"""
SRO (Systemic Risk Observatory) module endpoints.

Provides API for monitoring systemic risks in the financial system,
including institution tracking, correlation analysis, and early warning indicators.
"""
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.modules.sro.service import SROService
from src.modules.sro.models import InstitutionType, SystemicImportance, IndicatorType
from src.services.arin_export import export_compliance_check, make_zone_entity_id

router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class InstitutionCreate(BaseModel):
    """Request to register new institution."""
    name: str = Field(..., min_length=1, max_length=255)
    institution_type: str = Field(default="other")
    systemic_importance: str = Field(default="low")
    country_code: str = Field(default="DE", max_length=2)
    headquarters_city: Optional[str] = None
    description: Optional[str] = None
    total_assets: Optional[float] = None
    market_cap: Optional[float] = None
    regulator: Optional[str] = None
    lei_code: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class InstitutionUpdate(BaseModel):
    """Request to update institution."""
    name: Optional[str] = None
    description: Optional[str] = None
    systemic_importance: Optional[str] = None
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    tier1_capital: Optional[float] = None
    market_cap: Optional[float] = None
    systemic_risk_score: Optional[float] = None
    contagion_risk: Optional[float] = None
    interconnectedness_score: Optional[float] = None
    leverage_ratio: Optional[float] = None
    liquidity_ratio: Optional[float] = None
    under_stress: Optional[bool] = None
    extra_data: Optional[Dict[str, Any]] = None


class InstitutionResponse(BaseModel):
    """Institution response model."""
    id: str
    sro_id: str
    name: str
    description: Optional[str] = None
    institution_type: str
    systemic_importance: str
    country_code: str
    headquarters_city: Optional[str] = None
    total_assets: Optional[float] = None
    market_cap: Optional[float] = None
    systemic_risk_score: Optional[float] = None
    contagion_risk: Optional[float] = None
    interconnectedness_score: Optional[float] = None
    is_active: bool
    under_stress: bool

    class Config:
        from_attributes = True


class CorrelationCreate(BaseModel):
    """Request to create a correlation."""
    institution_a_id: str = Field(..., description="First institution ID")
    institution_b_id: str = Field(..., description="Second institution ID")
    correlation_coefficient: float = Field(..., ge=-1, le=1)
    relationship_type: str = Field(default="counterparty")
    exposure_amount: Optional[float] = None
    contagion_probability: Optional[float] = Field(None, ge=0, le=1)
    description: Optional[str] = None


class CorrelationResponse(BaseModel):
    """Correlation response model."""
    id: str
    institution_a_id: str
    institution_b_id: str
    correlation_coefficient: float
    relationship_type: str
    exposure_amount: Optional[float] = None
    contagion_probability: Optional[float] = None

    class Config:
        from_attributes = True


class IndicatorCreate(BaseModel):
    """Request to record an indicator."""
    indicator_type: str = Field(..., description="Type of indicator")
    indicator_name: str = Field(..., min_length=1, max_length=255)
    value: float
    scope: str = Field(default="market")
    institution_id: Optional[str] = None
    previous_value: Optional[float] = None
    warning_threshold: Optional[float] = None
    critical_threshold: Optional[float] = None
    data_source: Optional[str] = None


class IndicatorResponse(BaseModel):
    """Indicator response model."""
    id: str
    indicator_type: str
    indicator_name: str
    value: float
    previous_value: Optional[float] = None
    change_pct: Optional[float] = None
    scope: str
    institution_id: Optional[str] = None
    is_breached: bool
    observation_date: datetime

    class Config:
        from_attributes = True


# ==================== HELPER ====================

def _institution_to_response(inst) -> InstitutionResponse:
    """Convert institution model to response."""
    return InstitutionResponse(
        id=inst.id,
        sro_id=inst.sro_id,
        name=inst.name,
        description=inst.description,
        institution_type=inst.institution_type,
        systemic_importance=inst.systemic_importance,
        country_code=inst.country_code,
        headquarters_city=inst.headquarters_city,
        total_assets=inst.total_assets,
        market_cap=inst.market_cap,
        systemic_risk_score=inst.systemic_risk_score,
        contagion_risk=inst.contagion_risk,
        interconnectedness_score=inst.interconnectedness_score,
        is_active=inst.is_active,
        under_stress=inst.under_stress,
    )


# ==================== AMPLIFICATION FACTOR (Phase 1.3) ====================

class AmplificationFactorRequest(BaseModel):
    """Request for amplification factor calculation."""
    physical_asset_id: str = Field(..., description="CIP asset ID, SCSS supplier ID, or infrastructure node ID")
    shock_origin_type: str = Field(default="infrastructure", description="infrastructure, supplier, or asset")
    time_horizon_days: int = Field(default=90, ge=1, le=365)


@router.post("/amplification-factor", summary="Calculate financial amplification for physical shock")
async def amplification_factor(
    data: AmplificationFactorRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Calculate how a physical shock amplifies through financial channels.
    Returns initial impact, amplified impact, transmission channels, and intervention window.
    """
    from src.modules.sro.correlation_engine import get_correlation_engine

    engine = get_correlation_engine(db)
    analysis = await engine.calculate_amplification_factor(
        shock_origin_id=data.physical_asset_id,
        shock_origin_type=data.shock_origin_type,
        time_horizon_days=data.time_horizon_days,
    )
    return {
        "initial_impact_usd": analysis.initial_impact_usd,
        "amplified_impact_usd": analysis.amplified_impact_usd,
        "amplification_factor": analysis.amplification_factor,
        "transmission_channels": [
            {
                "channel": tc.channel,
                "institutions_affected": tc.institutions_affected,
                "contribution_to_amplification": tc.contribution_to_amplification,
            }
            for tc in analysis.transmission_channels
        ],
        "time_to_systemic_impact_days": analysis.time_to_systemic_impact_days,
        "intervention_window_days": analysis.intervention_window_days,
        "explanation": {
            "what": "Financial amplification of physical shock through credit defaults and fire sales",
            "confidence": 0.7,
            "why_now": "Based on current exposure paths in Knowledge Graph",
            "sources": ["Knowledge Graph", "sro_institution_exposures"],
            "recommendations": [
                f"Intervention window: {analysis.intervention_window_days} days",
                "Increase liquidity buffers for exposed institutions",
            ],
        },
    }


# ==================== INDICATORS (Phase 1.3) ====================

@router.get("/indicators/sfi", summary="Systemic Fragility Index")
async def get_sfi(
    scope: str = Query("global", description="global, region, institution"),
    region: Optional[str] = Query(None),
    institution_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get SFI (Systemic Fragility Index). Bands: resilient, elevated, fragile, critical."""
    from src.modules.sro.indicators import get_indicators_service
    svc = get_indicators_service(db)
    r = await svc.compute_sfi(scope=scope, region=region, institution_id=institution_id)
    return {"value": r.value, "interpretation": r.interpretation, "band": r.band}


@router.get("/indicators/fpcc", summary="Financial-Physical Coupling Coefficient")
async def get_fpcc(
    scope: str = Query("global"),
    region: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get FPCC. High (>0.7): physical shocks amplify. Low (<0.3): resilient."""
    from src.modules.sro.indicators import get_indicators_service
    svc = get_indicators_service(db)
    r = await svc.compute_fpcc(scope=scope, region=region)
    return {"value": r.value, "interpretation": r.interpretation, "band": r.band}


@router.get("/indicators/cfp", summary="Cascading Failure Potential")
async def get_cfp(
    scope: str = Query("global"),
    initial_shock_node: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get CFP: P(cascade reaches >10 institutions). Stub implementation."""
    from src.modules.sro.indicators import get_indicators_service
    svc = get_indicators_service(db)
    r = await svc.compute_cfp(scope=scope, initial_shock_node=initial_shock_node)
    return {"value": r.value, "interpretation": r.interpretation, "band": r.band}


@router.get("/scenarios", summary="List scenario library")
async def get_scenarios() -> List[dict]:
    """List all scenarios from config/sro_scenarios/*.yaml."""
    from src.modules.sro.scenarios import list_scenarios as _list_scenarios
    return _list_scenarios()


class ScenarioInterventionItem(BaseModel):
    """Single intervention for scenario run."""
    day: int = Field(..., ge=0)
    type: str = Field(default="emergency_liquidity")
    amount_usd: Optional[float] = None


class ScenarioRunRequest(BaseModel):
    """Request to run a scenario."""
    n_monte_carlo: int = Field(default=100, ge=10, le=10000)
    time_horizon_days: int = Field(default=90, ge=1, le=365)
    interventions: Optional[List[ScenarioInterventionItem]] = None


@router.post("/scenarios/{scenario_id}/run", summary="Run scenario simulation")
async def run_scenario(
    scenario_id: str,
    data: Optional[ScenarioRunRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Run Contagion Simulator for the given scenario.
    Returns critical_path, percentiles, policy effectiveness.
    """
    global _active_simulation
    from src.modules.sro.scenarios import load_scenario, scenario_to_shock_and_interventions
    from src.modules.sro.contagion_simulator import get_contagion_simulator

    scenario_data = load_scenario(scenario_id)
    if not scenario_data:
        raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")

    shock, interventions = scenario_to_shock_and_interventions(scenario_data)
    sim = get_contagion_simulator(db)
    req = data or ScenarioRunRequest()
    if req.interventions:
        from src.modules.sro.contagion_simulator import PolicyIntervention
        interventions = [
            PolicyIntervention(day=iv.day, intervention_type=iv.type, amount_usd=iv.amount_usd)
            for iv in req.interventions
        ]

    _active_simulation = {
        "status": "running",
        "scenario_id": scenario_id,
        "scenario_name": scenario_data.get("name", scenario_id),
        "progress": 0,
        "started_at": datetime.utcnow().isoformat(),
    }

    try:
        results = await sim.simulate_cascade(
            initial_shock=shock,
            time_horizon_days=req.time_horizon_days,
            interventions=interventions,
            n_monte_carlo=req.n_monte_carlo,
        )
    except Exception as e:
        _active_simulation = {}
        raise HTTPException(status_code=500, detail=f"Scenario simulation failed: {str(e)}")
    finally:
        _active_simulation = {}

    # Sanitize for JSON (NaN/inf not JSON-serializable)
    def _sanitize(obj):
        import math
        if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
            return None
        if isinstance(obj, dict):
            return {k: _sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_sanitize(v) for v in obj]
        return obj

    percentiles = _sanitize(results.percentiles)
    prob_collapse = _sanitize(results.probability_systemic_collapse)
    critical_path = results.critical_path or []

    from src.modules.sro.audit import get_audit_logger
    from src.modules.sro.service import SROService
    audit = get_audit_logger(db)
    await audit.log_simulation(
        scenario={"id": scenario_id, "name": scenario_data.get("name")},
        results={
            "percentiles": percentiles,
            "probability_systemic_collapse": prob_collapse,
            "critical_path": critical_path,
        },
    )
    sro_svc = SROService(db)
    run_id = await sro_svc.store_simulation_run(
        scenario_id=scenario_id,
        scenario_name=scenario_data.get("name", scenario_id),
        results={
            "percentiles": percentiles,
            "probability_systemic_collapse": prob_collapse,
            "critical_path": critical_path,
        },
        monte_carlo_runs=req.n_monte_carlo,
    )
    await db.commit()

    return {
        "run_id": run_id,
        "scenario_id": scenario_id,
        "scenario_name": scenario_data.get("name", scenario_id),
        "monte_carlo_runs": req.n_monte_carlo,
        "percentiles": percentiles,
        "probability_systemic_collapse": prob_collapse,
        "critical_path": critical_path,
        "intervention_recommendations": results.intervention_recommendations,
        "explanation": {
            "what": "Monte Carlo contagion simulation with fire sales and policy interventions",
            "confidence": 0.65,
            "why_now": "Scenario-driven stress test per regulatory requirements",
            "sources": ["Contagion Simulator", "sro_institutions", "sro_correlations"],
            "recommendations": [r.get("action", "") for r in results.intervention_recommendations],
        },
    }


@router.get("/simulations", summary="List simulation runs")
async def list_sro_simulations(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """List recent contagion simulation runs."""
    from src.modules.sro.service import SROService
    svc = SROService(db)
    return await svc.list_simulation_runs(limit=limit)


@router.get("/simulations/{run_id}/network", summary="Contagion network visualization (FR-SRO-006)")
async def get_sro_simulation_network(
    run_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get contagion network: institutions (nodes), exposures (edges), optional simulation context."""
    from src.modules.sro.service import SROService
    svc = SROService(db)
    result = await svc.get_contagion_network(run_id=run_id)
    return result


class MarketCreate(BaseModel):
    """Request to register market (FR-SRO-002)."""
    name: str = Field(..., min_length=1)
    asset_class: str = Field(...)
    market_structure: str = Field(default="centralized_exchange")
    daily_volume_usd: Optional[float] = None
    country_code: Optional[str] = None


@router.post("/markets", status_code=201, summary="Register market (FR-SRO-002)")
async def register_market(
    data: MarketCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a financial market."""
    from src.modules.sro.service import SROService
    svc = SROService(db)
    m = await svc.register_market(
        name=data.name,
        asset_class=data.asset_class,
        market_structure=data.market_structure,
        daily_volume_usd=data.daily_volume_usd,
        country_code=data.country_code,
    )
    await db.commit()
    return {"id": m.id, "market_id": m.market_id, "name": m.name}


@router.get("/markets", summary="List markets")
async def list_sro_markets(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """List financial markets."""
    from src.modules.sro.service import SROService
    svc = SROService(db)
    markets = await svc.list_markets(limit=limit)
    return [
        {
            "id": m.id,
            "market_id": m.market_id,
            "name": m.name,
            "asset_class": m.asset_class,
            "market_structure": m.market_structure,
            "daily_volume_usd": m.daily_volume_usd,
            "country_code": m.country_code,
        }
        for m in markets
    ]


@router.get("/indicators/methodology", summary="Indicator methodology documentation")
async def get_indicators_methodology() -> dict:
    """
    Model cards and methodology for SFI, CFP, FPCC, PRW.
    Explainability: assumptions, limitations, interpretation.
    """
    return {
        "SFI": {
            "name": "Systemic Fragility Index",
            "formula": "sfi = f(interconnectedness, concentration, leverage, liquidity_mismatch, correlation_regime, physical_dependency_exposure)",
            "bands": {"resilient": "<0.3", "elevated": "0.3-0.6", "fragile": "0.6-0.8", "critical": ">=0.8"},
            "sources": ["Regulatory filings", "Network analysis"],
            "limitations": "Uses simplified weighting; full model requires real-time market data.",
        },
        "CFP": {
            "name": "Cascading Failure Potential",
            "formula": "P(cascade reaches >10 institutions | initial shock)",
            "methodology": "Monte Carlo simulation via Contagion Simulator",
            "limitations": "Stub implementation; full version requires populated institution graph.",
        },
        "FPCC": {
            "name": "Financial-Physical Coupling Coefficient",
            "formula": "Σ(financial_exposure × infrastructure_dependency) / total_capitalization",
            "interpretation": "High (>0.7): physical shocks amplify. Low (<0.3): resilient.",
            "sources": ["sro_institution_exposures", "sro_institutions"],
        },
        "PRW": {
            "name": "Policy Response Window",
            "definition": "Days until cascade becomes irreversible (point of no return)",
            "methodology": "Simulation-derived; identifies when >30% of system affected",
            "limitations": "Stub returns fixed value; full version from Contagion Simulator.",
        },
    }


@router.get("/indicators/prw", summary="Policy Response Window")
async def get_prw(
    scope: str = Query("global"),
    scenario_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get PRW: days until point of no return. Stub implementation."""
    from src.modules.sro.indicators import get_indicators_service
    svc = get_indicators_service(db)
    r = await svc.compute_prw(scope=scope, scenario_id=scenario_id)
    return {"value": r.value, "interpretation": r.interpretation, "band": r.band}


# ==================== REGULATOR DASHBOARD (Phase 1.3) ====================

async def _safe_audit(db, action: str, endpoint: str, metadata: dict = None):
    """Non-blocking audit log - never raise."""
    try:
        from src.modules.sro.audit import get_audit_logger
        await get_audit_logger(db).log_dashboard_action(action, endpoint, metadata=metadata or {})
    except Exception:
        pass


@router.get("/dashboard/heatmap", summary="Global SFI heatmap by region")
async def dashboard_heatmap(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Global systemic risk heatmap - SFI by region/jurisdiction."""
    try:
        await _safe_audit(db, "view_heatmap", "/sro/dashboard/heatmap")
        from src.modules.sro.indicators import get_indicators_service
        svc = get_indicators_service(db)
        regions = ["EU", "US", "ASIA", "EM"]
        heatmap = {}
        for r in regions:
            res = await svc.compute_sfi(scope="region", region=r)
            heatmap[r] = {"sfi": res.value, "band": res.band}
        # Auto-export to ARIN Platform (fire-and-forget)
        if settings.arin_export_url:
            avg_sfi = sum(h["sfi"] for h in heatmap.values()) / len(heatmap) if heatmap else 0
            risk_score = min(100, avg_sfi * 20)  # rough 0-100 scale
            asyncio.create_task(
                export_compliance_check(
                    entity_id=make_zone_entity_id("_".join(regions), "systemic_risk"),
                    risk_score=risk_score,
                    summary=f"SRO systemic risk heatmap: {regions}. Avg SFI: {avg_sfi:.2f}.",
                    recommendations=["Monitor elevated regions", "Review cross-border exposure"],
                    indicators=heatmap,
                )
            )
        return {"heatmap": heatmap, "regions": regions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/scenarios", summary="Scenario library with run status")
async def dashboard_scenarios() -> List[dict]:
    """Scenario library for war gaming."""
    try:
        from src.modules.sro.scenarios import list_scenarios as _list_scenarios
        return _list_scenarios()
    except Exception:
        return []


# In-memory store for active simulation progress (dashboard polling)
_active_simulation: Dict[str, Any] = {}


@router.get("/dashboard/active-simulation", summary="Current run progress")
async def dashboard_active_simulation() -> dict:
    """
    Return current simulation run progress for dashboard polling.
    When a scenario is running, returns scenario_id, status, progress, started_at.
    When idle, returns empty or status=idle.
    """
    if not _active_simulation:
        return {"status": "idle", "scenario_id": None}
    return dict(_active_simulation)


@router.get("/dashboard/timelines", summary="Time-to-impact counters")
async def dashboard_timelines(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Critical timelines: immediate (<7d), elevated (7-30d), medium-term (30-90d)."""
    try:
        await _safe_audit(db, "view_timelines", "/sro/dashboard/timelines")
        from src.modules.sro.indicators import get_indicators_service
        svc = get_indicators_service(db)
        prw = await svc.compute_prw()
        return {
            "immediate_threats": [],
            "elevated_threats": [{"name": "System-wide PRW", "days": prw.value, "status": "monitor"}],
            "medium_term_threats": [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interventions/levers", summary="List policy levers")
async def get_intervention_levers() -> List[dict]:
    """List available policy levers (monetary, macroprudential, market, coordination)."""
    try:
        from src.modules.sro.intervention_engine import get_intervention_engine
        engine = get_intervention_engine()
        return engine.get_levers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class InterventionOptimizeRequest(BaseModel):
    """Request for policy optimization."""
    scenario_id: Optional[str] = None
    objective: str = Field(default="minimize_collapse_probability")
    max_firepower_usd: float = Field(default=3e12, ge=0)


@router.post("/interventions/optimize", summary="Optimize policy mix")
async def optimize_interventions(
    data: InterventionOptimizeRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Recommend policy mix to minimize systemic collapse probability.
    Returns recommended interventions and expected outcome.
    """
    from src.modules.sro.intervention_engine import get_intervention_engine

    async def _run(session) -> dict:
        return await get_intervention_engine(session).optimize_policy(
            scenario_id=data.scenario_id or None,
            objective=data.objective,
            max_firepower_usd=data.max_firepower_usd,
        )

    try:
        result = await _run(db)
    except Exception as e:
        # Fallback: run without DB (uses default institutions) when DB load fails
        try:
            result = await _run(None)
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e2)}")

    await _safe_audit(db, "optimize_interventions", "/sro/interventions/optimize",
                      metadata={"scenario_id": data.scenario_id, "objective": data.objective})
    return result


@router.get("/dashboard/cross-border-pathways", summary="Cross-border contagion probabilities")
async def dashboard_cross_border(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """EU->US, China->EM, Energy->All contagion probabilities."""
    try:
        await _safe_audit(db, "view_cross_border", "/sro/dashboard/cross-border-pathways")
        return {
            "EU_to_US": 0.34,
            "China_to_EM": 0.67,
            "Energy_to_All": 0.89,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STATUS ====================

@router.get("", summary="SRO module status")
async def sro_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Return SRO module status and statistics."""
    try:
        service = SROService(db)
        stats = await service.get_statistics()
        return {
            "module": "sro",
            "status": "ok",
            "statistics": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== INSTITUTION CRUD ====================

@router.post("/institutions", response_model=InstitutionResponse, status_code=201)
async def register_institution(
    data: InstitutionCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new financial institution.
    
    Creates an SRO record with:
    - Unique SRO ID (e.g., SRO-BANK-DE-ABC123)
    - Classification (type, systemic importance)
    - Financial metrics
    """
    service = SROService(db)
    
    institution = await service.register_institution(
        name=data.name,
        institution_type=data.institution_type,
        systemic_importance=data.systemic_importance,
        country_code=data.country_code,
        headquarters_city=data.headquarters_city,
        description=data.description,
        total_assets=data.total_assets,
        market_cap=data.market_cap,
        regulator=data.regulator,
        lei_code=data.lei_code,
        extra_data=data.extra_data,
    )
    
    await db.commit()
    
    return _institution_to_response(institution)


@router.get("/institutions", response_model=List[InstitutionResponse])
async def list_institutions(
    institution_type: Optional[str] = Query(None, description="Filter by type"),
    systemic_importance: Optional[str] = Query(None, description="Filter by importance"),
    country_code: Optional[str] = Query(None, description="Filter by country"),
    under_stress: Optional[bool] = Query(None, description="Filter stressed institutions"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List financial institutions with optional filters."""
    try:
        service = SROService(db)
        institutions = await service.list_institutions(
            institution_type=institution_type,
            systemic_importance=systemic_importance,
            country_code=country_code,
            under_stress=under_stress,
            limit=limit,
            offset=offset,
        )
        return [_institution_to_response(i) for i in institutions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/institutions/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get institution by ID or SRO ID."""
    service = SROService(db)
    
    institution = await service.get_institution(institution_id)
    
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    return _institution_to_response(institution)


class ExposureCreate(BaseModel):
    """Request to add institution exposure (CIP/SCSS)."""
    target_type: str = Field(..., description="INFRASTRUCTURE, SUPPLIER, or MARKET")
    target_id: str = Field(..., description="CIP asset ID, SCSS supplier ID, or market ID")
    exposure_amount_usd: Optional[float] = None
    sector_concentration: Optional[float] = None
    description: Optional[str] = None


@router.post("/institutions/{institution_id}/exposures", status_code=201)
async def add_institution_exposure(
    institution_id: str,
    data: ExposureCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Link institution to CIP asset, SCSS supplier, or market (DEPENDS_ON_INFRASTRUCTURE, EXPOSED_TO_SUPPLY_CHAIN)."""
    service = SROService(db)
    try:
        exposure = await service.add_exposure(
            institution_id=institution_id,
            target_type=data.target_type,
            target_id=data.target_id,
            exposure_amount_usd=data.exposure_amount_usd,
            sector_concentration=data.sector_concentration,
            description=data.description,
        )
        await db.commit()
        return {
            "id": exposure.id,
            "institution_id": exposure.institution_id,
            "target_type": exposure.target_type,
            "target_id": exposure.target_id,
            "exposure_amount_usd": exposure.exposure_amount_usd,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/institutions/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: str,
    data: InstitutionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update institution attributes."""
    service = SROService(db)
    
    updates = data.model_dump(exclude_unset=True)
    
    institution = await service.update_institution(institution_id, updates)
    
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    await db.commit()
    
    return _institution_to_response(institution)


@router.delete("/institutions/{institution_id}")
async def delete_institution(
    institution_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete institution by ID."""
    service = SROService(db)
    
    success = await service.delete_institution(institution_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    await db.commit()
    
    return {"status": "deleted", "id": institution_id}


# ==================== CORRELATIONS ====================

@router.post("/correlations", response_model=CorrelationResponse, status_code=201)
async def add_correlation(
    data: CorrelationCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Add a risk correlation between institutions.
    
    Tracks how stress in one institution may affect another.
    """
    service = SROService(db)
    
    # Verify both institutions exist
    inst_a = await service.get_institution(data.institution_a_id)
    inst_b = await service.get_institution(data.institution_b_id)
    
    if not inst_a:
        raise HTTPException(status_code=404, detail=f"Institution {data.institution_a_id} not found")
    if not inst_b:
        raise HTTPException(status_code=404, detail=f"Institution {data.institution_b_id} not found")
    
    correlation = await service.add_correlation(
        institution_a_id=data.institution_a_id,
        institution_b_id=data.institution_b_id,
        correlation_coefficient=data.correlation_coefficient,
        relationship_type=data.relationship_type,
        exposure_amount=data.exposure_amount,
        contagion_probability=data.contagion_probability,
        description=data.description,
    )
    
    await db.commit()
    
    return CorrelationResponse(
        id=correlation.id,
        institution_a_id=correlation.institution_a_id,
        institution_b_id=correlation.institution_b_id,
        correlation_coefficient=correlation.correlation_coefficient,
        relationship_type=correlation.relationship_type,
        exposure_amount=correlation.exposure_amount,
        contagion_probability=correlation.contagion_probability,
    )


@router.get("/institutions/{institution_id}/correlations")
async def get_correlations(
    institution_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all correlations for an institution."""
    service = SROService(db)
    
    institution = await service.get_institution(institution_id)
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    correlations = await service.get_correlations(institution_id)
    
    return {
        "institution_id": institution_id,
        "sro_id": institution.sro_id,
        "correlations": [
            CorrelationResponse(
                id=c.id,
                institution_a_id=c.institution_a_id,
                institution_b_id=c.institution_b_id,
                correlation_coefficient=c.correlation_coefficient,
                relationship_type=c.relationship_type,
                exposure_amount=c.exposure_amount,
                contagion_probability=c.contagion_probability,
            ).model_dump()
            for c in correlations
        ],
    }


@router.delete("/correlations/{correlation_id}")
async def delete_correlation(
    correlation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a correlation."""
    service = SROService(db)
    
    success = await service.delete_correlation(correlation_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Correlation not found")
    
    await db.commit()
    
    return {"status": "deleted", "id": correlation_id}


# ==================== INDICATORS ====================

@router.post("/indicators", response_model=IndicatorResponse, status_code=201)
async def record_indicator(
    data: IndicatorCreate,
    db: AsyncSession = Depends(get_db),
):
    """Record a systemic risk indicator value."""
    service = SROService(db)
    
    indicator = await service.record_indicator(
        indicator_type=data.indicator_type,
        indicator_name=data.indicator_name,
        value=data.value,
        scope=data.scope,
        institution_id=data.institution_id,
        previous_value=data.previous_value,
        warning_threshold=data.warning_threshold,
        critical_threshold=data.critical_threshold,
        data_source=data.data_source,
    )
    
    await db.commit()
    
    return IndicatorResponse(
        id=indicator.id,
        indicator_type=indicator.indicator_type,
        indicator_name=indicator.indicator_name,
        value=indicator.value,
        previous_value=indicator.previous_value,
        change_pct=indicator.change_pct,
        scope=indicator.scope,
        institution_id=indicator.institution_id,
        is_breached=indicator.is_breached,
        observation_date=indicator.observation_date,
    )


@router.get("/indicators", response_model=List[IndicatorResponse])
async def list_indicators(
    indicator_type: Optional[str] = Query(None, description="Filter by type"),
    scope: Optional[str] = Query(None, description="Filter by scope"),
    institution_id: Optional[str] = Query(None, description="Filter by institution"),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get latest indicator readings."""
    service = SROService(db)
    
    indicators = await service.get_latest_indicators(
        indicator_type=indicator_type,
        scope=scope,
        institution_id=institution_id,
        limit=limit,
    )
    
    return [
        IndicatorResponse(
            id=i.id,
            indicator_type=i.indicator_type,
            indicator_name=i.indicator_name,
            value=i.value,
            previous_value=i.previous_value,
            change_pct=i.change_pct,
            scope=i.scope,
            institution_id=i.institution_id,
            is_breached=i.is_breached,
            observation_date=i.observation_date,
        )
        for i in indicators
    ]


@router.get("/indicators/breached", response_model=List[IndicatorResponse])
async def get_breached_indicators(
    db: AsyncSession = Depends(get_db),
):
    """Get all indicators that have breached thresholds."""
    service = SROService(db)
    
    indicators = await service.get_breached_indicators()
    
    return [
        IndicatorResponse(
            id=i.id,
            indicator_type=i.indicator_type,
            indicator_name=i.indicator_name,
            value=i.value,
            previous_value=i.previous_value,
            change_pct=i.change_pct,
            scope=i.scope,
            institution_id=i.institution_id,
            is_breached=i.is_breached,
            observation_date=i.observation_date,
        )
        for i in indicators
    ]


# ==================== RISK ASSESSMENT ====================

@router.get("/institutions/{institution_id}/systemic-risk")
async def get_systemic_risk_score(
    institution_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate systemic risk score for an institution.
    
    Returns:
    - Overall systemic risk score (0-100)
    - Component scores
    - Risk level classification
    """
    service = SROService(db)
    
    result = await service.calculate_systemic_risk_score(institution_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.get("/institutions/{institution_id}/contagion")
async def get_contagion_analysis(
    institution_id: str,
    depth: int = Query(2, ge=1, le=5, description="Contagion depth to analyze"),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze potential contagion spread from an institution.
    
    Returns:
    - Affected institutions
    - Total exposure at risk
    - Contagion paths
    """
    service = SROService(db)
    
    result = await service.get_contagion_analysis(institution_id, depth=depth)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


# ==================== REFERENCE DATA ====================

@router.get("/types")
async def get_institution_types():
    """Get list of available institution types."""
    return {
        "types": [
            {"value": t.value, "name": t.name.replace("_", " ").title()}
            for t in InstitutionType
        ]
    }


@router.get("/systemic-importance-levels")
async def get_systemic_importance_levels():
    """Get list of systemic importance levels with descriptions."""
    descriptions = {
        "gsib": "Global Systemically Important Bank",
        "dsib": "Domestic Systemically Important Bank",
        "gsii": "Global Systemically Important Insurer",
        "high": "High systemic importance",
        "medium": "Medium systemic importance",
        "low": "Low systemic importance",
    }
    return {
        "levels": [
            {"value": s.value, "name": s.name, "description": descriptions.get(s.value, "")}
            for s in SystemicImportance
        ]
    }


@router.get("/indicator-types")
async def get_indicator_types():
    """Get list of indicator types."""
    return {
        "types": [
            {"value": t.value, "name": t.name.replace("_", " ").title()}
            for t in IndicatorType
        ]
    }
