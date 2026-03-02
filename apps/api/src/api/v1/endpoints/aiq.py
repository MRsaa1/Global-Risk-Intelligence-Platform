"""
AI-Q style assistant endpoints.

Provides a lightweight "ask" endpoint that returns:
- answer text
- sources (citations)
- optional intent and action (for commands: navigate, diagnostics, remediation)

This is designed for cloud LLM now, and local GPU/NIM later via settings.
"""

from __future__ import annotations

import logging
from uuid import uuid4
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.services.aiq_research_assistant import get_aiq_assistant
from src.services.oversee import get_oversee_service
from src.services.command_intent import detect_intent, IntentResult
from src.core.resilience.circuit_breaker import get_circuit_breaker

router = APIRouter()
logger = logging.getLogger(__name__)


class AiqAskRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=4000)
    asset_id: Optional[str] = None
    project_id: Optional[str] = None
    include_overseer_status: bool = True
    context: Optional[Dict[str, Any]] = None


class AiqSource(BaseModel):
    id: str
    kind: str
    title: str
    snippet: str = ""
    url: Optional[str] = None


class AiqAction(BaseModel):
    type: str
    label: Optional[str] = None
    path: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class AiqAskResponse(BaseModel):
    answer: str
    sources: List[AiqSource] = []
    intent: Optional[str] = None
    action: Optional[AiqAction] = None
    request_id: Optional[str] = None  # for feedback correlation (POST /aiq/feedback)


def _action_from_intent(r: IntentResult) -> Optional[AiqAction]:
    if not r.action_type:
        return None
    return AiqAction(
        type=r.action_type,
        label=r.action_label,
        path=r.action_path,
        payload=r.action_payload,
    )


async def _run_remediation(ir: IntentResult) -> str:
    """Execute remediation command and return result message."""
    if ir.action_type == "run_oversee":
        try:
            svc = get_oversee_service()
            await svc.run_cycle(use_llm=True, include_events=True)
            status = svc.get_status()
            actions = status.get("auto_resolution_actions") or []
            summary = status.get("executive_summary") or "Цикл Overseer выполнен."
            if actions:
                return f"{summary}\n\nДействия: " + "; ".join(
                    str(a) for a in actions[:5]
                )
            return summary
        except Exception as e:
            logger.warning("Oversee run failed: %s", e)
            return f"Ошибка запуска диагностики: {e}"

    if ir.action_type == "start_agents":
        try:
            from src.api.v1.endpoints.alerts import start_monitoring
            await start_monitoring()
            return "Мониторинг агентов запущен."
        except Exception as e:
            logger.warning("Start agents failed: %s", e)
            return f"Ошибка запуска агентов: {e}"

    if ir.action_type == "stop_agents":
        try:
            from src.api.v1.endpoints.alerts import stop_monitoring
            await stop_monitoring()
            return "Агенты остановлены."
        except Exception as e:
            logger.warning("Stop agents failed: %s", e)
            return f"Ошибка остановки агентов: {e}"

    if ir.action_type == "reset_circuit_breaker" and ir.circuit_breaker_name:
        try:
            breaker = get_circuit_breaker(ir.circuit_breaker_name)
            await breaker.reset()
            return f"Circuit breaker «{ir.circuit_breaker_name}» сброшен в CLOSED."
        except Exception as e:
            logger.warning("Circuit breaker reset failed: %s", e)
            return f"Ошибка сброса: {e}"

    return "Команда не выполнена."


async def _run_diagnostics() -> str:
    """Gather oversee + health summary and return short text."""
    parts = []
    try:
        svc = get_oversee_service()
        status = svc.get_status()
        summary = status.get("executive_summary")
        if summary:
            parts.append(summary)
        alerts = status.get("system_alerts") or []
        if alerts:
            parts.append(f"Alerts: {len(alerts)}")
        services = status.get("services") or {}
        if services:
            ok = sum(1 for s in services.values() if isinstance(s, dict) and s.get("status") == "ok")
            parts.append(f"Services: {ok}/{len(services)} ok")
    except Exception as e:
        logger.warning("Oversee status failed: %s", e)
        parts.append(f"Status: error ({e})")
    return "\n".join(parts) if parts else "No diagnostics data."


class AiqFeedbackRequest(BaseModel):
    request_id: Optional[str] = None
    feedback: str = Field(..., description="positive | negative")
    answer_summary: Optional[str] = None
    question_hash: Optional[str] = None
    comment: Optional[str] = None


@router.post("/ask", response_model=AiqAskResponse)
async def ask_aiq(req: AiqAskRequest):
    """
    Ask the AI-Q assistant a question or run a command.

    Returns:
    - answer text (and sources for questions)
    - optional intent and action for navigation/execute
    - request_id for feedback (POST /aiq/feedback)
    """
    request_id = str(uuid4())
    ir = detect_intent(req.question)

    # Navigation: short answer + action (frontend navigates)
    if ir.intent == "navigation":
        answer = "Открываю."
        if ir.action_type == "open_stress_test":
            answer = "Открываю стресс-тест."
        elif ir.action_type == "open_agents":
            answer = "Открываю мониторинг агентов."
        elif ir.action_type == "open_action_plans":
            answer = "Открываю планы действий."
        elif ir.action_type == "open_alerts":
            answer = "Открываю алерты."
        return AiqAskResponse(
            answer=answer,
            sources=[],
            intent=ir.intent,
            action=_action_from_intent(ir),
            request_id=request_id,
        )

    # Diagnostics: run status and return summary + optional action
    if ir.intent == "diagnostics":
        answer = await _run_diagnostics()
        return AiqAskResponse(
            answer=answer,
            sources=[],
            intent=ir.intent,
            action=_action_from_intent(ir),
            request_id=request_id,
        )

    # Remediation: execute and return result
    if ir.intent == "remediation":
        answer = await _run_remediation(ir)
        return AiqAskResponse(
            answer=answer,
            sources=[],
            intent=ir.intent,
            action=None,
            request_id=request_id,
        )

    # Question: try agentic orchestrator for composite requests, else full AIQ flow
    ctx: Dict[str, Any] = dict(req.context or {})
    if req.asset_id:
        ctx["asset_id"] = req.asset_id
    if req.project_id:
        ctx["project_id"] = req.project_id

    if req.include_overseer_status:
        svc = get_oversee_service()
        status_before = svc.get_status()
        ctx["overseer_status"] = status_before
        # If user is asking about errors/health and system is degraded, run one cycle so the agent self-heals first
        q = (req.question or "").lower()
        health_keywords = ("error", "errors", "problem", "problems", "broken", "fix", "health", "status", "не работает", "ошибк", "проблем", "почини", "диагностик")
        if any(k in q for k in health_keywords) and status_before.get("status") in ("degraded", "critical"):
            try:
                await svc.run_cycle(use_llm=False, include_events=False)
                ctx["overseer_status"] = svc.get_status()
            except Exception as e:
                logger.debug("Overseer self-heal cycle failed: %s", e)

    # Workflow templates: map intent to predefined workflow (quarterly report, infrastructure health, alert triage)
    q_lower = (req.question or "").lower().strip()
    workflow_triggers = [
        ("quarterly_risk_report", ["quarterly risk report", "квартальный отчёт", "quarterly report", "квартальный отчёт по рискам"]),
        ("infrastructure_health", ["infrastructure health", "здоровье инфраструктуры", "run oversee", "запусти диагностику системы"]),
        ("alert_triage", ["alert triage", "триаж алертов", "triage alerts", "оцени алерты"]),
    ]
    for template_name, keywords in workflow_triggers:
        if any(kw in q_lower for kw in keywords):
            try:
                from src.services.agentic_orchestrator import run_workflow
                orch = await run_workflow(template_name, context=ctx)
                if orch.answer:
                    return AiqAskResponse(
                        answer=orch.answer,
                        sources=[],
                        intent="question",
                        action=None,
                        request_id=request_id,
                    )
            except Exception as e:
                logger.debug("Workflow %s skipped: %s", template_name, e)
            break

    composite_triggers = [" и ", " and ", " затем ", " then ", "потом", "проверь и ", "check and "]
    if any(t in q_lower for t in composite_triggers):
        try:
            from src.services.agentic_orchestrator import run as run_orchestrator
            orch = await run_orchestrator(req.question, ctx)
            if orch.answer:
                action = None
                if orch.action_navigate:
                    action = AiqAction(
                        type=orch.action_navigate.get("type", "open_health"),
                        label=orch.action_navigate.get("label"),
                        path=orch.action_navigate.get("path"),
                    )
                return AiqAskResponse(
                    answer=orch.answer,
                    sources=[],
                    intent="question",
                    action=action,
                    request_id=request_id,
                )
        except Exception as e:
            logger.debug("Agentic orchestrator skipped: %s", e)

    aiq = get_aiq_assistant()
    result = await aiq.answer_question(question=req.question, context=ctx)
    return AiqAskResponse(
        answer=result.text,
        sources=[
            AiqSource(id=s.id, kind=s.kind, title=s.title, snippet=s.snippet, url=s.url)
            for s in (result.sources or [])
        ],
        intent="question",
        action=None,
        request_id=request_id,
    )


@router.post("/feedback")
async def submit_feedback(fb: AiqFeedbackRequest):
    """
    Submit feedback for an AI-Q answer (positive/negative). Used for future fine-tuning and quality analytics.
    Pass request_id from the prior /ask response to correlate.
    """
    try:
        from src.services.agent_feedback import append as feedback_append
        feedback_append(
            request_id=fb.request_id or "",
            feedback=fb.feedback,
            answer_summary=fb.answer_summary or "",
            question_hash=fb.question_hash,
            comment=fb.comment or "",
        )
        return {"status": "ok", "message": "Feedback recorded"}
    except Exception as e:
        logger.warning("Feedback append failed: %s", e)
        return {"status": "error", "message": str(e)}

