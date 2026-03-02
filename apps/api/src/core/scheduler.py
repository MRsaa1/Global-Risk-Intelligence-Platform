"""
APScheduler singleton for real-time data ingestion jobs.

Used by the ingestion pipeline to run periodic fetches from external data sources
(GDELT, USGS, WHO, CISA KEV, etc.) and push updates via WebSocket.
"""
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import structlog

from src.core.config import settings

logger = structlog.get_logger()

_scheduler: Optional[AsyncIOScheduler] = None


def get_scheduler() -> Optional[AsyncIOScheduler]:
    """Return the global AsyncIOScheduler instance, or None if scheduler is disabled."""
    return _scheduler


def start_scheduler() -> Optional[AsyncIOScheduler]:
    """Create and start the global AsyncIOScheduler. Idempotent."""
    global _scheduler
    if not getattr(settings, "enable_scheduler", True):
        logger.info("Scheduler disabled (enable_scheduler=false)")
        return None
    if _scheduler is not None:
        return _scheduler
    tz = getattr(settings, "scheduler_timezone", "UTC")
    _scheduler = AsyncIOScheduler(timezone=tz)
    _scheduler.start()
    logger.info("APScheduler started", timezone=tz)
    return _scheduler


def stop_scheduler() -> None:
    """Shutdown the global scheduler."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=True)
        _scheduler = None
        logger.info("APScheduler stopped")
    return None


def add_interval_job(
    func,
    minutes: int,
    id: str,
    replace_existing: bool = True,
    **kwargs,
) -> bool:
    """Add a job that runs every `minutes` minutes. Returns True if added."""
    sched = get_scheduler()
    if sched is None:
        return False
    trigger = IntervalTrigger(minutes=minutes)
    try:
        sched.add_job(
            func,
            trigger=trigger,
            id=id,
            replace_existing=replace_existing,
            **kwargs,
        )
        logger.info("Scheduler job added", job_id=id, interval_minutes=minutes)
        return True
    except Exception as e:
        logger.warning("Scheduler add_job failed", job_id=id, error=str(e))
        return False
