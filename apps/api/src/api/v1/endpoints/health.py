"""Health check endpoints."""
from fastapi import APIRouter
import logging
import asyncio
from datetime import datetime

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

router = APIRouter()
logger = logging.getLogger(__name__)


async def _check_redis() -> dict:
    """Check Redis connection. Returns disabled when Redis is not enabled. Never returns None."""
    try:
        from src.core.config import settings
        if not getattr(settings, "enable_redis", True) or not (getattr(settings, "redis_url", "") or "").strip():
            return {"status": "disabled", "backend": "memory", "message": "Redis disabled (enable_redis=False or REDIS_URL empty)"}
    except Exception:
        pass
    try:
        from src.services.cache import get_cache
        cache = await get_cache()
        stats = getattr(cache, "stats", lambda: {})()
        if stats.get("backend") == "memory" and not stats.get("redis_fallback"):
            return {"status": "disabled", "backend": "memory"}
        return {
            "status": "connected" if stats.get("backend") == "redis" else "fallback",
            "backend": stats.get("backend", "unknown"),
            "connected": stats.get("connected", False),
        }
    except Exception as e:
        logger.warning(f"Redis health check failed: {e}")
        return {"status": "error", "error": str(e)}
    return {"status": "disabled", "backend": "memory", "message": "Redis check skipped"}


async def _check_database() -> dict:
    """Check database connection (PostgreSQL or SQLite). Retries briefly to handle startup/transient failures."""
    from src.core.database import engine
    from sqlalchemy import text

    last_error = None
    for attempt in range(3):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            break
        except Exception as e:
            last_error = e
            if attempt < 2:
                await asyncio.sleep(0.3 * (attempt + 1))
            continue
    else:
        logger.warning("Database health check failed after retries: %s", last_error)
        return {"status": "error", "error": str(last_error)[:200]}

    # Optional: get asset count (separate connection to avoid session lifecycle issues with aiosqlite)
    try:
        from src.core.database import AsyncSessionLocal
        from sqlalchemy import select, func
        from src.models.asset import Asset
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(func.count(Asset.id)).where(Asset.status == "active"))
            asset_count = result.scalar() or 0
        return {"status": "connected", "asset_count": asset_count}
    except Exception:
        return {"status": "connected"}


async def _check_neo4j() -> dict:
    """Check Neo4j connection."""
    try:
        from src.core.config import settings
        if not getattr(settings, "enable_neo4j", False):
            return {"status": "disabled", "message": "Neo4j disabled"}
        from src.services.knowledge_graph import get_knowledge_graph_service
        kg_service = get_knowledge_graph_service()
        if kg_service.is_available:
            # Try a simple query
            async with kg_service.driver.session() as session:
                result = await session.run("RETURN 1 as test")
                await result.single()
            return {"status": "connected"}
        else:
            return {"status": "unavailable", "message": "Neo4j not configured"}
    except Exception as e:
        logger.warning(f"Neo4j health check failed: {e}")
        return {"status": "error", "error": str(e)}


async def _check_external_apis() -> dict:
    """Check status of external APIs."""
    status = {}
    
    # NOAA
    try:
        from src.services.external.noaa_client import noaa_client
        status["noaa"] = {
            "configured": noaa_client.is_configured,
            "status": "available" if noaa_client.is_configured else "not_configured",
        }
    except Exception as e:
        status["noaa"] = {"status": "error", "error": str(e)}
    
    # FEMA (public API, no key needed)
    try:
        from src.services.external.fema_client import fema_client
        # Quick test - just check if client is initialized
        status["fema"] = {
            "configured": True,
            "status": "available",
        }
    except Exception as e:
        status["fema"] = {"status": "error", "error": str(e)}
    
    # NVIDIA
    try:
        from src.core.config import settings
        status["nvidia"] = {
            "configured": bool(settings.nvidia_api_key),
            "status": "available" if settings.nvidia_api_key else "not_configured",
        }
    except Exception as e:
        status["nvidia"] = {"status": "error", "error": str(e)}
    
    return status


async def _check_nvidia_services() -> dict:
    """Полный чеклист продуктов NVIDIA (конфиг + готовность NIM)."""
    try:
        from src.services.nvidia_services_status import get_nvidia_services_status
        return await get_nvidia_services_status()
    except Exception as e:
        logger.warning(f"NVIDIA services check failed: {e}")
        return {"error": str(e)}


async def _get_system_metrics() -> dict:
    """Get system resource usage."""
    if not HAS_PSUTIL:
        return {
            "memory_mb": None,
            "cpu_percent": None,
            "threads": None,
            "note": "psutil not installed",
        }
    
    try:
        process = psutil.Process()
        memory_info = process.memory_info()
        cpu_percent = process.cpu_percent(interval=0.1)
        
        return {
            "memory_mb": round(memory_info.rss / 1024 / 1024, 2),
            "cpu_percent": round(cpu_percent, 1),
            "threads": process.num_threads(),
        }
    except Exception as e:
        logger.warning(f"Failed to get system metrics: {e}")
        return {
            "memory_mb": None,
            "cpu_percent": None,
            "threads": None,
            "error": str(e),
        }


@router.get("")
async def health():
    """Basic health check. demo_mode=True when ALLOW_SEED_IN_PRODUCTION — frontend opens all strategic modules without auth."""
    from src.core.config import settings
    return {
        "status": "healthy",
        "version": getattr(settings, "app_version", "1.5.0"),
        "environment": getattr(settings, "environment", "production"),
        "demo_mode": getattr(settings, "allow_seed_in_production", False),
    }


@router.get("/nvidia")
async def health_nvidia():
    """
    Полный чеклист продуктов NVIDIA: конфигурация и готовность NIM.
    Удобно для проверки в браузере или мониторинга.
    """
    try:
        from src.services.nvidia_services_status import get_nvidia_services_status
        status = await get_nvidia_services_status()
        return {"nvidia_services": status}
    except Exception as e:
        logger.warning(f"NVIDIA health failed: {e}")
        return {"nvidia_services": {"error": str(e)}}


@router.get("/detailed")
async def health_detailed():
    """
    Detailed health check with service statuses.
    
    Includes:
    - Database status (PostgreSQL/SQLite)
    - Neo4j Knowledge Graph status
    - Redis cache status
    - External API status (NOAA, FEMA, NVIDIA)
    - System metrics (memory, CPU)
    - Active connections
    """
    # Check all services in parallel (including NVIDIA services checklist)
    redis_status, db_status, neo4j_status, external_apis, system_metrics, nvidia_services = await asyncio.gather(
        _check_redis(),
        _check_database(),
        _check_neo4j(),
        _check_external_apis(),
        _get_system_metrics(),
        _check_nvidia_services(),
    )
    
    # Check SENTINEL status
    try:
        from src.api.v1.endpoints.alerts import _is_monitoring
        sentinel_status = {
            "monitoring": _is_monitoring,
            "status": "active" if _is_monitoring else "stopped",
        }
    except Exception:
        sentinel_status = {"status": "unknown"}
    
    # Determine overall health
    critical_services_healthy = (
        db_status.get("status") == "connected"
    )
    
    all_healthy = (
        critical_services_healthy and
        redis_status.get("status") in ("connected", "fallback", "disabled")
    )
    
    return {
        "status": "healthy" if all_healthy else "degraded",
        "version": "1.5.0",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "database": db_status,
            "neo4j": neo4j_status,
            "redis": redis_status,
            "sentinel": sentinel_status,
        },
        "external_apis": external_apis,
        "nvidia_services": nvidia_services,
        "system": system_metrics,
    }


@router.get("/cache")
async def cache_status():
    """Get cache status and statistics."""
    try:
        from src.services.cache import cache_stats
        stats = await cache_stats()
        return {
            "status": "ok",
            **stats,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }
