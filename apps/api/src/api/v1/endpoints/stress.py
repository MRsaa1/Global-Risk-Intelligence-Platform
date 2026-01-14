"""
Stress Testing API Endpoints
=============================

Production-level stress testing with CPU-optimized Monte Carlo.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from src.services.stress_testing import (
    stress_testing_service,
    StressScenario,
    ScenarioType,
    StressResult
)
import structlog

logger = structlog.get_logger()
router = APIRouter()


class StressTestRequest(BaseModel):
    """Request for stress test."""
    asset_values: list[float] = Field(
        ..., 
        description="List of asset values in billions",
        min_length=1,
        max_length=1000
    )
    default_probs: list[float] = Field(
        ...,
        description="Default probabilities (0-1)",
        min_length=1
    )
    recovery_rates: Optional[list[float]] = Field(
        None,
        description="Recovery rates (0-1), defaults to 0.4"
    )
    scenario_type: ScenarioType = Field(
        ScenarioType.CREDIT_SHOCK,
        description="Type of stress scenario"
    )
    severity: float = Field(
        0.5,
        ge=0.0,
        le=1.0,
        description="Scenario severity (0-1)"
    )
    time_horizon_years: int = Field(
        5,
        ge=1,
        le=30,
        description="Time horizon in years"
    )
    num_simulations: int = Field(
        10000,
        ge=1000,
        le=1000000,
        description="Number of Monte Carlo simulations"
    )


class PortfolioRiskRequest(BaseModel):
    """Request for portfolio-level risk analysis."""
    total_exposure: float = Field(..., description="Total portfolio exposure in billions")
    num_assets: int = Field(50, ge=1, le=500)
    average_pd: float = Field(0.02, ge=0.001, le=0.5)
    average_lgd: float = Field(0.45, ge=0.0, le=1.0)
    correlation: float = Field(0.3, ge=0.0, le=0.99)
    scenario_type: ScenarioType = ScenarioType.CREDIT_SHOCK
    severity: float = Field(0.5, ge=0.0, le=1.0)


@router.post("/run", response_model=StressResult)
async def run_stress_test(request: StressTestRequest):
    """
    Run a comprehensive stress test on portfolio.
    
    Uses Numba-accelerated Monte Carlo simulation.
    Designed for high-performance CPU execution.
    
    Returns VaR, CVaR, cascade analysis, and recovery time.
    """
    logger.info(
        "Stress test requested",
        scenario=request.scenario_type,
        severity=request.severity,
        n_assets=len(request.asset_values),
        simulations=request.num_simulations
    )
    
    # Validate lengths
    if len(request.asset_values) != len(request.default_probs):
        raise HTTPException(
            status_code=400,
            detail="asset_values and default_probs must have same length"
        )
    
    # Default recovery rates
    recovery_rates = request.recovery_rates
    if recovery_rates is None:
        recovery_rates = [0.4] * len(request.asset_values)
    
    if len(recovery_rates) != len(request.asset_values):
        raise HTTPException(
            status_code=400,
            detail="recovery_rates must have same length as asset_values"
        )
    
    # Build scenario
    scenario = StressScenario(
        scenario_type=request.scenario_type,
        severity=request.severity,
        time_horizon_years=request.time_horizon_years,
        num_simulations=request.num_simulations
    )
    
    try:
        result = await stress_testing_service.run_stress_test(
            asset_values=request.asset_values,
            default_probs=request.default_probs,
            recovery_rates=recovery_rates,
            scenario=scenario
        )
        
        logger.info(
            "Stress test completed",
            var_99=result.var_99,
            cvar=result.expected_shortfall,
            simulations=result.simulation_count
        )
        
        return result
    
    except Exception as e:
        logger.error("Stress test failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portfolio", response_model=StressResult)
async def run_portfolio_stress_test(request: PortfolioRiskRequest):
    """
    Simplified portfolio-level stress test.
    
    Automatically generates portfolio structure from parameters.
    Good for quick scenario analysis.
    """
    import numpy as np
    
    # Generate portfolio
    np.random.seed(42)  # Reproducible
    
    # Asset values (log-normal distribution)
    mean_value = request.total_exposure / request.num_assets
    values = np.random.lognormal(
        np.log(mean_value), 
        0.5, 
        request.num_assets
    )
    values = values * (request.total_exposure / np.sum(values))  # Normalize
    
    # Default probabilities (beta distribution around average)
    pds = np.random.beta(
        request.average_pd * 10,
        (1 - request.average_pd) * 10,
        request.num_assets
    )
    pds = np.clip(pds, 0.001, 0.99)
    
    # Recovery rates
    rrs = np.random.beta(
        request.average_lgd * 5,
        (1 - request.average_lgd) * 5,
        request.num_assets
    )
    rrs = 1 - np.clip(rrs, 0.1, 0.9)  # Convert LGD to RR
    
    scenario = StressScenario(
        scenario_type=request.scenario_type,
        severity=request.severity,
        num_simulations=50000  # Higher for portfolio
    )
    
    result = await stress_testing_service.run_stress_test(
        asset_values=values.tolist(),
        default_probs=pds.tolist(),
        recovery_rates=rrs.tolist(),
        scenario=scenario
    )
    
    return result


@router.get("/scenarios")
async def list_scenarios():
    """List available stress scenarios."""
    scenarios = [
        {
            "type": ScenarioType.CLIMATE_PHYSICAL,
            "name": "Climate Physical Risk",
            "description": "Physical climate impacts (floods, storms, heat)",
            "recommended_severity": 0.7
        },
        {
            "type": ScenarioType.CLIMATE_TRANSITION,
            "name": "Climate Transition Risk",
            "description": "Transition to low-carbon economy",
            "recommended_severity": 0.5
        },
        {
            "type": ScenarioType.CREDIT_SHOCK,
            "name": "Credit Shock",
            "description": "Sudden credit quality deterioration",
            "recommended_severity": 0.6
        },
        {
            "type": ScenarioType.LIQUIDITY_CRISIS,
            "name": "Liquidity Crisis",
            "description": "Market-wide liquidity freeze",
            "recommended_severity": 0.8
        },
        {
            "type": ScenarioType.CORRELATION_SPIKE,
            "name": "Correlation Spike",
            "description": "Sudden increase in asset correlations",
            "recommended_severity": 0.7
        },
        {
            "type": ScenarioType.PANDEMIC,
            "name": "Pandemic",
            "description": "Global health crisis impact",
            "recommended_severity": 0.6
        },
        {
            "type": ScenarioType.GEOPOLITICAL,
            "name": "Geopolitical Crisis",
            "description": "Regional conflict or sanctions",
            "recommended_severity": 0.5
        },
    ]
    return {"scenarios": scenarios}
