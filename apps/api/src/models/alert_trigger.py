"""Configurable Early Warning trigger (metric threshold -> alert)."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class AlertTrigger(Base):
    """
    User-defined trigger: when metric_key op threshold_value, raise an alert.
    Evaluated in SENTINEL monitoring loop.
    """
    __tablename__ = "alert_triggers"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    metric_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    operator: Mapped[str] = mapped_column(
        String(8), nullable=False
    )  # gt, lt, gte, lte, eq
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)
    window_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    alert_type: Mapped[str] = mapped_column(String(64), nullable=False, default="custom_trigger")
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="warning")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
