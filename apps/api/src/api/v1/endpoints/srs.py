"""SRS (Sovereign Risk Shield) module API endpoints."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.modules.srs.service import SRSService
from src.modules.srs.models import SovereignFund, ResourceDeposit
from src.services.module_audit import log_module_action

router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================


class SovereignFundCreate(BaseModel):
    """Create sovereign fund."""
    name: str = Field(..., min_length=1, max_length=255)
    country_code: str = Field(..., min_length=2, max_length=2)
    description: Optional[str] = None
    total_assets_usd: Optional[float] = None
    currency: str = Field(default="USD", max_length=3)
    status: str = Field(default="active")
    established_year: Optional[int] = None
    mandate: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class SovereignFundResponse(BaseModel):
    """Sovereign fund response."""
    id: str
    srs_id: str
    name: str
    country_code: str
    description: Optional[str] = None
    total_assets_usd: Optional[float] = None
    currency: str
    status: str
    established_year: Optional[int] = None
    mandate: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class ResourceDepositCreate(BaseModel):
    """Create resource deposit."""
    name: str = Field(..., min_length=1, max_length=255)
    resource_type: str = Field(..., max_length=50)
    country_code: str = Field(..., min_length=2, max_length=2)
    sovereign_fund_id: Optional[str] = None
    estimated_value_usd: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    extraction_horizon_years: Optional[int] = None


class ResourceDepositResponse(BaseModel):
    """Resource deposit response."""
    id: str
    srs_id: str
    name: str
    resource_type: str
    country_code: str
    sovereign_fund_id: Optional[str] = None
    estimated_value_usd: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    extraction_horizon_years: Optional[int] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class ScenarioRunRequest(BaseModel):
    """Run SRS scenario."""
    scenario_type: str = Field(..., description="e.g. sovereign_solvency_stress, regime_transition")
    country_code: Optional[str] = None
    fund_id: Optional[str] = None
    params: Optional[Dict[str, Any]] = None


def _fund_to_response(f: SovereignFund) -> SovereignFundResponse:
    return SovereignFundResponse(
        id=f.id,
        srs_id=f.srs_id,
        name=f.name,
        country_code=f.country_code,
        description=f.description,
        total_assets_usd=f.total_assets_usd,
        currency=f.currency,
        status=f.status,
        established_year=f.established_year,
        mandate=f.mandate,
        created_at=f.created_at.isoformat() if f.created_at else None,
    )


def _deposit_to_response(d: ResourceDeposit) -> ResourceDepositResponse:
    return ResourceDepositResponse(
        id=d.id,
        srs_id=d.srs_id,
        name=d.name,
        resource_type=d.resource_type,
        country_code=d.country_code,
        sovereign_fund_id=d.sovereign_fund_id,
        estimated_value_usd=d.estimated_value_usd,
        latitude=d.latitude,
        longitude=d.longitude,
        description=d.description,
        extraction_horizon_years=d.extraction_horizon_years,
        created_at=d.created_at.isoformat() if d.created_at else None,
    )


# ==================== FUNDS ====================


@router.get("/funds", response_model=List[SovereignFundResponse])
async def list_funds(
    country_code: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List sovereign funds."""
    svc = SRSService(db)
    funds = await svc.list_funds(country_code=country_code, status=status, limit=limit, offset=offset)
    return [_fund_to_response(f) for f in funds]


@router.post("/funds", response_model=SovereignFundResponse)
async def create_fund(
    body: SovereignFundCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a sovereign fund."""
    svc = SRSService(db)
    fund = await svc.create_fund(
        name=body.name,
        country_code=body.country_code.upper(),
        description=body.description,
        total_assets_usd=body.total_assets_usd,
        currency=body.currency,
        status=body.status,
        established_year=body.established_year,
        mandate=body.mandate,
        extra_data=body.extra_data,
    )
    await log_module_action(db, "srs", "create", entity_type="sovereign_fund", entity_id=fund.id, details={"srs_id": fund.srs_id, "name": fund.name})
    await db.commit()
    await db.refresh(fund)
    return _fund_to_response(fund)


@router.get("/funds/{fund_id}", response_model=SovereignFundResponse)
async def get_fund(
    fund_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a sovereign fund by id or srs_id."""
    svc = SRSService(db)
    fund = await svc.get_fund(fund_id)
    if not fund:
        raise HTTPException(status_code=404, detail="Sovereign fund not found")
    return _fund_to_response(fund)


# ==================== DEPOSITS ====================


@router.get("/deposits", response_model=List[ResourceDepositResponse])
async def list_deposits(
    country_code: Optional[str] = Query(None),
    sovereign_fund_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List resource deposits."""
    svc = SRSService(db)
    deposits = await svc.list_deposits(
        country_code=country_code,
        sovereign_fund_id=sovereign_fund_id,
        resource_type=resource_type,
        limit=limit,
        offset=offset,
    )
    return [_deposit_to_response(d) for d in deposits]


@router.post("/deposits", response_model=ResourceDepositResponse)
async def create_deposit(
    body: ResourceDepositCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a resource deposit."""
    svc = SRSService(db)
    dep = await svc.create_deposit(
        name=body.name,
        resource_type=body.resource_type,
        country_code=body.country_code.upper(),
        sovereign_fund_id=body.sovereign_fund_id,
        estimated_value_usd=body.estimated_value_usd,
        latitude=body.latitude,
        longitude=body.longitude,
        description=body.description,
        extraction_horizon_years=body.extraction_horizon_years,
    )
    await log_module_action(db, "srs", "create", entity_type="resource_deposit", entity_id=dep.id, details={"srs_id": dep.srs_id, "name": dep.name})
    await db.commit()
    await db.refresh(dep)
    return _deposit_to_response(dep)


@router.get("/deposits/{deposit_id}", response_model=ResourceDepositResponse)
async def get_deposit(
    deposit_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a resource deposit by id or srs_id."""
    svc = SRSService(db)
    dep = await svc.get_deposit(deposit_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Resource deposit not found")
    return _deposit_to_response(dep)


# ==================== UPDATE / DELETE ====================


class SovereignFundUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    total_assets_usd: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    mandate: Optional[str] = None


@router.patch("/funds/{fund_id}", response_model=SovereignFundResponse)
async def update_fund(fund_id: str, body: SovereignFundUpdate, db: AsyncSession = Depends(get_db)):
    """Update a sovereign fund."""
    svc = SRSService(db)
    fund = await svc.update_fund(fund_id, **body.model_dump(exclude_none=True))
    if not fund:
        raise HTTPException(status_code=404, detail="Sovereign fund not found")
    await log_module_action(db, "srs", "update", entity_type="sovereign_fund", entity_id=fund.id, details=body.model_dump(exclude_none=True))
    await db.commit()
    await db.refresh(fund)
    return _fund_to_response(fund)


@router.delete("/funds/{fund_id}")
async def delete_fund(fund_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a sovereign fund."""
    svc = SRSService(db)
    ok = await svc.delete_fund(fund_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Sovereign fund not found")
    await log_module_action(db, "srs", "delete", entity_type="sovereign_fund", entity_id=fund_id)
    await db.commit()
    return {"status": "deleted", "id": fund_id}


# ==================== INDICATORS & SCENARIOS ====================


@router.get("/indicators")
async def get_indicators(
    country_code: Optional[str] = Query(None),
    indicator_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get sovereign risk indicators."""
    svc = SRSService(db)
    return await svc.get_indicators(
        country_code=country_code,
        indicator_type=indicator_type,
        limit=limit,
    )


@router.post("/scenarios/run")
async def run_scenario(
    body: ScenarioRunRequest,
    db: AsyncSession = Depends(get_db),
):
    """Run an SRS scenario (sovereign solvency stress, regime transition, etc.)."""
    svc = SRSService(db)
    result = await svc.run_scenario(
        scenario_type=body.scenario_type,
        country_code=body.country_code,
        fund_id=body.fund_id,
        params=body.params,
    )
    await log_module_action(db, "srs", "run_scenario", entity_type="scenario", details={"scenario_type": body.scenario_type, "country_code": body.country_code, "fund_id": body.fund_id})
    await db.commit()
    return result


class BatchScenarioRequest(BaseModel):
    """Run multiple scenarios at once for comparison."""
    scenario_types: List[str] = Field(..., min_length=1, max_length=10)
    country_code: Optional[str] = None
    fund_id: Optional[str] = None
    params: Optional[Dict[str, Any]] = None


@router.post("/scenarios/batch")
async def run_batch_scenarios(
    body: BatchScenarioRequest,
    db: AsyncSession = Depends(get_db),
):
    """Run multiple SRS scenarios for comparison."""
    svc = SRSService(db)
    results = await svc.run_batch_scenarios(
        scenario_types=body.scenario_types,
        country_code=body.country_code,
        fund_id=body.fund_id,
        params=body.params,
    )
    await log_module_action(db, "srs", "batch_scenarios", entity_type="scenario", details={"types": body.scenario_types})
    await db.commit()
    return {"scenarios": results, "count": len(results)}


@router.get("/scenarios/types")
async def list_scenario_types():
    """List available SRS scenario types."""
    return {
        "scenario_types": [
            {"id": "sovereign_solvency_stress", "name": "Sovereign Solvency Stress", "description": "Monte Carlo simulation of fund & deposit wealth under stress shocks"},
            {"id": "commodity_shock", "name": "Commodity Price Shock", "description": "Oil/gas/mineral price crash impact on resource deposits"},
            {"id": "capital_flight", "name": "Capital Flight", "description": "Sustained capital outflows from sovereign funds"},
            {"id": "sanctions", "name": "Sanctions", "description": "Asset freeze and export restrictions"},
            {"id": "regime_transition", "name": "Regime Transition", "description": "Governance shock reducing fund management efficiency"},
            {"id": "resource_depletion", "name": "Resource Depletion", "description": "Accelerated resource extraction and depletion timeline"},
            {"id": "demographic_shift", "name": "Demographic Shift", "description": "Aging population and fiscal burden on sovereign wealth"},
            {"id": "fx_crisis", "name": "FX Crisis", "description": "Local currency devaluation impact on USD-denominated value"},
        ]
    }


# ==================== AGGREGATIONS ====================


@router.get("/countries/{country_code}/summary")
async def country_summary(country_code: str, db: AsyncSession = Depends(get_db)):
    """Get aggregated summary for a country: wealth, funds, resource mix."""
    svc = SRSService(db)
    return await svc.get_country_summary(country_code)


@router.get("/heatmap")
async def heatmap_data(db: AsyncSession = Depends(get_db)):
    """Per-country wealth data for heatmap visualization."""
    svc = SRSService(db)
    return await svc.get_heatmap_data()


# ==================== STATUS ====================


@router.get("/status")
async def srs_status(db: AsyncSession = Depends(get_db)) -> dict:
    """SRS module status."""
    svc = SRSService(db)
    funds = await svc.list_funds(limit=1000)
    deposits = await svc.list_deposits(limit=1000)
    countries = list({f.country_code for f in funds} | {d.country_code for d in deposits})
    return {
        "module": "srs",
        "status": "operational",
        "enabled": True,
        "funds_count": len(funds),
        "deposits_count": len(deposits),
        "countries": countries,
        "total_fund_assets_usd": sum(f.total_assets_usd or 0 for f in funds),
        "total_deposit_value_usd": sum(d.estimated_value_usd or 0 for d in deposits),
        "scenario_types_available": 8,
    }
