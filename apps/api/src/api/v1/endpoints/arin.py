"""
ARIN API - Autonomous Risk Intelligence Network.

- /assess: Multi-agent risk assessment (internal)
- /export: Manual export to ARIN Platform (Unified Analysis)
- /verdict/{entity_id}: Proxy to ARIN unified verdict
- /physical-asset: Export image + data for Cosmos Reason 2 analysis
- /human-reviews: List pending human reviews (human-in-the-loop)
- /human-reviews/{decision_id}/resolve: Approve or reject escalation
"""
import json
import logging
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.models.human_review import HumanReviewRequest
from src.services.arin_orchestrator import get_arin_orchestrator
from src.services.arin_export import export_to_arin, export_physical_asset, get_arin_verdict, _build_export_url
from src.services.ethicist_audit import log_ethicist_assessment

logger = logging.getLogger(__name__)

router = APIRouter()


class ARINAssessRequest(BaseModel):
    """Request body for ARIN assess endpoint."""
    source_module: str = Field(..., description="cip, scss, sro, stress_test")
    object_type: str = Field(..., description="infrastructure, supplier, institution, scenario, asset")
    object_id: str = Field(..., description="ID of object to assess")
    input_data: Optional[dict[str, Any]] = Field(None, description="Optional context/input snapshot")
    shared_context: Optional[dict[str, Any]] = Field(None, description="Optional overseer_status, recent_alerts, portfolio_id for agents")


class ARINExportRequest(BaseModel):
    """Request body for manual export to ARIN Platform."""
    entity_id: str = Field(..., description="Portfolio UUID, ticker, or entity ID in ARIN")
    entity_type: str = Field("portfolio", description="portfolio, stock, crypto, etc.")
    analysis_type: str = Field(
        "global_risk_assessment",
        description="global_risk_assessment, asset_risk_analysis, stress_test, compliance_check",
    )
    data: dict[str, Any] = Field(..., description="Risk analysis results")
    metadata: Optional[dict[str, Any]] = Field(None, description="Optional metadata")


@router.post("/assess")
async def assess_risk(
    request: ARINAssessRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    Run multi-agent risk assessment.

    Returns DecisionObject with:
    - Agent assessments (from SENTINEL, ANALYST, ADVISOR, ETHICIST, module agents)
    - Consensus score and risk level
    - Verdict; human_confirmation_required and escalation_reason when CRITICAL / >€10M / life_safety
    - Ethicist assessment logged to immutable audit (cryptographic_signature, immutable_log_reference)
    - When human_confirmation_required, a HumanReviewRequest is created for GET /human-reviews
    """
    try:
        orchestrator = get_arin_orchestrator()
        decision = await orchestrator.assess(
            source_module=request.source_module,
            object_type=request.object_type,
            object_id=request.object_id,
            input_data=request.input_data,
            shared_context=request.shared_context,
        )
        # Ethicist immutable audit: log ethicist assessment to hash chain
        ethicist_assessment = next(
            (a for a in decision.agent_assessments if a.agent_id == "ethicist"),
            None,
        )
        if ethicist_assessment:
            try:
                assessment_payload = {
                    "agent_id": ethicist_assessment.agent_id,
                    "risk_score": ethicist_assessment.score,
                    "confidence": ethicist_assessment.confidence,
                    "reasoning": ethicist_assessment.reasoning,
                    "decision_id": decision.decision_id,
                    "source_module": decision.source_module,
                    "object_type": decision.object_type,
                    "object_id": decision.object_id,
                }
                await log_ethicist_assessment(
                    session,
                    decision_id=decision.decision_id,
                    assessment=assessment_payload,
                    source_module=decision.source_module,
                )
            except Exception:
                pass  # do not fail assess on audit write failure
        # Human-in-the-loop: create pending review when verdict requires it
        if decision.verdict.human_confirmation_required:
            try:
                existing = await session.execute(
                    select(HumanReviewRequest).where(
                        HumanReviewRequest.decision_id == decision.decision_id
                    )
                )
                if existing.scalar_one_or_none() is None:
                    hr = HumanReviewRequest(
                        decision_id=decision.decision_id,
                        source_module=decision.source_module,
                        object_type=decision.object_type,
                        object_id=decision.object_id,
                        escalation_reason=decision.verdict.escalation_reason,
                        decision_snapshot=json.dumps(decision.model_dump(mode="json"), default=str),
                        status="pending",
                    )
                    session.add(hr)
                    await session.commit()
            except Exception:
                pass
        return decision.model_dump(mode="json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export")
async def export_to_arin_platform(request: ARINExportRequest):
    """
    Manually export risk data to ARIN Platform (Unified Analysis).

    Sends data to ARIN so it appears as "Global Risk" in Data Sources Status.
    Needs ARIN_EXPORT_URL or ARIN_BASE_URL set in the API environment.
    """
    export_url = _build_export_url()
    if not export_url:
        return {
            "exported": False,
            "reason": "ARIN export not configured",
            "message": "Set ARIN_EXPORT_URL or ARIN_BASE_URL in the API .env (e.g. ARIN_BASE_URL=https://arin.saa-alliance.com).",
        }
    result = await export_to_arin(
        entity_id=request.entity_id,
        entity_type=request.entity_type,
        analysis_type=request.analysis_type,
        data=request.data,
        metadata=request.metadata,
    )
    if result is None:
        return {
            "exported": False,
            "reason": "ARIN export failed",
            "message": "Upstream ARIN Platform did not accept the request.",
        }
    return {**result, "exported": True} if isinstance(result, dict) else result


# ---------------------------------------------------------------------------
# Verdict proxy (external ARIN)
# ---------------------------------------------------------------------------


class ARINVerdictResponse(BaseModel):
    """Response from ARIN unified verdict."""
    entity_id: str
    verdict: str = Field(..., description="BUY, SELL, HOLD, or AVOID")
    risk_score: float = 0.0
    confidence: float = 0.0
    agent_results: dict[str, Any] = Field(default_factory=dict)
    sources: list[str] = Field(default_factory=list)
    configured: bool = Field(True, description="False when ARIN is not configured")


@router.get("/verdict/{entity_id}")
async def get_verdict(entity_id: str):
    """
    Proxy to external ARIN unified verdict for *entity_id*.

    Fetches ``GET {ARIN_BASE_URL}/api/v1/unified/verdict/{entity_id}`` and
    returns the result.  When ARIN is not configured returns a graceful
    fallback so the UI can display "not configured" instead of an error.
    """
    result = await get_arin_verdict(entity_id)
    if result is None:
        # Return a graceful "not configured" response
        return ARINVerdictResponse(
            entity_id=entity_id,
            verdict="N/A",
            risk_score=0,
            confidence=0,
            agent_results={},
            sources=[],
            configured=False,
        ).model_dump()
    return result


# ---------------------------------------------------------------------------
# Physical asset export (image + data for Cosmos Reason 2)
# ---------------------------------------------------------------------------


class PhysicalAssetExportRequest(BaseModel):
    """Request body for physical asset export (Cosmos Reason 2)."""
    entity_id: str = Field(..., description="Entity ID following convention: zone_*, asset_*, etc.")
    entity_type: str = Field("zone", description="zone, physical_asset, portfolio, scenario")
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Contextual data: risk_score, scenario, zone_name, stress_metrics, etc.",
    )
    image_url: Optional[str] = Field(None, description="URL of satellite/inspection image")
    image_base64: Optional[str] = Field(None, description="Base64-encoded image (screenshot/photo)")
    data_sources: Optional[list[str]] = Field(None, description="Provenance: FEMA, NOAA, CMIP6, etc.")


@router.post("/physical-asset")
async def export_physical_asset_endpoint(request: PhysicalAssetExportRequest):
    """
    Export image + data for Physical Asset Risk analysis via Cosmos Reason 2.

    Sends data (including optional image) to ARIN Platform where the
    Physical Asset Risk agent will process it through Cosmos Reason 2.
    """
    if not (settings.arin_export_url or settings.arin_base_url):
        return {
            "exported": False,
            "reason": "ARIN not configured",
            "message": "Set ARIN_BASE_URL or ARIN_EXPORT_URL to enable physical asset export.",
        }

    result = await export_physical_asset(
        entity_id=request.entity_id,
        entity_type=request.entity_type,
        data=request.context,
        image_url=request.image_url,
        image_base64=request.image_base64,
        data_sources=request.data_sources,
    )
    if result is None:
        return {
            "exported": False,
            "reason": "ARIN export failed",
            "message": "Upstream ARIN Platform did not accept the physical asset export.",
        }
    return {**result, "exported": True} if isinstance(result, dict) else result


# ---------------------------------------------------------------------------
# Human-in-the-loop
# ---------------------------------------------------------------------------


class HumanReviewResolveBody(BaseModel):
    """Body for resolving a human review."""
    action: str = Field(..., description="approve or reject")
    resolved_by: Optional[str] = Field(None, description="User or system identifier")
    resolution_note: Optional[str] = Field(None, description="Optional note")


@router.get("/human-reviews", response_model=List[dict])
async def list_human_reviews(
    status: str = "pending",
    session: AsyncSession = Depends(get_db),
):
    """
    List human review requests (human-in-the-loop escalation).

    Default status=pending. Returns list of { decision_id, source_module, object_type,
    object_id, escalation_reason, created_at, decision_snapshot }.
    """
    from datetime import datetime
    result = await session.execute(
        select(HumanReviewRequest).where(HumanReviewRequest.status == status).order_by(HumanReviewRequest.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "decision_id": r.decision_id,
            "source_module": r.source_module,
            "object_type": r.object_type,
            "object_id": r.object_id,
            "escalation_reason": r.escalation_reason,
            "decision_snapshot": json.loads(r.decision_snapshot) if r.decision_snapshot else None,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "resolved_by": r.resolved_by,
        }
        for r in rows
    ]


@router.post("/human-reviews/{decision_id}/resolve")
async def resolve_human_review(
    decision_id: str,
    body: HumanReviewResolveBody,
    session: AsyncSession = Depends(get_db),
):
    """
    Resolve an escalated human review: approve or reject.

    action must be "approve" or "reject". Optionally set resolved_by and resolution_note.
    """
    result = await session.execute(
        select(HumanReviewRequest).where(
            HumanReviewRequest.decision_id == decision_id,
            HumanReviewRequest.status == "pending",
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail=f"No pending human review for decision {decision_id}")
    action = (body.action or "").strip().lower()
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
    from datetime import datetime, timezone
    req.status = "approved" if action == "approve" else "rejected"
    req.resolved_at = datetime.now(timezone.utc)
    req.resolved_by = body.resolved_by or "api"
    req.resolution_note = body.resolution_note
    await session.commit()
    return {"decision_id": decision_id, "status": req.status, "resolved_at": req.resolved_at.isoformat()}
