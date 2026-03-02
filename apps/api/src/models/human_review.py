"""Human-in-the-loop escalation — pending reviews and resolution."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class HumanReviewRequest(Base):
    """
    Escalation to human review: CRITICAL / >€10M / life_safety.

    When Ethicist/ARIN sets human_confirmation_required=True, a row is created here.
    Resolved via POST /arin/human-reviews/{decision_id}/resolve.
    """
    __tablename__ = "human_review_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    decision_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    source_module: Mapped[Optional[str]] = mapped_column(String(64))
    object_type: Mapped[Optional[str]] = mapped_column(String(64))
    object_id: Mapped[Optional[str]] = mapped_column(String(128))
    escalation_reason: Mapped[Optional[str]] = mapped_column(String(128))  # CRITICAL, financial_impact, life_safety
    decision_snapshot: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending, approved, rejected
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    resolved_by: Mapped[Optional[str]] = mapped_column(String(128))
    resolution_note: Mapped[Optional[str]] = mapped_column(Text)
