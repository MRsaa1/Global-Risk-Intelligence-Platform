"""
DAE Action Executors - notify, suggest, gate, report.

Integrates with existing platform services (alerts, event emitter, audit, pdf_report).
"""
import logging
from dataclasses import dataclass
from typing import Any, Optional
from uuid import uuid4

from src.models.decision_object import DecisionObject
from src.models.events import EventTypes

logger = logging.getLogger(__name__)


@dataclass
class ActionResult:
    """Result of executing an action."""
    action: str
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    ref_id: Optional[str] = None


class ActionExecutor:
    """
    Executes DAE actions.
    Lazily imports platform services to avoid circular deps.
    """

    async def execute(
        self,
        action: str,
        decision: DecisionObject,
        params: Optional[dict[str, Any]] = None,
    ) -> ActionResult:
        """Execute action by name."""
        params = params or {}
        try:
            if action == "notify_stakeholders":
                return await self._notify_stakeholders(decision, params)
            if action == "flag_for_review":
                return await self._flag_for_review(decision, params)
            if action == "require_human_confirmation":
                return await self._require_human_confirmation(decision, params)
            if action == "log_to_audit":
                return await self._log_to_audit(decision, params)
            if action == "suggest_action":
                return await self._suggest_action(decision, params)
            if action == "suggest_hedge":
                return await self._suggest_hedge(decision, params)
            if action == "generate_report":
                return await self._generate_report(decision, params)
            return ActionResult(action=action, success=False, error=f"Unknown action: {action}")
        except Exception as e:
            logger.exception("DAE action %s failed", action)
            return ActionResult(action=action, success=False, error=str(e))

    async def _notify_stakeholders(self, decision: DecisionObject, params: dict) -> ActionResult:
        """Emit event and optionally create alert."""
        try:
            from src.services.event_emitter import event_emitter
            urgency = params.get("urgency", "medium")
            await event_emitter.emit(
                event_type=EventTypes.RISK_ASSESSMENT,
                entity_type="decision",
                entity_id=decision.decision_id,
                action="notify",
                data={
                    "risk_level": decision.verdict.risk_level,
                    "recommendation": decision.verdict.recommendation,
                    "urgency": urgency,
                    "object_id": decision.object_id,
                    "source_module": decision.source_module,
                },
                intent=False,
                actor_type="system",
            )
            return ActionResult(action="notify_stakeholders", success=True, ref_id=decision.decision_id)
        except Exception as e:
            return ActionResult(action="notify_stakeholders", success=False, error=str(e))

    async def _flag_for_review(self, decision: DecisionObject, params: dict) -> ActionResult:
        """Flag decision for human review."""
        try:
            from src.services.event_emitter import event_emitter
            await event_emitter.emit(
                event_type=EventTypes.RISK_ASSESSMENT,
                entity_type="decision",
                entity_id=decision.decision_id,
                action="flag_for_review",
                data={
                    "review_type": params.get("review_type", "standard"),
                    "sla_hours": params.get("sla_hours"),
                    "object_id": decision.object_id,
                },
                intent=False,
                actor_type="system",
            )
            return ActionResult(action="flag_for_review", success=True, ref_id=decision.decision_id)
        except Exception as e:
            return ActionResult(action="flag_for_review", success=False, error=str(e))

    async def _require_human_confirmation(self, decision: DecisionObject, params: dict) -> ActionResult:
        """Mark that human confirmation is required."""
        try:
            from src.services.event_emitter import event_emitter
            await event_emitter.emit(
                event_type=EventTypes.RISK_ASSESSMENT,
                entity_type="decision",
                entity_id=decision.decision_id,
                action="human_confirmation_required",
                data={
                    "approver_role": params.get("approver_role", "risk_officer"),
                    "escalation_hours": params.get("escalation_hours"),
                    "object_id": decision.object_id,
                },
                intent=False,
                actor_type="system",
            )
            return ActionResult(action="require_human_confirmation", success=True, ref_id=decision.decision_id)
        except Exception as e:
            return ActionResult(action="require_human_confirmation", success=False, error=str(e))

    async def _log_to_audit(self, decision: DecisionObject, params: dict) -> ActionResult:
        """Log decision to audit layer and Decision Object store for replay."""
        try:
            from src.services.audit_log import audit_service, AuditAction, AuditCategory
            await audit_service.log_action(
                action=AuditAction.STRESS_TEST_COMPLETE,
                category=AuditCategory.SYSTEM,
                description=f"Decision {decision.decision_id} - {decision.verdict.risk_level}",
                resource_type="decision_object",
                resource_id=decision.decision_id,
                new_value=decision.model_dump(mode="json"),
                metadata={"retention_days": params.get("retention_days", 2555)},
            )
            await audit_service.log_decision_object(decision)
            return ActionResult(action="log_to_audit", success=True, ref_id=decision.decision_id)
        except Exception as e:
            return ActionResult(action="log_to_audit", success=False, error=str(e))

    async def _suggest_action(self, decision: DecisionObject, params: dict) -> ActionResult:
        """Suggest an action (create recommendation event)."""
        try:
            from src.services.event_emitter import event_emitter
            action_type = params.get("action_type", "review")
            await event_emitter.emit(
                event_type=EventTypes.RISK_ASSESSMENT,
                entity_type="decision",
                entity_id=decision.decision_id,
                action="suggest",
                data={
                    "suggested_action": action_type,
                    "object_id": decision.object_id,
                    "recommendation": decision.verdict.recommendation,
                },
                intent=False,
                actor_type="system",
            )
            return ActionResult(action="suggest_action", success=True, ref_id=decision.decision_id)
        except Exception as e:
            return ActionResult(action="suggest_action", success=False, error=str(e))

    async def _suggest_hedge(self, decision: DecisionObject, params: dict) -> ActionResult:
        """Suggest hedge action."""
        return await self._suggest_action(
            decision, {**params, "action_type": "hedge"}
        )

    async def _generate_report(self, decision: DecisionObject, params: dict) -> ActionResult:
        """Request report generation."""
        try:
            from src.services.event_emitter import event_emitter
            report_type = params.get("report_type", "risk_assessment")
            await event_emitter.emit(
                event_type=EventTypes.RISK_ASSESSMENT,
                entity_type="decision",
                entity_id=decision.decision_id,
                action="generate_report",
                data={
                    "report_type": report_type,
                    "object_id": decision.object_id,
                },
                intent=False,
                actor_type="system",
            )
            return ActionResult(action="generate_report", success=True, ref_id=decision.decision_id)
        except Exception as e:
            return ActionResult(action="generate_report", success=False, error=str(e))
