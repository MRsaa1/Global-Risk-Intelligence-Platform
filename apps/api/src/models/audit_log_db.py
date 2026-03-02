"""Persistent audit log model for PostgreSQL (GDPR/DORA 7-year retention)."""
from datetime import datetime

from sqlalchemy import DateTime, String, Text, Boolean, Integer, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class AuditLog(Base):
    """
    Persistent audit log entry.
    Retention: 7 years (DORA). Purge older records via scheduled job.
    """
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), index=True)
    user_email: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), default="info")
    resource_type: Mapped[str | None] = mapped_column(String(64), index=True)
    resource_id: Mapped[str | None] = mapped_column(String(128), index=True)
    endpoint: Mapped[str | None] = mapped_column(String(256))
    method: Mapped[str | None] = mapped_column(String(16))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    old_value: Mapped[dict | None] = mapped_column(JSONB)
    new_value: Mapped[dict | None] = mapped_column(JSONB)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int | None] = mapped_column(Integer)

    __table_args__ = (
        Index("ix_audit_log_timestamp_category", "timestamp", "category"),
        Index("ix_audit_log_user_timestamp", "user_id", "timestamp"),
    )
