"""Municipal SaaS subscription — Phase D: $5K–20K/year tiers."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class MunicipalSubscription(Base):
    """
    SaaS subscription for a municipality (tenant).
    Tiers ~$5K–20K/year; complements grant commission.
    """
    __tablename__ = "municipal_subscriptions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    tenant_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="Municipality or tenant identifier",
    )
    tier: Mapped[str] = mapped_column(
        String(50),
        default="standard",
        index=True,
        comment="standard ($5K), professional ($10K), enterprise ($20K)",
    )
    amount_yearly: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    period_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        index=True,
        comment="active, cancelled, past_due, trialing",
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)
