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
    """Check Redis connection."""
    try:
        from src.services.cache import get_cache, cache_stats
        cache = await get_cache()
        stats = cache.stats()
        return {
            "status": "connected" if stats.get("backend") == "redis" else "fallback",
            "backend": stats.get("backend", "unknown"),
            "connected": stats.get("connected", False),
        }
    except Exception as e:
        logger.warning(f"Redis health check failed: {e}")
        return {"status": "error", "error": str(e)}


async def _check_database() -> dict:
    """Check PostgreSQL connection."""
    try:
        from src.core.database import engine, get_db
        from sqlalchemy import text, select, func
        from src.models.asset import Asset
        
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        
        # Get database stats (try to count assets)
        try:
            from src.core.database import get_db
            async for db in get_db():
                try:
                    # Count assets
                    result = await db.execute(select(func.count(Asset.id)).where(Asset.status == "active"))
                    asset_count = result.scalar() or 0
                    
                    return {
                        "status": "connected",
                        "asset_count": asset_count,
                    }
                except Exception:
                    return {"status": "connected"}
                break
        except Exception:
            return {"status": "connected"}
    except Exception as e:
        logger.warning(f"Database health check failed: {e}")
        return {"status": "error", "error": str(e)}


async def _check_neo4j() -> dict:
    """Check Neo4j connection."""
    try:
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
    """Basic health check."""
    return {
        "status": "healthy",
        "version": "1.5.0",
    }


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
    # Check all services in parallel
    redis_status, db_status, neo4j_status, external_apis, system_metrics = await asyncio.gather(
        _check_redis(),
        _check_database(),
        _check_neo4j(),
        _check_external_apis(),
        _get_system_metrics(),
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
        redis_status.get("status") in ("connected", "fallback")
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
