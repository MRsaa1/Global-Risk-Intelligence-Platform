"""
Stress Tests API endpoints.

CRUD operations for stress tests, risk zones, and reports.
Integrates with NVIDIA LLM for intelligent report generation.
"""
import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.config import settings
from src.services.nvidia_llm import llm_service, LLMModel
from src.services.nvidia_orchestration import nvidia_consensus_engine
from src.services.knowledge_graph import get_knowledge_graph_service
from src.services.cascade_gnn import cascade_gnn_service
from src.services.entity_resolution import resolve_entity
from src.services.regulatory_engine import get_applicable_regulations
from src.services.news_enrichment import enrich_stress_test_context
from src.services.risk_zone_calculator import risk_zone_calculator, EventCategory
from src.services.nvidia_stress_pipeline import nvidia_stress_pipeline, NVIDIAEnhancedResult
from src.models.stress_test import (
    StressTest,
    StressTestType,
    StressTestStatus,
    RiskZone,
    ZoneLevel,
    ZoneAsset,
    StressTestReport,
    ActionPlan,
    OrganizationType,
)
from src.models.compliance_verification import ComplianceVerification
from src.models.asset import Asset
from src.services.event_emitter import event_emitter
from src.models.events import EventTypes
from src.services.arin_export import export_stress_test, make_scenario_entity_id
from src.services.scenario_replay import replay_service
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/stress-tests", tags=["Stress Tests"])

# Currency by city/region (San Francisco = USD, Tokyo = JPY, Frankfurt/London = EUR/GBP)
REGION_CURRENCY = {
    "Montreal": "CAD",
    "Toronto": "CAD",
    "Vancouver": "CAD",
    "Calgary": "CAD",
    "Quebec": "CAD",
    "San Francisco": "USD",
    "Oakland": "USD",
    "New York": "USD",
    "Chicago": "USD",
    "Los Angeles": "USD",
    "London": "GBP",
    "Frankfurt": "EUR",
    "Berlin": "EUR",
    "Munich": "EUR",
    "Paris": "EUR",
    "Amsterdam": "EUR",
    "Tokyo": "JPY",
    "Singapore": "SGD",
    "Sydney": "AUD",
    "Melbourne": "AUD",
}

# Jurisdiction by city/region for regulatory relevance (Japan, EU, USA, Canada)
REGION_JURISDICTION = {
    "Tokyo": "Japan",
    "Japan": "Japan",
    "Osaka": "Japan",
    "San Francisco": "USA",
    "New York": "USA",
    "Chicago": "USA",
    "Los Angeles": "USA",
    "Oakland": "USA",
    "London": "UK",
    "Frankfurt": "EU",
    "Berlin": "EU",
    "Munich": "EU",
    "Paris": "EU",
    "Amsterdam": "EU",
    "Melbourne": "Australia",
    "Sydney": "Australia",
    "Montreal": "Canada",
    "Toronto": "Canada",
    "Vancouver": "Canada",
    "Calgary": "Canada",
    "Quebec": "Canada",
    "Canada": "Canada",
}


def _get_currency_for_city(city_name: str) -> str:
    """Return currency code for city (USD, EUR, GBP, JPY, etc.). Default EUR."""
    if not city_name:
        return "EUR"
    for key, currency in REGION_CURRENCY.items():
        if key.lower() in city_name.lower():
            return currency
    # US-style names often contain state or "USA"
    if "USA" in (city_name or "").upper() or "United States" in (city_name or ""):
        return "USD"
    if "Japan" in (city_name or "") or "Tokyo" in (city_name or ""):
        return "JPY"
    return "EUR"


def _get_jurisdiction_for_city(city_name: str) -> str:
    """Return jurisdiction for regulatory relevance (Japan, EU, USA, UK, Australia, Canada). Default EU."""
    if not city_name:
        return "EU"
    c = (city_name or "").strip()
    for key, jurisdiction in REGION_JURISDICTION.items():
        if key.lower() in c.lower():
            return jurisdiction
    if "USA" in c.upper() or "United States" in c:
        return "USA"
    if "Japan" in c or "Tokyo" in c:
        return "Japan"
    if "Canada" in c or "Quebec" in c:
        return "Canada"
    return "EU"


def _is_llm_fallback(text: Optional[str]) -> bool:
    """True if text is a placeholder/mock from missing or unavailable LLM."""
    if not text or not text.strip():
        return True
    t = text.strip().lower()
    return (
        "llm not configured" in t
        or "configure nvidia_api_key" in t
        or "nvidia_llm_api_key" in t
        or "simulated response" in t
        or "demo response" in t
        or "mock " in t
        or "this is a simulated" in t
    )


def _build_template_executive_summary(result: Any, request: Any, zones_text: str) -> str:
    """Build a deterministic executive summary from result and request when LLM is unavailable."""
    event_name = getattr(result, "event_name", "Stress test")
    event_type = getattr(result, "event_type", None)
    event_type_val = getattr(event_type, "value", str(event_type)) if event_type else "climate"
    city_name = getattr(result, "city_name", request.city_name if request else "")
    severity = getattr(request, "severity", 0.5)
    total_loss = getattr(result, "total_loss", 0) or 0
    total_buildings = getattr(result, "total_buildings_affected", 0) or 0
    total_pop = getattr(result, "total_population_affected", 0) or 0
    zones = getattr(result, "zones", []) or []
    top_zones = zones[:5]
    p1 = (
        f"This stress test models a {event_type_val} scenario ({event_name}) for {city_name} at {severity:.0%} severity. "
        "The results indicate material exposure and operational risk that warrant immediate attention from management and stakeholders."
    )
    p2 = (
        f"Key metrics: total estimated loss €{total_loss:,.0f}M, {total_buildings:,} buildings affected, "
        f"{total_pop:,} population impacted. Top risk zones: {zones_text.strip() or 'see zone table.'}"
    )
    p3 = (
        "Immediate priorities: validate exposure in highest-risk zones, confirm mitigation and continuity plans, "
        "and ensure regulatory and disclosure requirements are met."
    )
    return f"{p1}\n\n{p2}\n\n{p3}"


def _build_template_concluding_summary(result: Any, request: Any, zones_text: str) -> str:
    """Build a short deterministic concluding summary when LLM is unavailable."""
    event_name = getattr(result, "event_name", "Stress test")
    city_name = getattr(result, "city_name", request.city_name if request else "")
    total_loss = getattr(result, "total_loss", 0) or 0
    total_buildings = getattr(result, "total_buildings_affected", 0) or 0
    zones = getattr(result, "zones", []) or []
    bullets = [
        f"Scenario: {event_name} for {city_name}; total estimated loss €{total_loss:,.0f}M.",
        f"Buildings affected: {total_buildings:,}; review zone-level exposure.",
        "Validate business continuity and mitigation plans for highest-risk areas.",
        "Ensure compliance with disclosure and regulatory requirements.",
    ]
    if zones:
        bullets.append(f"Focus on top zones: {', '.join(z.label for z in zones[:3])}.")
    return "\n".join(bullets)


# =============================================================================
# Pydantic Schemas
# =============================================================================

class RiskZoneCreate(BaseModel):
    """Schema for creating a risk zone."""
    zone_level: ZoneLevel = ZoneLevel.MEDIUM
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None
    radius_km: Optional[float] = None
    polygon: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None


class RiskZoneResponse(BaseModel):
    """Response schema for risk zone."""
    id: str
    stress_test_id: str
    zone_level: str
    center_latitude: Optional[float]
    center_longitude: Optional[float]
    radius_km: Optional[float]
    risk_score: float
    affected_assets_count: int
    total_exposure: Optional[float]
    expected_loss: Optional[float]
    name: Optional[str]
    description: Optional[str]

    class Config:
        from_attributes = True


class StressTestCreate(BaseModel):
    """Schema for creating a stress test."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    test_type: StressTestType = StressTestType.CLIMATE
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None
    radius_km: float = 100.0
    region_name: Optional[str] = None
    country_codes: Optional[str] = None
    severity: float = Field(0.5, ge=0.0, le=1.0)
    probability: float = Field(0.1, ge=0.0, le=1.0)
    time_horizon_months: int = 12
    pd_multiplier: float = 1.0
    lgd_multiplier: float = 1.0
    valuation_impact_pct: float = 0.0
    recovery_time_months: Optional[int] = None
    parameters: Optional[dict] = None
    historical_event_id: Optional[str] = None


class StressTestUpdate(BaseModel):
    """Schema for updating a stress test."""
    name: Optional[str] = None
    description: Optional[str] = None
    test_type: Optional[StressTestType] = None
    status: Optional[StressTestStatus] = None
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None
    radius_km: Optional[float] = None
    region_name: Optional[str] = None
    country_codes: Optional[str] = None
    severity: Optional[float] = None
    probability: Optional[float] = None
    time_horizon_months: Optional[int] = None
    pd_multiplier: Optional[float] = None
    lgd_multiplier: Optional[float] = None
    valuation_impact_pct: Optional[float] = None
    recovery_time_months: Optional[int] = None
    parameters: Optional[dict] = None


class StressTestResponse(BaseModel):
    """Response schema for stress test."""
    id: str
    name: str
    description: Optional[str]
    test_type: str
    status: str
    center_latitude: Optional[float]
    center_longitude: Optional[float]
    radius_km: Optional[float]
    region_name: Optional[str]
    country_codes: Optional[str]
    severity: float
    probability: float
    time_horizon_months: int
    pd_multiplier: float
    lgd_multiplier: float
    valuation_impact_pct: float
    recovery_time_months: Optional[int]
    affected_assets_count: Optional[int]
    total_exposure: Optional[float]
    expected_loss: Optional[float]
    created_at: Optional[str]
    updated_at: Optional[str]
    zones: List[RiskZoneResponse] = []
    compliance_verification: Optional[dict] = None  # { verified: bool, verifications: [{ framework_id, status, id }], verified_at: iso }

    class Config:
        from_attributes = True


class ActionPlanResponse(BaseModel):
    """Response schema for action plan."""
    id: str
    organization_type: str
    organization_name: Optional[str]
    actions: Optional[List[str]] = None
    priority: str
    timeline: Optional[str]
    estimated_cost: Optional[float]
    risk_reduction: Optional[float]
    roi_percentage: Optional[float]


class StressTestReportResponse(BaseModel):
    """Response schema for stress test report."""
    id: str
    stress_test_id: str
    summary: Optional[str]
    generated_at: str
    action_plans: List[ActionPlanResponse] = []


class ZoneAssetResponse(BaseModel):
    """Response schema for zone-asset link."""
    id: str
    zone_id: str
    asset_id: str
    asset_name: str
    asset_type: str
    impact_severity: float
    expected_loss: Optional[float]
    recovery_time_months: Optional[int]
    impact_details: Optional[dict] = None


# =============================================================================
# CRUD Endpoints
# =============================================================================

@router.get("", response_model=List[StressTestResponse])
async def list_stress_tests(
    test_type: Optional[StressTestType] = None,
    status: Optional[StressTestStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
):
    """List all stress tests with optional filtering."""
    query = select(StressTest)
    
    if test_type:
        query = query.where(StressTest.test_type == test_type.value)
    if status:
        query = query.where(StressTest.status == status.value)
    
    query = query.order_by(StressTest.created_at.desc()).offset(skip).limit(limit)
    
    result = await session.execute(query)
    tests = result.scalars().all()
    
    response = []
    for test in tests:
        test_dict = {
            "id": test.id,
            "name": test.name,
            "description": test.description,
            "test_type": test.test_type,
            "status": test.status,
            "center_latitude": test.center_latitude,
            "center_longitude": test.center_longitude,
            "radius_km": test.radius_km,
            "region_name": test.region_name,
            "country_codes": test.country_codes,
            "severity": test.severity,
            "probability": test.probability,
            "time_horizon_months": test.time_horizon_months,
            "pd_multiplier": test.pd_multiplier,
            "lgd_multiplier": test.lgd_multiplier,
            "valuation_impact_pct": test.valuation_impact_pct,
            "recovery_time_months": test.recovery_time_months,
            "affected_assets_count": test.affected_assets_count,
            "total_exposure": test.total_exposure,
            "expected_loss": test.expected_loss,
            "created_at": test.created_at.isoformat() if test.created_at else None,
            "updated_at": test.updated_at.isoformat() if test.updated_at else None,
            "zones": [],
        }
        response.append(test_dict)
    
    return response


@router.post("", response_model=StressTestResponse, status_code=201)
async def create_stress_test(
    data: StressTestCreate,
    session: AsyncSession = Depends(get_db),
    use_synthetic: bool = Query(False, description="Use synthetic scenario generation"),
):
    """
    Create a new stress test.
    
    If use_synthetic=True, generates synthetic scenario parameters using NeMo Data Designer.
    """
    # Generate synthetic scenario if requested
    if use_synthetic:
        try:
            from src.services.nemo_data_designer import get_nemo_data_designer_service
            designer = get_nemo_data_designer_service()
            
            if designer.enabled:
                result = await designer.generate_stress_test_scenarios(
                    scenario_type=data.test_type.value,
                    region=data.region_name or "Unknown",
                    count=1,
                    severity_range=(data.severity, data.severity + 0.1),
                )
                
                if result.scenarios:
                    synthetic = result.scenarios[0]
                    # Enhance data with synthetic parameters
                    if data.parameters is None:
                        data.parameters = {}
                    data.parameters.update(synthetic.parameters)
                    data.severity = synthetic.severity
                    logger.info(f"Using synthetic scenario: {synthetic.name}")
        except Exception as e:
            logger.warning(f"Synthetic scenario generation failed, using provided data: {e}")
    
    test = StressTest(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
        test_type=data.test_type.value,
        center_latitude=data.center_latitude,
        center_longitude=data.center_longitude,
        radius_km=data.radius_km,
        region_name=data.region_name,
        country_codes=data.country_codes,
        severity=data.severity,
        probability=data.probability,
        time_horizon_months=data.time_horizon_months,
        pd_multiplier=data.pd_multiplier,
        lgd_multiplier=data.lgd_multiplier,
        valuation_impact_pct=data.valuation_impact_pct,
        recovery_time_months=data.recovery_time_months,
        parameters=json.dumps(data.parameters) if data.parameters else None,
        historical_event_id=data.historical_event_id,
    )
    
    session.add(test)
    await session.commit()
    await session.refresh(test)
    
    return {
        "id": test.id,
        "name": test.name,
        "description": test.description,
        "test_type": test.test_type,
        "status": test.status,
        "center_latitude": test.center_latitude,
        "center_longitude": test.center_longitude,
        "radius_km": test.radius_km,
        "region_name": test.region_name,
        "country_codes": test.country_codes,
        "severity": test.severity,
        "probability": test.probability,
        "time_horizon_months": test.time_horizon_months,
        "pd_multiplier": test.pd_multiplier,
        "lgd_multiplier": test.lgd_multiplier,
        "valuation_impact_pct": test.valuation_impact_pct,
        "recovery_time_months": test.recovery_time_months,
        "affected_assets_count": test.affected_assets_count,
        "total_exposure": test.total_exposure,
        "expected_loss": test.expected_loss,
        "created_at": test.created_at.isoformat() if test.created_at else None,
        "updated_at": test.updated_at.isoformat() if test.updated_at else None,
        "zones": [],
    }


@router.get("/scenarios/library")
async def get_stress_scenario_library():
    """Regulatory stress scenario library (EBA, Fed, NGFS, IMF). Full schema: type, severity_numeric, horizon."""
    try:
        from src.services.stress_scenario_registry import get_stress_scenario_library as _get_library
        return _get_library()
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning("Stress scenario library failed, returning fallback: %s", e)
        return []


@router.get("/scenarios/extended")
async def get_extended_scenarios():
    """Extended stress scenario tree (by category)."""
    try:
        from src.services.stress_scenario_registry import get_extended_scenarios_tree
        return get_extended_scenarios_tree()
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning("Extended scenarios failed, returning fallback: %s", e)
        return {"categories": []}


class SyntheticStressRequest(BaseModel):
    """Request for synthetic black-swan scenario generation."""
    portfolio_context: Optional[Dict[str, Any]] = Field(None, description="Portfolio/asset context")
    count: int = Field(10, ge=1, le=50, description="Number of synthetic scenarios to generate")


@router.post("/synthetic")
async def generate_synthetic_stress(body: Optional[SyntheticStressRequest] = None):
    """
    Generate synthetic black-swan stress scenarios.
    Uses SyntheticScenarioGenerator (LLM) to produce plausible unprecedented event combinations.
    """
    from src.services.synthetic_scenarios import get_synthetic_scenario_generator
    req = body or SyntheticStressRequest()
    generator = get_synthetic_scenario_generator()
    scenarios = await generator.generate_black_swans(
        portfolio_context=req.portfolio_context or {},
        count=req.count,
    )
    return {
        "scenarios": [
            {
                "scenario_id": s.scenario_id,
                "name": s.name,
                "description": s.description,
                "probability_estimate": s.probability_estimate,
                "affected_domains": s.affected_domains,
                "cascade_path": s.cascade_path,
                "compound_events": s.compound_events,
            }
            for s in scenarios
        ],
        "count": len(scenarios),
    }


@router.post("/admin/seed")
async def seed_stress_tests(session: AsyncSession = Depends(get_db)):
    """
    One-time seed of demo stress test scenarios into DB.
    Idempotent: no-op if 10+ tests exist. Use to populate the scenario
    dropdown on Visualizations/Command Center on a fresh server.
    Path /admin/seed avoids conflict with /{test_id} (which would match /seed).
    Times out after 60s to avoid hanging if DB is slow or locked.
    """
    import asyncio
    from src.services.stress_test_seed import seed_stress_tests_db
    try:
        n = await asyncio.wait_for(seed_stress_tests_db(session), timeout=60.0)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Seed timed out (60s). Database may be slow or locked; retry later.",
        )
    return {"status": "success", "message": "Stress tests seeded", "inserted": n}


@router.get("/{test_id}", response_model=StressTestResponse)
async def get_stress_test(
    test_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Get a stress test by ID with zones."""
    result = await session.execute(
        select(StressTest).where(StressTest.id == test_id)
    )
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Stress test not found")
    
    # Get zones
    zones_result = await session.execute(
        select(RiskZone).where(RiskZone.stress_test_id == test_id)
    )
    zones = zones_result.scalars().all()

    # Compliance verifications for this stress test
    comp_result = await session.execute(
        select(ComplianceVerification)
        .where(ComplianceVerification.stress_test_id == test_id)
        .order_by(ComplianceVerification.checked_at.desc())
    )
    comp_list = comp_result.scalars().all()
    compliance_verification = None
    if comp_list:
        verified = any(c.status == "passed" for c in comp_list)
        verified_at = comp_list[0].checked_at.isoformat() if comp_list[0].checked_at else None
        compliance_verification = {
            "verified": verified,
            "verifications": [{"framework_id": c.framework_id, "status": c.status, "id": c.id} for c in comp_list],
            "verified_at": verified_at,
        }

    return {
        "id": test.id,
        "name": test.name,
        "description": test.description,
        "test_type": test.test_type,
        "status": test.status,
        "center_latitude": test.center_latitude,
        "center_longitude": test.center_longitude,
        "radius_km": test.radius_km,
        "region_name": test.region_name,
        "country_codes": test.country_codes,
        "severity": test.severity,
        "probability": test.probability,
        "time_horizon_months": test.time_horizon_months,
        "pd_multiplier": test.pd_multiplier,
        "lgd_multiplier": test.lgd_multiplier,
        "valuation_impact_pct": test.valuation_impact_pct,
        "recovery_time_months": test.recovery_time_months,
        "affected_assets_count": test.affected_assets_count,
        "total_exposure": test.total_exposure,
        "expected_loss": test.expected_loss,
        "created_at": test.created_at.isoformat() if test.created_at else None,
        "updated_at": test.updated_at.isoformat() if test.updated_at else None,
        "zones": [
            {
                "id": z.id,
                "stress_test_id": z.stress_test_id,
                "zone_level": z.zone_level,
                "center_latitude": z.center_latitude,
                "center_longitude": z.center_longitude,
                "radius_km": z.radius_km,
                "risk_score": z.risk_score,
                "affected_assets_count": z.affected_assets_count,
                "total_exposure": z.total_exposure,
                "expected_loss": z.expected_loss,
                "name": z.name,
                "description": z.description,
            }
            for z in zones
        ],
        "compliance_verification": compliance_verification,
    }


@router.get("/{test_id}/czml")
async def get_stress_test_czml(
    test_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Get CZML document for 4D timeline animation of stress test zones (T0 -> T+12m).
    If test_id is not found in DB (e.g. catalog scenario id like climate_tipping), returns
    synthetic CZML for that scenario so the 4D timeline still plays with visible impact zone."""
    result = await session.execute(
        select(StressTest).where(StressTest.id == test_id)
    )
    test = result.scalar_one_or_none()
    if test:
        zones_result = await session.execute(
            select(RiskZone).where(RiskZone.stress_test_id == test_id)
        )
        zones = zones_result.scalars().all()
        duration_months = float(getattr(test, "time_horizon_months", 12) or 12)
        czml = replay_service.generate_stress_test_czml(test, zones, duration_months=duration_months)
        return JSONResponse(content=czml, media_type="application/json")
    # Fallback: catalog scenario id (no DB row) — generate synthetic CZML so 4D timeline works
    czml = replay_service.generate_catalog_scenario_czml(test_id)
    return JSONResponse(content=czml, media_type="application/json")


@router.patch("/{test_id}", response_model=StressTestResponse)
async def update_stress_test(
    test_id: str,
    data: StressTestUpdate,
    session: AsyncSession = Depends(get_db),
):
    """Update a stress test."""
    result = await session.execute(
        select(StressTest).where(StressTest.id == test_id)
    )
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Stress test not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "test_type" and value:
            value = value.value
        elif field == "status" and value:
            value = value.value
        elif field == "parameters" and value:
            value = json.dumps(value)
        setattr(test, field, value)
    
    await session.commit()
    await session.refresh(test)
    
    return await get_stress_test(test_id, session)


@router.delete("/{test_id}", status_code=204)
async def delete_stress_test(
    test_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Delete a stress test."""
    result = await session.execute(
        select(StressTest).where(StressTest.id == test_id)
    )
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Stress test not found")
    
    test_name = test.name
    await session.delete(test)
    await session.commit()
    
    # Emit stress test deleted event
    await event_emitter.emit(
        event_type=EventTypes.STRESS_TEST_DELETED,
        entity_type="stress_test",
        entity_id=test_id,
        action="deleted",
        data={"name": test_name},
        intent=False,
    )


# =============================================================================
# Risk Zone Endpoints
# =============================================================================

@router.post("/{test_id}/zones", response_model=RiskZoneResponse, status_code=201)
async def create_risk_zone(
    test_id: str,
    data: RiskZoneCreate,
    session: AsyncSession = Depends(get_db),
):
    """Create a risk zone for a stress test."""
    # Check test exists
    result = await session.execute(
        select(StressTest).where(StressTest.id == test_id)
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Stress test not found")
    
    zone = RiskZone(
        id=str(uuid4()),
        stress_test_id=test_id,
        zone_level=data.zone_level.value,
        center_latitude=data.center_latitude,
        center_longitude=data.center_longitude,
        radius_km=data.radius_km,
        polygon=data.polygon,
        name=data.name,
        description=data.description,
    )
    
    session.add(zone)
    await session.commit()
    await session.refresh(zone)
    
    # Emit zone created event
    await event_emitter.emit(
        event_type=EventTypes.RISK_ZONE_CREATED,
        entity_type="zone",
        entity_id=zone.id,
        action="created",
        data={
            "name": zone.name,
            "zone_level": zone.zone_level,
            "stress_test_id": test_id,
            "risk_score": zone.risk_score,
        },
        intent=False,
    )
    
    return zone


@router.get("/{test_id}/zones", response_model=List[RiskZoneResponse])
async def list_risk_zones(
    test_id: str,
    session: AsyncSession = Depends(get_db),
):
    """List all risk zones for a stress test."""
    result = await session.execute(
        select(RiskZone).where(RiskZone.stress_test_id == test_id)
    )
    zones = result.scalars().all()
    return zones


@router.get("/{test_id}/zones/{zone_id}/assets", response_model=List[ZoneAssetResponse])
async def list_zone_assets(
    test_id: str,
    zone_id: str,
    session: AsyncSession = Depends(get_db),
):
    """List all assets in a risk zone."""
    # Get zone assets with asset details
    result = await session.execute(
        select(ZoneAsset, Asset)
        .join(Asset, ZoneAsset.asset_id == Asset.id)
        .where(ZoneAsset.zone_id == zone_id)
    )
    rows = result.all()
    
    return [
        {
            "id": za.id,
            "zone_id": za.zone_id,
            "asset_id": za.asset_id,
            "asset_name": asset.name,
            "asset_type": asset.asset_type,
            "impact_severity": za.impact_severity,
            "expected_loss": za.expected_loss,
            "recovery_time_months": za.recovery_time_months,
            "impact_details": json.loads(za.impact_details) if za.impact_details else None,
        }
        for za, asset in rows
    ]


# =============================================================================
# Quick Execution Schemas
# =============================================================================

class QuickStressTestRequest(BaseModel):
    """Request for quick stress test execution."""
    city_name: str = Field(..., description="Name of the city")
    center_latitude: float = Field(..., ge=-90, le=90)
    center_longitude: float = Field(..., ge=-180, le=180)
    event_id: str = Field(..., description="Event identifier (e.g., 'flood-scenario', 'basel-liquidity')")
    severity: float = Field(0.5, ge=0.0, le=1.0, description="Severity multiplier")
    use_llm: bool = Field(True, description="Generate LLM-powered executive summary")
    use_nvidia_pipeline: bool = Field(False, description="Use full NVIDIA pipeline (Earth-2 + PhysicsNeMo)")
    entity_name: Optional[str] = Field(
        None,
        description="Name of the entity or location (e.g. Uniklinik Köln or Frankfurt); used to detect entity type for zone labels and LLM context",
    )
    use_kg: bool = Field(
        True,
        description="Enrich with Knowledge Graph related entities when Neo4j is enabled",
    )
    use_cascade_gnn: bool = Field(
        True,
        description="Run cascade simulation (GNN/NetworkX) and include in response",
    )
    use_nvidia_orchestration: bool = Field(
        False,
        description="Use NVIDIA AI Orchestration (multi-model consensus: fast + deep analysis, weighted summary). Requires use_llm=True.",
    )
    source: Optional[str] = Field(
        None,
        description="Optional label for report origin, e.g. 'zone_simulation' for Municipal zone stress test on 3D.",
    )


class QuickZoneResponse(BaseModel):
    """Zone in quick stress test response."""
    label: str
    risk_level: str
    position: dict
    radius: float
    affected_buildings: int
    estimated_loss: float
    population_affected: int
    recommendations: List[str]
    polygon: Optional[List[List[float]]] = None  # [[lng, lat], ...] for flood extent


class NVIDIAPipelineInfo(BaseModel):
    """NVIDIA pipeline execution info."""
    stages_completed: List[str]
    services_used: List[str]
    execution_time_ms: int
    all_mock: bool
    confidence_score: float
    weather_adjusted_severity: Optional[float] = None


class MitigationActionResponse(BaseModel):
    """Mitigation action in response."""
    action: str
    priority: str
    cost: Optional[float] = None
    risk_reduction: Optional[float] = None


class NVIDIAEnhancedRequest(BaseModel):
    """Request for NVIDIA-enhanced stress test."""
    city_name: str = Field(..., description="Name of the city")
    center_latitude: float = Field(..., ge=-90, le=90)
    center_longitude: float = Field(..., ge=-180, le=180)
    event_type: str = Field(..., description="Event type: flood, seismic, fire, financial, etc.")
    severity: float = Field(0.5, ge=0.0, le=1.0)
    run_physics: bool = Field(True, description="Run physics simulations")
    run_llm: bool = Field(True, description="Generate LLM analysis")
    entity_name: Optional[str] = Field(
        None,
        description="Name of the entity or location; used to detect entity type for zone labels and LLM context",
    )


class NVIDIAEnhancedResponse(BaseModel):
    """Response for NVIDIA-enhanced stress test."""
    id: str
    event_name: str
    event_type: str
    city_name: str
    severity: float
    adjusted_severity: float
    timestamp: str
    total_loss: float
    total_buildings_affected: int
    total_population_affected: int
    zones: List[QuickZoneResponse]
    executive_summary: Optional[str] = None
    mitigation_actions: List[MitigationActionResponse]
    data_sources: List[str]
    nvidia_pipeline: NVIDIAPipelineInfo
    weather_context: Optional[dict] = None
    physics_context: Optional[dict] = None
    region_action_plan: Optional["RegionActionPlanResponse"] = None
    report_v2: Optional[dict] = None
    methodology: Optional[dict] = None  # ISO 31000:2018 (Gap C6)
    eu_taxonomy_alignment: Optional[dict] = None  # EU Taxonomy (Gap C5)


class RegionActionPlanResponse(BaseModel):
    """Regional action plan embedded in stress test response."""
    region: str
    country: str
    event_type: str
    summary: str
    key_actions: List[str]
    contacts: List[dict]
    sources: List[dict]
    urls: List[str]


class QuickStressTestResponse(BaseModel):
    """Response for quick stress test execution."""
    id: str
    event_name: str
    event_type: str
    city_name: str
    severity: float
    timestamp: str
    total_loss: float
    total_buildings_affected: int
    total_population_affected: int
    zones: List[QuickZoneResponse]
    executive_summary: Optional[str] = None
    concluding_summary: Optional[str] = None
    mitigation_actions: List[MitigationActionResponse]
    data_sources: List[str]
    llm_generated: bool = False
    region_action_plan: Optional[RegionActionPlanResponse] = None
    report_v2: Optional[dict] = None
    related_entities: Optional[List[dict]] = None
    graph_context: Optional[str] = None
    cascade_simulation: Optional[dict] = None
    resolved_entity_type: Optional[str] = None  # from OpenCorporates/Wikidata when available
    nvidia_orchestration: Optional[dict] = None  # when use_nvidia_orchestration: confidence, model_agreement, flag_for_human_review
    currency: str = "EUR"  # USD for US cities, EUR/GBP for EU/UK
    decision_object: Optional[dict] = None  # Risk & Intelligence OS - ARIN Decision Object
    report_source: Optional[str] = None  # e.g. zone_simulation when stress test run from Municipal/3D zone flow
    compliance_verification: Optional[dict] = None  # { verified: bool, verifications: [{ framework_id, status, id }], verified_at: iso }


# =============================================================================
# Execution Endpoints
# =============================================================================

@router.post("/execute", response_model=QuickStressTestResponse)
async def execute_quick_stress_test(
    request: QuickStressTestRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    Execute a quick stress test with smart risk zone calculation.
    
    This endpoint:
    1. Calculates risk zones using the smart algorithm (based on event type)
    2. Optionally generates LLM-powered executive summary
    3. Saves results to database
    4. Returns complete report
    
    Use this for on-demand stress testing from the UI.
    """
    import re
    logger = logging.getLogger(__name__)
    
    # Knowledge Graph: optional entity type from node + related entities (when Neo4j enabled, before calculate)
    entity_name_for_calc = request.entity_name or request.city_name
    entity_type_override = None
    related_entities = None
    graph_context = None
    if request.use_kg and getattr(settings, "enable_neo4j", False):
        try:
            kg = get_knowledge_graph_service()
            if kg.is_available:
                kg_entity = await kg.get_entity_by_name_or_id(entity_name_for_calc)
                if kg_entity:
                    # Map KG node labels/asset_type/infra_type to our EntityType
                    at = (kg_entity.get("asset_type") or "").lower()
                    it = (kg_entity.get("infra_type") or "").lower()
                    labels = [str(l).upper() for l in (kg_entity.get("labels") or [])]
                    if "hospital" in at or "health" in at or "HEALTHCARE" in labels:
                        entity_type_override = "HEALTHCARE"
                    elif "bank" in at or "insurance" in at or "financial" in at or "Asset" in labels and "INFRASTRUCTURE" not in labels:
                        entity_type_override = "FINANCIAL"
                    elif "INFRASTRUCTURE" in labels or it or "power" in it or "airport" in it:
                        entity_type_override = "INFRASTRUCTURE" if "airport" not in (entity_name_for_calc or "").lower() else "AIRPORT"
                related_entities = await kg.get_related_entities(entity_name_for_calc, limit=15)
                if related_entities:
                    graph_context = "Related entities from knowledge graph: " + ", ".join(
                        [f"{e.get('name', e.get('id'))} ({e.get('relationship_type', 'RELATED')})" for e in related_entities]
                    )
        except Exception as e:
            logger.debug("Knowledge Graph failed: %s", e)

    # Calculate risk zones (entity_type_override from KG when available)
    result = risk_zone_calculator.calculate(
        center_lat=request.center_latitude,
        center_lng=request.center_longitude,
        event_id=request.event_id,
        severity=request.severity,
        city_name=request.city_name,
        entity_name=entity_name_for_calc,
        entity_type_override=entity_type_override,
    )

    # Entity resolution: optional enrichment via Wikidata/OpenCorporates
    resolved_entity_type = None
    try:
        resolution = await resolve_entity(entity_name_for_calc)
        if resolution and resolution.suggested_entity_type:
            resolved_entity_type = resolution.suggested_entity_type
            if graph_context is None:
                graph_context = ""
            graph_context = (graph_context or "") + f" External data ({resolution.source}) suggests entity type: {resolved_entity_type}."
    except Exception as e:
        logger.debug("Entity resolution failed: %s", e)

    # Cascade GNN: run cascade simulation when requested
    cascade_simulation = None
    if request.use_cascade_gnn:
        try:
            cascade_gnn_service.build_graph_for_city_scenario(request.city_name, request.event_id)
            if cascade_gnn_service.nodes:
                trigger_id = next(iter(cascade_gnn_service.nodes))
                cascade_result = await cascade_gnn_service.simulate_cascade(
                    trigger_node_id=trigger_id,
                    trigger_severity=request.severity,
                    max_steps=10,
                )
                # GNN returns total_loss in raw currency units; normalize to millions for display (same as result.total_loss)
                raw_loss = cascade_result.total_loss
                total_loss_m = (raw_loss / 1e6) if raw_loss >= 1e6 else (raw_loss if raw_loss > 0 else result.total_loss)
                # Sanity cap: cascade loss should not exceed ~20x base loss (avoid trillion display from wrong GNN scale)
                base_m = result.total_loss or 100
                if total_loss_m > 20 * base_m:
                    total_loss_m = min(total_loss_m, 5 * base_m)
                cascade_simulation = {
                    "trigger_node": cascade_result.trigger_node,
                    "affected_nodes": cascade_result.affected_nodes,
                    "total_loss": total_loss_m,
                    "simulation_steps": cascade_result.simulation_steps,
                    "propagation_paths": cascade_result.propagation_paths[:10],
                    "critical_nodes": cascade_result.critical_nodes,
                    "containment_points": cascade_result.containment_points,
                }
        except Exception as e:
            logger.debug("Cascade GNN simulation failed: %s", e)
    
    executive_summary = None
    concluding_summary = None
    llm_generated = False
    mitigation_actions = result.mitigation_actions

    # Generate LLM-powered executive summary if requested
    nvidia_orchestration_result = None
    if request.use_llm:
        try:
            zones_text = "\n".join([
                f"- {z.label}: {z.risk_level.value.upper()} "
                f"(Buildings: {z.affected_buildings}, Loss: €{z.estimated_loss}M)"
                for z in result.zones[:5]
            ])
            entity_ctx = ""
            if result.entity_name and result.entity_type:
                entity_ctx = f"Entity: {result.entity_name} (Type: {result.entity_type}). Adapt the analysis and recommendations to this entity type (e.g. for HEALTHCARE focus on medical supply, ICU capacity, patient safety; for FINANCIAL on liquidity, counterparties; for CITY/REGION on infrastructure and population)."
                if "airport" in (result.entity_name or "").lower():
                    entity_ctx += " For airports mention operator (e.g. Fraport AG for Frankfurt Airport) and airline operations (e.g. Deutsche Lufthansa) where relevant."
                entity_ctx += "\n\n"
            if graph_context:
                entity_ctx += graph_context + "\n\n"

            # NVIDIA AI Orchestration: multi-model consensus (fast + deep analysis, weighted summary)
            if request.use_nvidia_orchestration and nvidia_consensus_engine.is_available:
                scenario = {
                    "entity_name": entity_name_for_calc,
                    "entity_type": getattr(result, "entity_type", "") or "",
                    "event_name": result.event_name,
                    "event_type": result.event_type.value,
                    "severity": request.severity,
                    "zones_text": zones_text,
                    "total_loss": result.total_loss,
                }
                if cascade_simulation and cascade_simulation.get("affected_nodes"):
                    scenario["cascade_affected"] = len(cascade_simulation.get("affected_nodes", []))
                    scenario["cascade_critical"] = [n.get("id") for n in (cascade_simulation.get("critical_nodes") or [])[:3]]
                orch_result = await nvidia_consensus_engine.analyze_with_consensus(
                    entity_name_for_calc, scenario, request.severity
                )
                executive_summary = orch_result.summary or orch_result.analysis
                if executive_summary:
                    executive_summary = re.sub(r'\*\*([^*]+)\*\*', r'\1', executive_summary)
                    executive_summary = re.sub(r'\*([^*]+)\*', r'\1', executive_summary)
                    executive_summary = re.sub(r'^#{1,6}\s*', '', executive_summary, flags=re.MULTILINE)
                    executive_summary = re.sub(r'\n{3,}', '\n\n', executive_summary).strip()
                concluding_summary = (orch_result.analysis or "").strip()[:1500]
                if concluding_summary:
                    concluding_summary = re.sub(r'\*\*([^*]+)\*\*', r'\1', concluding_summary)
                    concluding_summary = re.sub(r'\n{3,}', '\n\n', concluding_summary).strip()
                llm_generated = True
                nvidia_orchestration_result = {
                    "entity_type": orch_result.entity_type,
                    "confidence": orch_result.confidence,
                    "model_agreement": orch_result.model_agreement,
                    "flag_for_human_review": orch_result.flag_for_human_review,
                    "used_model_fast": orch_result.used_model_fast,
                    "used_model_deep": orch_result.used_model_deep,
                }
                logger.info(
                    "NVIDIA orchestration used for %s (agreement=%.2f, review=%s)",
                    request.city_name,
                    orch_result.model_agreement,
                    orch_result.flag_for_human_review,
                )

            # Multi-prompt pipeline (analyst -> cascade comment -> summary) when not using orchestration
            elif not nvidia_orchestration_result:
                # Prompt 1: Entity/scenario analyst (short structured analysis)
                analyst_prompt = f"""You are a risk analyst. In 3-5 short bullet points, analyze this stress test scenario. Focus on: entity type relevance, key risk zones, and immediate exposure. Plain text, English only, no markdown.

{entity_ctx}Stress Test: {result.event_name} | Type: {result.event_type.value} | Location: {result.city_name} | Severity: {result.severity:.0%}
Total Loss: €{result.total_loss:,.0f}M | Buildings: {result.total_buildings_affected:,} | Population: {result.total_population_affected:,}
Risk Zones:
{zones_text}"""
                analyst_response = await llm_service.generate(
                    prompt=analyst_prompt,
                    model=LLMModel.LLAMA_8B,
                    max_tokens=300,
                    temperature=0.3,
                )
                analyst_text = (analyst_response.content or "").strip() if analyst_response.finish_reason != "mock" else ""

                # Prompt 2: Cascade commentator (if cascade simulation was run)
                cascade_comment_text = ""
                if cascade_simulation and cascade_simulation.get("affected_nodes"):
                    cascade_prompt = f"""In 2-3 sentences, comment on cascade risk: trigger node {cascade_simulation.get('trigger_node')}, affected nodes ({len(cascade_simulation.get('affected_nodes', []))}), critical nodes {cascade_simulation.get('critical_nodes', [])[:3]}, and containment points {cascade_simulation.get('containment_points', [])[:2]}. Plain text, English, no markdown."""
                    cascade_response = await llm_service.generate(
                        prompt=cascade_prompt,
                        model=LLMModel.LLAMA_8B,
                        max_tokens=200,
                        temperature=0.3,
                    )
                    if cascade_response.finish_reason != "mock" and cascade_response.content:
                        cascade_comment_text = cascade_response.content.strip()

                # Prompt 3: Executive summary (synthesize analyst + cascade into 2-3 paragraphs)
                prior_analysis = f"Prior analysis:\n{analyst_text}\n\n" if analyst_text else ""
                if cascade_comment_text:
                    prior_analysis += f"Cascade comment:\n{cascade_comment_text}\n\n"
                summary_prompt = f"""Synthesize the following into a professional executive summary (2-3 paragraphs).
{prior_analysis}Write one coherent summary that covers: (1) risk scenario and implications, (2) key findings with metrics, (3) immediate priorities for stakeholders. Use the prior analysis and cascade comment if provided. Plain text only, no markdown. English."""

                summary_response = await llm_service.generate(
                    prompt=summary_prompt,
                    model=LLMModel.LLAMA_70B,
                    max_tokens=600,
                    temperature=0.3,
                )
                
                if summary_response.finish_reason != "mock" and summary_response.content:
                    # Remove markdown formatting
                    executive_summary = summary_response.content
                    executive_summary = re.sub(r'\*\*([^*]+)\*\*', r'\1', executive_summary)
                    executive_summary = re.sub(r'\*([^*]+)\*', r'\1', executive_summary)
                    executive_summary = re.sub(r'^#{1,6}\s*', '', executive_summary, flags=re.MULTILINE)
                    executive_summary = re.sub(r'\n{3,}', '\n\n', executive_summary).strip()
                    llm_generated = True
                    logger.info(f"LLM generated summary for {request.city_name}")
                
                # Generate LLM mitigation actions (entity-aware)
                entity_actions_ctx = ""
                if result.entity_name and result.entity_type:
                    entity_actions_ctx = f"Entity: {result.entity_name} (Type: {result.entity_type}). Adapt actions to this entity type (e.g. HEALTHCARE: medical supply, ICU, patient safety; FINANCIAL: liquidity, counterparties; CITY/REGION: infrastructure, population)."
                    if "airport" in (result.entity_name or "").lower():
                        entity_actions_ctx += " For airports mention operator (e.g. Fraport AG) and airline operations (e.g. Deutsche Lufthansa) where relevant."
                    entity_actions_ctx += "\n\n"
                event_cat = (result.event_type.value or "").lower()
                scenario_rule = ""
                if "supply" in event_cat or "supply_chain" in event_cat:
                    scenario_rule = "SCENARIO RULE: This is a SUPPLY CHAIN scenario. Do NOT suggest evacuation or emergency response. Suggest ONLY supply-chain actions: alternative suppliers, inventory buffer, distribution channels, expedited shipping, local sourcing.\n\n"
                elif "financial" in event_cat or "credit" in event_cat or "liquidity" in event_cat:
                    scenario_rule = "SCENARIO RULE: This is a FINANCIAL scenario. Suggest liquidity, hedging, counterparty contact, credit limits, regulatory filings. Do NOT suggest evacuation.\n\n"
                actions_prompt = f"""Generate 5 specific mitigation actions for this {result.event_type.value} risk scenario in {request.city_name}.
{scenario_rule}{entity_actions_ctx}Event: {result.event_name}
Severity: {request.severity:.0%}
Expected Loss: €{result.total_loss:,.0f}M

Provide exactly 5 concise action items, each on a new line. Start each with a verb.
Write in plain text only. Do NOT use markdown formatting, asterisks, or special symbols.
Write in English only."""

                actions_response = await llm_service.generate(
                    prompt=actions_prompt,
                    model=LLMModel.LLAMA_8B,
                    max_tokens=250,
                    temperature=0.4,
                )
                
                if actions_response.finish_reason != "mock" and actions_response.content:
                    lines = []
                    for line in actions_response.content.split('\n'):
                        line = line.strip().lstrip('•-1234567890. ')
                        line = re.sub(r'\*\*([^*]+)\*\*', r'\1', line)
                        line = re.sub(r'\*([^*]+)\*', r'\1', line)
                        if line and len(line) > 10:
                            lines.append(line)
                    
                    if len(lines) >= 3:
                        mitigation_actions = [
                            {
                                "action": action,
                                "priority": "urgent" if i < 2 else "high" if i < 4 else "medium",
                                "cost": round((10 - i * 1.5), 1),
                                "risk_reduction": round(35 - i * 5),
                            }
                            for i, action in enumerate(lines[:5])
                        ]
                        logger.info(f"LLM generated {len(mitigation_actions)} actions")

                # Generate concluding summary (entity-aware)
                concluding_entity_ctx = ""
                if result.entity_name and result.entity_type:
                    concluding_entity_ctx = f"Entity: {result.entity_name} (Type: {result.entity_type}). Tailor the conclusion to this entity type."
                    if "airport" in (result.entity_name or "").lower():
                        concluding_entity_ctx += " For airports mention operator (e.g. Fraport AG) and airline operations (e.g. Lufthansa) where relevant."
                    concluding_entity_ctx += "\n\n"
                concluding_prompt = f"""Based on this stress test, write a CONCLUDING SUMMARY (closing section) that leaves NO questions unanswered.
{concluding_entity_ctx}Stress Test: {result.event_name}
Type: {result.event_type.value}
Location: {result.city_name}
Total Expected Loss: €{result.total_loss:,.0f}M | Buildings: {result.total_buildings_affected:,} | Population: {result.total_population_affected:,}

The reader must understand:
1. WHAT TO DO - Clear, ordered action steps (immediate, short-term, medium-term)
2. HOW IT WILL AFFECT - Impact on assets, operations, stakeholders, timeline
3. BOTTOM LINE - One sentence takeaway: what is the key decision or outcome

Write 3-4 short paragraphs. Be explicit. Use plain text only, no markdown. English."""
                try:
                    concluding_response = await llm_service.generate(
                        prompt=concluding_prompt,
                        model=LLMModel.LLAMA_70B,
                        max_tokens=500,
                        temperature=0.3,
                    )
                    if concluding_response.finish_reason != "mock" and concluding_response.content:
                        concluding_summary = concluding_response.content
                        concluding_summary = re.sub(r'\*\*([^*]+)\*\*', r'\1', concluding_summary)
                        concluding_summary = re.sub(r'\*([^*]+)\*', r'\1', concluding_summary)
                        concluding_summary = re.sub(r'^#{1,6}\s*', '', concluding_summary, flags=re.MULTILINE)
                        concluding_summary = re.sub(r'\n{3,}', '\n\n', concluding_summary).strip()
                        logger.info("LLM generated concluding summary")
                except Exception as ec:
                    logger.error(f"LLM concluding summary error: {ec}")
        except Exception as e:
            logger.error(f"LLM error: {e}")

    # Template executive/concluding summary when LLM unavailable or returned fallback
    zones_text = "\n".join([
        f"- {z.label}: {z.risk_level.value.upper()} (Buildings: {z.affected_buildings}, Loss: €{z.estimated_loss}M)"
        for z in result.zones[:5]
    ])
    if executive_summary is None or _is_llm_fallback(executive_summary):
        executive_summary = _build_template_executive_summary(result, request, zones_text)
    if concluding_summary is None or _is_llm_fallback(concluding_summary):
        concluding_summary = _build_template_concluding_summary(result, request, zones_text)

    # Save to database
    test_id = str(uuid4())
    
    # Emit stress test started event
    started_event = await event_emitter.emit_stress_test_started(
        test_id=test_id,
        name=result.event_name,
        test_type=result.event_type.value if hasattr(result.event_type, 'value') else str(result.event_type),
        severity=request.severity,
        probability=0.5,
    )
    
    # Create stress test record
    stress_test = StressTest(
        id=test_id,
        name=result.event_name,
        description=f"Quick stress test for {request.city_name}",
        test_type=result.event_type.value if hasattr(result.event_type, 'value') else str(result.event_type),
        status=StressTestStatus.COMPLETED.value,
        center_latitude=request.center_latitude,
        center_longitude=request.center_longitude,
        radius_km=max(z.radius for z in result.zones) / 1000 if result.zones else 1.0,
        region_name=request.city_name,
        severity=request.severity,
        probability=0.5,
        time_horizon_months=12,
        affected_assets_count=result.total_buildings_affected,
        total_exposure=result.total_loss * 1000000,  # Convert to €
        expected_loss=result.total_loss * 1000000,
    )
    session.add(stress_test)
    
    # Create risk zones (include polygon for 4D CZML when available)
    for zone in result.zones:
        poly_json = None
        if getattr(zone, "polygon", None) and isinstance(zone.polygon, (list, tuple)) and len(zone.polygon) >= 3:
            poly_json = json.dumps({"type": "Polygon", "coordinates": [zone.polygon]})
        risk_zone = RiskZone(
            id=str(uuid4()),
            stress_test_id=test_id,
            zone_level=zone.risk_level.value,
            center_latitude=zone.position["lat"],
            center_longitude=zone.position["lng"],
            radius_km=zone.radius / 1000,
            polygon=poly_json,
            risk_score={"critical": 0.9, "high": 0.7, "medium": 0.5, "low": 0.3}.get(zone.risk_level.value, 0.5),
            affected_assets_count=zone.affected_buildings,
            total_exposure=zone.estimated_loss * 1000000,
            expected_loss=zone.estimated_loss * 1000000,
            name=zone.label,
        )
        session.add(risk_zone)
    
    # Report V2 metrics (probabilistic, temporal, contagion, etc.)
    from src.services.stress_report_metrics import compute_report_v2
    # Sector for Report V2: city_region when entity is city/region so sector metrics show city_region not enterprise
    entity_type_sector = getattr(result, "entity_type", None)
    sector_override = "city_region" if entity_type_sector == "CITY_REGION" else None
    report_v2 = compute_report_v2(
        total_loss=result.total_loss,
        zones_count=len(result.zones),
        city_name=result.city_name,
        event_type=result.event_type.value,
        severity=result.severity,
        total_buildings_affected=result.total_buildings_affected,
        total_population_affected=result.total_population_affected,
        sector=sector_override or "enterprise",
    )
    if cascade_simulation:
        report_v2["cascade_simulation"] = cascade_simulation
    elif request.use_cascade_gnn and result.zones:
        # Fallback when GNN had no nodes or failed: minimal cascade from zones
        first_zone = result.zones[0]
        report_v2["cascade_simulation"] = {
            "trigger_node": first_zone.label,
            "affected_nodes": [{"id": z.label, "name": z.label} for z in result.zones[:5]],
            "total_loss": result.total_loss,
            "simulation_steps": 1,
            "critical_nodes": [{"id": first_zone.label}] if result.zones else [],
            "containment_points": [result.zones[-1].label] if len(result.zones) > 1 else [],
        }
    if nvidia_orchestration_result:
        report_v2["nvidia_orchestration"] = nvidia_orchestration_result
    # Regulatory relevance (Phase 3) — jurisdiction by city (Japan, EU, USA)
    entity_type_for_reg = getattr(result, "entity_type", None) or "CITY_REGION"
    jurisdiction = _get_jurisdiction_for_city(result.city_name)
    reg_ctx = get_applicable_regulations(entity_type_for_reg, jurisdiction, result.severity)
    report_v2["regulatory_relevance"] = {
        "entity_type": reg_ctx.entity_type,
        "jurisdiction": reg_ctx.jurisdiction,
        "regulations": reg_ctx.regulations,
        "regulation_labels": reg_ctx.labels,
        "disclosure_required": reg_ctx.disclosure_required,
        "required_metrics": reg_ctx.required_metrics[:5],
    }
    # News/event enrichment (Phase 3) when API key set
    try:
        news_ctx = await enrich_stress_test_context(
            region=result.city_name,
            event_type=result.event_type.value,
            limit=5,
        )
        if news_ctx.get("events"):
            report_v2["news_enrichment"] = news_ctx
    except Exception:
        pass

    # GPU / NIM: when USE_LOCAL_NIM and FourCastNet healthy, mark report as using GPU (visible vs local/Contabo)
    data_sources_response = list(result.data_sources)
    nim_used = False
    try:
        if getattr(settings, "use_local_nim", False):
            from src.services.nvidia_nim import nim_service
            if await nim_service.check_health("fourcastnet"):
                report_v2["gpu_services_used"] = ["FourCastNet NIM"]
                if "FourCastNet NIM (GPU)" not in data_sources_response:
                    data_sources_response.append("FourCastNet NIM (GPU)")
                nim_used = True
    except Exception:
        pass
    # When NIM/Earth-2 not used, mark Open-Meteo (no-GPU simulations)
    if not nim_used and "Open-Meteo (API)" not in data_sources_response:
        data_sources_response.append("Open-Meteo (API)")

    currency = _get_currency_for_city(result.city_name)

    # Create report (include entity_name/entity_type for PDF/reporter)
    report = StressTestReport(
        id=str(uuid4()),
        stress_test_id=test_id,
        summary=executive_summary or f"Stress test completed for {request.city_name}",
        report_data=json.dumps({
            "zones": [
                {
                    "label": z.label,
                    "risk_level": z.risk_level.value,
                    "affected_buildings": z.affected_buildings,
                    "estimated_loss": z.estimated_loss,
                }
                for z in result.zones
            ],
            "mitigation_actions": mitigation_actions,
            "data_sources": data_sources_response,
            "report_v2": report_v2,
            "entity_name": getattr(result, "entity_name", None),
            "entity_type": getattr(result, "entity_type", None),
            "currency": currency,
        }),
    )
    session.add(report)

    await session.commit()

    # Compliance verification (real check against norms for this jurisdiction)
    compliance_verification_payload: Optional[dict] = None
    try:
        from src.services.compliance_agent import run_verification
        verifications = await run_verification(
            db=session,
            entity_type=entity_type_for_reg,
            jurisdiction=jurisdiction,
            stress_test_id=test_id,
            context={"severity": result.severity, "total_loss": result.total_loss},
        )
        await session.commit()
        if verifications:
            compliance_verification_payload = {
                "verified": any(v.status == "passed" for v in verifications),
                "verifications": [{"framework_id": v.framework_id, "status": v.status, "id": v.id} for v in verifications],
                "verified_at": verifications[0].checked_at.isoformat() if verifications else None,
            }
    except Exception as e:
        logger.debug("Compliance verification skipped: %s", e)

    # Attach region action plan if available (e.g. Australia/Melbourne flood)
    from src.services.region_action_plans import get_plan, plan_to_dict

    region_plan = get_plan(result.city_name, request.event_id)
    region_plan_data = RegionActionPlanResponse(**plan_to_dict(region_plan)) if region_plan else None

    # Emit stress test completed event
    await event_emitter.emit_stress_test_completed(
        test_id=test_id,
        name=result.event_name,
        result={
            "zones": len(result.zones),
            "expected_loss": result.total_loss,
            "buildings_affected": result.total_buildings_affected,
        },
        caused_by=started_event.event_id,
    )

    # ARIN Decision Object (Risk & Intelligence OS)
    decision_object = None
    try:
        from src.services.arin_orchestrator import get_arin_orchestrator
        orch = get_arin_orchestrator()
        do = await orch.assess(
            source_module="stress_test",
            object_type="scenario",
            object_id=test_id,
            input_data={
                "severity": result.severity,
                "total_loss": result.total_loss,
                "zones_count": len(result.zones),
                "city_name": result.city_name,
                "event_type": result.event_type.value,
            },
            shared_context={"portfolio_id": test_id, "source": "stress_test"},
        )
        decision_object = do.model_dump(mode="json")
    except Exception as e:
        logger.debug("ARIN assess skipped: %s", e)

    # ARIN Platform export (fire-and-forget) with compliance verification when available
    if settings.arin_export_url:
        export_kw: dict = {
            "entity_id": make_scenario_entity_id(result.event_name, str(result.severity)),
            "scenario_name": result.event_name,
            "risk_score": result.severity * 100,
            "portfolio_loss": -(result.total_loss / 100) if result.total_loss else None,
            "recovery_days": None,
            "summary": executive_summary,
            "recommendations": [a.get("action", "") for a in mitigation_actions[:3] if isinstance(a, dict) and a.get("action")],
        }
        if compliance_verification_payload:
            export_kw["compliance_verification_passed"] = compliance_verification_payload.get("verified", False)
            export_kw["compliance_verification_id"] = compliance_verification_payload.get("verifications", [{}])[0].get("id") if compliance_verification_payload.get("verifications") else None
            export_kw["frameworks_checked"] = [v.get("framework_id") for v in compliance_verification_payload.get("verifications", [])]
        asyncio.create_task(export_stress_test(**export_kw))

    return QuickStressTestResponse(
        id=test_id,
        event_name=result.event_name,
        event_type=result.event_type.value,
        city_name=result.city_name,
        severity=result.severity,
        timestamp=result.timestamp,
        total_loss=result.total_loss,
        total_buildings_affected=result.total_buildings_affected,
        total_population_affected=result.total_population_affected,
        zones=[
            QuickZoneResponse(
                label=z.label,
                risk_level=z.risk_level.value,
                position=z.position,
                radius=z.radius,
                affected_buildings=z.affected_buildings,
                estimated_loss=z.estimated_loss,
                population_affected=z.population_affected,
                recommendations=z.recommendations,
                polygon=getattr(z, 'polygon', None),
            )
            for z in result.zones
        ],
        executive_summary=executive_summary,
        concluding_summary=concluding_summary,
        mitigation_actions=[
            MitigationActionResponse(**action) for action in mitigation_actions
        ],
        data_sources=data_sources_response,
        llm_generated=llm_generated,
        region_action_plan=region_plan_data,
        report_v2=report_v2,
        related_entities=related_entities,
        graph_context=graph_context,
        cascade_simulation=cascade_simulation,
        resolved_entity_type=resolved_entity_type,
        nvidia_orchestration=nvidia_orchestration_result,
        currency=currency,
        decision_object=decision_object,
        report_source=getattr(request, "source", None),
        compliance_verification=compliance_verification_payload,
    )


@router.post("/execute/nvidia", response_model=NVIDIAEnhancedResponse)
async def execute_nvidia_enhanced_stress_test(
    request: NVIDIAEnhancedRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    Execute NVIDIA-enhanced stress test with full pipeline.
    
    This endpoint uses the complete NVIDIA stack:
    1. **Earth-2 FourCastNet** - Weather forecast for location
    2. **PhysicsNeMo** - Physics-based simulations (flood/seismic/fire)
    3. **LLM (Llama 3.1)** - Intelligent analysis and recommendations
    
    All services have automatic fallback to mock data if API unavailable.
    The response includes detailed pipeline execution info.
    """
    from src.services.risk_zone_calculator import get_event_category
    from src.services.region_action_plans import get_plan, plan_to_dict
    from src.services.stress_report_metrics import compute_report_v2

    logger = logging.getLogger(__name__)
    
    # Determine event category
    event_type = get_event_category(request.event_type)
    
    # Run NVIDIA pipeline
    pipeline_result = await nvidia_stress_pipeline.execute(
        latitude=request.center_latitude,
        longitude=request.center_longitude,
        event_type=event_type,
        severity=request.severity,
        city_name=request.city_name,
        run_physics=request.run_physics,
        run_llm=request.run_llm,
    )
    
    # Use adjusted severity from pipeline
    adjusted_severity = pipeline_result.weather_adjusted_severity
    
    # Calculate risk zones with adjusted severity (entity_name for context-dependent zone labels)
    entity_name_nvidia = request.entity_name or request.city_name
    zones_result = risk_zone_calculator.calculate(
        center_lat=request.center_latitude,
        center_lng=request.center_longitude,
        event_id=request.event_type,
        severity=adjusted_severity,
        city_name=request.city_name,
        entity_name=entity_name_nvidia,
    )
    
    # Merge pipeline data sources with zone data sources
    all_data_sources = list(set(zones_result.data_sources + pipeline_result.data_sources))
    # When NIM/GPU not used, mark Open-Meteo (no-GPU simulations)
    if "FourCastNet NIM (GPU)" not in all_data_sources and "Open-Meteo (API)" not in all_data_sources:
        all_data_sources.append("Open-Meteo (API)")

    # Use LLM summary if available, otherwise use default
    executive_summary = pipeline_result.executive_summary
    # Template fallback when pipeline returns no summary or mock/LLM-unavailable message
    nvidia_zones_text = "\n".join([
        f"- {z.label}: {z.risk_level.value.upper()} (Buildings: {z.affected_buildings}, Loss: €{z.estimated_loss}M)"
        for z in zones_result.zones[:5]
    ])
    if executive_summary is None or _is_llm_fallback(executive_summary):
        executive_summary = _build_template_executive_summary(zones_result, request, nvidia_zones_text)

    # Use LLM recommendations if available
    if pipeline_result.mitigation_recommendations:
        mitigation_actions = [
            {
                "action": action,
                "priority": "urgent" if i < 2 else "high" if i < 4 else "medium",
                "cost": round(10 - i * 1.5, 1),
                "risk_reduction": round(35 - i * 5),
            }
            for i, action in enumerate(pipeline_result.mitigation_recommendations)
        ]
    else:
        mitigation_actions = zones_result.mitigation_actions
    
    # Save to database
    test_id = str(uuid4())
    
    # Emit stress test started event
    started_event = await event_emitter.emit_stress_test_started(
        test_id=test_id,
        name=zones_result.event_name,
        test_type=event_type.value,
        severity=adjusted_severity,
        probability=0.5,
    )
    
    stress_test = StressTest(
        id=test_id,
        name=zones_result.event_name,
        description=f"NVIDIA-enhanced stress test for {request.city_name}",
        test_type=event_type.value,
        status=StressTestStatus.COMPLETED.value,
        center_latitude=request.center_latitude,
        center_longitude=request.center_longitude,
        radius_km=max(z.radius for z in zones_result.zones) / 1000 if zones_result.zones else 1.0,
        region_name=request.city_name,
        severity=adjusted_severity,
        probability=0.5,
        time_horizon_months=12,
        affected_assets_count=zones_result.total_buildings_affected,
        total_exposure=zones_result.total_loss * 1000000,
        expected_loss=zones_result.total_loss * 1000000,
    )
    session.add(stress_test)
    
    # Create risk zones
    for zone in zones_result.zones:
        risk_zone = RiskZone(
            id=str(uuid4()),
            stress_test_id=test_id,
            zone_level=zone.risk_level.value,
            center_latitude=zone.position["lat"],
            center_longitude=zone.position["lng"],
            radius_km=zone.radius / 1000,
            risk_score={"critical": 0.9, "high": 0.7, "medium": 0.5, "low": 0.3}.get(zone.risk_level.value, 0.5),
            affected_assets_count=zone.affected_buildings,
            total_exposure=zone.estimated_loss * 1000000,
            expected_loss=zone.estimated_loss * 1000000,
            name=zone.label,
        )
        session.add(risk_zone)
    
    await session.commit()
    
    # Emit stress test completed event
    await event_emitter.emit_stress_test_completed(
        test_id=test_id,
        name=zones_result.event_name,
        result={
            "zones": len(zones_result.zones),
            "expected_loss": zones_result.total_loss,
            "buildings_affected": zones_result.total_buildings_affected,
            "nvidia_services": pipeline_result.nvidia_services_used,
        },
        caused_by=started_event.event_id,
    )
    
    logger.info(
        "NVIDIA-enhanced stress test completed",
        city=request.city_name,
        event_type=event_type.value,
        services_used=len(pipeline_result.nvidia_services_used),
        all_mock=pipeline_result.all_mock,
    )
    
    # Prepare weather context dict
    weather_ctx = None
    if pipeline_result.weather_context:
        wc = pipeline_result.weather_context
        weather_ctx = {
            "temperature_c": wc.temperature_c,
            "precipitation_mm": wc.precipitation_mm,
            "wind_speed_ms": wc.wind_speed_ms,
            "humidity_percent": wc.humidity_percent,
            "extreme_weather": wc.extreme_weather,
            "is_mock": wc.is_mock,
        }
    
    # Prepare physics context dict
    physics_ctx = None
    if pipeline_result.physics_context:
        pc = pipeline_result.physics_context
        physics_ctx = {
            "flood_depth_m": pc.flood_depth_m,
            "flood_velocity_ms": pc.flood_velocity_ms,
            "seismic_magnitude": pc.seismic_magnitude,
            "seismic_damage_ratio": pc.seismic_damage_ratio,
            "is_mock": pc.is_mock,
        }
    
    return NVIDIAEnhancedResponse(
        id=test_id,
        event_name=zones_result.event_name,
        event_type=event_type.value,
        city_name=request.city_name,
        severity=request.severity,
        adjusted_severity=adjusted_severity,
        timestamp=zones_result.timestamp,
        total_loss=zones_result.total_loss,
        total_buildings_affected=zones_result.total_buildings_affected,
        total_population_affected=zones_result.total_population_affected,
        zones=[
            QuickZoneResponse(
                label=z.label,
                risk_level=z.risk_level.value,
                position=z.position,
                radius=z.radius,
                affected_buildings=z.affected_buildings,
                estimated_loss=z.estimated_loss,
                population_affected=z.population_affected,
                recommendations=z.recommendations,
                polygon=getattr(z, 'polygon', None),
            )
            for z in zones_result.zones
        ],
        executive_summary=executive_summary,
        mitigation_actions=[
            MitigationActionResponse(**action) for action in mitigation_actions
        ],
        data_sources=all_data_sources,
        region_action_plan=(
            RegionActionPlanResponse(**plan_to_dict(region_plan))
            if (region_plan := get_plan(request.city_name, request.event_type))
            else None
        ),
        report_v2=compute_report_v2(
            total_loss=zones_result.total_loss,
            zones_count=len(zones_result.zones),
            city_name=request.city_name,
            event_type=event_type.value,
            severity=adjusted_severity,
            total_buildings_affected=zones_result.total_buildings_affected,
            total_population_affected=zones_result.total_population_affected,
        ),
        nvidia_pipeline=NVIDIAPipelineInfo(
            stages_completed=pipeline_result.pipeline_stages,
            services_used=pipeline_result.nvidia_services_used,
            execution_time_ms=pipeline_result.execution_time_ms,
            all_mock=pipeline_result.all_mock,
            confidence_score=pipeline_result.confidence_score,
            weather_adjusted_severity=adjusted_severity,
        ),
        weather_context=weather_ctx,
        physics_context=physics_ctx,
        methodology=getattr(zones_result, "methodology", None),
        eu_taxonomy_alignment=getattr(zones_result, "eu_taxonomy_alignment", None),
    )


@router.post("/{test_id}/run", response_model=StressTestResponse)
async def run_stress_test(
    test_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Execute a stress test and calculate impacts."""
    result = await session.execute(
        select(StressTest).where(StressTest.id == test_id)
    )
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Stress test not found")
    
    # Update status
    test.status = StressTestStatus.RUNNING.value
    await session.commit()
    
    # Emit stress test started event
    started_event = await event_emitter.emit_stress_test_started(
        test_id=test_id,
        name=test.name,
        test_type=test.test_type,
        severity=test.severity,
        probability=test.probability,
    )
    
    try:
        # Find affected assets based on location
        if test.center_latitude and test.center_longitude and test.radius_km:
            # Simple distance calculation (not geodesic, for demo)
            # In production, use PostGIS ST_DWithin
            affected_assets = await session.execute(
                select(Asset).where(
                    Asset.latitude.isnot(None),
                    Asset.longitude.isnot(None),
                )
            )
            assets = affected_assets.scalars().all()
            
            # Emit progress update - 25%
            await event_emitter.emit_stress_test_progress(
                test_id=test_id,
                progress=25,
                status="running",
                message="Finding affected assets...",
            )
            
            # Filter by approximate distance
            affected = []
            for asset in assets:
                # Simple lat/lon distance approximation
                lat_diff = abs(asset.latitude - test.center_latitude)
                lon_diff = abs(asset.longitude - test.center_longitude)
                # Rough km approximation: 1 degree ≈ 111 km
                dist_km = ((lat_diff * 111) ** 2 + (lon_diff * 111 * 0.7) ** 2) ** 0.5
                if dist_km <= test.radius_km:
                    affected.append(asset)
            
            test.affected_assets_count = len(affected)
            
            # Emit progress update - 50%
            await event_emitter.emit_stress_test_progress(
                test_id=test_id,
                progress=50,
                status="running",
                message=f"Found {len(affected)} affected assets",
            )
            
            # Calculate total exposure and expected loss
            total_exposure = sum(a.current_valuation or 0 for a in affected)
            test.total_exposure = total_exposure
            test.expected_loss = total_exposure * abs(test.valuation_impact_pct) / 100 * test.probability
            
            # Emit progress update - 75%
            await event_emitter.emit_stress_test_progress(
                test_id=test_id,
                progress=75,
                status="running",
                message="Creating risk zones...",
            )
            
            # Create/update risk zones based on severity
            created_zones = []
            if affected:
                # Create concentric zones
                zones_data = [
                    (ZoneLevel.CRITICAL, 0.3),
                    (ZoneLevel.HIGH, 0.5),
                    (ZoneLevel.MEDIUM, 0.7),
                    (ZoneLevel.LOW, 1.0),
                ]
                
                for zone_level, radius_factor in zones_data:
                    zone = RiskZone(
                        id=str(uuid4()),
                        stress_test_id=test_id,
                        zone_level=zone_level.value,
                        center_latitude=test.center_latitude,
                        center_longitude=test.center_longitude,
                        radius_km=test.radius_km * radius_factor,
                        risk_score=test.severity * (1.0 / radius_factor),
                        name=f"{zone_level.value.title()} Zone",
                    )
                    session.add(zone)
                    created_zones.append(zone)
            
            await session.flush()  # Flush to get zone IDs
            
            # Emit zone created events
            for zone in created_zones:
                await event_emitter.emit_risk_zone_created(
                    zone_id=zone.id,
                    zone_name=zone.name or f"{zone.zone_level} Zone",
                    zone_level=zone.zone_level,
                    risk_score=zone.risk_score,
                    stress_test_id=test_id,
                    caused_by=started_event.event_id,
                )
        
        test.status = StressTestStatus.COMPLETED.value
        await session.commit()
        await session.refresh(test)
        
        # Emit stress test completed event
        await event_emitter.emit_stress_test_completed(
            test_id=test_id,
            name=test.name,
            result={
                "zones": len(created_zones) if 'created_zones' in locals() else 0,
                "affected_assets": test.affected_assets_count,
                "expected_loss": test.expected_loss,
            },
            caused_by=started_event.event_id,
        )

        # ARIN Platform export (fire-and-forget)
        if getattr(settings, "arin_export_url", None):
            asyncio.create_task(
                export_stress_test(
                    entity_id=make_scenario_entity_id(test.name, str(test.severity or 0.5)),
                    scenario_name=test.name,
                    risk_score=test.severity * 100 if test.severity else 50,
                    portfolio_loss=-(test.expected_loss / 1e6) if test.expected_loss else None,
                    recovery_days=None,
                    summary=f"Stress test {test.name}: {test.affected_assets_count or 0} assets, €{test.expected_loss or 0:,.0f} expected loss.",
                    recommendations=["Review exposure", "Update risk limits"],
                )
            )
        
    except Exception as e:
        test.status = StressTestStatus.FAILED.value
        await session.commit()
        
        # Emit stress test failed event
        await event_emitter.emit_stress_test_failed(
            test_id=test_id,
            name=test.name,
            error=str(e),
            caused_by=started_event.event_id,
        )
        
        raise HTTPException(status_code=500, detail=str(e))
    
    return await get_stress_test(test_id, session)


# =============================================================================
# Report Endpoints
# =============================================================================

@router.post("/{test_id}/reports", response_model=StressTestReportResponse, status_code=201)
async def generate_report(
    test_id: str,
    use_llm: bool = Query(True, description="Use NVIDIA LLM for intelligent analysis"),
    session: AsyncSession = Depends(get_db),
):
    """
    Generate a detailed report for a stress test.
    
    Uses NVIDIA LLM (Llama 3.1) for intelligent summary and recommendations.
    """
    logger = logging.getLogger(__name__)
    
    result = await session.execute(
        select(StressTest).where(StressTest.id == test_id)
    )
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Stress test not found")
    
    # Get zones for context
    zones_result = await session.execute(
        select(RiskZone).where(RiskZone.stress_test_id == test_id)
    )
    zones = zones_result.scalars().all()
    
    # Generate summary using LLM if enabled
    summary = f"Stress test '{test.name}' analysis complete. Affected assets: {test.affected_assets_count or 0}, Expected loss: €{test.expected_loss or 0:,.0f}"
    
    if use_llm:
        try:
            # Prepare context for LLM
            prompt = f"""Analyze this stress test and provide a professional executive summary (2-3 paragraphs):

**Stress Test:** {test.name}
**Type:** {test.test_type}
**Region:** {test.region_name or 'N/A'}
**Severity:** {test.severity:.0%}
**Probability:** {test.probability:.0%}
**Time Horizon:** {test.time_horizon_months} months

**Impact:**
- Affected Assets: {test.affected_assets_count or 0}
- Total Exposure: €{test.total_exposure or 0:,.0f}
- Expected Loss: €{test.expected_loss or 0:,.0f}
- Valuation Impact: {test.valuation_impact_pct:.1f}%

**Risk Zones:** {len(zones)} zones identified
{chr(10).join([f"- {z.zone_level.upper()}: {z.name or 'Zone'} (risk score: {z.risk_score:.2f})" for z in zones[:5]])}

Provide:
1. Executive summary of the risk scenario
2. Key findings and metrics
3. Immediate implications for stakeholders

Use professional risk management language. Be concise but comprehensive."""

            llm_response = await llm_service.generate(
                prompt=prompt,
                model=LLMModel.LLAMA_70B,  # Best quality
                max_tokens=800,
                temperature=0.3,  # More deterministic
            )
            
            if llm_response.finish_reason != "mock":
                summary = llm_response.content
                logger.info(f"LLM generated summary for stress test {test_id}")
            else:
                logger.warning("LLM returned mock response, using default summary")
                
        except Exception as e:
            logger.error(f"LLM error: {e}, using default summary")
    
    # Create report
    report = StressTestReport(
        id=str(uuid4()),
        stress_test_id=test_id,
        summary=summary,
    )
    session.add(report)
    
    # Generate action plans for each organization type
    # Use LLM to generate context-aware recommendations
    org_plans = []
    
    base_plans = [
        {
            "type": OrganizationType.DEVELOPER,
            "priority": "high",
            "timeline": "72h",
            "default_actions": [
                "Review all projects in affected risk zones",
                "Update construction insurance coverage",
                "Develop emergency evacuation plans for construction sites",
            ],
        },
        {
            "type": OrganizationType.INSURER,
            "priority": "critical",
            "timeline": "24h",
            "default_actions": [
                "Increase loss reserves for expected claims",
                "Activate reinsurance treaty agreements",
                "Deploy damage assessment teams to affected areas",
            ],
        },
        {
            "type": OrganizationType.BANK,
            "priority": "high",
            "timeline": "week",
            "default_actions": [
                "Review credit limits for borrowers in risk zones",
                "Update collateral valuations for affected assets",
                "Prepare loan restructuring programs",
            ],
        },
        {
            "type": OrganizationType.ENTERPRISE,
            "priority": "high",
            "timeline": "immediate",
            "default_actions": [
                "Activate business continuity plan",
                "Secure and protect critical equipment",
                "Establish backup communication channels",
            ],
        },
        {
            "type": OrganizationType.MILITARY,
            "priority": "high",
            "timeline": "24h",
            "default_actions": [
                "Prepare forces for civilian assistance operations",
                "Secure critical infrastructure protection",
                "Coordinate with civil emergency services",
            ],
        },
    ]
    
    # For the most critical organization (Insurer), use LLM for tailored recommendations
    if use_llm:
        try:
            actions_prompt = f"""Generate 5 specific action items for an INSURANCE COMPANY responding to this risk event:

Event: {test.name}
Type: {test.test_type}
Severity: {test.severity:.0%}
Expected Loss: €{test.expected_loss or 0:,.0f}
Affected Assets: {test.affected_assets_count or 0}

Provide exactly 5 concise, actionable recommendations in English. Each should be a single sentence.
Format: One action per line, starting with a verb. English only."""

            llm_actions = await llm_service.generate(
                prompt=actions_prompt,
                model=LLMModel.LLAMA_8B,  # Fast model for actions
                max_tokens=300,
                temperature=0.4,
            )
            
            if llm_actions.finish_reason != "mock":
                # Parse LLM response into action items
                llm_action_lines = [
                    line.strip().lstrip('•-123456789. ')
                    for line in llm_actions.content.split('\n')
                    if line.strip() and len(line.strip()) > 10
                ][:5]
                
                if len(llm_action_lines) >= 3:
                    # Update insurer actions with LLM-generated ones
                    for plan in base_plans:
                        if plan["type"] == OrganizationType.INSURER:
                            plan["default_actions"] = llm_action_lines
                            break
                    logger.info(f"LLM generated {len(llm_action_lines)} action items")
        except Exception as e:
            logger.error(f"LLM action generation error: {e}")
    
    # Convert to final format
    for plan in base_plans:
        org_plans.append({
            "type": plan["type"],
            "actions": plan["default_actions"],
            "priority": plan["priority"],
            "timeline": plan["timeline"],
        })
    
    for plan_data in org_plans:
        action_plan = ActionPlan(
            id=str(uuid4()),
            report_id=report.id,
            organization_type=plan_data["type"].value,
            actions=json.dumps(plan_data["actions"]),
            priority=plan_data["priority"],
            timeline=plan_data["timeline"],
            risk_reduction=0.3,  # Estimated 30% risk reduction
        )
        session.add(action_plan)
    
    await session.commit()
    await session.refresh(report)
    
    # Fetch action plans
    plans_result = await session.execute(
        select(ActionPlan).where(ActionPlan.report_id == report.id)
    )
    action_plans = plans_result.scalars().all()
    
    return {
        "id": report.id,
        "stress_test_id": report.stress_test_id,
        "summary": report.summary,
        "generated_at": report.generated_at.isoformat(),
        "action_plans": [
            {
                "id": ap.id,
                "organization_type": ap.organization_type,
                "organization_name": ap.organization_name,
                "actions": json.loads(ap.actions) if ap.actions else None,
                "priority": ap.priority,
                "timeline": ap.timeline,
                "estimated_cost": ap.estimated_cost,
                "risk_reduction": ap.risk_reduction,
                "roi_percentage": ap.roi_percentage,
            }
            for ap in action_plans
        ],
    }


@router.get("/{test_id}/reports", response_model=List[StressTestReportResponse])
async def list_reports(
    test_id: str,
    session: AsyncSession = Depends(get_db),
):
    """List all reports for a stress test."""
    result = await session.execute(
        select(StressTestReport)
        .where(StressTestReport.stress_test_id == test_id)
        .order_by(StressTestReport.generated_at.desc())
    )
    reports = result.scalars().all()
    
    response = []
    for report in reports:
        plans_result = await session.execute(
            select(ActionPlan).where(ActionPlan.report_id == report.id)
        )
        action_plans = plans_result.scalars().all()
        
        response.append({
            "id": report.id,
            "stress_test_id": report.stress_test_id,
            "summary": report.summary,
            "generated_at": report.generated_at.isoformat(),
            "action_plans": [
                {
                    "id": ap.id,
                    "organization_type": ap.organization_type,
                    "organization_name": ap.organization_name,
                    "actions": json.loads(ap.actions) if ap.actions else None,
                    "priority": ap.priority,
                    "timeline": ap.timeline,
                    "estimated_cost": ap.estimated_cost,
                    "risk_reduction": ap.risk_reduction,
                    "roi_percentage": ap.roi_percentage,
                }
                for ap in action_plans
            ],
        })
    
    return response


# =============================================================================
# Types Endpoint
# =============================================================================

@router.get("/types/list")
async def list_stress_test_types():
    """Get all available stress test types."""
    return {
        "types": [
            {
                "value": t.value,
                "label": {
                    StressTestType.POLITICAL: "Политический",
                    StressTestType.MILITARY: "Военный",
                    StressTestType.CLIMATE: "Климатический",
                    StressTestType.FINANCIAL: "Финансовый",
                    StressTestType.SOCIAL: "Социальный",
                    StressTestType.PANDEMIC: "Пандемия",
                    StressTestType.REGULATORY: "Регуляторный (Базель)",
                    StressTestType.PROTEST: "Протесты",
                    StressTestType.UPRISING: "Восстания",
                    StressTestType.CIVIL_UNREST: "Массовые беспорядки",
                }.get(t, t.value.title())
            }
            for t in StressTestType
        ],
        "zone_levels": [
            {"value": z.value, "label": z.value.title()}
            for z in ZoneLevel
        ],
        "organization_types": [
            {
                "value": o.value,
                "label": {
                    OrganizationType.DEVELOPER: "Девелоперы",
                    OrganizationType.INSURER: "Страховые компании",
                    OrganizationType.MILITARY: "Военные структуры",
                    OrganizationType.BANK: "Банки",
                    OrganizationType.ENTERPRISE: "Предприятия",
                    OrganizationType.GOVERNMENT: "Государственные органы",
                    OrganizationType.INFRASTRUCTURE: "Критическая инфраструктура",
                }.get(o, o.value.title())
            }
            for o in OrganizationType
        ],
    }
