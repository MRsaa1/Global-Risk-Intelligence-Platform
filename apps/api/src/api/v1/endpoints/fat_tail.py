"""Fat Tail (Black Swan) catalog and triggers API."""
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.fat_tail_event import FatTailEvent

router = APIRouter()


class FatTailEventCreate(BaseModel):
    event_type: str
    name: str
    description: Optional[str] = None
    base_probability: float = 0.001
    indicator_source: Optional[str] = None
    indicator_threshold: Optional[float] = None
    enabled: bool = True


class FatTailEventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_probability: Optional[float] = None
    indicator_source: Optional[str] = None
    indicator_threshold: Optional[float] = None
    enabled: Optional[bool] = None


@router.get("/catalog", response_model=List[dict])
async def list_fat_tail_events(
    enabled_only: bool = False,
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """List Fat Tail events catalog."""
    q = select(FatTailEvent).order_by(FatTailEvent.event_type)
    if enabled_only:
        q = q.where(FatTailEvent.enabled.is_(True))
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "event_type": r.event_type,
            "name": r.name,
            "description": r.description,
            "base_probability": r.base_probability,
            "indicator_source": r.indicator_source,
            "indicator_threshold": r.indicator_threshold,
            "enabled": r.enabled,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/catalog", response_model=dict)
async def create_fat_tail_event(
    body: FatTailEventCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Add a Fat Tail event to the catalog."""
    from uuid import uuid4
    rec = FatTailEvent(
        id=str(uuid4()),
        event_type=body.event_type,
        name=body.name,
        description=body.description,
        base_probability=body.base_probability,
        indicator_source=body.indicator_source,
        indicator_threshold=body.indicator_threshold,
        enabled=body.enabled,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return {
        "id": rec.id,
        "event_type": rec.event_type,
        "name": rec.name,
        "description": rec.description,
        "base_probability": rec.base_probability,
        "indicator_source": rec.indicator_source,
        "indicator_threshold": rec.indicator_threshold,
        "enabled": rec.enabled,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
    }


@router.get("/triggers", response_model=dict)
async def get_fat_tail_triggers(db: AsyncSession = Depends(get_db)) -> dict:
    """
    Current Fat Tail triggers status: which events would fire based on indicator thresholds.
    When indicator_source is configured, a job can poll and create alerts (source=FAT_TAIL).
    """
    result = await db.execute(
        select(FatTailEvent).where(FatTailEvent.enabled.is_(True))
    )
    events = result.scalars().all()
    # Placeholder: in production would fetch indicator values and compare to threshold
    elevated = []
    for e in events:
        if e.indicator_threshold is not None:
            # Demo: no real indicator fetch; list events that have threshold set
            elevated.append({"id": e.id, "event_type": e.event_type, "name": e.name})
    return {
        "events_with_indicators": len([e for e in events if e.indicator_source]),
        "elevated_risk": elevated,
        "message": "Run SENTINEL or a scheduled job to create Fat Tail alerts when indicators exceed threshold.",
    }
