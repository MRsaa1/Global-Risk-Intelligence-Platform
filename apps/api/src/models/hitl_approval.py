"""HITL (Human-in-the-Loop) approval request persistence. Optional DB storage for ApprovalGate."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class HitlApprovalRequest(Base):
    """
    Persistent storage for workflow approval gates when use_hitl_persistence is True.
    Survives API restarts; supports audit and recovery of pending decisions.
    """
    __tablename__ = "hitl_approval_requests"

    gate_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    workflow_run_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    step_name: Mapped[str] = mapped_column(String(128), nullable=False)
    agent: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    decision_by: Mapped[Optional[str]] = mapped_column(String(128))
    decision_reason: Mapped[Optional[str]] = mapped_column(Text)
    modifications: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
