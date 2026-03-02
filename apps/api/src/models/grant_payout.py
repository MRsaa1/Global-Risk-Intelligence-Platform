"""Grant payout - commission payout linked to grant application."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class GrantPayout(Base):
    """
    Payout record for an approved grant application (commission).
    application_id references CADAPT in-memory application; no FK.
    """
    __tablename__ = "grant_payouts"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    application_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
        comment="Grant application ID (from CADAPT service)",
    )
    payout_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        index=True,
        comment="pending, paid, cancelled",
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)
