"""
Register all ingestion jobs with the APScheduler.

Called from main.py after start_scheduler().
"""
import asyncio
import structlog

from src.core.scheduler import add_interval_job

logger = structlog.get_logger()


async def run_catalog_ingestion_job() -> dict:
    """Run ingestion for all enabled sources in the SSOT catalog (DB-driven pipeline)."""
    from src.core.database import AsyncSessionLocal
    from src.models.ingestion_source import IngestionSource
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(IngestionSource).where(IngestionSource.enabled.is_(True))
        )
        sources = list(result.scalars().all())
    if not sources:
        return {"success": True, "sources_run": 0, "message": "No enabled sources in catalog"}

    # Import job runner by source_type: module = {source_type}_job, fn = run_{source_type}_job
    ok = 0
    for src in sources:
        mod_name = f"{src.source_type}_job"
        fn_name = f"run_{src.source_type}_job"
        try:
            mod = __import__(f"src.services.ingestion.jobs.{mod_name}", fromlist=[fn_name])
            fn = getattr(mod, fn_name)
            await fn()
            ok += 1
        except Exception as e:
            logger.warning("Catalog ingestion job failed", source_id=src.id, source_type=src.source_type, error=str(e))
    return {"success": True, "sources_run": len(sources), "ok_count": ok}


def register_ingestion_jobs() -> None:
    """Add natural hazards, threat intel, economic, weather jobs to the scheduler."""
    try:
        from src.services.ingestion.jobs.natural_hazards_job import run_natural_hazards_job
        add_interval_job(run_natural_hazards_job, minutes=5, id="natural_hazards")
    except Exception as e:
        logger.warning("Register natural_hazards job failed: %s", e)

    try:
        from src.services.ingestion.jobs.threat_intelligence_job import run_threat_intelligence_job
        add_interval_job(run_threat_intelligence_job, minutes=15, id="threat_intelligence")
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Register threat_intelligence job failed: %s", e)

    try:
        from src.services.ingestion.jobs.social_media_job import run_social_media_job
        add_interval_job(run_social_media_job, minutes=10, id="social_media")
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Register social_media job failed: %s", e)

    try:
        from src.services.ingestion.jobs.biosecurity_job import run_biosecurity_job
        add_interval_job(run_biosecurity_job, minutes=60, id="biosecurity")
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Register biosecurity job failed: %s", e)

    try:
        from src.services.ingestion.jobs.cyber_threats_job import run_cyber_threats_job
        add_interval_job(run_cyber_threats_job, minutes=360, id="cyber_threats")  # 6h
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Register cyber_threats job failed: %s", e)

    try:
        from src.services.ingestion.jobs.economic_job import run_economic_job
        add_interval_job(run_economic_job, minutes=24 * 60, id="economic")  # 24h
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Register economic job failed: %s", e)

    try:
        from src.services.ingestion.jobs.weather_job import run_weather_job
        add_interval_job(run_weather_job, minutes=30, id="weather")
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Register weather job failed: %s", e)

    try:
        from src.services.ingestion.jobs.market_data_job import run_market_data_job
        add_interval_job(run_market_data_job, minutes=5, id="market_data")
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Register market_data job failed: %s", e)

    try:
        from src.services.ingestion.jobs.population_job import run_population_job
        add_interval_job(run_population_job, minutes=24 * 60, id="population")
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Register population job failed: %s", e)

    try:
        from src.services.ingestion.jobs.infrastructure_job import run_infrastructure_job
        add_interval_job(run_infrastructure_job, minutes=60, id="infrastructure")
    except ImportError:
        pass
    except Exception as e:
        logger.warning("Register infrastructure job failed: %s", e)

    try:
        add_interval_job(run_catalog_ingestion_job, minutes=60, id="ingestion_by_catalog")
    except Exception as e:
        logger.warning("Register ingestion_by_catalog job failed: %s", e)

    logger.info("Ingestion jobs registered")
