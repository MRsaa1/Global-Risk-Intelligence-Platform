"""Compliance verification results — who checked, when, against which norms, outcome."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class ComplianceVerification(Base):
    """
    Result of a compliance check: entity/scope, stress_test (optional), framework,
    jurisdiction, status (passed/failed/partial), evidence snapshot, audit link.
    """
    __tablename__ = "compliance_verifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    entity_id: Mapped[Optional[str]] = mapped_column(String(128), index=True)  # scope: portfolio, entity, etc.
    entity_type: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    stress_test_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("stress_tests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    framework_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    jurisdiction: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # passed | failed | partial
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    checked_by_agent_id: Mapped[str] = mapped_column(String(64), nullable=False, default="compliance_agent")
    evidence_snapshot: Mapped[Optional[str]] = mapped_column(Text)  # JSON: norms/chunks used, requirements checked
    requirements_checked: Mapped[Optional[str]] = mapped_column(Text)  # JSON: list of requirement ids and result
    audit_log_id: Mapped[Optional[int]] = mapped_column(nullable=True)  # FK to agent_audit_log.id if needed
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    reviewer_agent_id: Mapped[Optional[str]] = mapped_column(String(64))
