"""
HTTP API for reg-calculator service.

Provides REST API endpoints for running calculations.
"""

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import time
import structlog
import uvicorn

from apps.reg_calculator.engine import DistributedCalculationEngine
from libs.dsl_schema import ScenarioDSL
from apps.reg_calculator.observability import metrics_collector, setup_logging

# Setup observability
setup_logging()
logger = structlog.get_logger(__name__)

app = FastAPI(
    title="🌐 Reg Calculator API",
    description="Institutional-Grade Regulatory Calculation Engine",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CalculationRequest(BaseModel):
    """Calculation request model."""
    scenario_id: str
    portfolio_id: str


class CalculationResponse(BaseModel):
    """Calculation response model."""
    status: str
    calculation_id: Optional[str] = None
    outputs: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# Global calculation engine
engine = DistributedCalculationEngine(backend="ray", cache_enabled=True)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "reg-calculator",
        "version": "1.0.0",
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(
        content=metrics_collector.get_metrics(),
        media_type="text/plain",
    )


@app.post("/calculate", response_model=CalculationResponse)
async def calculate(request: CalculationRequest):
    """
    Execute calculation.

    Args:
        request: Calculation request with scenario_id and portfolio_id

    Returns:
        Calculation results
    """
    start_time = time.time()
    
    try:
        logger.info(
            "Calculation request",
            scenario_id=request.scenario_id,
            portfolio_id=request.portfolio_id,
        )

        # Increment metrics
        metrics_collector.increment_counter(
            "calculations_total",
            labels={"status": "started", "scenario_type": "default"},
        )

        # TODO: Load scenario from database or file
        # For now, use placeholder scenario
        from datetime import datetime
        from libs.dsl_schema.schema import (
            ScenarioMetadata,
            PortfolioReference,
            RegulatoryRule,
        )
        from libs.dsl_schema.schema import Jurisdiction, RegulatoryFramework

        metadata = ScenarioMetadata(
            scenario_id=request.scenario_id,
            name="API Scenario",
        )

        portfolio_ref = PortfolioReference(
            portfolio_id=request.portfolio_id,
            as_of_date=datetime.utcnow(),
        )

        scenario = ScenarioDSL(
            metadata=metadata,
            portfolio=portfolio_ref,
            regulatory_rules=[
                RegulatoryRule(
                    framework=RegulatoryFramework.BASEL_IV,
                    jurisdiction=Jurisdiction.US_FED,
                )
            ],
            calculation_steps=[],
            outputs=[],
        )

        # Execute calculation
        results = engine.execute(scenario, request.portfolio_id)

        # Record metrics
        duration = time.time() - start_time
        metrics_collector.observe_histogram(
            "calculation_duration_seconds",
            duration,
            labels={"scenario_type": "default"},
        )

        if results.get("status") == "success":
            metrics_collector.increment_counter(
                "calculations_total",
                labels={"status": "success", "scenario_type": "default"},
            )
            
            return CalculationResponse(
                status="success",
                calculation_id=f"calc_{request.scenario_id}",
                outputs=results.get("outputs", {}),
            )
        else:
            metrics_collector.increment_counter(
                "calculations_total",
                labels={"status": "error", "scenario_type": "default"},
            )
            
            return CalculationResponse(
                status="error",
                error=results.get("errors", ["Unknown error"])[0] if results.get("errors") else "Unknown error",
            )

    except Exception as e:
        logger.error("Calculation error", error=str(e), exc_info=True)
        metrics_collector.increment_counter(
            "calculations_total",
            labels={"status": "error", "scenario_type": "default"},
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/calculations/{calculation_id}")
async def get_calculation(calculation_id: str):
    """Get calculation status (placeholder)."""
    return {
        "calculation_id": calculation_id,
        "status": "completed",
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)

