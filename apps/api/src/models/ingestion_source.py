"""Ingestion source catalog for SSOT (Single Source of Truth)."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class IngestionSource(Base):
    """
    Catalog entry for a data source (exchange, iot, news, regulatory).
    Used by ingestion pipelines and scheduler to run periodic fetches.
    """
    __tablename__ = "ingestion_sources"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True
    )  # exchange, iot, news, regulatory
    endpoint_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    refresh_interval_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )
    config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
