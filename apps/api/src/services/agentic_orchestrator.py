"""
Agentic orchestrator: Reason → Plan → Act for composite assistant commands.

Used when the user request is multi-step (e.g. "check errors and restart agents").
Single-step intents remain in aiq/ask (command_intent + direct execution).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.services.command_intent import detect_intent, IntentResult
from src.services.aiq_research_assistant import get_aiq_assistant

logger = logging.getLogger(__name__)


@dataclass
class StepResult:
    step: str
    success: bool
    output: str
    tool: Optional[str] = None


@dataclass
class OrchestratorResult:
    answer: str
    actions_completed: List[StepResult] = field(default_factory=list)
    action_navigate: Optional[Dict[str, str]] = None  # type, label, path for frontend
    shared_context: Optional[Dict[str, Any]] = None  # request-scoped context after all steps (overseer_status, etc.)


# Map step description (or tool name) to async callable that returns (success, output_text)
async def _run_tool(
    tool_name: str,
    params: Optional[Dict[str, Any]] = None,
    shared_ctx: Optional[Dict[str, Any]] = None,
) -> tuple[bool, str]:
    """Execute one tool and return (success, message). shared_ctx can be updated by the tool (e.g. oversee_status)."""
    params = params or {}
    shared_ctx = shared_ctx or {}
    try:
        if tool_name in ("oversee_run", "run_oversee", "run diagnostics", "запусти диагностику"):
            from src.services.oversee import get_oversee_service
            svc = get_oversee_service()
            await svc.run_cycle(use_llm=True, include_events=True)
            status = svc.get_status()
            shared_ctx["overseer_status"] = status
            summary = status.get("executive_summary") or "Overseer cycle completed."
            return True, summary

        if tool_name in ("start_agents", "agents_start", "start monitoring"):
            from src.api.v1.endpoints.alerts import start_monitoring
            await start_monitoring()
            return True, "Agents started."

        if tool_name in ("stop_agents", "agents_stop", "stop monitoring"):
            from src.api.v1.endpoints.alerts import stop_monitoring
            await stop_monitoring()
            return True, "Agents stopped."

        if tool_name == "reset_circuit_breaker":
            from src.core.resilience.circuit_breaker import get_circuit_breaker
            name = params.get("name") or ""
            if not name:
                return False, "Missing circuit breaker name."
            breaker = get_circuit_breaker(name)
            await breaker.reset()
            return True, f"Circuit breaker {name} reset."

        if tool_name in ("oversee_status", "diagnostics", "get status"):
            from src.services.oversee import get_oversee_service
            svc = get_oversee_service()
            status = svc.get_status()
            shared_ctx["overseer_status"] = status
            shared_ctx["recent_alerts"] = (status.get("system_alerts") or [])[:10]
            summary = status.get("executive_summary") or "No summary."
            alerts = status.get("system_alerts") or []
            return True, f"{summary}\nAlerts: {len(alerts)}"

        if tool_name == "arin_assess" or tool_name == "assess_risk":
            from src.services.arin_orchestrator import get_arin_orchestrator
            ot = (params.get("object_type") or "stress_test")[:64]
            oid = (params.get("object_id") or "default")[:64]
            mod = (params.get("source_module") or "stress_test")[:64]
            inp = params.get("input_data") or {}
            arin = get_arin_orchestrator()
            decision = await arin.assess(
                source_module=mod,
                object_type=ot,
                object_id=oid,
                input_data=inp,
                shared_context=shared_ctx,
            )
            v = decision.verdict
            out = f"Risk {v.risk_level} (confidence {v.confidence:.2f}); recommendation: {v.recommendation}"
            if v.human_confirmation_required and v.escalation_reason:
                out += f"; human review required: {v.escalation_reason}"
            shared_ctx["last_arin_decision"] = {
                "decision_id": decision.decision_id,
                "risk_level": v.risk_level,
                "recommendation": v.recommendation,
            }
            return True, out

        if tool_name == "assessment_chain":
            # SENTINEL -> ANALYST -> ADVISOR: use alert from context (set by oversee_status)
            alert_id = (params.get("alert_id") or "").strip()
            if not alert_id and shared_ctx:
                recent = (shared_ctx.get("recent_alerts") or [])[:1]
                if recent and isinstance(recent[0], dict):
                    alert_id = str(recent[0].get("id") or recent[0].get("alert_id") or "")
            if not alert_id:
                return False, "No alert_id in params or context (run oversee_status first)."
            try:
                from src.core.database import AsyncSessionLocal
                from src.layers.agents.sentinel import sentinel_agent
                from src.layers.agents.analyst import analyst_agent
                from src.layers.agents.advisor import advisor_agent
                from src.models.asset import Asset
                from sqlalchemy import select
                alerts_list = sentinel_agent.get_active_alerts()
                alert = next((a for a in alerts_list if str(a.id) == alert_id), None)
                if not alert:
                    return False, f"Alert {alert_id} not found or already resolved."
                alert_data = {
                    "type": getattr(alert.alert_type, "value", str(alert.alert_type)),
                    "title": alert.title,
                    "message": alert.message,
                    "asset_ids": list(alert.asset_ids) if alert.asset_ids else [],
                    "asset_id": alert.asset_ids[0] if alert.asset_ids else None,
                    "exposure": getattr(alert, "exposure", None),
                    "severity": getattr(alert.severity, "value", str(alert.severity)),
                }
                analysis = await analyst_agent.analyze_alert(alert_id=alert.id, alert_data=alert_data)
                asset_id_ctx = alert.asset_ids[0] if alert.asset_ids else "alert-context"
                asset_data = {
                    "id": asset_id_ctx,
                    "name": f"Alert: {(alert.title or '')[:50]}",
                    "climate_risk_score": 50,
                    "physical_risk_score": 40,
                    "network_risk_score": 40,
                    "valuation": float(getattr(alert, "exposure", 0) or 0),
                }
                async with AsyncSessionLocal() as db:
                    if alert.asset_ids:
                        r = await db.execute(select(Asset).where(Asset.id == alert.asset_ids[0]))
                        row = r.scalar_one_or_none()
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
                    recommendations = await advisor_agent.generate_recommendations(
                        asset_id=asset_id_ctx,
                        asset_data=asset_data,
                        alerts=[{"type": alert_data["type"], "title": alert.title, "message": alert.message}],
                        analysis={
                            "root_causes": analysis.root_causes,
                            "contributing_factors": analysis.contributing_factors,
                            "correlations": analysis.correlations,
                            "trends": analysis.trends,
                            "confidence": analysis.confidence,
                        },
                    )
                rec_summary = "; ".join([r.recommendation[:80] for r in recommendations[:3]]) if recommendations else "No recommendations."
                shared_ctx["assessment_result"] = {
                    "alert_id": alert_id,
                    "root_causes": analysis.root_causes[:3],
                    "recommendations_summary": rec_summary,
                }
                return True, f"Analysis: {len(analysis.root_causes)} root causes. Recommendations: {rec_summary}"
            except Exception as e:
                logger.exception("Assessment chain failed")
                return False, str(e)

        if tool_name == "jira_create_issue":
            from src.integrations.jira import jira_create_issue
            summary = (params.get("summary") or "Risk platform action")[:200]
            res = await jira_create_issue(summary=summary, description=summary, project="RISK")
            return res.success, res.message

        if tool_name == "servicenow_create_incident":
            from src.integrations.servicenow import servicenow_create_incident
            short = (params.get("short_description") or "Risk platform incident")[:200]
            res = await servicenow_create_incident(short_description=short, description=short)
            return res.success, res.message

        return False, f"Unknown tool: {tool_name}"
    except Exception as e:
        logger.warning("Tool %s failed: %s", tool_name, e)
        return False, str(e)


def _step_to_tool(step: str) -> tuple[str, Dict[str, Any]]:
    """Map a natural-language step to (tool_name, params)."""
    s = step.lower().strip()
    if "oversee" in s or "diagnostic" in s or "проверь систему" in s or "run diagnostic" in s:
        return "oversee_run", {}
    if "start agent" in s or "включи агент" in s or "запусти мониторинг" in s:
        return "start_agents", {}
    if "stop agent" in s or "останови агент" in s:
        return "stop_agents", {}
    if "reset" in s and "circuit" in s:
        # Try to extract name (e.g. "reset circuit breaker redis" -> redis)
        parts = s.replace("circuit breaker", "").replace("cb", "").split()
        for p in parts:
            if p and p not in ("reset", "the", "a"):
                return "reset_circuit_breaker", {"name": p}
        return "reset_circuit_breaker", {"name": "default"}
    if "status" in s or "алерт" in s or "ошибк" in s:
        return "oversee_status", {}
    if "jira" in s or "тикет" in s or "issue" in s or "create ticket" in s or "создай задачу" in s:
        return "jira_create_issue", {"summary": s[:200]}
    if "servicenow" in s or "incident" in s or "инцидент" in s or "create incident" in s:
        return "servicenow_create_incident", {"short_description": s[:200]}
    if "assess risk" in s or "оцени риск" in s or "risk assess" in s or "stress test risk" in s:
        return "arin_assess", {"object_type": "stress_test", "object_id": "latest", "source_module": "stress_test"}
    return "oversee_status", {}  # default: get status


async def run(user_message: str, context: Optional[Dict[str, Any]] = None) -> OrchestratorResult:
    """
    Reason → Plan → Act for composite or ambiguous requests.
    Returns answer text and optional list of completed actions.
    """
    ctx = context or {}
    ir = detect_intent(user_message)

    # Single-step intents are handled by aiq/ask; orchestrator is for composite/question with "and" / multi-verb
    # If already a clear single intent (navigation, remediation, diagnostics), caller (aiq) handles it.
    # We are invoked only when we need to plan (e.g. question that looks like multi-step).
    # So: if intent is question and message suggests multiple actions, do plan + act.

    composite_triggers = [" и ", " and ", " затем ", " then ", "потом", "after", "проверь и ", "check and "]
    is_composite = any(t in (user_message or "").lower() for t in composite_triggers)
    if not is_composite:
        # Single intent: return empty result so caller uses normal path
        return OrchestratorResult(answer="")

    aiq = get_aiq_assistant()
    steps = await aiq.plan_steps(goal=user_message, context=ctx)
    if not steps:
        return OrchestratorResult(answer="Could not break down into steps.")

    results: List[StepResult] = []
    for step in steps:
        tool_name, params = _step_to_tool(step)
        success, output = await _run_tool(tool_name, params, shared_ctx=ctx)
        results.append(StepResult(step=step, success=success, output=output, tool=tool_name))
        ctx["last_step_output"] = (output or "")[:500]
        if success:
            try:
                from src.services.agent_actions_log import append as log_append
                await log_append(
                    source="agentic_orchestrator",
                    agent_id="orchestrator",
                    action_type=tool_name,
                    input_summary=step[:500],
                    result_summary=(output or "")[:500],
                    db=ctx.get("_db"),
                )
            except Exception as e:
                logger.debug("Agent actions log append skipped: %s", e)

    summary_parts = [f"{'✓' if r.success else '✗'} {r.step}: {r.output[:200]}" for r in results]
    answer = "Done:\n" + "\n".join(summary_parts)
    # Guardrails: validate before returning to user
    try:
        from src.services.nemo_guardrails import get_nemo_guardrails_service
        guardrails = get_nemo_guardrails_service()
        if getattr(guardrails, "validate", None) and getattr(guardrails, "enabled", True):
            validated = await guardrails.validate(answer, context=ctx, agent_type="ADVISOR")
            if not getattr(validated, "passed", True) and getattr(validated, "safe_fallback", None):
                answer = validated.safe_fallback or answer
    except Exception as e:
        logger.debug("Guardrails on orchestrator output skipped: %s", e)
    return OrchestratorResult(answer=answer, actions_completed=results, shared_context=ctx)


# ---------- Workflow templates (C1/C4: dynamic composition) ----------
# Named workflows: goal -> list of tool names (and optional params). run_workflow runs them in order with shared context.
# report = status + ARIN assess -> quarterly risk report style; assessment = SENTINEL -> ANALYST -> ADVISOR; remediation = after critical.
WORKFLOW_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "infrastructure_health": [
        {"tool": "oversee_run", "params": {}},
    ],
    "alert_triage": [
        {"tool": "oversee_status", "params": {}},
        {"tool": "arin_assess", "params": {"object_type": "stress_test", "object_id": "latest", "source_module": "stress_test"}},
    ],
    "quarterly_risk_report": [
        {"tool": "arin_assess", "params": {"object_type": "stress_test", "object_id": "quarterly", "source_module": "stress_test"}},
    ],
    "report": [
        {"tool": "oversee_status", "params": {}},
        {"tool": "arin_assess", "params": {"object_type": "stress_test", "object_id": "quarterly", "source_module": "stress_test"}},
    ],
    "assessment": [
        {"tool": "oversee_status", "params": {}},
        {"tool": "assessment_chain", "params": {}},
    ],
    "remediation": [
        {"tool": "oversee_run", "params": {}},
    ],
}


async def run_workflow(
    template_name: str,
    context: Optional[Dict[str, Any]] = None,
    db: Optional[Any] = None,
) -> OrchestratorResult:
    """
    Run a predefined workflow (sequence of tools) with shared context.
    Use from AI-Q when user intent maps to a template (e.g. "quarterly risk report" -> quarterly_risk_report).
    When db is provided, agent actions are also persisted to agent_audit_log.
    """
    steps_def = WORKFLOW_TEMPLATES.get(template_name)
    if not steps_def:
        return OrchestratorResult(answer=f"Unknown workflow: {template_name}")
    ctx = dict(context or {})
    if db is not None:
        ctx["_db"] = db
    results: List[StepResult] = []
    for i, item in enumerate(steps_def):
        tool_name = item.get("tool", "oversee_status")
        params = item.get("params") or {}
        step_label = f"Step {i + 1}: {tool_name}"
        success, output = await _run_tool(tool_name, params, shared_ctx=ctx)
        results.append(StepResult(step=step_label, success=success, output=output, tool=tool_name))
        ctx["last_step_output"] = (output or "")[:500]
        if success:
            try:
                from src.services.agent_actions_log import append as log_append
                await log_append(
                    source="agentic_orchestrator",
                    agent_id="workflow",
                    action_type=tool_name,
                    input_summary=template_name[:500],
                    result_summary=(output or "")[:500],
                    db=ctx.get("_db"),
                )
            except Exception as e:
                logger.debug("Agent actions log append skipped: %s", e)
    summary_parts = [f"{'✓' if r.success else '✗'} {r.step}: {r.output[:200]}" for r in results]
    answer = "Done:\n" + "\n".join(summary_parts)
    return OrchestratorResult(answer=answer, actions_completed=results, shared_context=ctx)
