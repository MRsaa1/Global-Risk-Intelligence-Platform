"""
Audit Trail — logs every agent action through AgentAuditLog.

Records: agent_id, action, input hash, output summary, reflection result,
LLM model used, tokens consumed, duration, workflow run ID.
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class AuditEntry:
    agent_id: str
    action: str
    workflow_run_id: str = ""
    step_id: str = ""
    result_summary: str = ""
    reflection_verdict: Optional[str] = None
    llm_model_used: Optional[str] = None
    tokens_used: int = 0
    duration_ms: int = 0
    timestamp: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = time.time()


class AuditTrailService:
    """In-memory audit trail. Wired to AgentAuditLog DB model when available."""

    def __init__(self):
        self._entries: List[AuditEntry] = []

    async def log_agent_action(
        self,
        agent_id: str,
        action: str,
        workflow_run_id: str = "",
        step_id: str = "",
        result_summary: str = "",
        reflection_verdict: Optional[str] = None,
        llm_model_used: Optional[str] = None,
        tokens_used: int = 0,
        duration_ms: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        entry = AuditEntry(
            agent_id=agent_id,
            action=action,
            workflow_run_id=workflow_run_id,
            step_id=step_id,
            result_summary=result_summary,
            reflection_verdict=reflection_verdict,
            llm_model_used=llm_model_used,
            tokens_used=tokens_used,
            duration_ms=duration_ms,
            metadata=metadata or {},
        )
        self._entries.append(entry)
        logger.debug(
            "AUDIT: agent=%s action=%s workflow=%s step=%s duration=%dms",
            agent_id, action, workflow_run_id, step_id, duration_ms,
        )

        # Persist to DB if available
        try:
            await self._persist_to_db(entry)
        except Exception:
            pass

    async def _persist_to_db(self, entry: AuditEntry) -> None:
        """Attempt to write to AgentAuditLog table."""
        try:
            from src.core.database import get_async_session
            from src.models.agent_audit_log import AgentAuditLog
            async for session in get_async_session():
                record = AgentAuditLog(
                    agent_id=entry.agent_id,
                    action=entry.action,
                    workflow_run_id=entry.workflow_run_id,
                    step_id=entry.step_id,
                    result_summary=entry.result_summary,
                    reflection_verdict=entry.reflection_verdict,
                    llm_model_used=entry.llm_model_used,
                    tokens_used=entry.tokens_used,
                    duration_ms=entry.duration_ms,
                )
                session.add(record)
                await session.commit()
                break
        except Exception:
            pass

    def get_entries(
        self,
        workflow_run_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        entries = self._entries
        if workflow_run_id:
            entries = [e for e in entries if e.workflow_run_id == workflow_run_id]
        if agent_id:
            entries = [e for e in entries if e.agent_id == agent_id]
        return [
            {
                "agent_id": e.agent_id,
                "action": e.action,
                "workflow_run_id": e.workflow_run_id,
                "step_id": e.step_id,
                "result_summary": e.result_summary,
                "reflection_verdict": e.reflection_verdict,
                "duration_ms": e.duration_ms,
                "timestamp": e.timestamp,
            }
            for e in entries[-limit:]
        ]

    def get_stats(self) -> Dict[str, Any]:
        if not self._entries:
            return {"total": 0}
        total = len(self._entries)
        by_agent = {}
        for e in self._entries:
            by_agent[e.agent_id] = by_agent.get(e.agent_id, 0) + 1
        avg_duration = sum(e.duration_ms for e in self._entries) / total
        return {
            "total": total,
            "by_agent": by_agent,
            "avg_duration_ms": round(avg_duration, 1),
        }


# Singleton
audit_trail = AuditTrailService()
