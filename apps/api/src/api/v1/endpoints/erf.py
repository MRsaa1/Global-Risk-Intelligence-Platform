"""ERF - Existential Risk Framework API endpoints."""
import logging
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from src.modules.erf.service import erf_service

logger = logging.getLogger(__name__)
router = APIRouter()


class DomainOverrideRequest(BaseModel):
    """Override a domain probability."""
    domain: str = Field(..., description="Risk domain: agi, biosecurity, nuclear, climate, financial")
    probability: float = Field(..., ge=0, le=1)


@router.get("/dashboard")
async def erf_dashboard():
    """Get comprehensive ERF risk dashboard with domains, correlations, and timeline."""
    return erf_service.get_risk_dashboard()


@router.get("/extinction-probability")
async def compute_extinction(
    target_year: int = Query(2100, ge=2025, le=2500),
    monte_carlo_runs: int = Query(10_000, ge=1_000, le=100_000),
    include_correlations: bool = Query(True),
):
    """Compute P(extinction) using Monte Carlo simulation with correlated domains."""
    result = erf_service.compute_extinction_probability(
        target_year=target_year,
        monte_carlo_runs=monte_carlo_runs,
        include_correlations=include_correlations,
    )
    return result.to_dict()


@router.get("/timeline")
async def extinction_timeline(
    years: Optional[str] = Query(None, description="Comma-separated years, e.g. 2030,2050,2100"),
    monte_carlo_runs: int = Query(5_000, ge=1_000, le=50_000),
):
    """Compute extinction probability timeline across multiple target years."""
    year_list = None
    if years:
        year_list = [int(y.strip()) for y in years.split(",")]
    return erf_service.compute_timeline(years=year_list, monte_carlo_runs=monte_carlo_runs)


@router.get("/domains")
async def get_domains():
    """Get current domain risk contributions."""
    contributions = erf_service.get_domain_contributions()
    return [c.to_dict() for c in contributions]


@router.get("/correlations")
async def get_correlations():
    """Get cross-domain correlation matrix."""
    correlations = erf_service.get_correlations()
    return [c.to_dict() for c in correlations]


@router.post("/domains/override")
async def override_domain(request: DomainOverrideRequest):
    """Override a domain's base probability with observed/computed value."""
    erf_service.set_domain_probability(request.domain, request.probability)
    return {"status": "updated", "domain": request.domain, "probability": request.probability}


@router.get("/longtermist-analysis")
async def longtermist_analysis(
    intervention_cost_m: float = Query(10.0, description="Intervention cost in millions USD"),
    p_reduction_per_m: float = Query(0.0001, description="P(extinction) reduction per $1M spent"),
    future_lives: float = Query(1e15, description="Total future lives at stake"),
):
    """Longtermist cost-effectiveness analysis for risk reduction interventions."""
    return erf_service.longtermist_optimizer(
        intervention_cost_m=intervention_cost_m,
        p_reduction_per_m=p_reduction_per_m,
        future_lives_at_stake=future_lives,
    )


@router.get("/tier-classification")
async def tier_classification():
    """Get current risk tier classification with thresholds."""
    ep = erf_service.compute_extinction_probability(2100, 2_000)
    return {
        "current_tier": ep.tier.value,
        "p_extinction": round(ep.p_extinction, 6),
        "tier_thresholds": {
            "X": ">= 1% (extinction-level)",
            "1": "0.1% - 1% (catastrophic)",
            "2": "0.01% - 0.1% (severe)",
            "3": "< 0.01% (elevated)",
            "M": "monitoring only",
        },
    }
