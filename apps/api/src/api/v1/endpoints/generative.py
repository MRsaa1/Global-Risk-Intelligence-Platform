"""
Generative AI endpoints — reports, explanations, recommendations, disclosure drafts, synthesis.

Maps to product directions:
- Reports & summaries: executive summary (stress tests), zone conclusions
- Explain scenarios: explain-zone, explain-scenario
- Recommendations: recommendations (text)
- Documents & regulation: disclosure-draft (EBA/Fed/NGFS)
- Chat & Q&A: use existing /api/v1/aiq/ask
- Agent explanations: alert-explanation (short alert summary)
- Data synthesis: synthesize
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.core.security import get_current_user
from src.models.user import User
from src.services.generative_ai import (
    alert_explanation as gen_alert_explanation,
    disclosure_draft as gen_disclosure_draft,
    explain_scenario as gen_explain_scenario,
    explain_zone as gen_explain_zone,
    recommendations_text as gen_recommendations_text,
    synthesize_sources as gen_synthesize_sources,
)

router = APIRouter()


# ---------- Request/Response models ----------


class ExplainZoneRequest(BaseModel):
    zone_data: Dict[str, Any] = Field(..., description="Zone payload (label, risk_level, position, etc.)")
    question: Optional[str] = Field(None, description="Custom question, e.g. 'Why is this zone at risk?'")


class ExplainScenarioRequest(BaseModel):
    scenario_name: str = Field(..., min_length=1, description="e.g. NGFS SSP5, San Francisco +0.5m")
    scenario_context: Optional[Dict[str, Any]] = None
    portfolio_context: Optional[str] = None


class RecommendationsRequest(BaseModel):
    stress_result: Optional[Dict[str, Any]] = None
    scenario_name: Optional[str] = None
    zones_summary: Optional[str] = None


class DisclosureDraftRequest(BaseModel):
    context: Dict[str, Any] = Field(..., description="Stress test / report context")
    framework: str = Field(default="NGFS", description="EBA, Fed, or NGFS")


class SynthesizeRequest(BaseModel):
    sources: List[Dict[str, Any]] = Field(..., description="List of {kind, data} or {kind, snippet}")


class AlertExplanationRequest(BaseModel):
    alert_title: str = Field(..., min_length=1)
    alert_message: str = Field(default="")
    alert_type: str = Field(default="")
    severity: str = Field(default="")


# ---------- Endpoints (optional auth like AIQ) ----------


@router.post("/explain-zone")
async def explain_zone(
    request: ExplainZoneRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Explain why a zone is at risk or answer a custom question about it.
    Returns short, coherent text (2–4 sentences).
    """
    text = await gen_explain_zone(
        zone_data=request.zone_data,
        question=request.question,
    )
    return {"explanation": text}


@router.post("/explain-scenario")
async def explain_scenario(
    request: ExplainScenarioRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Explain what a scenario means (e.g. NGFS SSP5, San Francisco +0.5m).
    Optional portfolio context for "what does this mean for the portfolio?"
    """
    text = await gen_explain_scenario(
        scenario_name=request.scenario_name,
        scenario_context=request.scenario_context,
        portfolio_context=request.portfolio_context,
    )
    return {"explanation": text}


@router.post("/recommendations")
async def recommendations_text(
    request: RecommendationsRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Generate textual recommendations: mitigation, next steps, zone priorities.
    Input: stress test result and/or scenario name and/or zones summary.
    """
    text = await gen_recommendations_text(
        stress_result=request.stress_result,
        scenario_name=request.scenario_name,
        zones_summary=request.zones_summary,
    )
    return {"recommendations": text}


@router.post("/disclosure-draft")
async def disclosure_draft(
    request: DisclosureDraftRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Draft disclosure or explanatory note for stress tests under EBA, Fed, or NGFS.
    """
    text = await gen_disclosure_draft(
        context=request.context,
        framework=request.framework,
    )
    return {"draft": text, "framework": request.framework}


@router.post("/synthesize")
async def synthesize(
    request: SynthesizeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Synthesize multiple sources (weather, geodata, historical events) into one coherent summary.
    """
    text = await gen_synthesize_sources(sources=request.sources)
    return {"summary": text}


@router.post("/alert-explanation")
async def alert_explanation(
    request: AlertExplanationRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Short explanation of an alert for SENTINEL / UI: what it means and why it matters.
    """
    text = await gen_alert_explanation(
        alert_title=request.alert_title,
        alert_message=request.alert_message,
        alert_type=request.alert_type,
        severity=request.severity,
    )
    return {"explanation": text}
