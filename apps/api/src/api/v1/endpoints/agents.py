"""
Agent endpoints - Layer 4: Autonomous Agents.

Provides APIs for:
- SENTINEL: Alerts and monitoring
- ANALYST: Deep analysis
- ADVISOR: Recommendations
- REPORTER: PDF report generation (with optional LLM executive summary)
"""
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.asset import Asset
from src.layers.agents.sentinel import sentinel_agent, AlertSeverity
from src.layers.agents.analyst import analyst_agent
from src.layers.agents.advisor import advisor_agent
from src.layers.agents.reporter import reporter_agent
from src.services.generative_ai import alert_explanation as gen_alert_explanation
from src.services.pdf_report import HAS_PDF

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
        select(Asset).where(Asset.id == str(asset_id))
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


@router.post("/alert/{alert_id}/analyze-and-recommend")
async def alert_analyze_and_recommend(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Workflow: Run ANALYST on alert, then ADVISOR with analysis context.
    Returns analysis (root causes, factors, correlations) and recommendations in one response.
    """
    # Resolve alert from SENTINEL
    alerts_list = sentinel_agent.get_active_alerts()
    alert = next((a for a in alerts_list if str(a.id) == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found or already resolved")

    try:
        alert_data = {
            "type": alert.alert_type.value,
            "title": alert.title,
            "message": alert.message,
            "asset_ids": alert.asset_ids,
            "asset_id": alert.asset_ids[0] if alert.asset_ids else None,
            "exposure": alert.exposure,
            "severity": alert.severity.value,
        }

        # ANALYST: deep analysis
        analysis = await analyst_agent.analyze_alert(
            alert_id=alert.id,
            alert_data=alert_data,
        )
        analysis_dict = {
            "root_causes": analysis.root_causes,
            "contributing_factors": analysis.contributing_factors,
            "correlations": analysis.correlations,
            "trends": analysis.trends,
            "confidence": analysis.confidence,
            "computation_time_ms": analysis.computation_time_ms,
        }

        # Resolve asset for ADVISOR (first linked asset or placeholder)
        asset_id_ctx = alert.asset_ids[0] if alert.asset_ids else "alert-context"
        asset_data = {
            "id": asset_id_ctx,
            "name": f"Alert: {(alert.title or '')[:50]}",
            "climate_risk_score": 50,
            "physical_risk_score": 40,
            "network_risk_score": 40,
            "valuation": float(alert.exposure or 0),
        }
        if alert.asset_ids:
            result = await db.execute(select(Asset).where(Asset.id == alert.asset_ids[0]))
            row = result.scalar_one_or_none()
            if row:
                asset_data = {
                    "id": str(row.id),
                    "name": row.name or str(row.id),
                    "climate_risk_score": row.climate_risk_score or 40,
                    "physical_risk_score": row.physical_risk_score or 20,
                    "network_risk_score": row.network_risk_score or 30,
                    "valuation": float(row.current_valuation or 0),
                }
                asset_id_ctx = str(row.id)

        # ADVISOR: recommendations using analysis context
        recommendations = await advisor_agent.generate_recommendations(
            asset_id=asset_id_ctx,
            asset_data=asset_data,
            alerts=[{"type": alert.alert_type.value, "title": alert.title, "message": alert.message}],
            analysis=analysis_dict,
        )

        # Generative AI: short explanation of alert for UI (never fail the request)
        explanation = ""
        try:
            explanation = await gen_alert_explanation(
                alert_title=alert.title,
                alert_message=alert.message or "",
                alert_type=alert.alert_type.value,
                severity=alert.severity.value,
            )
        except Exception as e:
            logger.debug("Alert explanation LLM failed: %s", e)

        return {
            "alert_id": alert_id,
            "explanation": explanation or None,
            "analysis": {
                "analysis_id": str(analysis.analysis_id),
                "root_causes": analysis.root_causes,
                "contributing_factors": analysis.contributing_factors,
                "correlations": analysis.correlations,
                "trends": analysis.trends,
                "confidence": analysis.confidence,
                "computation_time_ms": analysis.computation_time_ms,
            },
            "recommendations": [
                {
                    "id": str(r.id),
                    "trigger": r.trigger,
                    "asset_id": r.asset_id,
                    "current_situation": r.current_situation,
                    "risk_if_no_action": r.risk_if_no_action,
                    "recommended_option": r.recommended_option,
                    "recommendation_reason": r.recommendation_reason,
                    "urgency": r.urgency,
                    "options": [
                        {
                            "id": str(o.id),
                            "name": o.name,
                            "description": o.description,
                            "upfront_cost": o.upfront_cost,
                            "annual_cost": o.annual_cost,
                            "risk_reduction": o.risk_reduction,
                            "npv_5yr": o.npv_5yr,
                            "roi_5yr": o.roi_5yr,
                            "payback_years": o.payback_years,
                        }
                        for o in (r.options or [])
                    ],
                }
                for r in recommendations
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("analyze-and-recommend failed for alert %s: %s", alert_id, e)
        raise HTTPException(
            status_code=503,
            detail="Analysis temporarily unavailable. Please try again.",
        )


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


# ==================== REPORTER ENDPOINTS ====================

class ReporterPDFRequest(BaseModel):
    """Request for REPORTER stress test PDF (optionally with LLM executive summary)."""
    test_name: str = Field(default="Stress Test Report")
    city_name: str = Field(default="New York")
    test_type: str = Field(default="climate")
    severity: float = Field(default=0.5, ge=0.0, le=1.0)
    zones: List[Dict[str, Any]] = Field(default_factory=list)
    actions: Optional[List[Dict[str, Any]]] = None
    executive_summary: Optional[str] = None
    use_llm: bool = Field(default=True, description="If True and no executive_summary, try NVIDIA LLM")


@router.post("/reporter/stress-pdf")
async def reporter_stress_pdf(request: ReporterPDFRequest):
    """
    REPORTER: Generate stress test PDF report.
    
    When executive_summary is not provided and use_llm=True, uses NVIDIA LLM
    to generate an executive summary before producing the PDF.
    """
    if not HAS_PDF:
        raise HTTPException(
            status_code=503,
            detail="PDF generation is not available. Install reportlab (recommended for macOS) or WeasyPrint + system libs (cairo, pango)."
        )
    stress_test = {
        "name": request.test_name,
        "region_name": request.city_name,
        "test_type": request.test_type,
        "severity": request.severity,
    }
    if request.executive_summary:
        stress_test["executive_summary"] = request.executive_summary
    pdf_bytes = await reporter_agent.generate_stress_test_report(
        stress_test=stress_test,
        zones=request.zones,
        actions=request.actions,
        use_llm=request.use_llm and not request.executive_summary,
    )
    filename = f"stress_test_{request.city_name.replace(' ', '_')}_{request.test_type}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
