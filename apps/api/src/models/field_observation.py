"""Cross-Track Synergy: field observations and calibration results (Track B → Track A)."""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class FieldObservation(Base):
    """
    Real-world observation from Track B (municipal deployments).
    Feeds into Track A model calibration (predicted vs observed).
    """
    __tablename__ = "field_observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    city: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    h3_cell: Mapped[str] = mapped_column(String(32), default="", index=True)
    observation_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="flood_event, heat_event, infrastructure_failure, adaptation_performance",
    )
    predicted_severity: Mapped[float] = mapped_column(Float, nullable=False)
    observed_severity: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_loss_m: Mapped[float] = mapped_column(Float, default=0.0)
    observed_loss_m: Mapped[float] = mapped_column(Float, default=0.0)
    adaptation_measure_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    adaptation_effectiveness_observed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    population_affected: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    # Optional link to stress test report when submitted from Municipal/Report UI
    stress_test_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)


class CalibrationResult(Base):
    """Result of a calibration run (observed vs predicted comparison)."""
    __tablename__ = "calibration_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    model_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    observations_used: Mapped[int] = mapped_column(Integer, nullable=False)
    mean_absolute_error: Mapped[float] = mapped_column(Float, nullable=False)
    bias: Mapped[float] = mapped_column(Float, nullable=False)
    r_squared: Mapped[float] = mapped_column(Float, nullable=False)
    recalibration_factor: Mapped[float] = mapped_column(Float, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
