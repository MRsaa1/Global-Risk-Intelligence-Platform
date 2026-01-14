"""Digital Twin endpoints - Layer 1: Living Digital Twins."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.database import get_db
from src.models.digital_twin import DigitalTwin, TwinState, TwinTimeline

router = APIRouter()


class DigitalTwinResponse(BaseModel):
    """Digital Twin response schema."""
    id: UUID
    asset_id: UUID
    state: TwinState
    
    # Geometry
    geometry_type: Optional[str]
    geometry_path: Optional[str]
    
    # Physical State
    structural_integrity: Optional[float]
    condition_score: Optional[float]
    remaining_useful_life_years: Optional[float]
    
    # Exposures
    climate_exposures: Optional[dict]
    infrastructure_dependencies: Optional[dict]
    
    # Financial
    financial_metrics: Optional[dict]
    
    # Futures
    future_scenarios: Optional[dict]
    
    class Config:
        from_attributes = True


class TimelineEventResponse(BaseModel):
    """Timeline event response schema."""
    id: UUID
    event_type: str
    event_date: str
    event_title: str
    event_description: Optional[str]
    data: Optional[dict]
    source: Optional[str]
    
    class Config:
        from_attributes = True


class TimelineEventCreate(BaseModel):
    """Create timeline event."""
    event_type: str
    event_date: str
    event_title: str
    event_description: Optional[str] = None
    data: Optional[dict] = None
    source: Optional[str] = None


@router.get("/{asset_id}", response_model=DigitalTwinResponse)
async def get_digital_twin(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the Digital Twin for an asset.
    
    Returns the complete Living Digital Twin including:
    - Current physical state
    - Climate exposures
    - Infrastructure dependencies
    - Financial metrics
    - Simulated future scenarios
    """
    result = await db.execute(
        select(DigitalTwin).where(DigitalTwin.asset_id == asset_id)
    )
    twin = result.scalar_one_or_none()
    
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")
    
    return twin


@router.get("/{asset_id}/timeline", response_model=list[TimelineEventResponse])
async def get_twin_timeline(
    asset_id: UUID,
    event_type: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the timeline history of a Digital Twin.
    
    The timeline contains the complete history:
    - genesis (construction)
    - renovations
    - inspections
    - incidents
    - sensor readings
    - valuations
    """
    # First get the twin
    result = await db.execute(
        select(DigitalTwin).where(DigitalTwin.asset_id == asset_id)
    )
    twin = result.scalar_one_or_none()
    
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")
    
    # Get timeline events
    query = select(TwinTimeline).where(TwinTimeline.digital_twin_id == twin.id)
    
    if event_type:
        query = query.where(TwinTimeline.event_type == event_type)
    
    query = query.order_by(TwinTimeline.event_date.desc()).limit(limit)
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    return events


@router.post("/{asset_id}/timeline", response_model=TimelineEventResponse, status_code=201)
async def add_timeline_event(
    asset_id: UUID,
    event: TimelineEventCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Add an event to the Digital Twin timeline.
    
    Event types:
    - genesis: Asset creation/construction
    - renovation: Major renovation or upgrade
    - inspection: Physical inspection
    - incident: Damage, issue, or incident
    - sensor: Automated sensor reading
    - valuation: Financial valuation update
    """
    from datetime import datetime
    
    # Get the twin
    result = await db.execute(
        select(DigitalTwin).where(DigitalTwin.asset_id == asset_id)
    )
    twin = result.scalar_one_or_none()
    
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")
    
    # Parse date
    try:
        event_date = datetime.fromisoformat(event.event_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
    
    timeline_event = TwinTimeline(
        digital_twin_id=twin.id,
        event_type=event.event_type,
        event_date=event_date,
        event_title=event.event_title,
        event_description=event.event_description,
        data=event.data,
        source=event.source,
    )
    
    db.add(timeline_event)
    await db.commit()
    await db.refresh(timeline_event)
    
    return timeline_event


@router.post("/{asset_id}/sync")
async def sync_digital_twin(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger synchronization of the Digital Twin.
    
    This will:
    1. Fetch latest sensor data
    2. Update climate exposures
    3. Recalculate risk scores
    4. Update financial metrics
    """
    result = await db.execute(
        select(DigitalTwin).where(DigitalTwin.asset_id == asset_id)
    )
    twin = result.scalar_one_or_none()
    
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")
    
    # TODO: Implement sync logic
    # For now, return placeholder
    return {
        "status": "sync_triggered",
        "asset_id": str(asset_id),
        "twin_id": str(twin.id),
        "message": "Synchronization will be implemented",
    }


@router.get("/{asset_id}/exposures")
async def get_climate_exposures(
    asset_id: UUID,
    scenario: str = "ssp245",
    time_horizon: int = 2050,
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed climate exposures for an asset.
    
    Scenarios:
    - ssp126: Sustainability (low emissions)
    - ssp245: Middle of the road
    - ssp585: Fossil-fueled development (high emissions)
    
    Returns exposure scores for:
    - Flood risk
    - Heat stress
    - Wind/storm risk
    - Wildfire risk
    - Sea level rise
    """
    result = await db.execute(
        select(DigitalTwin).where(DigitalTwin.asset_id == asset_id)
    )
    twin = result.scalar_one_or_none()
    
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")
    
    # TODO: Implement climate exposure calculation
    # For now, return sample data
    return {
        "asset_id": str(asset_id),
        "scenario": scenario,
        "time_horizon": time_horizon,
        "exposures": {
            "flood": {
                "score": 45,
                "return_period_100yr_depth_m": 1.2,
                "annual_probability": 0.01,
            },
            "heat_stress": {
                "score": 62,
                "cooling_degree_days_increase": 450,
                "extreme_heat_days_per_year": 35,
            },
            "wind": {
                "score": 28,
                "max_gust_100yr_ms": 42,
            },
            "wildfire": {
                "score": 15,
                "probability": 0.002,
            },
            "sea_level_rise": {
                "score": 8,
                "exposure_m": 0.3,
            },
        },
        "composite_score": 52,
        "data_sources": ["CMIP6", "FEMA NFHL", "Copernicus"],
    }
