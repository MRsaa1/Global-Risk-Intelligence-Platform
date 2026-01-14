"""
Historical Events API endpoints.

CRUD operations for historical events used for calibration.
"""
import json
from typing import List, Optional
from datetime import date
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.historical_event import HistoricalEvent
from src.models.stress_test import StressTestType
from src.services.stress_test_seed import get_historical_events, get_stress_test_scenarios

router = APIRouter(prefix="/historical-events", tags=["Historical Events"])


# =============================================================================
# Pydantic Schemas
# =============================================================================

class HistoricalEventCreate(BaseModel):
    """Schema for creating a historical event."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    event_type: StressTestType = StressTestType.CLIMATE
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    duration_days: Optional[int] = None
    region_name: Optional[str] = None
    country_codes: Optional[str] = None
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None
    affected_area_km2: Optional[float] = None
    severity_actual: Optional[float] = Field(None, ge=0.0, le=1.0)
    financial_loss_eur: Optional[float] = None
    insurance_claims_eur: Optional[float] = None
    affected_population: Optional[int] = None
    casualties: Optional[int] = None
    displaced_people: Optional[int] = None
    affected_assets_count: Optional[int] = None
    destroyed_assets_count: Optional[int] = None
    damaged_assets_count: Optional[int] = None
    recovery_time_months: Optional[int] = None
    reconstruction_cost_eur: Optional[float] = None
    pd_multiplier_observed: Optional[float] = None
    lgd_multiplier_observed: Optional[float] = None
    valuation_impact_pct_observed: Optional[float] = None
    cascade_effects: Optional[List[str]] = None
    affected_sectors: Optional[List[str]] = None
    impact_developers: Optional[dict] = None
    impact_insurers: Optional[dict] = None
    impact_military: Optional[dict] = None
    impact_banks: Optional[dict] = None
    impact_enterprises: Optional[dict] = None
    sources: Optional[List[str]] = None
    lessons_learned: Optional[str] = None
    tags: Optional[List[str]] = None


class HistoricalEventResponse(BaseModel):
    """Response schema for historical event."""
    id: str
    name: str
    description: Optional[str]
    event_type: str
    start_date: Optional[str]
    end_date: Optional[str]
    duration_days: Optional[int]
    region_name: Optional[str]
    country_codes: Optional[str]
    center_latitude: Optional[float]
    center_longitude: Optional[float]
    affected_area_km2: Optional[float]
    severity_actual: Optional[float]
    financial_loss_eur: Optional[float]
    insurance_claims_eur: Optional[float]
    affected_population: Optional[int]
    casualties: Optional[int]
    displaced_people: Optional[int]
    affected_assets_count: Optional[int]
    destroyed_assets_count: Optional[int]
    damaged_assets_count: Optional[int]
    recovery_time_months: Optional[int]
    reconstruction_cost_eur: Optional[float]
    pd_multiplier_observed: Optional[float]
    lgd_multiplier_observed: Optional[float]
    valuation_impact_pct_observed: Optional[float]
    cascade_effects: Optional[List[str]]
    affected_sectors: Optional[List[str]]
    lessons_learned: Optional[str]
    is_verified: bool
    tags: Optional[List[str]]
    created_at: Optional[str]

    class Config:
        from_attributes = True


class CalibrationParamsResponse(BaseModel):
    """Response for calibration parameters."""
    event_type: str
    severity: Optional[float]
    duration_days: Optional[int]
    recovery_time_months: Optional[int]
    pd_multiplier: float
    lgd_multiplier: float
    valuation_impact_pct: float
    financial_loss_eur: Optional[float]
    affected_area_km2: Optional[float]


# =============================================================================
# CRUD Endpoints
# =============================================================================

@router.get("", response_model=List[HistoricalEventResponse])
async def list_historical_events(
    event_type: Optional[StressTestType] = None,
    verified_only: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
):
    """List all historical events with optional filtering."""
    query = select(HistoricalEvent)
    
    if event_type:
        query = query.where(HistoricalEvent.event_type == event_type.value)
    if verified_only:
        query = query.where(HistoricalEvent.is_verified == True)
    
    query = query.order_by(HistoricalEvent.start_date.desc()).offset(skip).limit(limit)
    
    result = await session.execute(query)
    events = result.scalars().all()
    
    return [_event_to_response(e) for e in events]


@router.post("", response_model=HistoricalEventResponse, status_code=201)
async def create_historical_event(
    data: HistoricalEventCreate,
    session: AsyncSession = Depends(get_db),
):
    """Create a new historical event."""
    event = HistoricalEvent(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
        event_type=data.event_type.value,
        start_date=data.start_date,
        end_date=data.end_date,
        duration_days=data.duration_days,
        region_name=data.region_name,
        country_codes=data.country_codes,
        center_latitude=data.center_latitude,
        center_longitude=data.center_longitude,
        affected_area_km2=data.affected_area_km2,
        severity_actual=data.severity_actual,
        financial_loss_eur=data.financial_loss_eur,
        insurance_claims_eur=data.insurance_claims_eur,
        affected_population=data.affected_population,
        casualties=data.casualties,
        displaced_people=data.displaced_people,
        affected_assets_count=data.affected_assets_count,
        destroyed_assets_count=data.destroyed_assets_count,
        damaged_assets_count=data.damaged_assets_count,
        recovery_time_months=data.recovery_time_months,
        reconstruction_cost_eur=data.reconstruction_cost_eur,
        pd_multiplier_observed=data.pd_multiplier_observed,
        lgd_multiplier_observed=data.lgd_multiplier_observed,
        valuation_impact_pct_observed=data.valuation_impact_pct_observed,
        cascade_effects=json.dumps(data.cascade_effects) if data.cascade_effects else None,
        affected_sectors=json.dumps(data.affected_sectors) if data.affected_sectors else None,
        impact_developers=json.dumps(data.impact_developers) if data.impact_developers else None,
        impact_insurers=json.dumps(data.impact_insurers) if data.impact_insurers else None,
        impact_military=json.dumps(data.impact_military) if data.impact_military else None,
        impact_banks=json.dumps(data.impact_banks) if data.impact_banks else None,
        impact_enterprises=json.dumps(data.impact_enterprises) if data.impact_enterprises else None,
        sources=json.dumps(data.sources) if data.sources else None,
        lessons_learned=data.lessons_learned,
        tags=json.dumps(data.tags) if data.tags else None,
    )
    
    session.add(event)
    await session.commit()
    await session.refresh(event)
    
    return _event_to_response(event)


@router.get("/{event_id}", response_model=HistoricalEventResponse)
async def get_historical_event(
    event_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Get a historical event by ID."""
    result = await session.execute(
        select(HistoricalEvent).where(HistoricalEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="Historical event not found")
    
    return _event_to_response(event)


@router.get("/{event_id}/calibration", response_model=CalibrationParamsResponse)
async def get_calibration_params(
    event_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Get calibration parameters from a historical event."""
    result = await session.execute(
        select(HistoricalEvent).where(HistoricalEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="Historical event not found")
    
    return event.to_calibration_params()


@router.delete("/{event_id}", status_code=204)
async def delete_historical_event(
    event_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Delete a historical event."""
    result = await session.execute(
        select(HistoricalEvent).where(HistoricalEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="Historical event not found")
    
    await session.delete(event)
    await session.commit()


# =============================================================================
# Seed Endpoint
# =============================================================================

@router.post("/seed", status_code=201)
async def seed_historical_events(
    session: AsyncSession = Depends(get_db),
):
    """Seed the database with example historical events."""
    events_data = get_historical_events()
    created = 0
    
    for event_data in events_data:
        # Check if already exists
        result = await session.execute(
            select(HistoricalEvent).where(HistoricalEvent.name == event_data["name"])
        )
        if result.scalar_one_or_none():
            continue
        
        event = HistoricalEvent(
            id=str(uuid4()),
            **event_data,
        )
        session.add(event)
        created += 1
    
    await session.commit()
    
    return {
        "message": f"Seeded {created} historical events",
        "total_available": len(events_data),
    }


# =============================================================================
# Helper Functions
# =============================================================================

def _event_to_response(event: HistoricalEvent) -> dict:
    """Convert event model to response dict."""
    return {
        "id": event.id,
        "name": event.name,
        "description": event.description,
        "event_type": event.event_type,
        "start_date": event.start_date.isoformat() if event.start_date else None,
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "duration_days": event.duration_days,
        "region_name": event.region_name,
        "country_codes": event.country_codes,
        "center_latitude": event.center_latitude,
        "center_longitude": event.center_longitude,
        "affected_area_km2": event.affected_area_km2,
        "severity_actual": event.severity_actual,
        "financial_loss_eur": event.financial_loss_eur,
        "insurance_claims_eur": event.insurance_claims_eur,
        "affected_population": event.affected_population,
        "casualties": event.casualties,
        "displaced_people": event.displaced_people,
        "affected_assets_count": event.affected_assets_count,
        "destroyed_assets_count": event.destroyed_assets_count,
        "damaged_assets_count": event.damaged_assets_count,
        "recovery_time_months": event.recovery_time_months,
        "reconstruction_cost_eur": event.reconstruction_cost_eur,
        "pd_multiplier_observed": event.pd_multiplier_observed,
        "lgd_multiplier_observed": event.lgd_multiplier_observed,
        "valuation_impact_pct_observed": event.valuation_impact_pct_observed,
        "cascade_effects": json.loads(event.cascade_effects) if event.cascade_effects else None,
        "affected_sectors": json.loads(event.affected_sectors) if event.affected_sectors else None,
        "lessons_learned": event.lessons_learned,
        "is_verified": event.is_verified,
        "tags": json.loads(event.tags) if event.tags else None,
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }
