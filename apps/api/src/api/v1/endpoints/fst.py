"""FST (Financial System Stress Test Engine) module API endpoints.

Full scenario library (EBA/CCAR/PRA/NGFS), interbank contagion,
liquidity stress (LCR/NSFR), capital adequacy, and batch runs.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.modules.fst.service import FSTService
from src.services.module_audit import log_module_action

router = APIRouter()


class RunScenarioRequest(BaseModel):
    scenario_id: str = Field(..., description="e.g. eba_2024_adverse, fed_ccar_severely_adverse")
    regulatory_format: Optional[str] = Field(None, description="basel, fed, ecb")
    params: Optional[Dict[str, Any]] = None


class BatchRunRequest(BaseModel):
    scenario_ids: List[str] = Field(..., min_length=1, max_length=12)
    regulatory_format: Optional[str] = None
    params: Optional[Dict[str, Any]] = None


class InterbankContagionRequest(BaseModel):
    n_banks: int = Field(20, ge=2, le=100)
    default_probability: float = Field(0.05, ge=0, le=1)
    exposure_pct: float = Field(0.15, ge=0, le=1)
    n_rounds: int = Field(5, ge=1, le=20)
    n_mc: int = Field(500, ge=50, le=5000)


class LCRStressRequest(BaseModel):
    hqla_usd: float = Field(50e9, gt=0)
    net_outflows_30d_usd: float = Field(45e9, gt=0)
    deposit_runoff_pct: float = Field(0.10, ge=0, le=1)
    collateral_haircut_pct: float = Field(0.15, ge=0, le=1)


class NSFRStressRequest(BaseModel):
    available_stable_funding_usd: float = Field(80e9, gt=0)
    required_stable_funding_usd: float = Field(75e9, gt=0)
    wholesale_freeze_pct: float = Field(0.20, ge=0, le=1)


class CapitalImpactRequest(BaseModel):
    cet1_capital_usd: float = Field(30e9, gt=0)
    rwa_usd: float = Field(300e9, gt=0)
    scenario_loss_usd: float = Field(10e9, ge=0)
    rwa_inflation_pct: float = Field(0.10, ge=0, le=1)


@router.get("/scenarios")
async def list_scenarios(
    category: Optional[str] = Query(None, description="eba, ccar, pra, custom, liquidity, systemic, ngfs"),
    severity: Optional[str] = Query(None, description="baseline, adverse, severely_adverse, severe"),
    db: AsyncSession = Depends(get_db),
):
    """List FST scenarios with optional filtering by category and severity."""
    svc = FSTService(db)
    return await svc.list_scenarios(category=category, severity=severity)


@router.post("/scenarios/run")
async def run_scenario(body: RunScenarioRequest, db: AsyncSession = Depends(get_db)):
    """Run an FST scenario and return regulatory report structure."""
    svc = FSTService(db)
    result = await svc.run_scenario(
        scenario_id=body.scenario_id,
        regulatory_format=body.regulatory_format,
        params=body.params,
    )
    if "fst_run_id" in result:
        await log_module_action(db, "fst", "run", entity_type="scenario_run", entity_id=result.get("fst_run_id"), details={"scenario_id": body.scenario_id, "regulatory_format": body.regulatory_format})
        await db.commit()
    return result


@router.post("/scenarios/batch")
async def run_batch(body: BatchRunRequest, db: AsyncSession = Depends(get_db)):
    """Run multiple FST scenarios for cross-comparison."""
    svc = FSTService(db)
    results = await svc.run_batch(body.scenario_ids, body.regulatory_format, body.params)
    await log_module_action(db, "fst", "batch_run", entity_type="scenario_batch", details={"scenario_ids": body.scenario_ids})
    await db.commit()
    return {"runs": results, "count": len(results)}


@router.get("/runs")
async def list_runs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List recent FST runs."""
    svc = FSTService(db)
    return await svc.list_runs(limit=limit, offset=offset)


@router.get("/runs/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single FST run by id or fst_id."""
    svc = FSTService(db)
    result = await svc.get_run(run_id)
    if not result:
        raise HTTPException(status_code=404, detail="FST run not found")
    return result


@router.post("/interbank-contagion")
async def interbank_contagion(body: InterbankContagionRequest, db: AsyncSession = Depends(get_db)):
    """Monte Carlo interbank contagion simulation."""
    svc = FSTService(db)
    result = svc.simulate_interbank_contagion(
        n_banks=body.n_banks,
        default_probability=body.default_probability,
        exposure_pct=body.exposure_pct,
        n_rounds=body.n_rounds,
        n_mc=body.n_mc,
    )
    await log_module_action(db, "fst", "interbank_contagion", entity_type="simulation", details={"n_banks": body.n_banks})
    await db.commit()
    return result


@router.post("/liquidity/lcr")
async def lcr_stress(body: LCRStressRequest, db: AsyncSession = Depends(get_db)):
    """Compute stressed Liquidity Coverage Ratio."""
    svc = FSTService(db)
    return svc.compute_lcr_stress(
        hqla_usd=body.hqla_usd,
        net_outflows_30d_usd=body.net_outflows_30d_usd,
        deposit_runoff_pct=body.deposit_runoff_pct,
        collateral_haircut_pct=body.collateral_haircut_pct,
    )


@router.post("/liquidity/nsfr")
async def nsfr_stress(body: NSFRStressRequest, db: AsyncSession = Depends(get_db)):
    """Compute stressed Net Stable Funding Ratio."""
    svc = FSTService(db)
    return svc.compute_nsfr_stress(
        available_stable_funding_usd=body.available_stable_funding_usd,
        required_stable_funding_usd=body.required_stable_funding_usd,
        wholesale_freeze_pct=body.wholesale_freeze_pct,
    )


@router.post("/capital-impact")
async def capital_impact(body: CapitalImpactRequest, db: AsyncSession = Depends(get_db)):
    """Compute capital adequacy impact from stress scenario."""
    svc = FSTService(db)
    return svc.compute_capital_impact(
        cet1_capital_usd=body.cet1_capital_usd,
        rwa_usd=body.rwa_usd,
        scenario_loss_usd=body.scenario_loss_usd,
        rwa_inflation_pct=body.rwa_inflation_pct,
    )


@router.get("/status")
async def fst_status(db: AsyncSession = Depends(get_db)) -> dict:
    svc = FSTService(db)
    scenarios = await svc.list_scenarios()
    runs = await svc.list_runs(limit=5)
    categories = list({s.get("category", "custom") for s in scenarios})
    return {
        "module": "fst",
        "status": "operational",
        "enabled": True,
        "scenarios_count": len(scenarios),
        "categories": categories,
        "recent_runs": len(runs),
        "features": ["interbank_contagion", "lcr_stress", "nsfr_stress", "capital_adequacy", "batch_runs"],
    }
