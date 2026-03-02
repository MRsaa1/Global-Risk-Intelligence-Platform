"""Unified module audit log for strategic modules (CIP, SRS, CityOS, FST, etc.)."""
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class ModuleAuditLog(Base):
    """
    Persistent audit log for strategic module actions.
    Used for regulator export: filter by module and date range.
    """
    __tablename__ = "module_audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    module_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(64), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(128), index=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    changed_by: Mapped[str | None] = mapped_column(String(128))

    __table_args__ = (
        Index("ix_module_audit_log_module_changed_at", "module_id", "changed_at"),
    )
