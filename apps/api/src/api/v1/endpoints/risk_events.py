"""
Risk Events API — canonical external risk data (event_entities, normalized_events).

GET /risk/events — list events (from event_entities) with filters.
GET /risk/events/{event_uid} — event detail with losses/impacts/recovery.
POST /risk/events/sync — run ETL sync (USGS or EM-DAT CSV).
GET /risk/sources — list source_registry.
GET /risk/quality — quality scores by source (Q, completeness, etc.).
GET /risk/backtesting — list processing_runs / dataset versions for reproducible backtesting.

Technical Spec: docs/EXTERNAL_DATABASES_TECHNICAL_SPEC_V1.md
"""
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.external_risk_events import (
    EventEntity,
    EventLoss,
    EventImpact,
    EventRecovery,
    SourceRegistry,
    ProcessingRun,
    DataQualityScore,
)
from src.services.external_risk_etl import (
    run_full_sync_usgs,
    run_full_sync_emdat,
    seed_source_registry,
    score_quality_events,
)

router = APIRouter(prefix="/risk", tags=["Risk Events (External Data)"])


@router.get("/events", response_model=Dict[str, Any])
async def list_risk_events(
    country: Optional[str] = Query(None, description="Country ISO2"),
    event_type: Optional[str] = Query(None, description="canonical_event_type"),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List event_entities with optional filters. For backtesting and comparables."""
    q = select(EventEntity)
    if country:
        q = q.where(EventEntity.country_iso2 == country.upper())
    if event_type:
        q = q.where(EventEntity.canonical_event_type == event_type)
    if from_date:
        q = q.where(EventEntity.start_date >= from_date)
    if to_date:
        q = q.where(EventEntity.start_date <= to_date)
    q = q.order_by(EventEntity.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    entities = result.scalars().all()
    items = [
        {
            "event_uid": e.event_uid,
            "canonical_event_type": e.canonical_event_type,
            "canonical_title": e.canonical_title,
            "start_date": e.start_date.isoformat() if e.start_date else None,
            "end_date": e.end_date.isoformat() if e.end_date else None,
            "country_iso2": e.country_iso2,
            "region": e.region,
            "city": e.city,
            "lat": e.lat,
            "lon": e.lon,
            "best_source": e.best_source,
            "source_count": e.source_count,
        }
        for e in entities
    ]
    return {"events": items, "count": len(items)}


@router.get("/events/{event_uid}", response_model=Dict[str, Any])
async def get_risk_event(
    event_uid: str,
    db: AsyncSession = Depends(get_db),
):
    """Get one event with losses, impacts, recovery."""
    result = await db.execute(select(EventEntity).where(EventEntity.event_uid == event_uid))
    entity = result.scalars().one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Event not found")
    losses_result = await db.execute(select(EventLoss).where(EventLoss.event_uid == event_uid))
    impacts_result = await db.execute(select(EventImpact).where(EventImpact.event_uid == event_uid))
    recovery_result = await db.execute(select(EventRecovery).where(EventRecovery.event_uid == event_uid))
    losses = [
        {
            "loss_type": l.loss_type,
            "amount_original": float(l.amount_original) if l.amount_original else None,
            "currency_original": l.currency_original,
            "amount_usd_nominal": float(l.amount_usd_nominal) if l.amount_usd_nominal else None,
            "amount_usd_real": float(l.amount_usd_real) if l.amount_usd_real else None,
            "base_year": l.base_year,
            "source_name": l.source_name,
            "confidence": float(l.confidence) if l.confidence else None,
        }
        for l in losses_result.scalars().all()
    ]
    impacts = [
        {
            "casualties": float(i.casualties) if i.casualties else None,
            "displaced": float(i.displaced) if i.displaced else None,
            "sector": i.sector,
            "source_name": i.source_name,
            "confidence": float(i.confidence) if i.confidence else None,
        }
        for i in impacts_result.scalars().all()
    ]
    recoveries = [
        {
            "duration_days": float(r.duration_days) if r.duration_days else None,
            "recovery_time_months": float(r.recovery_time_months) if r.recovery_time_months else None,
            "rto_days": float(r.rto_days) if r.rto_days else None,
            "rpo_hours": float(r.rpo_hours) if r.rpo_hours else None,
            "source_name": r.source_name,
            "confidence": float(r.confidence) if r.confidence else None,
        }
        for r in recovery_result.scalars().all()
    ]
    return {
        "event_uid": entity.event_uid,
        "canonical_event_type": entity.canonical_event_type,
        "canonical_title": entity.canonical_title,
        "start_date": entity.start_date.isoformat() if entity.start_date else None,
        "end_date": entity.end_date.isoformat() if entity.end_date else None,
        "country_iso2": entity.country_iso2,
        "region": entity.region,
        "city": entity.city,
        "lat": entity.lat,
        "lon": entity.lon,
        "best_source": entity.best_source,
        "source_count": entity.source_count,
        "losses": losses,
        "impacts": impacts,
        "recovery": recoveries,
    }


@router.post("/events/sync", response_model=Dict[str, Any])
async def trigger_sync(
    source: str = Query("usgs", description="Source to sync: usgs or emdat"),
    days: int = Query(365, ge=1, le=3650),
    min_magnitude: float = Query(5.0, ge=0, le=10),
    seed_registry: bool = Query(False, description="Also upsert source_registry from seed"),
    csv_file: Optional[UploadFile] = File(None, description="EM-DAT CSV file (required when source=emdat)"),
):
    """Run ETL: USGS (extract → normalize → event_entities) or EM-DAT (upload CSV → same pipeline)."""
    if source == "usgs":
        try:
            from src.core.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                if seed_registry:
                    await seed_source_registry(session)
                    await session.commit()
            counts = await run_full_sync_usgs(days=days, min_magnitude=min_magnitude)
            return {
                "status": "success",
                "source": source,
                "counts": counts,
                "message": "Extract → normalize → event_entities completed. Use GET /risk/events to list.",
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    if source == "emdat":
        if not csv_file:
            raise HTTPException(status_code=400, detail="csv_file required for source=emdat")
        try:
            content = (await csv_file.read()).decode("utf-8", errors="replace")
            counts = await run_full_sync_emdat(content)
            return {
                "status": "success",
                "source": source,
                "counts": counts,
                "message": "EM-DAT CSV loaded → normalize → event_entities + losses/impacts/recovery. Use GET /risk/events to list.",
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=400, detail="Only source=usgs or source=emdat supported")


@router.get("/sources", response_model=Dict[str, Any])
async def list_risk_sources(
    active_only: bool = Query(True),
    domain: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List source_registry: sources from which we pull data for correct online risk calculation."""
    q = select(SourceRegistry)
    if active_only:
        q = q.where(SourceRegistry.active.is_(True))
    if domain:
        q = q.where(SourceRegistry.domain == domain)
    q = q.order_by(SourceRegistry.domain, SourceRegistry.priority_rank)
    result = await db.execute(q)
    rows = result.scalars().all()
    items = [
        {
            "source_name": r.source_name,
            "domain": r.domain,
            "license_type": r.license_type,
            "refresh_frequency": r.refresh_frequency,
            "priority_rank": r.priority_rank,
            "active": r.active,
            "tos_url": r.tos_url,
            "storage_restrictions": r.storage_restrictions,
        }
        for r in rows
    ]
    return {"sources": items, "count": len(items)}


@router.get("/quality", response_model=Dict[str, Any])
async def list_risk_quality(
    source: Optional[str] = Query(None, description="Filter by best_source of event_entity"),
    min_q: float = Query(0.0, ge=0, le=1, description="Minimum Q score"),
    recompute: bool = Query(False, description="Recompute quality scores for all events"),
    db: AsyncSession = Depends(get_db),
):
    """List data_quality_scores for event_entities. Optionally recompute Q (0.35*completeness + 0.25*source_trust + 0.2*freshness + 0.2*consistency)."""
    if recompute:
        from src.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await score_quality_events(session, source_name=source)
            await session.commit()
    q = select(DataQualityScore).where(DataQualityScore.entity_type == "event_entity")
    if source:
        q = q.join(EventEntity, EventEntity.event_uid == DataQualityScore.entity_id).where(
            EventEntity.best_source == source
        )
    result = await db.execute(q)
    rows = result.scalars().all()
    items = []
    for r in rows:
        if float(r.q_score) < min_q:
            continue
        items.append({
            "entity_id": r.entity_id,
            "q_score": float(r.q_score),
            "completeness": float(r.completeness) if r.completeness else None,
            "source_trust": float(r.source_trust) if r.source_trust else None,
            "freshness": float(r.freshness) if r.freshness else None,
            "consistency": float(r.consistency) if r.consistency else None,
            "computed_at": r.computed_at.isoformat() if r.computed_at else None,
        })
    return {"quality_scores": items, "count": len(items)}


@router.get("/backtesting", response_model=Dict[str, Any])
async def list_backtesting_runs(
    dataset_version: Optional[str] = Query(None, description="Filter by dataset_version"),
    source_name: Optional[str] = Query(None, description="Filter by source_name"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List processing_runs (ETL runs) with dataset_version for reproducible backtesting. Use dataset_version in backtest requests."""
    q = select(ProcessingRun).order_by(ProcessingRun.started_at.desc()).limit(limit)
    if dataset_version:
        q = q.where(ProcessingRun.dataset_version == dataset_version)
    if source_name:
        q = q.where(ProcessingRun.source_name == source_name)
    result = await db.execute(q)
    rows = result.scalars().all()
    items = [
        {
            "run_id": r.run_id,
            "source_name": r.source_name,
            "dataset_version": r.dataset_version,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "status": r.status,
            "row_count": r.row_count,
            "error_count": r.error_count,
        }
        for r in rows
    ]
    return {"runs": items, "count": len(items)}
