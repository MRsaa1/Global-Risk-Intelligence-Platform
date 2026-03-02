"""
ApprovalGate — Human-in-the-Loop (HITL) for workflow steps.

When a workflow step is flagged as requiring human approval (severity > HIGH
or step type == 'approval_gate'), this service pauses the workflow, creates
a pending review request, and waits for human decision.

Optional: when use_hitl_persistence is True, requests are stored in hitl_approval_requests table.
"""
import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ApprovalRequest:
    gate_id: str
    workflow_run_id: str
    step_name: str
    agent: str
    severity: str
    payload: Dict[str, Any] = field(default_factory=dict)
    status: str = "pending"  # pending | approved | rejected | modified
    decision_by: Optional[str] = None
    decision_reason: Optional[str] = None
    modifications: Optional[Dict[str, Any]] = None
    created_at: float = 0.0
    decided_at: Optional[float] = None

    def __post_init__(self):
        if not self.created_at:
            self.created_at = time.time()


class ApprovalGate:
    """Manages human-in-the-loop approval gates for workflows."""

    def __init__(self):
        self._pending: Dict[str, ApprovalRequest] = {}
        self._history: List[ApprovalRequest] = []

    async def request_approval(
        self,
        workflow_run_id: str,
        step_name: str,
        agent: str,
        payload: Dict[str, Any],
        severity: str = "high",
    ) -> str:
        gate_id = f"gate_{uuid4().hex[:10]}"
        req = ApprovalRequest(
            gate_id=gate_id,
            workflow_run_id=workflow_run_id,
            step_name=step_name,
            agent=agent,
            severity=severity,
            payload=payload,
        )
        self._pending[gate_id] = req
        logger.info("HITL approval requested: gate=%s workflow=%s step=%s", gate_id, workflow_run_id, step_name)
        if getattr(settings, "use_hitl_persistence", False):
            asyncio.create_task(self._persist_request(req))
        return gate_id

    async def _persist_request(self, req: ApprovalRequest) -> None:
        """Persist approval request to DB when use_hitl_persistence is True."""
        try:
            from src.core.database import get_async_session
            from src.models.hitl_approval import HitlApprovalRequest as HitlModel
            async for session in get_async_session():
                row = HitlModel(
                    gate_id=req.gate_id,
                    workflow_run_id=req.workflow_run_id,
                    step_name=req.step_name,
                    agent=req.agent,
                    severity=req.severity,
                    payload=json.dumps(req.payload) if req.payload else None,
                    status=req.status,
                )
                session.add(row)
                await session.commit()
                break
        except Exception as e:
            logger.debug("HITL persist request skipped: %s", e)

    async def _update_persisted(
        self, gate_id: str, status: str, decision_by: str, reason: str, modifications: Optional[Dict[str, Any]]
    ) -> None:
        """Update persisted approval request on decide."""
        try:
            from sqlalchemy import update
            from src.core.database import get_async_session
            from src.models.hitl_approval import HitlApprovalRequest as HitlModel
            async for session in get_async_session():
                await session.execute(
                    update(HitlModel).where(HitlModel.gate_id == gate_id).values(
                        status=status,
                        decision_by=decision_by,
                        decision_reason=reason or None,
                        modifications=json.dumps(modifications) if modifications else None,
                        decided_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
                break
        except Exception as e:
            logger.debug("HITL persist update skipped: %s", e)

    async def check_approval(self, gate_id: str) -> Optional[ApprovalRequest]:
        req = self._pending.get(gate_id)
        if req and req.status != "pending":
            return req
        return None

    async def decide(
        self,
        gate_id: str,
        decision: str,
        decided_by: str = "human",
        reason: str = "",
        modifications: Optional[Dict[str, Any]] = None,
    ) -> bool:
        req = self._pending.get(gate_id)
        if not req:
            return False
        req.status = decision  # approved | rejected | modified
        req.decision_by = decided_by
        req.decision_reason = reason
        req.modifications = modifications
        req.decided_at = time.time()
        self._history.append(req)
        if getattr(settings, "use_hitl_persistence", False):
            asyncio.create_task(self._update_persisted(gate_id, decision, decided_by, reason, modifications))
        logger.info("HITL decision: gate=%s decision=%s by=%s", gate_id, decision, decided_by)
        return True

    async def wait_for_approval(
        self, gate_id: str, timeout_seconds: float = 3600
    ) -> ApprovalRequest:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            result = await self.check_approval(gate_id)
            if result:
                return result
            await asyncio.sleep(1.0)
        req = self._pending.get(gate_id)
        if req:
            req.status = "timeout"
        return req or ApprovalRequest(gate_id=gate_id, workflow_run_id="", step_name="", agent="", severity="", status="timeout")

    def list_pending(self, workflow_run_id: Optional[str] = None) -> List[Dict[str, Any]]:
        pending = [r for r in self._pending.values() if r.status == "pending"]
        if workflow_run_id:
            pending = [r for r in pending if r.workflow_run_id == workflow_run_id]
        return [
            {
                "gate_id": r.gate_id,
                "workflow_run_id": r.workflow_run_id,
                "step_name": r.step_name,
                "agent": r.agent,
                "severity": r.severity,
                "created_at": r.created_at,
                "payload_keys": list(r.payload.keys()),
            }
            for r in pending
        ]

    def list_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [
            {
                "gate_id": r.gate_id,
                "workflow_run_id": r.workflow_run_id,
                "step_name": r.step_name,
                "status": r.status,
                "decision_by": r.decision_by,
                "decided_at": r.decided_at,
            }
            for r in self._history[-limit:]
        ]


# Singleton
approval_gate = ApprovalGate()
