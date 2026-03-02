"""
Agent feedback for AI-Q / ARIN answers (D2: self-improvement loop).

Stores positive/negative feedback and optional comment per request.
In-memory ring buffer; can be replaced with DB table for fine-tuning pipeline.
"""
from __future__ import annotations

import hashlib
import logging
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

MAX_ENTRIES = 2000
_store: deque["AgentFeedbackRecord"] = deque(maxlen=MAX_ENTRIES)


@dataclass
class AgentFeedbackRecord:
    request_id: str
    question_hash: str
    answer_summary: str
    feedback: str  # "positive" | "negative"
    comment: str
    timestamp: str
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "question_hash": self.question_hash,
            "answer_summary": self.answer_summary[:500] if self.answer_summary else "",
            "feedback": self.feedback,
            "comment": (self.comment or "")[:1000],
            "timestamp": self.timestamp,
            **self.meta,
        }


def _hash_question(question: str) -> str:
    return hashlib.sha256((question or "").strip().encode()).hexdigest()[:16]


def append(
    request_id: str,
    feedback: str,
    answer_summary: str = "",
    question_hash: Optional[str] = None,
    comment: str = "",
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    """Record one feedback entry. feedback must be 'positive' or 'negative'."""
    if feedback not in ("positive", "negative"):
        feedback = "positive" if feedback.lower() in ("1", "true", "yes", "up", "positive") else "negative"
    record = AgentFeedbackRecord(
        request_id=request_id or "",
        question_hash=question_hash or "",
        answer_summary=answer_summary or "",
        feedback=feedback,
        comment=comment or "",
        timestamp=datetime.now(tz=timezone.utc).isoformat(),
        meta=meta or {},
    )
    _store.append(record)


def get_recent(limit: int = 50, feedback_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return most recent feedback entries (newest first). feedback_filter: positive | negative | None for all."""
    items = list(_store)
    items.reverse()
    if feedback_filter in ("positive", "negative"):
        items = [x for x in items if x.feedback == feedback_filter]
    return [x.to_dict() for x in items[:limit]]
