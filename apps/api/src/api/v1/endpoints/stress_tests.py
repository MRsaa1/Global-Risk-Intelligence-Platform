"""
Stress Tests API endpoints.

CRUD operations for stress tests, risk zones, and reports.
Integrates with NVIDIA LLM for intelligent report generation.
"""
import json
import logging
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services.nvidia_llm import llm_service, LLMModel
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
from src.models.asset import Asset
from src.services.event_emitter import event_emitter
from src.models.events import EventTypes

router = APIRouter(prefix="/stress-tests", tags=["Stress Tests"])


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
):
    """Create a new stress test."""
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
    from src.services.stress_scenario_registry import get_stress_scenario_library as _get_library
    return _get_library()


@router.get("/scenarios/extended")
async def get_extended_scenarios():
    """Extended stress scenario tree (by category)."""
    from src.services.stress_scenario_registry import get_extended_scenarios_tree
    return get_extended_scenarios_tree()


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
    }


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
    mitigation_actions: List[MitigationActionResponse]
    data_sources: List[str]
    llm_generated: bool = False


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
    
    # Calculate risk zones using the smart algorithm
    result = risk_zone_calculator.calculate(
        center_lat=request.center_latitude,
        center_lng=request.center_longitude,
        event_id=request.event_id,
        severity=request.severity,
        city_name=request.city_name,
    )
    
    executive_summary = None
    llm_generated = False
    mitigation_actions = result.mitigation_actions
    
    # Generate LLM-powered executive summary if requested
    if request.use_llm:
        try:
            zones_text = "\n".join([
                f"- {z.label}: {z.risk_level.value.upper()} "
                f"(Buildings: {z.affected_buildings}, Loss: €{z.estimated_loss}M)"
                for z in result.zones[:5]
            ])
            
            summary_prompt = f"""Analyze this stress test scenario and provide a professional executive summary (2-3 paragraphs).

Stress Test: {result.event_name}
Type: {result.event_type.value}
Location: {result.city_name}
Severity: {result.severity:.0%}

Impact Assessment:
- Total Expected Loss: €{result.total_loss:,.0f}M
- Buildings Affected: {result.total_buildings_affected:,}
- Population Impacted: {result.total_population_affected:,}

Identified Risk Zones:
{zones_text}

Provide:
1. Executive summary of the risk scenario and its implications
2. Key findings with quantitative metrics
3. Immediate priorities for stakeholders

IMPORTANT: Write in plain text only. Do NOT use any markdown formatting such as asterisks, bold, headers, or bullet points with dashes.
Use professional risk management language. Be concise but comprehensive. Write in English."""

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
            
            # Generate LLM mitigation actions
            actions_prompt = f"""Generate 5 specific mitigation actions for this {result.event_type.value} risk scenario in {request.city_name}.

Event: {result.event_name}
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
                    
        except Exception as e:
            logger.error(f"LLM error: {e}")
    
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
    
    # Create risk zones
    for zone in result.zones:
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
    
    # Create report
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
            "data_sources": result.data_sources,
        }),
    )
    session.add(report)
    
    await session.commit()
    
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
            )
            for z in result.zones
        ],
        executive_summary=executive_summary,
        mitigation_actions=[
            MitigationActionResponse(**action) for action in mitigation_actions
        ],
        data_sources=result.data_sources,
        llm_generated=llm_generated,
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
    
    # Calculate risk zones with adjusted severity
    zones_result = risk_zone_calculator.calculate(
        center_lat=request.center_latitude,
        center_lng=request.center_longitude,
        event_id=request.event_type,
        severity=adjusted_severity,
        city_name=request.city_name,
    )
    
    # Merge pipeline data sources with zone data sources
    all_data_sources = list(set(zones_result.data_sources + pipeline_result.data_sources))
    
    # Use LLM summary if available, otherwise use default
    executive_summary = pipeline_result.executive_summary
    
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
            )
            for z in zones_result.zones
        ],
        executive_summary=executive_summary,
        mitigation_actions=[
            MitigationActionResponse(**action) for action in mitigation_actions
        ],
        data_sources=all_data_sources,
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
