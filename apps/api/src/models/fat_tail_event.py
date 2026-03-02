"""Fat Tail (Black Swan) event catalog for Early Warning."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class FatTailEvent(Base):
    """
    Catalog of tail events: pandemic, solar_flare, internet_collapse, etc.
    indicator_source: URL or key for external indicator (e.g. space weather API).
    """
    __tablename__ = "fat_tail_events"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_probability: Mapped[float] = mapped_column(Float, nullable=False, default=0.001)
    indicator_source: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    indicator_threshold: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
