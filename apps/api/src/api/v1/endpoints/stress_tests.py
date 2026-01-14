"""
Stress Tests API endpoints.

CRUD operations for stress tests, risk zones, and reports.
"""
import json
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
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
    
    await session.delete(test)
    await session.commit()


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
# Execution Endpoints
# =============================================================================

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
            
            # Calculate total exposure and expected loss
            total_exposure = sum(a.current_valuation or 0 for a in affected)
            test.total_exposure = total_exposure
            test.expected_loss = total_exposure * abs(test.valuation_impact_pct) / 100 * test.probability
            
            # Create/update risk zones based on severity
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
        
        test.status = StressTestStatus.COMPLETED.value
        await session.commit()
        await session.refresh(test)
        
    except Exception as e:
        test.status = StressTestStatus.FAILED.value
        await session.commit()
        raise HTTPException(status_code=500, detail=str(e))
    
    return await get_stress_test(test_id, session)


# =============================================================================
# Report Endpoints
# =============================================================================

@router.post("/{test_id}/reports", response_model=StressTestReportResponse, status_code=201)
async def generate_report(
    test_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Generate a detailed report for a stress test."""
    result = await session.execute(
        select(StressTest).where(StressTest.id == test_id)
    )
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Stress test not found")
    
    # Create report
    report = StressTestReport(
        id=str(uuid4()),
        stress_test_id=test_id,
        summary=f"Stress test '{test.name}' analysis complete. "
                f"Affected assets: {test.affected_assets_count or 0}, "
                f"Expected loss: €{test.expected_loss or 0:,.0f}",
    )
    session.add(report)
    
    # Generate action plans for each organization type
    org_plans = [
        {
            "type": OrganizationType.DEVELOPER,
            "actions": [
                "Пересмотреть проекты в зоне риска",
                "Обновить страхование строительства",
                "Разработать план эвакуации стройплощадок",
            ],
            "priority": "high",
            "timeline": "72h",
        },
        {
            "type": OrganizationType.INSURER,
            "actions": [
                "Обновить резервы на выплаты",
                "Активировать перестраховочные договоры",
                "Подготовить команды оценщиков",
            ],
            "priority": "critical",
            "timeline": "24h",
        },
        {
            "type": OrganizationType.BANK,
            "actions": [
                "Пересмотреть кредитные лимиты для заёмщиков в зоне",
                "Обновить оценку залогового обеспечения",
                "Подготовить программы реструктуризации",
            ],
            "priority": "high",
            "timeline": "week",
        },
        {
            "type": OrganizationType.ENTERPRISE,
            "actions": [
                "Активировать план непрерывности бизнеса",
                "Защитить критическое оборудование",
                "Обеспечить резервные коммуникации",
            ],
            "priority": "high",
            "timeline": "immediate",
        },
        {
            "type": OrganizationType.MILITARY,
            "actions": [
                "Подготовить силы для помощи населению",
                "Обеспечить защиту критической инфраструктуры",
                "Координация с гражданскими службами",
            ],
            "priority": "high",
            "timeline": "24h",
        },
    ]
    
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
