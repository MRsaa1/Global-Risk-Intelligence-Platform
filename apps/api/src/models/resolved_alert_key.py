"""Persistent store for resolved alert dedup keys so resolved state survives reload and multi-worker."""
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class ResolvedAlertKey(Base):
    """
    Stores dedup_key of resolved alerts (source:type:title).
    Same logical alert across workers/restarts is considered resolved if its key is here.
    """
    __tablename__ = "resolved_alert_keys"

    dedup_key: Mapped[str] = mapped_column(String(512), primary_key=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
