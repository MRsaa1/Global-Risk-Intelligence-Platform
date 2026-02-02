"""
OVERSEER Service - System-wide monitoring AI.

Collects health, platform, alerts, and (optionally) events; evaluates rules;
optionally produces LLM executive_summary. Used by /oversee/status and background task.
"""
import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.core.config import settings
from src.core.database import AsyncSessionLocal
from src.core.resilience.circuit_breaker import get_circuit_breaker, get_all_circuit_breakers
from src.core.resilience.retry import retry_with_backoff, RetryConfig

logger = logging.getLogger(__name__)


@dataclass
class SystemAlert:
    """System-level alert (infra, API, agent)."""
    code: str
    severity: str  # critical, high, warning, info
    title: str
    message: str
    source: str  # e.g. database, redis, nvidia, cpu, alerts


def _get_health_checks():
    """Import health check functions (avoids circular import at module load)."""
    from src.api.v1.endpoints.health import (
        _check_redis,
        _check_database,
        _check_neo4j,
        _check_external_apis,
        _get_system_metrics,
    )
    return _check_redis, _check_database, _check_neo4j, _check_external_apis, _get_system_metrics


def _get_sentinel_alerts():
    from src.layers.agents.sentinel import sentinel_agent
    return sentinel_agent.get_active_alerts()


def _get_sentinel_monitoring_flag():
    from src.api.v1.endpoints.alerts import _is_monitoring
    return _is_monitoring


async def _fetch_platform_metrics() -> dict:
    """Fetch platform layer metrics using DB session."""
    from src.api.v1.endpoints.platform import (
        format_count,
        get_layer0_metrics,
        get_layer1_metrics,
        get_layer2_metrics,
        get_layer3_metrics,
        get_layer4_metrics,
        get_layer5_metrics,
    )
    now = datetime.utcnow()
    async with AsyncSessionLocal() as db:
        l0_count, l0_details = await get_layer0_metrics(db)
        l1_count, l1_details = await get_layer1_metrics(db)
        l2_count, l2_details = await get_layer2_metrics(db)
        l3_count, l3_details = await get_layer3_metrics(db)
        l4_count, l4_details = get_layer4_metrics()
        l5_version, l5_details = get_layer5_metrics()

    layers = [
        {"layer": 0, "name": "Verified Truth", "status": "active", "count_raw": l0_count},
        {"layer": 1, "name": "Digital Twins", "status": "active", "count_raw": l1_count},
        {"layer": 2, "name": "Network Intelligence", "status": "active", "count_raw": l2_count},
        {"layer": 3, "name": "Simulation Engine", "status": "active", "count_raw": l3_count},
        {"layer": 4, "name": "Autonomous Agents", "status": "beta", "count_raw": l4_count},
        {"layer": 5, "name": "Protocol (PARS)", "status": "dev", "count_raw": 0},
    ]
    total_records = l0_count + l1_count + l2_count + l3_count
    return {
        "layers": layers,
        "total_records": total_records,
        "system_health": "healthy",
        "last_sync": now.isoformat(),
        "layer4_details": l4_details,
    }


class OverseerService:
    """
    System-wide monitoring: collect snapshot, evaluate rules, optional LLM summary.
    """

    def __init__(self):
        self._last_snapshot: Optional[Dict[str, Any]] = None
        self._last_system_alerts: List[SystemAlert] = []
        self._last_status: str = "healthy"
        self._last_timestamp: Optional[str] = None
        self._last_executive_summary: str = ""
        self._last_executive_sources: List[Dict[str, Any]] = []
        self._auto_resolution_actions: List[str] = []  # Track auto-resolved issues

    async def collect_snapshot(self, include_events: bool = True) -> Dict[str, Any]:
        """
        Collect health, platform, alerts, and optionally recent events.
        """
        (
            _check_redis,
            _check_database,
            _check_neo4j,
            _check_external_apis,
            _get_system_metrics,
        ) = _get_health_checks()

        redis_status, db_status, neo4j_status, external_apis, system_metrics = await asyncio.gather(
            _check_redis(),
            _check_database(),
            _check_neo4j(),
            _check_external_apis(),
            _get_system_metrics(),
        )

        try:
            sentinel_monitoring = _get_sentinel_monitoring_flag()
        except Exception:
            sentinel_monitoring = False

        sentinel_status = {
            "monitoring": sentinel_monitoring,
            "status": "active" if sentinel_monitoring else "stopped",
        }

        platform_metrics = await _fetch_platform_metrics()
        alerts = _get_sentinel_alerts()

        alerts_summary = {
            "total": len(alerts),
            "critical": len([a for a in alerts if str(a.severity) == "critical"]),
            "high": len([a for a in alerts if str(a.severity) == "high"]),
            "warning": len([a for a in alerts if str(a.severity) == "warning"]),
            "info": len([a for a in alerts if str(a.severity) == "info"]),
        }
        newest = alerts[0] if alerts else None
        if newest:
            alerts_summary["newest_alert"] = {
                "id": str(newest.id),
                "alert_type": str(newest.alert_type),
                "severity": str(newest.severity),
                "title": newest.title,
            }
        else:
            alerts_summary["newest_alert"] = None

        events_slice: List[Dict[str, Any]] = []
        if include_events:
            try:
                from src.services.event_emitter import event_emitter
                recent = event_emitter.get_recent_events(limit=100)
                events_slice = [
                    {"event_type": e.event_type, "entity_type": e.entity_type, "action": e.action}
                    for e in recent
                ]
            except Exception as e:
                logger.debug("Overseer: could not get recent events: %s", e)

        # NEW: Collect detailed checks
        databases = await self._collect_database_checks()
        services = await self._collect_service_checks()
        modules = await self._check_strategic_modules()
        agents = await self._check_agents()
        endpoints = await self._check_all_endpoints()
        nvidia = await self._check_nvidia_services()
        performance = await self._check_performance_metrics()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "health": {
                "status": "healthy" if db_status.get("status") == "connected" and
                          redis_status.get("status") in ("connected", "fallback") else "degraded",
                "services": {
                    "database": db_status,
                    "neo4j": neo4j_status,
                    "redis": redis_status,
                    "sentinel": sentinel_status,
                },
                "external_apis": external_apis,
                "system": system_metrics,
            },
            "platform": platform_metrics,
            "alerts": alerts_summary,
            "events_last_100": events_slice,
            # NEW: Detailed checks
            "databases": databases,
            "services": services,
            "modules": modules,
            "agents": agents,
            "endpoints": endpoints,
            "nvidia": nvidia,
            "performance": performance,
        }

    def evaluate_rules(self, snapshot: Dict[str, Any]) -> List[SystemAlert]:
        """
        Evaluate rules on snapshot, return system-level alerts.
        """
        alerts: List[SystemAlert] = []
        health = snapshot.get("health", {})
        services = health.get("services", {})
        external = health.get("external_apis", {})
        system = health.get("system", {}) or {}
        platform = snapshot.get("platform", {})
        alerts_summary = snapshot.get("alerts", {})

        if services.get("database", {}).get("status") != "connected":
            alerts.append(SystemAlert(
                code="infra_database",
                severity="critical",
                title="Database unavailable",
                message="Database check did not return connected.",
                source="database",
            ))

        redis_s = services.get("redis", {}).get("status")
        if redis_s not in ("connected", "fallback"):
            alerts.append(SystemAlert(
                code="infra_redis",
                severity="high" if redis_s == "error" else "warning",
                title="Redis issue",
                message=f"Redis status: {redis_s}.",
                source="redis",
            ))

        # Neo4j is optional (Knowledge Graph); app runs with Mock when unavailable.
        # Do not add a system alert for neo4j "error" — it would alarm operators
        # while the platform is fully functional. Status remains in health/checks.

        cpu = system.get("cpu_percent")
        if cpu is not None and cpu > 90:
            alerts.append(SystemAlert(
                code="system_cpu",
                severity="high" if cpu > 95 else "warning",
                title="High CPU",
                message=f"Process CPU at {cpu}%.",
                source="cpu",
            ))

        mem = system.get("memory_mb")
        if mem is not None and mem > 2048:
            alerts.append(SystemAlert(
                code="system_memory",
                severity="warning",
                title="High memory",
                message=f"Process memory {mem} MB.",
                source="memory",
            ))

        nv = external.get("nvidia", {})
        if nv.get("status") == "not_configured" and settings.nvidia_api_key:
            pass
        elif nv.get("status") == "error":
            alerts.append(SystemAlert(
                code="api_nvidia",
                severity="warning",
                title="NVIDIA API error",
                message=nv.get("error", "NVIDIA API check failed."),
                source="nvidia",
            ))

        total_a = alerts_summary.get("total", 0)
        crit_a = alerts_summary.get("critical", 0)
        high_a = alerts_summary.get("high", 0)
        if crit_a >= 5 or (crit_a + high_a) >= 15:
            alerts.append(SystemAlert(
                code="alerts_spike",
                severity="high" if crit_a >= 5 else "warning",
                title="Domain alerts spike",
                message=f"Critical: {crit_a}, High: {high_a}, Total: {total_a}.",
                source="alerts",
            ))

        if platform.get("system_health") != "healthy":
            alerts.append(SystemAlert(
                code="platform_health",
                severity="warning",
                title="Platform health degraded",
                message=f"system_health={platform.get('system_health', 'unknown')}.",
                source="platform",
            ))

        # NEW: Database rules
        databases = snapshot.get("databases", {})
        if databases.get("postgresql", {}).get("status") != "connected":
            alerts.append(SystemAlert(
                code="database_postgresql",
                severity="critical",
                title="PostgreSQL unavailable",
                message="PostgreSQL database is not connected.",
                source="database",
            ))
        
        if getattr(settings, "enable_neo4j", False) and databases.get("neo4j", {}).get("status") == "error":
            alerts.append(SystemAlert(
                code="database_neo4j",
                severity="high",
                title="Neo4j error",
                message=databases.get("neo4j", {}).get("error", "Neo4j check failed"),
                source="database",
            ))
        
        if databases.get("redis", {}).get("status") == "error":
            alerts.append(SystemAlert(
                code="database_redis",
                severity="high",
                title="Redis error",
                message=databases.get("redis", {}).get("error", "Redis check failed"),
                source="database",
            ))
        
        # NEW: Service rules
        services = snapshot.get("services", {})
        if getattr(settings, "enable_neo4j", False) and services.get("knowledge_graph", {}).get("status") != "healthy":
            alerts.append(SystemAlert(
                code="service_kg",
                severity="high",
                title="Knowledge Graph service unhealthy",
                message="Knowledge Graph service is not responding correctly.",
                source="service",
            ))
        
        if services.get("cascade_engine", {}).get("status") != "healthy":
            alerts.append(SystemAlert(
                code="service_cascade",
                severity="warning",
                title="Cascade Engine unhealthy",
                message="Cascade Engine is not responding correctly.",
                source="service",
            ))
        
        # NEW: Module rules
        modules = snapshot.get("modules", {})
        for module_name, module_status in modules.items():
            if module_status.get("status") == "error":
                alerts.append(SystemAlert(
                    code=f"module_{module_name}",
                    severity="high",
                    title=f"{module_name.upper()} module error",
                    message=module_status.get("error", "Unknown error"),
                    source="module",
                ))
        
        # NEW: Endpoint rules
        endpoints = snapshot.get("endpoints", {})
        for endpoint_name, endpoint_status in endpoints.items():
            if isinstance(endpoint_status, dict):
                error_rate = endpoint_status.get("error_rate", 0)
                avg_duration = endpoint_status.get("avg_duration_ms", 0)
                
                if error_rate > 0.1:  # >10% errors
                    alerts.append(SystemAlert(
                        code=f"endpoint_{endpoint_name}",
                        severity="high",
                        title=f"{endpoint_name} endpoint high error rate",
                        message=f"Error rate: {error_rate*100:.1f}%",
                        source="api",
                    ))
                
                if avg_duration > 5000:  # >5 seconds
                    alerts.append(SystemAlert(
                        code=f"endpoint_{endpoint_name}_slow",
                        severity="warning",
                        title=f"{endpoint_name} endpoint slow",
                        message=f"Average response time: {avg_duration:.0f}ms",
                        source="api",
                    ))
        
        # NEW: Performance rules
        performance = snapshot.get("performance", {})
        if performance:
            endpoints_perf = performance.get("endpoints", {})
            if endpoints_perf:
                avg_response_time = endpoints_perf.get("avg_response_time_ms", 0)
                avg_error_rate = endpoints_perf.get("avg_error_rate", 0)
                
                if avg_response_time > 3000:  # >3 seconds average
                    alerts.append(SystemAlert(
                        code="performance_slow",
                        severity="warning",
                        title="System performance degraded",
                        message=f"Average response time: {avg_response_time:.0f}ms",
                        source="performance",
                    ))
                
                if avg_error_rate > 0.05:  # >5% error rate
                    alerts.append(SystemAlert(
                        code="performance_high_error_rate",
                        severity="high",
                        title="High error rate across endpoints",
                        message=f"Average error rate: {avg_error_rate*100:.1f}%",
                        source="performance",
                    ))
            
            system_perf = performance.get("system", {})
            if system_perf:
                cpu = system_perf.get("cpu_percent")
                memory_percent = system_perf.get("memory_percent")
                
                if cpu and cpu > 90:
                    alerts.append(SystemAlert(
                        code="performance_cpu_high",
                        severity="warning" if cpu < 95 else "high",
                        title="High CPU usage",
                        message=f"CPU usage: {cpu:.1f}%",
                        source="performance",
                    ))
                
                if memory_percent and memory_percent > 85:
                    alerts.append(SystemAlert(
                        code="performance_memory_high",
                        severity="warning",
                        title="High memory usage",
                        message=f"Memory usage: {memory_percent:.1f}%",
                        source="performance",
                    ))
        
        # NEW: Circuit Breaker rules
        circuit_breakers = get_all_circuit_breakers()
        for cb_name, cb_state in circuit_breakers.items():
            if cb_state.get("state") == "open":
                # Skip optional services when disabled
                if cb_name == "neo4j" and not getattr(settings, "enable_neo4j", False):
                    continue
                if cb_name == "minio" and not getattr(settings, "enable_minio", False):
                    continue
                if cb_name == "timescale" and not getattr(settings, "enable_timescale", False):
                    continue
                alerts.append(SystemAlert(
                    code=f"circuit_breaker_{cb_name}",
                    severity="high",
                    title=f"Circuit breaker {cb_name} is OPEN",
                    message=f"Service {cb_name} is failing. Circuit breaker opened after {cb_state.get('failure_count', 0)} failures.",
                    source="circuit_breaker",
                ))
        
        return alerts

    async def _collect_database_checks(self) -> Dict[str, Any]:
        """Collect detailed database checks with Circuit Breaker and Retry."""
        databases = {}
        
        # PostgreSQL - with Circuit Breaker and Retry
        postgres_breaker = get_circuit_breaker("postgresql", failure_threshold=3, timeout=30)
        try:
            from src.core.database import engine
            from sqlalchemy import text
            
            async def check_postgres():
                async with engine.connect() as conn:
                    start = time.time()
                    await conn.execute(text("SELECT 1"))
                    query_time = (time.time() - start) * 1000
                    
                    # Get table sizes and stats
                    try:
                        result = await conn.execute(text("""
                            SELECT 
                                schemaname,
                                tablename,
                                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                                pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
                            FROM pg_tables
                            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                            LIMIT 10
                        """))
                        table_sizes = [dict(row._mapping) for row in result]
                    except:
                        table_sizes = []
                    
                    # Get connection pool stats
                    pool = engine.pool
                    pool_stats = {
                        "size": pool.size() if hasattr(pool, 'size') else None,
                        "checked_in": pool.checkedin() if hasattr(pool, 'checkedin') else None,
                        "checked_out": pool.checkedout() if hasattr(pool, 'checkedout') else None,
                        "overflow": pool.overflow() if hasattr(pool, 'overflow') else None,
                    }
                    
                    return {
                        "status": "connected",
                        "query_time_ms": round(query_time, 2),
                        "table_sizes": table_sizes,
                        "pool_stats": pool_stats,
                    }
            
            # Use Circuit Breaker
            try:
                result = await postgres_breaker.call(check_postgres)
                databases["postgresql"] = result
            except Exception as breaker_error:
                # Circuit breaker is open or error occurred
                databases["postgresql"] = {
                    "status": "error",
                    "error": str(breaker_error),
                    "circuit_state": postgres_breaker.get_state()["state"],
                }
        except Exception as e:
            databases["postgresql"] = {"status": "error", "error": str(e)}
        
        # Neo4j - optional (disable to avoid auth rate-limit noise when not configured)
        if not getattr(settings, "enable_neo4j", False):
            databases["neo4j"] = {"status": "disabled"}
        else:
            neo4j_breaker = get_circuit_breaker("neo4j", failure_threshold=3, timeout=30)
            try:
                from src.services.knowledge_graph import get_knowledge_graph_service
                kg_service = get_knowledge_graph_service()
                
                async def check_neo4j():
                    start = time.time()
                    async with kg_service.driver.session() as session:
                        # Get node counts by label
                        result = await session.run("""
                            MATCH (n)
                            RETURN labels(n)[0] as label, count(n) as count
                            ORDER BY count DESC
                            LIMIT 20
                        """)
                        # Neo4j AsyncResult is NOT sync-iterable; use .data() for async + mock compatibility
                        node_rows = await result.data()
                        node_counts = {
                            row.get("label", "Unknown"): row.get("count", 0)
                            for row in (node_rows or [])
                            if row.get("label") is not None
                        }
                        
                        # Get relationship counts
                        rel_result = await session.run("""
                            MATCH ()-[r]->()
                            RETURN type(r) as type, count(r) as count
                            ORDER BY count DESC
                            LIMIT 20
                        """)
                        rel_rows = await rel_result.data()
                        relationship_counts = {
                            row.get("type", "UNKNOWN"): row.get("count", 0)
                            for row in (rel_rows or [])
                            if row.get("type") is not None
                        }
                        
                    query_time = (time.time() - start) * 1000
                    
                    return {
                        "status": "connected",
                        "query_time_ms": round(query_time, 2),
                        "node_counts": node_counts,
                        "relationship_counts": relationship_counts,
                    }
                
                # Use Circuit Breaker with Retry
                try:
                    async def call_with_breaker():
                        return await neo4j_breaker.call(check_neo4j)
                    
                    retry_config = RetryConfig(max_attempts=2, initial_delay=0.5)
                    result = await retry_with_backoff(call_with_breaker, retry_config)
                    databases["neo4j"] = result
                except Exception as breaker_error:
                    databases["neo4j"] = {
                        "status": "error",
                        "error": str(breaker_error),
                        "circuit_state": neo4j_breaker.get_state()["state"],
                    }
            except Exception as e:
                databases["neo4j"] = {"status": "error", "error": str(e)}
        
        # Redis - with Circuit Breaker and Retry
        redis_breaker = get_circuit_breaker("redis", failure_threshold=3, timeout=30)
        try:
            from src.services.cache import get_cache
            cache = await get_cache()
            
            async def check_redis():
                # Check if Redis is connected
                if hasattr(cache, '_client') and cache._client:
                    await cache._client.ping()
                    
                    # Get Redis info
                    try:
                        info = await cache._client.info()
                        return {
                            "status": "connected",
                            "backend": "redis",
                            "memory_used_mb": round(info.get("used_memory", 0) / 1024 / 1024, 2),
                            "keys": info.get("db0", {}).get("keys", 0) if isinstance(info.get("db0"), dict) else 0,
                            "hits": info.get("keyspace_hits", 0),
                            "misses": info.get("keyspace_misses", 0),
                        }
                    except:
                        return {"status": "connected", "backend": "redis"}
                elif hasattr(cache, '_connected'):
                    # RedisCache with fallback
                    return {
                        "status": "connected" if cache._connected else "fallback",
                        "backend": "redis" if cache._connected else "memory",
                    }
                else:
                    # InMemoryCache fallback
                    stats = cache.stats() if hasattr(cache, 'stats') else {}
                    return {
                        "status": "fallback",
                        "backend": "memory",
                        "stats": stats,
                    }
            
            # Use Circuit Breaker with Retry
            try:
                async def call_with_breaker():
                    return await redis_breaker.call(check_redis)
                
                retry_config = RetryConfig(max_attempts=2, initial_delay=0.5)
                result = await retry_with_backoff(call_with_breaker, retry_config)
                databases["redis"] = result
            except Exception as breaker_error:
                databases["redis"] = {
                    "status": "error",
                    "error": str(breaker_error),
                    "circuit_state": redis_breaker.get_state()["state"],
                    "fallback": "memory",
                }
        except Exception as e:
            databases["redis"] = {"status": "error", "error": str(e), "fallback": "memory"}
        
        # MinIO - optional
        if not getattr(settings, "enable_minio", False):
            databases["minio"] = {"status": "disabled"}
        else:
            minio_breaker = get_circuit_breaker("minio", failure_threshold=3, timeout=30)
            try:
                from minio import Minio
            except Exception as e:
                databases["minio"] = {"status": "error", "error": str(e)}
            else:
                async def check_minio():
                    client = Minio(
                        settings.minio_endpoint,
                        access_key=settings.minio_access_key,
                        secret_key=settings.minio_secret_key,
                        secure=settings.minio_secure,
                    )

                    # Lightweight connectivity check (avoid heavy object listing)
                    buckets = client.list_buckets()
                    bucket_names = [b.name for b in (buckets or []) if getattr(b, "name", None)]

                    return {
                        "status": "connected",
                        "bucket_count": len(bucket_names),
                        "buckets": bucket_names[:20],
                    }

                # Use Circuit Breaker with Retry
                try:
                    async def call_with_breaker():
                        return await minio_breaker.call(check_minio)

                    retry_config = RetryConfig(max_attempts=2, initial_delay=0.5)
                    result = await retry_with_backoff(call_with_breaker, retry_config)
                    databases["minio"] = result
                except Exception as breaker_error:
                    databases["minio"] = {
                        "status": "error",
                        "error": str(breaker_error),
                        "circuit_state": minio_breaker.get_state()["state"],
                    }
        
        # TimescaleDB - optional
        if not getattr(settings, "enable_timescale", False):
            databases["timescale"] = {"status": "disabled"}
        else:
            timescale_url = getattr(settings, "timescale_url", None)
            if not timescale_url:
                databases["timescale"] = {"status": "not_configured"}
            else:
                timescale_breaker = get_circuit_breaker("timescale", failure_threshold=3, timeout=30)

                async def check_timescale():
                    # Timescale checks are best-effort; use sync SQLAlchemy engine here.
                    from sqlalchemy import create_engine, text

                    url = timescale_url
                    # If an async driver is configured, downgrade to sync for create_engine.
                    if isinstance(url, str) and "+asyncpg" in url:
                        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)

                    engine = create_engine(url, pool_pre_ping=True)
                    try:
                        with engine.connect() as conn:
                            conn.execute(text("SELECT 1"))
                        return {"status": "connected"}
                    finally:
                        engine.dispose()

                try:
                    async def call_with_breaker():
                        return await timescale_breaker.call(check_timescale)

                    retry_config = RetryConfig(max_attempts=2, initial_delay=0.5)
                    result = await retry_with_backoff(call_with_breaker, retry_config)
                    databases["timescale"] = result
                except Exception as breaker_error:
                    databases["timescale"] = {
                        "status": "error",
                        "error": str(breaker_error),
                        "circuit_state": timescale_breaker.get_state()["state"],
                    }
        
        return databases

    async def _collect_service_checks(self) -> Dict[str, Any]:
        """Collect detailed service checks."""
        services = {}
        
        # Knowledge Graph Service (optional)
        if not getattr(settings, "enable_neo4j", False):
            services["knowledge_graph"] = {"status": "disabled", "available": False}
        else:
            try:
                from src.services.knowledge_graph import get_knowledge_graph_service
                kg_service = get_knowledge_graph_service()
                
                # Check if Neo4j is available by trying a query
                try:
                    start = time.time()
                    async with kg_service.driver.session() as session:
                        result = await session.run("MATCH (n:Asset) RETURN count(n) as count LIMIT 1")
                        await result.single()
                    query_time = (time.time() - start) * 1000
                    services["knowledge_graph"] = {
                        "status": "healthy",
                        "query_time_ms": round(query_time, 2),
                        "available": True,
                    }
                except Exception as kg_error:
                    services["knowledge_graph"] = {
                        "status": "unavailable",
                        "available": False,
                        "error": str(kg_error),
                    }
            except Exception as e:
                services["knowledge_graph"] = {"status": "error", "error": str(e)}
        
        # Cascade Engine
        try:
            from src.layers.simulation.cascade_engine import CascadeEngine
            engine = CascadeEngine()
            
            # Test small simulation
            start = time.time()
            result = await engine.simulate(
                trigger_node_id="test",
                num_runs=10,  # Small test
            )
            sim_time = (time.time() - start) * 1000
            services["cascade_engine"] = {
                "status": "healthy",
                "test_simulation_time_ms": round(sim_time, 2),
                "default_runs": engine.default_runs,
            }
        except Exception as e:
            services["cascade_engine"] = {"status": "error", "error": str(e)}
        
        # Simulation Engines
        engines_status = {}
        
        # Physics Engine
        try:
            from src.layers.simulation.physics_engine import PhysicsEngine
            physics = PhysicsEngine()
            engines_status["physics"] = {"status": "healthy"}
        except Exception as e:
            engines_status["physics"] = {"status": "error", "error": str(e)}
        
        # Climate Engine
        try:
            from src.services.climate_service import climate_service
            engines_status["climate"] = {"status": "healthy"}
        except Exception as e:
            engines_status["climate"] = {"status": "error", "error": str(e)}
        
        # Economics Engine
        try:
            # Try to import financial models service
            try:
                from src.services.financial_models import financial_models_service
                engines_status["economics"] = {"status": "healthy"}
            except ImportError:
                # Fallback if service doesn't exist yet
                engines_status["economics"] = {"status": "not_implemented"}
        except Exception as e:
            engines_status["economics"] = {"status": "error", "error": str(e)}
        
        services["simulation_engines"] = engines_status
        
        return services

    async def _check_strategic_modules(self) -> Dict[str, Any]:
        """Check all strategic modules."""
        modules_status = {}
        
        # CIP Module
        try:
            from src.modules.cip.module import CIPModule
            cip = CIPModule()
            modules_status["cip"] = {
                "status": "active",
                "version": cip.version,
                "access_level": cip.access_level.value,
            }
        except Exception as e:
            modules_status["cip"] = {"status": "error", "error": str(e)}
        
        # SCSS Module
        try:
            from src.modules.scss.module import SCSSModule
            scss = SCSSModule()
            modules_status["scss"] = {
                "status": "active",
                "version": scss.version,
            }
        except Exception as e:
            modules_status["scss"] = {"status": "error", "error": str(e)}
        
        # SRO Module
        try:
            from src.modules.sro.module import SROModule
            sro = SROModule()
            modules_status["sro"] = {
                "status": "active",
                "version": sro.version,
            }
        except Exception as e:
            modules_status["sro"] = {"status": "error", "error": str(e)}
        
        return modules_status

    async def _check_agents(self) -> Dict[str, Any]:
        """Check all agents health."""
        agents_status = {}
        
        # SENTINEL
        try:
            from src.layers.agents.sentinel import sentinel_agent
            agents_status["sentinel"] = {
                "status": "active",
                "active_alerts": len(sentinel_agent.active_alerts),
                "rules_count": len(sentinel_agent.rules),
            }
        except Exception as e:
            agents_status["sentinel"] = {"status": "error", "error": str(e)}
        
        # ANALYST
        try:
            from src.layers.agents.analyst import analyst_agent
            agents_status["analyst"] = {"status": "active"}
        except Exception as e:
            agents_status["analyst"] = {"status": "error", "error": str(e)}
        
        # ADVISOR
        try:
            from src.layers.agents.advisor import advisor_agent
            agents_status["advisor"] = {"status": "active"}
        except Exception as e:
            agents_status["advisor"] = {"status": "error", "error": str(e)}
        
        # REPORTER
        try:
            from src.layers.agents.reporter import reporter_agent
            agents_status["reporter"] = {"status": "active"}
        except Exception as e:
            agents_status["reporter"] = {"status": "error", "error": str(e)}
        
        return agents_status

    async def _check_all_endpoints(self) -> Dict[str, Any]:
        """Check all API endpoints health."""
        try:
            from src.core.middleware.oversee_middleware import get_endpoint_metrics
            return get_endpoint_metrics()
        except Exception as e:
            logger.warning(f"Overseer: could not get endpoint metrics: {e}")
            return {}

    async def _check_nvidia_services(self) -> Dict[str, Any]:
        """Check all NVIDIA services."""
        nvidia_status = {}
        
        # NVIDIA LLM
        try:
            from src.services.nvidia_llm import llm_service
            nvidia_status["llm"] = {
                "status": "configured" if llm_service.is_available else "not_configured",
                "available": llm_service.is_available,
                "mode": getattr(llm_service, "mode", None),
            }
        except Exception as e:
            nvidia_status["llm"] = {"status": "error", "error": str(e)}
        
        # NVIDIA NIM (FourCastNet, CorrDiff)
        if not getattr(settings, "use_local_nim", False):
            nvidia_status["nim"] = {"status": "disabled", "enabled": False}
        else:
            try:
                from src.services.nvidia_nim import nim_service
                fourcastnet_healthy = await nim_service.check_health("fourcastnet")
                corrdiff_healthy = await nim_service.check_health("corrdiff")
                nvidia_status["nim"] = {
                    "status": "enabled",
                    "enabled": True,
                    "fourcastnet": "healthy" if fourcastnet_healthy else "unhealthy",
                    "corrdiff": "healthy" if corrdiff_healthy else "unhealthy",
                }
            except Exception as e:
                nvidia_status["nim"] = {"status": "error", "error": str(e), "enabled": True}
        
        # NVIDIA PhysicsNeMo
        try:
            # PhysicsNeMo is optional; treat import/runtime issues as "disabled/not configured"
            from src.services.nvidia_physics_nemo import physics_nemo_service

            configured = bool((getattr(settings, "nvidia_api_key", "") or "").strip())
            # This service uses cloud API key today; later can be switched to GPU/NIM.
            nvidia_status["physics_nemo"] = {
                "status": "configured" if configured else "not_configured",
                "available": configured,
            }
        except ImportError:
            nvidia_status["physics_nemo"] = {"status": "disabled", "available": False}
        except Exception as e:
            # Don't alarm Overseer; surface as unavailable with a short reason.
            nvidia_status["physics_nemo"] = {"status": "unavailable", "available": False, "error": str(e)[:200]}
        
        return nvidia_status

    async def _check_performance_metrics(self) -> Dict[str, Any]:
        """Check performance metrics: response times, throughput, resource usage."""
        performance = {}
        
        # Get endpoint metrics
        try:
            from src.core.middleware.oversee_middleware import get_endpoint_metrics
            endpoint_metrics = get_endpoint_metrics()
            
            if endpoint_metrics:
                # Calculate aggregate metrics
                all_durations = [
                    v.get("avg_duration_ms", 0)
                    for v in endpoint_metrics.values()
                    if isinstance(v, dict) and v.get("avg_duration_ms", 0) > 0
                ]
                all_error_rates = [
                    v.get("error_rate", 0)
                    for v in endpoint_metrics.values()
                    if isinstance(v, dict)
                ]
                
                performance["endpoints"] = {
                    "total_endpoints": len(endpoint_metrics),
                    "avg_response_time_ms": round(sum(all_durations) / len(all_durations), 2) if all_durations else 0,
                    "max_response_time_ms": round(max(all_durations), 2) if all_durations else 0,
                    "min_response_time_ms": round(min(all_durations), 2) if all_durations else 0,
                    "avg_error_rate": round(sum(all_error_rates) / len(all_error_rates), 4) if all_error_rates else 0,
                    "total_requests": sum(v.get("count", 0) for v in endpoint_metrics.values() if isinstance(v, dict)),
                    "total_errors": sum(v.get("error_count", 0) for v in endpoint_metrics.values() if isinstance(v, dict)),
                }
        except Exception as e:
            logger.warning(f"Overseer: could not get performance metrics: {e}")
            performance["endpoints"] = {"error": str(e)}
        
        # System resource metrics
        try:
            import psutil
            process = psutil.Process()
            
            # CPU
            cpu_percent = process.cpu_percent(interval=0.1)
            cpu_times = process.cpu_times()
            
            # Memory
            memory_info = process.memory_info()
            memory_percent = process.memory_percent()
            
            # Disk I/O
            try:
                disk_io = process.io_counters()
            except:
                disk_io = None
            
            # Network (if available)
            try:
                net_io = psutil.net_io_counters()
            except:
                net_io = None
            
            performance["system"] = {
                "cpu_percent": round(cpu_percent, 1),
                "cpu_user_time": round(cpu_times.user, 2),
                "cpu_system_time": round(cpu_times.system, 2),
                "memory_mb": round(memory_info.rss / 1024 / 1024, 2),
                "memory_percent": round(memory_percent, 1),
                "memory_vms_mb": round(memory_info.vms / 1024 / 1024, 2),
                "threads": process.num_threads(),
                "open_files": len(process.open_files()) if hasattr(process, 'open_files') else None,
                "disk_read_mb": round(disk_io.read_bytes / 1024 / 1024, 2) if disk_io else None,
                "disk_write_mb": round(disk_io.write_bytes / 1024 / 1024, 2) if disk_io else None,
                "network_sent_mb": round(net_io.bytes_sent / 1024 / 1024, 2) if net_io else None,
                "network_recv_mb": round(net_io.bytes_recv / 1024 / 1024, 2) if net_io else None,
            }
        except Exception as e:
            logger.warning(f"Overseer: could not get system metrics: {e}")
            performance["system"] = {"error": str(e)}
        
        # Database performance
        try:
            db_perf = {}
            
            # Get database checks to access performance data
            databases = await self._collect_database_checks()
            
            # PostgreSQL query time
            if databases.get("postgresql", {}).get("status") == "connected":
                db_perf["postgresql"] = {
                    "query_time_ms": databases["postgresql"].get("query_time_ms", 0),
                    "pool_size": databases["postgresql"].get("pool_stats", {}).get("size"),
                    "pool_checked_out": databases["postgresql"].get("pool_stats", {}).get("checked_out"),
                }
            
            # Neo4j query time
            if databases.get("neo4j", {}).get("status") == "connected":
                db_perf["neo4j"] = {
                    "query_time_ms": databases["neo4j"].get("query_time_ms", 0),
                }
            
            performance["databases"] = db_perf
        except Exception as e:
            logger.warning(f"Overseer: could not get database performance: {e}")
        
        return performance

    async def auto_resolve_issues(self, system_alerts: List[SystemAlert]) -> List[str]:
        """Automatically resolve issues where possible."""
        actions_taken = []
        
        for alert in system_alerts:
            if alert.code in ("infra_redis", "database_redis") and alert.severity in ("warning", "high"):
                # Try to reconnect Redis
                try:
                    from src.services.cache import get_cache
                    cache = await get_cache()
                    # Try to reconnect if it's RedisCache
                    if hasattr(cache, 'connect'):
                        connected = await cache.connect()
                        if connected:
                            actions_taken.append("✅ Redis reconnected successfully")
                        else:
                            actions_taken.append("⚠️ Redis reconnection failed, using memory fallback")
                    elif hasattr(cache, '_client') and cache._client:
                        await cache._client.ping()
                        actions_taken.append("✅ Redis connection verified")
                except Exception as e:
                    logger.warning(f"Overseer: Redis reconnection failed: {e}")
                    actions_taken.append(f"❌ Redis reconnection failed: {str(e)[:50]}")
            
            elif alert.code == "database_postgresql" and alert.severity == "critical":
                # Try to reconnect PostgreSQL with Circuit Breaker and Retry
                try:
                    postgres_breaker = get_circuit_breaker("postgresql")
                    if postgres_breaker.get_state()["state"] == "open":
                        await postgres_breaker.reset()
                        actions_taken.append("✅ PostgreSQL circuit breaker reset")
                    
                    async def reconnect_postgres():
                        from src.core.database import engine
                        from sqlalchemy import text
                        async with engine.connect() as conn:
                            await conn.execute(text("SELECT 1"))
                        return True
                    
                    retry_config = RetryConfig(max_attempts=3, initial_delay=2.0)
                    await retry_with_backoff(reconnect_postgres, retry_config)
                    actions_taken.append("✅ PostgreSQL reconnection successful")
                except Exception as e:
                    logger.warning(f"Overseer: PostgreSQL reconnection failed: {e}")
                    actions_taken.append(f"❌ PostgreSQL reconnection failed: {str(e)[:50]}")
            
            elif alert.code == "database_neo4j" and alert.severity == "high":
                # Try to reconnect Neo4j with Circuit Breaker
                try:
                    neo4j_breaker = get_circuit_breaker("neo4j")
                    if neo4j_breaker.get_state()["state"] == "open":
                        # Reset circuit breaker to allow retry
                        await neo4j_breaker.reset()
                        actions_taken.append("✅ Neo4j circuit breaker reset, will retry")
                    
                    from src.services.knowledge_graph import get_knowledge_graph_service
                    kg_service = get_knowledge_graph_service()
                    async with kg_service.driver.session() as session:
                        await session.run("RETURN 1 as test")
                    actions_taken.append("✅ Neo4j reconnection successful")
                except Exception as e:
                    logger.warning(f"Overseer: Neo4j reconnection failed: {e}")
                    actions_taken.append(f"⚠️ Neo4j unavailable, using mock fallback")
            
            elif alert.code == "system_memory" and alert.severity == "warning":
                # Auto cleanup cache
                try:
                    from src.services.cache import get_cache
                    cache = await get_cache()
                    if hasattr(cache, 'cleanup_expired'):
                        cleaned = await cache.cleanup_expired()
                        actions_taken.append(f"✅ Cache cleanup: removed {cleaned} expired entries")
                    elif hasattr(cache, 'clear_pattern'):
                        # Clear old cache entries
                        cleared = await cache.clear_pattern("risk_scores:*")
                        actions_taken.append(f"✅ Cache cleared: {cleared} risk_scores entries")
                    else:
                        actions_taken.append("⚠️ Cache cleanup suggested (manual action required)")
                except Exception as e:
                    logger.warning(f"Overseer: Cache cleanup failed: {e}")
            
            elif alert.code == "performance_slow" or alert.code == "performance_high_error_rate":
                # Performance degradation - log for analysis
                actions_taken.append("📊 Performance issue logged for analysis")
            
            elif alert.code == "performance_cpu_high" or alert.code == "performance_memory_high":
                # High resource usage - suggest optimization
                actions_taken.append("⚡ High resource usage detected - consider scaling or optimization")
            
            elif alert.code.startswith("endpoint_") and "slow" in alert.code:
                # Log slow endpoint for optimization
                actions_taken.append(f"📊 Slow endpoint logged: {alert.message}")
            
            elif alert.code == "service_kg" and alert.severity == "high":
                # Knowledge Graph service issue - try to reconnect
                try:
                    from src.services.knowledge_graph import get_knowledge_graph_service
                    kg_service = get_knowledge_graph_service()
                    async with kg_service.driver.session() as session:
                        await session.run("RETURN 1 as test")
                    actions_taken.append("✅ Knowledge Graph service reconnected")
                except Exception as e:
                    actions_taken.append(f"⚠️ Knowledge Graph unavailable: {str(e)[:50]}")
            
            # Auto-fix circuit breaker issues for Minio
            elif alert.code == "circuit_breaker" and "minio" in alert.message.lower():
                try:
                    minio_breaker = get_circuit_breaker("minio")
                    if minio_breaker.get_state()["state"] == "open":
                        # Try to test MinIO connection before resetting
                        try:
                            try:
                                from src.services.storage import get_storage_service
                                storage = await get_storage_service()
                                # Try to list buckets as a connection test
                                await storage.list_buckets()
                                # If successful, reset circuit breaker
                                await minio_breaker.reset()
                                actions_taken.append("✅ MinIO circuit breaker reset (connection verified)")
                            except ImportError:
                                # Storage service not available, try direct MinIO connection
                                from minio import Minio
                                from src.core.config import settings
                                client = Minio(
                                    settings.minio_endpoint,
                                    access_key=settings.minio_access_key,
                                    secret_key=settings.minio_secret_key,
                                    secure=settings.minio_secure
                                )
                                client.list_buckets()
                                await minio_breaker.reset()
                                actions_taken.append("✅ MinIO circuit breaker reset (connection verified)")
                        except Exception as e:
                            actions_taken.append(f"⚠️ MinIO still unavailable: {str(e)[:50]}")
                except Exception as e:
                    logger.warning(f"Overseer: MinIO circuit breaker reset failed: {e}")
            
            # Auto-fix circuit breaker issues for Timescale
            elif alert.code == "circuit_breaker" and "timescale" in alert.message.lower():
                try:
                    timescale_breaker = get_circuit_breaker("timescale")
                    if timescale_breaker.get_state()["state"] == "open":
                        # Try to test Timescale connection before resetting
                        try:
                            try:
                                from src.core.database import timescale_engine
                                from sqlalchemy import text
                                async with timescale_engine.connect() as conn:
                                    await conn.execute(text("SELECT 1"))
                                # If successful, reset circuit breaker
                                await timescale_breaker.reset()
                                actions_taken.append("✅ Timescale circuit breaker reset (connection verified)")
                            except (ImportError, AttributeError):
                                # Timescale engine not available, try using main engine with timescale URL
                                from src.core.database import create_async_engine
                                from src.core.config import settings
                                from sqlalchemy import text
                                temp_engine = create_async_engine(settings.timescale_url)
                                async with temp_engine.connect() as conn:
                                    await conn.execute(text("SELECT 1"))
                                await temp_engine.dispose()
                                await timescale_breaker.reset()
                                actions_taken.append("✅ Timescale circuit breaker reset (connection verified)")
                        except Exception as e:
                            actions_taken.append(f"⚠️ Timescale still unavailable: {str(e)[:50]}")
                except Exception as e:
                    logger.warning(f"Overseer: Timescale circuit breaker reset failed: {e}")
            
            # General circuit breaker auto-reset (if service becomes available)
            elif alert.code == "circuit_breaker" and alert.severity == "high":
                # Extract service name from alert message
                service_name = None
                for svc in ["neo4j", "minio", "timescale", "postgresql", "redis"]:
                    if svc in alert.message.lower():
                        service_name = svc
                        break
                
                if service_name:
                    try:
                        breaker = get_circuit_breaker(service_name)
                        if breaker.get_state()["state"] == "open":
                            # Try to verify service is actually available before resetting
                            # This prevents resetting when service is still down
                            try:
                                if service_name == "neo4j":
                                    from src.services.knowledge_graph import get_knowledge_graph_service
                                    kg_service = get_knowledge_graph_service()
                                    async with kg_service.driver.session() as session:
                                        await session.run("RETURN 1 as test")
                                elif service_name == "minio":
                                    try:
                                        from src.services.storage import get_storage_service
                                        storage = await get_storage_service()
                                        await storage.list_buckets()
                                    except ImportError:
                                        # Fallback to direct MinIO connection
                                        from minio import Minio
                                        from src.core.config import settings
                                        client = Minio(
                                            settings.minio_endpoint,
                                            access_key=settings.minio_access_key,
                                            secret_key=settings.minio_secret_key,
                                            secure=settings.minio_secure
                                        )
                                        client.list_buckets()
                                elif service_name == "timescale":
                                    try:
                                        from src.core.database import timescale_engine
                                        from sqlalchemy import text
                                        async with timescale_engine.connect() as conn:
                                            await conn.execute(text("SELECT 1"))
                                    except (ImportError, AttributeError):
                                        # Fallback to direct connection
                                        from src.core.database import create_async_engine
                                        from src.core.config import settings
                                        from sqlalchemy import text
                                        temp_engine = create_async_engine(settings.timescale_url)
                                        async with temp_engine.connect() as conn:
                                            await conn.execute(text("SELECT 1"))
                                        await temp_engine.dispose()
                                elif service_name == "postgresql":
                                    from src.core.database import engine
                                    from sqlalchemy import text
                                    async with engine.connect() as conn:
                                        await conn.execute(text("SELECT 1"))
                                elif service_name == "redis":
                                    from src.services.cache import get_cache
                                    cache = await get_cache()
                                    if hasattr(cache, '_client') and cache._client:
                                        await cache._client.ping()
                                
                                # Service is available, reset circuit breaker
                                await breaker.reset()
                                actions_taken.append(f"✅ {service_name.capitalize()} circuit breaker reset (service verified)")
                            except Exception as e:
                                # Service is still unavailable, don't reset
                                actions_taken.append(f"⚠️ {service_name.capitalize()} still unavailable, circuit breaker remains open")
                    except Exception as e:
                        logger.warning(f"Overseer: Circuit breaker auto-reset failed for {service_name}: {e}")
        
        self._auto_resolution_actions = actions_taken
        if actions_taken:
            logger.info(f"Overseer: Auto-resolved {len(actions_taken)} issues")
        return actions_taken

    async def summarize_llm(self, snapshot: Dict[str, Any], system_alerts: List[SystemAlert]) -> str:
        """
        Produce executive_summary via NVIDIA LLM. On failure, return fallback string.
        """
        if not getattr(settings, "oversee_use_llm", True):
            self._last_executive_sources = []
            return self._fallback_summary(snapshot, system_alerts)

        try:
            from src.services.nvidia_llm import llm_service
        except Exception as e:
            logger.debug("Overseer: LLM not available: %s", e)
            self._last_executive_sources = []
            return self._fallback_summary(snapshot, system_alerts)

        if not getattr(llm_service, "is_available", False):
            self._last_executive_sources = []
            return self._fallback_summary(snapshot, system_alerts)

        try:
            from src.services.aiq_research_assistant import get_aiq_assistant
            aiq = get_aiq_assistant()
            result = await aiq.overseer_summary(
                snapshot=snapshot,
                system_alerts=[{"code": a.code, "severity": a.severity, "title": a.title, "source": a.source} for a in system_alerts],
            )
            # Expose sources to UI
            self._last_executive_sources = [
                {
                    "id": s.id,
                    "kind": s.kind,
                    "title": s.title,
                    "snippet": s.snippet,
                    "url": s.url,
                }
                for s in (result.sources or [])
            ]
            return result.text or self._fallback_summary(snapshot, system_alerts)
        except Exception as e:
            logger.warning("Overseer: AI-Q summary failed: %s", e)
            self._last_executive_sources = []
            return self._fallback_summary(snapshot, system_alerts)

    def _fallback_summary(self, snapshot: Dict[str, Any], system_alerts: List[SystemAlert]) -> str:
        health_status = snapshot.get("health", {}).get("status", "unknown")
        n = len(system_alerts)
        if health_status == "healthy" and n == 0:
            return "System healthy. All core services and platform layers operational."
        if n == 0:
            return f"System status: {health_status}. No system-level alerts. Review health checks for details."
        crit = [a for a in system_alerts if a.severity == "critical"]
        high = [a for a in system_alerts if a.severity == "high"]
        parts = []
        if crit:
            parts.append(f"Critical: {', '.join(a.title for a in crit)}.")
        if high:
            parts.append(f"High: {', '.join(a.title for a in high)}.")
        if not parts:
            parts.append(f"{n} system alert(s) require attention.")
        return " ".join(parts)

    async def run_cycle(self, use_llm: bool = True, include_events: bool = True) -> None:
        """
        Run collect_snapshot, evaluate_rules, optionally summarize_llm; store results.
        """
        try:
            snapshot = await self.collect_snapshot(include_events=include_events)
        except Exception as e:
            logger.warning("Overseer: collect_snapshot failed: %s", e)
            snapshot = {"timestamp": datetime.utcnow().isoformat(), "health": {"status": "unknown"}, "platform": {}, "alerts": {}, "events_last_100": []}

        system_alerts = self.evaluate_rules(snapshot)
        
        # NEW: Auto-resolve issues
        auto_actions = await self.auto_resolve_issues(system_alerts)
        if auto_actions:
            logger.info(f"Overseer: auto-resolved {len(auto_actions)} issues: {auto_actions}")

        executive_summary = ""
        if use_llm and getattr(settings, "oversee_use_llm", True):
            executive_summary = await self.summarize_llm(snapshot, system_alerts)
        else:
            # Ensure we don't keep stale citations when LLM is disabled.
            self._last_executive_sources = []
            executive_summary = self._fallback_summary(snapshot, system_alerts)

        crit = [a for a in system_alerts if a.severity == "critical"]
        self._last_status = "critical" if crit else ("degraded" if system_alerts else "healthy")
        self._last_snapshot = snapshot
        self._last_system_alerts = system_alerts
        self._last_timestamp = snapshot.get("timestamp")
        self._last_executive_summary = executive_summary

        # WebSocket: broadcast to system_oversee channel (Phase 4)
        try:
            from src.api.v1.endpoints.websocket import manager as ws_manager
            await ws_manager.broadcast_to_channel(
                "system_oversee",
                {"type": "oversee_snapshot", "data": self.get_status()},
            )
        except Exception as e:
            logger.debug("Overseer: WebSocket broadcast failed: %s", e)

    def get_status(self) -> Dict[str, Any]:
        """Return last status for GET /oversee/status."""
        snapshot = self._last_snapshot or {}
        return {
            "status": self._last_status or "healthy",
            "timestamp": self._last_timestamp or datetime.utcnow().isoformat(),
            "checks": snapshot.get("health", {}).get("services", {}) if snapshot else {},
            "system_alerts": [
                {"code": a.code, "severity": a.severity, "title": a.title, "message": a.message, "source": a.source}
                for a in self._last_system_alerts
            ],
            "executive_summary": self._last_executive_summary if self._last_timestamp else "No data yet. Run POST /oversee/run or wait for the next cycle.",
            "executive_summary_sources": self._last_executive_sources if self._last_timestamp else [],
            # NEW: Detailed status
            "databases": snapshot.get("databases", {}),
            "services": snapshot.get("services", {}),
            "modules": snapshot.get("modules", {}),
            "agents": snapshot.get("agents", {}),
            "endpoints": snapshot.get("endpoints", {}),
            "nvidia": snapshot.get("nvidia", {}),
            "performance": snapshot.get("performance", {}),
            "auto_resolution_actions": self._auto_resolution_actions,
            # NEW: Circuit Breaker states
            "circuit_breakers": get_all_circuit_breakers(),
        }


# Singleton
_oversee_service: Optional[OverseerService] = None


def get_oversee_service() -> OverseerService:
    global _oversee_service
    if _oversee_service is None:
        _oversee_service = OverseerService()
    return _oversee_service
