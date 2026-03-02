"""
Unified log of agent actions for audit and observability (AgentOps-lite).

Records from: Overseer (auto_resolution_actions), agentic_orchestrator (tool calls),
optionally ARIN (assess). In-memory ring buffer; when db is provided, also persists to agent_audit_log.
"""
from __future__ import annotations

import json
import logging
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MAX_ENTRIES = 500
_log: deque["AgentActionRecord"] = deque(maxlen=MAX_ENTRIES)


@dataclass
class AgentActionRecord:
    source: str  # overseer | agentic_orchestrator | arin
    agent_id: str
    action_type: str
    input_summary: str
    result_summary: str
    timestamp: str
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "agent_id": self.agent_id,
            "action_type": self.action_type,
            "input_summary": self.input_summary[:500] if self.input_summary else "",
            "result_summary": self.result_summary[:500] if self.result_summary else "",
            "timestamp": self.timestamp,
            **self.meta,
        }


async def append(
    source: str,
    agent_id: str,
    action_type: str,
    input_summary: str = "",
    result_summary: str = "",
    meta: Optional[Dict[str, Any]] = None,
    db: Optional["AsyncSession"] = None,
) -> None:
    """Append one agent action to the unified log; when db is provided, also persist to agent_audit_log."""
    ts = datetime.now(tz=timezone.utc)
    record = AgentActionRecord(
        source=source,
        agent_id=agent_id,
        action_type=action_type,
        input_summary=input_summary or "",
        result_summary=result_summary or "",
        timestamp=ts.isoformat(),
        meta=meta or {},
    )
    _log.append(record)
    if db is not None:
        try:
            from src.models.agent_audit_log import AgentAuditLog
            row = AgentAuditLog(
                source=source,
                agent_id=agent_id,
                action_type=action_type,
                input_summary=(input_summary or "")[:2000],
                result_summary=(result_summary or "")[:2000],
                timestamp=ts,
                meta=json.dumps(meta) if meta else None,
            )
            db.add(row)
            await db.commit()
        except Exception as e:
            logger.debug("Agent audit log DB persist skipped: %s", e)


def get_recent(
    limit: int = 50,
    source_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Return the most recent entries (newest first). source_filter: overseer | agentic_orchestrator | arin | None for all."""
    items = list(_log)
    items.reverse()
    if source_filter:
        items = [x for x in items if x.source == source_filter]
    return [x.to_dict() for x in items[:limit]]


def get_metrics_last_24h() -> Dict[str, int]:
    """Return counts per source in the last 24 hours (from in-memory log)."""
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(tz=timezone.utc) - timedelta(hours=24)).isoformat()
    counts: Dict[str, int] = {}
    for record in _log:
        if record.timestamp >= cutoff:
            counts[record.source] = counts.get(record.source, 0) + 1
    return counts
