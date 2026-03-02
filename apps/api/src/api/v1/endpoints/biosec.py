"""BIOSEC - Biosecurity & Pandemic API endpoints."""
import logging
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from src.modules.biosec.service import biosec_service

logger = logging.getLogger(__name__)
router = APIRouter()


class PandemicSimRequest(BaseModel):
    """Pandemic simulation parameters."""
    population: float = Field(8e9, description="Total population")
    initial_infected: float = Field(100, description="Initial infected count")
    r0: float = Field(3.0, ge=0.1, le=20, description="Basic reproduction number")
    ifr: float = Field(0.02, ge=0.001, le=0.5, description="Infection fatality rate")
    recovery_days: float = Field(14, ge=1, le=60)
    days: int = Field(365, ge=30, le=1095)
    containment_day: int = Field(30, ge=0, le=365)
    containment_effectiveness: float = Field(0.5, ge=0, le=1)


@router.get("/dashboard")
async def biosec_dashboard():
    """Get BIOSEC module dashboard with BSL-4 labs and risk summary."""
    return biosec_service.get_dashboard()


@router.get("/labs")
async def get_labs(country: Optional[str] = Query(None)):
    """Get BSL-4 lab registry."""
    return biosec_service.get_labs(country=country)


@router.get("/labs/{lab_id}/risk")
async def assess_lab_risk(lab_id: str):
    """Assess risk for a specific BSL-4 lab including nearby airports."""
    return biosec_service.assess_lab_risk(lab_id)


@router.get("/airports")
async def get_airports():
    """Get major airport hubs for pandemic spread modeling."""
    return biosec_service.get_airports()


@router.get("/spread-network")
async def get_spread_network():
    """Get airport + BSL-4 lab network for spread visualization."""
    return biosec_service.get_spread_network()


@router.post("/simulate/pandemic")
async def simulate_pandemic(request: PandemicSimRequest):
    """Run SIR pandemic spread simulation."""
    result = biosec_service.simulate_pandemic(
        population=request.population,
        initial_infected=request.initial_infected,
        r0=request.r0,
        ifr=request.ifr,
        recovery_days=request.recovery_days,
        days=request.days,
        containment_day=request.containment_day,
        containment_effectiveness=request.containment_effectiveness,
    )
    return {
        "parameters": {
            "r0": request.r0,
            "ifr": request.ifr,
            "population": request.population,
            "containment_day": request.containment_day,
            "containment_effectiveness": request.containment_effectiveness,
        },
        "timeline": result,
        "total_days_simulated": len(result),
        "peak_infected": max(r["infected"] for r in result) if result else 0,
        "total_dead": result[-1]["dead"] if result else 0,
    }
