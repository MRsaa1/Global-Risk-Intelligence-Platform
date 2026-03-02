"""FST module database models (optional run metadata)."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class FSTRun(Base):
    """Metadata for an FST stress test run (regulatory report tracking)."""
    __tablename__ = "fst_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    fst_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    scenario_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    scenario_name: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="completed")
    regulatory_format: Mapped[Optional[str]] = mapped_column(String(50))  # basel, fed, ecb
    summary_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON summary for report
    run_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
