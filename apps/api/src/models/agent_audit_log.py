"""Persistent agent audit log (Phase C4). Inputs/outputs or hashes + metadata."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class AgentAuditLog(Base):
    """
    Persistent audit log for agent actions (orchestrator, overseer, ARIN, etc.).
    Stores input_summary, result_summary, optional hashes, and meta JSON (as Text for SQLite/PostgreSQL).
    """
    __tablename__ = "agent_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # overseer | agentic_orchestrator | arin
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    input_summary: Mapped[Optional[str]] = mapped_column(Text)
    result_summary: Mapped[Optional[str]] = mapped_column(Text)
    input_payload_hash: Mapped[Optional[str]] = mapped_column(String(64))
    output_payload_hash: Mapped[Optional[str]] = mapped_column(String(64))
    timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    meta: Mapped[Optional[str]] = mapped_column(Text)  # JSON
