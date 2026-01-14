"""
Agent endpoints - Layer 4: Autonomous Agents.

Provides APIs for:
- SENTINEL: Alerts and monitoring
- ANALYST: Deep analysis
- ADVISOR: Recommendations
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.asset import Asset
from src.layers.agents.sentinel import sentinel_agent, AlertSeverity
from src.layers.agents.analyst import analyst_agent
from src.layers.agents.advisor import advisor_agent

router = APIRouter()


# ==================== SCHEMAS ====================

class AlertResponse(BaseModel):
    """Alert response schema."""
    id: str
    alert_type: str
    severity: str
    title: str
    message: str
    asset_ids: list[str]
    exposure: float
    recommended_actions: list[str]
    created_at: str
    acknowledged: bool
    resolved: bool


class MonitoringContext(BaseModel):
    """Context for monitoring run."""
    weather_forecast: Optional[dict] = None
    sensors: Optional[dict] = None
    infrastructure: Optional[dict] = None


class AnalysisRequest(BaseModel):
    """Request for analysis."""
    asset_id: str
    include_sensitivity: bool = False
    sensitivity_variables: Optional[list[dict]] = None


class RecommendationResponse(BaseModel):
    """Recommendation response."""
    id: str
    trigger: str
    asset_id: Optional[str]
    current_situation: str
    risk_if_no_action: str
    recommended_option: str
    recommendation_reason: str
    urgency: str
    options: list[dict]


# ==================== SENTINEL ENDPOINTS ====================

@router.get("/alerts", response_model=list[AlertResponse])
async def get_active_alerts(
    severity: Optional[str] = None,
):
    """
    Get all active alerts from SENTINEL agent.
    
    Optional filtering by severity: info, warning, high, critical
    """
    sev = AlertSeverity(severity) if severity else None
    alerts = sentinel_agent.get_active_alerts(severity=sev)
    
    return [
        AlertResponse(
            id=str(a.id),
            alert_type=a.alert_type.value,
            severity=a.severity.value,
            title=a.title,
            message=a.message,
            asset_ids=a.asset_ids,
            exposure=a.exposure,
            recommended_actions=a.recommended_actions,
            created_at=a.created_at.isoformat(),
            acknowledged=a.acknowledged,
            resolved=a.resolved,
        )
        for a in alerts
    ]


@router.post("/monitor")
async def run_monitoring_cycle(
    context: MonitoringContext,
    db: AsyncSession = Depends(get_db),
):
    """
    Run SENTINEL monitoring cycle with provided context.
    
    In production, this would be triggered automatically by:
    - Weather API webhooks
    - Sensor data streams
    - Scheduled jobs
    """
    # Get assets for context
    result = await db.execute(select(Asset).limit(100))
    assets = result.scalars().all()
    
    asset_dicts = [
        {
            "id": str(a.id),
            "climate_risk_score": a.climate_risk_score or 0,
            "valuation": a.current_valuation or 0,
        }
        for a in assets
    ]
    
    full_context = {
        "weather_forecast": context.weather_forecast or {},
        "sensors": context.sensors or {},
        "infrastructure": context.infrastructure or {},
        "assets": asset_dicts,
    }
    
    alerts = await sentinel_agent.monitor(full_context)
    
    return {
        "alerts_generated": len(alerts),
        "alerts": [
            {
                "id": str(a.id),
                "severity": a.severity.value,
                "title": a.title,
            }
            for a in alerts
        ],
    }


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: UUID):
    """Acknowledge an alert."""
    success = sentinel_agent.acknowledge_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "acknowledged"}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: UUID):
    """Resolve an alert."""
    success = sentinel_agent.resolve_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "resolved"}


# ==================== ANALYST ENDPOINTS ====================

@router.post("/analyze/asset")
async def analyze_asset(
    request: AnalysisRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run ANALYST deep analysis on an asset.
    
    Returns:
    - Root causes of any issues
    - Contributing factors
    - Correlations discovered
    - Trend analysis
    """
    # Get asset
    result = await db.execute(
        select(Asset).where(Asset.id == request.asset_id)
    )
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    asset_data = {
        "id": str(asset.id),
        "name": asset.name,
        "climate_risk_score": asset.climate_risk_score,
        "physical_risk_score": asset.physical_risk_score,
        "network_risk_score": asset.network_risk_score,
        "valuation": asset.current_valuation,
    }
    
    # Run analysis
    analysis = await analyst_agent.analyze_asset(
        asset_id=request.asset_id,
        asset_data=asset_data,
    )
    
    response = {
        "analysis_id": str(analysis.analysis_id),
        "asset_id": request.asset_id,
        "root_causes": analysis.root_causes,
        "contributing_factors": analysis.contributing_factors,
        "correlations": analysis.correlations,
        "trends": analysis.trends,
        "confidence": analysis.confidence,
        "computation_time_ms": analysis.computation_time_ms,
    }
    
    # Add sensitivity analysis if requested
    if request.include_sensitivity and request.sensitivity_variables:
        sensitivity = await analyst_agent.run_sensitivity_analysis(
            asset_id=request.asset_id,
            base_scenario=asset_data,
            variables=request.sensitivity_variables,
        )
        response["sensitivity_analysis"] = sensitivity
    
    return response


# ==================== ADVISOR ENDPOINTS ====================

@router.get("/recommendations/{asset_id}", response_model=list[RecommendationResponse])
async def get_recommendations(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get ADVISOR recommendations for an asset.
    
    Generates actionable recommendations based on:
    - Current risk scores
    - Active alerts
    - Analysis results
    
    Each recommendation includes multiple options with NPV/ROI analysis.
    """
    # Get asset
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id)
    )
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    asset_data = {
        "id": str(asset.id),
        "name": asset.name,
        "climate_risk_score": asset.climate_risk_score or 40,
        "physical_risk_score": asset.physical_risk_score or 20,
        "network_risk_score": asset.network_risk_score or 30,
        "valuation": asset.current_valuation or 10_000_000,
    }
    
    # Get active alerts for this asset
    alerts = [
        a for a in sentinel_agent.get_active_alerts()
        if str(asset.id) in a.asset_ids
    ]
    
    # Generate recommendations
    recommendations = await advisor_agent.generate_recommendations(
        asset_id=str(asset.id),
        asset_data=asset_data,
        alerts=[{"type": a.alert_type.value, "title": a.title, "message": a.message} for a in alerts],
    )
    
    return [
        RecommendationResponse(
            id=str(r.id),
            trigger=r.trigger,
            asset_id=r.asset_id,
            current_situation=r.current_situation,
            risk_if_no_action=r.risk_if_no_action,
            recommended_option=r.recommended_option,
            recommendation_reason=r.recommendation_reason,
            urgency=r.urgency,
            options=[
                {
                    "id": str(o.id),
                    "name": o.name,
                    "description": o.description,
                    "upfront_cost": o.upfront_cost,
                    "annual_cost": o.annual_cost,
                    "risk_reduction": o.risk_reduction,
                    "pd_impact_bps": o.pd_impact_bps,
                    "npv_5yr": o.npv_5yr,
                    "roi_5yr": o.roi_5yr,
                    "payback_years": o.payback_years,
                }
                for o in r.options
            ],
        )
        for r in recommendations
    ]


@router.post("/evaluate-options")
async def evaluate_options(
    asset_id: str,
    options: list[dict],
    horizon_years: int = 5,
    discount_rate: float = 0.08,
):
    """
    Evaluate custom options with NPV and ROI analysis.
    
    Useful for comparing specific interventions or investments.
    """
    evaluated = await advisor_agent.evaluate_options(
        asset_id=asset_id,
        options=options,
        horizon_years=horizon_years,
        discount_rate=discount_rate,
    )
    
    return {
        "asset_id": asset_id,
        "horizon_years": horizon_years,
        "discount_rate": discount_rate,
        "options": [
            {
                "id": str(o.id),
                "name": o.name,
                "npv_5yr": o.npv_5yr,
                "roi_5yr": o.roi_5yr,
                "payback_years": o.payback_years,
                "risk_reduction": o.risk_reduction,
                "recommendation": "RECOMMENDED" if o.npv_5yr > 0 else "NOT RECOMMENDED",
            }
            for o in evaluated
        ],
    }
