"""Manual ingestion control endpoints."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.ingestion_source import IngestionSource

from src.services.ingestion.jobs.market_data_job import run_market_data_job
from src.services.ingestion.jobs.natural_hazards_job import run_natural_hazards_job
from src.services.ingestion.jobs.threat_intelligence_job import run_threat_intelligence_job
from src.services.ingestion.jobs.weather_job import run_weather_job
from src.services.ingestion.jobs.biosecurity_job import run_biosecurity_job
from src.services.ingestion.jobs.cyber_threats_job import run_cyber_threats_job
from src.services.ingestion.jobs.economic_job import run_economic_job
from src.services.ingestion.jobs.social_media_job import run_social_media_job
from src.services.ingestion.jobs.population_job import run_population_job
from src.services.ingestion.jobs.infrastructure_job import run_infrastructure_job
from src.services.ingestion.pipeline import get_last_refresh_times, set_last_attempt_time, get_sla_status

router = APIRouter()

# Map source_type from catalog to ingestion job (SSOT pipeline)
SOURCE_TYPE_TO_JOB = {
    "market_data": run_market_data_job,
    "natural_hazards": run_natural_hazards_job,
    "threat_intelligence": run_threat_intelligence_job,
    "weather": run_weather_job,
    "biosecurity": run_biosecurity_job,
    "cyber_threats": run_cyber_threats_job,
    "economic": run_economic_job,
    "social_media": run_social_media_job,
    "population": run_population_job,
    "infrastructure": run_infrastructure_job,
}


class IngestionSourceCreate(BaseModel):
    name: str
    source_type: str
    endpoint_url: Optional[str] = None
    refresh_interval_minutes: int = 60
    config: Optional[str] = None
    enabled: bool = True


class IngestionSourceUpdate(BaseModel):
    name: Optional[str] = None
    endpoint_url: Optional[str] = None
    refresh_interval_minutes: Optional[int] = None
    config: Optional[str] = None
    enabled: Optional[bool] = None


@router.get("/sources", response_model=List[Dict[str, Any]])
async def list_ingestion_sources(
    enabled_only: bool = False,
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """List ingestion sources from the SSOT catalog."""
    q = select(IngestionSource).order_by(IngestionSource.name)
    if enabled_only:
        q = q.where(IngestionSource.enabled.is_(True))
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "source_type": r.source_type,
            "endpoint_url": r.endpoint_url,
            "refresh_interval_minutes": r.refresh_interval_minutes,
            "config": r.config,
            "enabled": r.enabled,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.post("/sources", response_model=Dict[str, Any])
async def create_ingestion_source(
    body: IngestionSourceCreate,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Register a new ingestion source in the catalog."""
    from src.models.ingestion_source import IngestionSource as Model
    from uuid import uuid4
    rec = Model(
        id=str(uuid4()),
        name=body.name,
        source_type=body.source_type,
        endpoint_url=body.endpoint_url,
        refresh_interval_minutes=body.refresh_interval_minutes,
        config=body.config,
        enabled=body.enabled,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return {
        "id": rec.id,
        "name": rec.name,
        "source_type": rec.source_type,
        "endpoint_url": rec.endpoint_url,
        "refresh_interval_minutes": rec.refresh_interval_minutes,
        "config": rec.config,
        "enabled": rec.enabled,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
        "updated_at": rec.updated_at.isoformat() if rec.updated_at else None,
    }


@router.get("/sources/{source_id}", response_model=Dict[str, Any])
async def get_ingestion_source(
    source_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Get one ingestion source by id."""
    result = await db.execute(
        select(IngestionSource).where(IngestionSource.id == source_id)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Ingestion source not found")
    return {
        "id": rec.id,
        "name": rec.name,
        "source_type": rec.source_type,
        "endpoint_url": rec.endpoint_url,
        "refresh_interval_minutes": rec.refresh_interval_minutes,
        "config": rec.config,
        "enabled": rec.enabled,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
        "updated_at": rec.updated_at.isoformat() if rec.updated_at else None,
    }


@router.patch("/sources/{source_id}", response_model=Dict[str, Any])
async def update_ingestion_source(
    source_id: str,
    body: IngestionSourceUpdate,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Update an ingestion source."""
    result = await db.execute(
        select(IngestionSource).where(IngestionSource.id == source_id)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Ingestion source not found")
    if body.name is not None:
        rec.name = body.name
    if body.endpoint_url is not None:
        rec.endpoint_url = body.endpoint_url
    if body.refresh_interval_minutes is not None:
        rec.refresh_interval_minutes = body.refresh_interval_minutes
    if body.config is not None:
        rec.config = body.config
    if body.enabled is not None:
        rec.enabled = body.enabled
    await db.commit()
    await db.refresh(rec)
    return {
        "id": rec.id,
        "name": rec.name,
        "source_type": rec.source_type,
        "endpoint_url": rec.endpoint_url,
        "refresh_interval_minutes": rec.refresh_interval_minutes,
        "config": rec.config,
        "enabled": rec.enabled,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
        "updated_at": rec.updated_at.isoformat() if rec.updated_at else None,
    }


@router.get("/last-refresh", response_model=Dict[str, str])
async def get_last_refresh() -> Dict[str, str]:
    """Return last refresh ISO timestamp per source (from ingestion cache). Dashboard loads this on mount to show freshness without waiting for WebSocket."""
    return await get_last_refresh_times()


@router.get("/sla-status", response_model=List[Dict[str, Any]])
async def get_ingestion_sla_status() -> List[Dict[str, Any]]:
    """
    Return SLA status per ingestion source: last_refresh, target_max_age_seconds, status (ok|stale|fail).
    Use for alerting when status is stale or fail for critical sources.
    """
    return await get_sla_status()


@router.post("/run-by-catalog")
async def run_ingestion_by_catalog(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Run ingestion for all enabled sources in the catalog (SSOT pipeline)."""
    result = await db.execute(
        select(IngestionSource).where(IngestionSource.enabled.is_(True))
    )
    sources = list(result.scalars().all())
    started_at = datetime.now(timezone.utc).isoformat()
    results: Dict[str, Any] = {}
    for src in sources:
        job_fn = SOURCE_TYPE_TO_JOB.get(src.source_type)
        if job_fn is None:
            results[src.id] = {"success": False, "error": f"Unknown source_type: {src.source_type}"}
            continue
        try:
            out = await job_fn()
            results[src.id] = out if isinstance(out, dict) else {"success": True, "result": str(out)}
        except Exception as e:
            results[src.id] = {"success": False, "source_id": src.id, "error": str(e)}
    finished_at = datetime.now(timezone.utc).isoformat()
    ok_count = sum(1 for r in results.values() if isinstance(r, dict) and r.get("success") is True)
    return {
        "success": True,
        "started_at": started_at,
        "finished_at": finished_at,
        "sources_run": len(sources),
        "ok_count": ok_count,
        "results": results,
    }


@router.post("/refresh-all")
async def refresh_all_sources() -> Dict[str, Any]:
    """Force-run all ingestion sources immediately."""
    started_at = datetime.now(timezone.utc).isoformat()
    results: Dict[str, Any] = {}

    jobs = [
        ("market_data", run_market_data_job),
        ("natural_hazards", run_natural_hazards_job),
        ("threat_intelligence", run_threat_intelligence_job),
        ("weather", run_weather_job),
        ("biosecurity", run_biosecurity_job),
        ("cyber_threats", run_cyber_threats_job),
        ("economic", run_economic_job),
        ("social_media", run_social_media_job),
        ("population", run_population_job),
        ("infrastructure", run_infrastructure_job),
    ]

    for source_id, job_fn in jobs:
        try:
            results[source_id] = await job_fn()
        except Exception as e:
            results[source_id] = {"success": False, "source_id": source_id, "error": str(e)}

    finished_at = datetime.now(timezone.utc).isoformat()
    for source_id, r in results.items():
        if isinstance(r, dict) and r.get("success") is not True:
            await set_last_attempt_time(source_id, finished_at)
    ok_count = sum(1 for r in results.values() if isinstance(r, dict) and r.get("success") is True)
    return {
        "success": True,
        "started_at": started_at,
        "finished_at": finished_at,
        "total_sources": len(jobs),
        "ok_sources": ok_count,
        "results": results,
    }
