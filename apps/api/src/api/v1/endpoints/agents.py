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


@router.get("/messages/{workflow_id}")
async def get_workflow_messages(workflow_id: str, limit: int = 200):
    """
    Get message log for a workflow run (AgentMessageBus history by correlation_id).
    Path: GET /api/v1/agents/messages/{workflow_id}
    """
    try:
        from src.services.agent_message_bus import message_bus
    except ImportError:
        raise HTTPException(status_code=503, detail="Message bus not available")
    messages = message_bus.get_history(correlation_id=workflow_id, limit=min(limit, 500))
    return {"workflow_id": workflow_id, "messages": messages, "count": len(messages)}


@router.get("/audit")
async def get_agents_audit(
    source: Optional[str] = None,
    agent_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    Persistent agent audit log with filters and pagination.
    Returns records from agent_audit_log; optionally merge with in-memory recent entries.
    """
    from datetime import datetime
    from src.models.agent_audit_log import AgentAuditLog
    q = select(AgentAuditLog).order_by(AgentAuditLog.timestamp.desc())
    if source:
        q = q.where(AgentAuditLog.source == source)
    if agent_id:
        q = q.where(AgentAuditLog.agent_id == agent_id)
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            q = q.where(AgentAuditLog.timestamp >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            q = q.where(AgentAuditLog.timestamp <= dt)
        except ValueError:
            pass
    q = q.offset(offset).limit(min(limit, 200))
    r = await db.execute(q)
    rows = r.scalars().all()
    entries = [
        {
            "id": x.id,
            "source": x.source,
            "agent_id": x.agent_id,
            "action_type": x.action_type,
            "input_summary": (x.input_summary or "")[:500],
            "result_summary": (x.result_summary or "")[:500],
            "timestamp": x.timestamp.isoformat() if x.timestamp else None,
            "meta": x.meta,
        }
        for x in rows
    ]
    return {"entries": entries, "count": len(entries), "offset": offset}


@router.get("/audit-log")
async def get_agents_audit_log(limit: int = 50, source: Optional[str] = None):
    """
    Unified audit log of agent actions (Overseer, agentic_orchestrator, optionally ARIN).
    source: overseer | agentic_orchestrator | arin | omit for all.
    """
    try:
        from src.services.agent_actions_log import get_recent
        entries = get_recent(limit=min(limit, 200), source_filter=source)
        return {"entries": entries, "count": len(entries)}
    except Exception as e:
        logger.warning("Agents audit-log failed: %s", e)
        return {"entries": [], "count": 0}


class RunChainRequest(BaseModel):
    """Request to run a named workflow chain with shared context."""
    workflow_name: str = Field(..., description="assessment | report | remediation")
    context: Optional[Dict[str, Any]] = None


class RunChainResponse(BaseModel):
    """Response: answer and context snapshot (no secrets)."""
    answer: str
    context_snapshot: Dict[str, Any] = Field(default_factory=dict)
    actions_completed: List[Dict[str, Any]] = Field(default_factory=list)


@router.post("/run-chain", response_model=RunChainResponse)
async def run_chain(body: RunChainRequest, db: AsyncSession = Depends(get_db)):
    """
    Run a named workflow (report, assessment, remediation) with shared context.
    Returns the orchestrator answer and a context snapshot (alert_id, assessment_result, etc.; no secrets).
    Agent actions are persisted to agent_audit_log when DB is available.
    """
    from src.services.agentic_orchestrator import run_workflow, WORKFLOW_TEMPLATES
    if body.workflow_name not in WORKFLOW_TEMPLATES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown workflow_name. Use one of: {list(WORKFLOW_TEMPLATES.keys())}",
        )
    result = await run_workflow(template_name=body.workflow_name, context=body.context or {}, db=db)
    # Snapshot without secrets: drop keys that might hold tokens or PII
    ctx = result.shared_context or {}
    safe_keys = {"alert_id", "assessment_result", "last_step_output", "recent_alerts", "last_arin_decision", "overseer_status"}
    context_snapshot = {k: ctx[k] for k in safe_keys if k in ctx}
    if "overseer_status" in context_snapshot and isinstance(context_snapshot["overseer_status"], dict):
        # Keep summary only, not full config
        os_ = context_snapshot["overseer_status"]
        context_snapshot["overseer_status"] = {
            "executive_summary": os_.get("executive_summary"),
            "system_alerts_count": len(os_.get("system_alerts") or []),
        }
    return RunChainResponse(
        answer=result.answer,
        context_snapshot=context_snapshot,
        actions_completed=[{"step": r.step, "success": r.success, "output": (r.output or "")[:500]} for r in (result.actions_completed or [])],
    )


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

@router.get("/recommendations/{asset_id}/decision-object")
async def get_recommendations_decision_object(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get ARIN Decision Object for an asset (Risk & Intelligence OS).
    Multi-agent risk assessment with consensus and dissent.
    """
    result = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    try:
        from src.services.arin_orchestrator import get_arin_orchestrator
        orch = get_arin_orchestrator()
        do = await orch.assess(
            source_module="advisor",
            object_type="asset",
            object_id=str(asset.id),
            input_data={
                "climate_risk_score": asset.climate_risk_score or 40,
                "physical_risk_score": asset.physical_risk_score or 20,
                "network_risk_score": asset.network_risk_score or 30,
                "valuation": asset.current_valuation,
            },
            shared_context={"portfolio_id": str(getattr(asset, "portfolio_id", None) or asset.id), "source": "advisor"},
        )
        return do.model_dump(mode="json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    For Decision Object (multi-agent assessment), use GET /recommendations/{asset_id}/decision-object.
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

        # Validation summary for UI (Guardrails + Morpheus)
        validation_summary = {"guardrails_passed": True, "morpheus_passed": True, "violations": []}
        try:
            from src.services.nemo_guardrails import get_nemo_guardrails_service, GuardrailViolation
            guardrails = get_nemo_guardrails_service()
            if getattr(guardrails, "enabled", True):
                rec_text = " ".join(
                    (r.recommended_option or "") + " " + (r.recommendation_reason or "")
                    for r in recommendations[:5]
                )
                val_result = await guardrails.validate(
                    response=rec_text[:8000],
                    context={"asset_id": asset_id_ctx, "input": alert.message or ""},
                    agent_type="ADVISOR",
                )
                validation_summary["guardrails_passed"] = val_result.passed
                validation_summary["violations"] = [v.value for v in val_result.violations]
                validation_summary["morpheus_passed"] = GuardrailViolation.MORPHEUS not in val_result.violations
        except Exception as e:
            logger.debug("Validation summary failed: %s", e)

        return {
            "alert_id": alert_id,
            "explanation": explanation or None,
            "validation": validation_summary,
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
