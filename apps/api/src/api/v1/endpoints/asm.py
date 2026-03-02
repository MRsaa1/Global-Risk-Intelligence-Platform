"""ASM - Nuclear Safety & Monitoring API endpoints."""
import logging
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from src.modules.asm.service import asm_service

logger = logging.getLogger(__name__)
router = APIRouter()


class NuclearWinterRequest(BaseModel):
    """Nuclear winter simulation parameters."""
    warheads_used: int = Field(100, ge=1, le=10000)
    yield_kt_avg: float = Field(100, ge=1, le=50000)
    target_type: str = Field("mixed", description="mixed, countervalue, counterforce")


@router.get("/dashboard")
async def asm_dashboard():
    """Get ASM module dashboard with reactors, weapons, and escalation ladder."""
    return asm_service.get_dashboard()


@router.get("/reactors")
async def get_reactors(
    country: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="operational, under_construction, shutdown"),
):
    """Get nuclear reactor registry."""
    return asm_service.get_reactors(country=country, status=status)


@router.get("/reactors/{reactor_id}/risk")
async def assess_reactor_risk(reactor_id: str):
    """Assess risk for a specific nuclear reactor."""
    return asm_service.assess_reactor_risk(reactor_id)


@router.get("/nuclear-states")
async def get_nuclear_states():
    """Get nuclear-armed states data."""
    return asm_service.get_nuclear_states()


@router.get("/escalation-ladder")
async def get_escalation_ladder():
    """Get geopolitical escalation ladder levels."""
    return asm_service.get_escalation_ladder()


@router.post("/simulate/nuclear-winter")
async def simulate_nuclear_winter(request: NuclearWinterRequest):
    """Simulate nuclear winter effects including temperature, agriculture, and recovery."""
    return asm_service.simulate_nuclear_winter(
        warheads_used=request.warheads_used,
        yield_kt_avg=request.yield_kt_avg,
        target_type=request.target_type,
    )
