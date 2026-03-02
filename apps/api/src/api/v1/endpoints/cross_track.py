"""Cross-Track Synergy API endpoints."""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services import cross_track_synergy as svc

logger = logging.getLogger(__name__)
router = APIRouter()


class ObservationRequest(BaseModel):
    """Record a field observation."""
    city: str
    observation_type: str = Field(
        ...,
        description="flood_event, heat_event, infrastructure_failure, adaptation_performance",
    )
    predicted_severity: float = Field(..., ge=0, le=1)
    observed_severity: float = Field(..., ge=0, le=1)
    predicted_loss_m: float = 0.0
    observed_loss_m: float = 0.0
    h3_cell: str = ""
    adaptation_measure_id: Optional[str] = None
    adaptation_effectiveness: Optional[float] = None
    population_affected: int = 0
    notes: str = ""
    stress_test_id: Optional[str] = None


@router.get("/dashboard")
async def cross_track_dashboard(db: AsyncSession = Depends(get_db)):
    """Get cross-track synergy dashboard."""
    return await svc.get_dashboard(db)


@router.post("/observations")
async def record_observation(
    request: ObservationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Record a field observation from Track B (municipal deployment)."""
    obs = await svc.record_observation(
        db,
        city=request.city,
        observation_type=request.observation_type,
        predicted_severity=request.predicted_severity,
        observed_severity=request.observed_severity,
        predicted_loss_m=request.predicted_loss_m,
        observed_loss_m=request.observed_loss_m,
        h3_cell=request.h3_cell,
        adaptation_measure_id=request.adaptation_measure_id,
        adaptation_effectiveness=request.adaptation_effectiveness,
        population_affected=request.population_affected,
        notes=request.notes,
        stress_test_id=request.stress_test_id,
    )
    return {"status": "recorded", "observation": obs}


@router.get("/observations")
async def get_observations(
    db: AsyncSession = Depends(get_db),
    city: Optional[str] = Query(None),
    observation_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get recorded field observations."""
    return await svc.get_observations(db, city=city, observation_type=observation_type, limit=limit)


@router.post("/calibrate")
async def run_calibration(
    db: AsyncSession = Depends(get_db),
    model_name: str = Query("stress_test"),
):
    """Run model calibration using observed vs predicted data."""
    return await svc.run_calibration(db, model_name=model_name)


@router.get("/recalibration-triggers")
async def get_triggers(db: AsyncSession = Depends(get_db)):
    """Get automatic recalibration trigger events (>30% error)."""
    return await svc.get_recalibration_triggers(db)


@router.get("/adaptation-analytics")
async def adaptation_analytics(db: AsyncSession = Depends(get_db)):
    """Get aggregated adaptation measure effectiveness data."""
    return await svc.get_adaptation_analytics(db)
