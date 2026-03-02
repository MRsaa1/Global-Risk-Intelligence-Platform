"""Recovery Plan (BCP) models — linked to stress tests.

RecoveryPlan: BCP document linked to a stress test scenario.
RecoveryIndicator: KPIs/milestones to track recovery progress.
RecoveryMeasure: Concrete actions (preventive/detective/corrective).
"""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class RecoveryPlan(Base):
    """
    Business Continuity / Recovery Plan linked to a stress test.

    Created after or during a stress test to define RTO/RPO and recovery steps.
    """
    __tablename__ = "recovery_plans"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Link to stress test
    stress_test_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("stress_tests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # BCP targets
    rto_hours: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Recovery Time Objective (hours)",
    )
    rpo_hours: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Recovery Point Objective (hours)",
    )

    status: Mapped[str] = mapped_column(
        String(32),
        default="draft",
        index=True,
        comment="draft | active | archived",
    )

    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    created_by: Mapped[Optional[str]] = mapped_column(String(36))

    # Relationships
    stress_test: Mapped[Optional["StressTest"]] = relationship(
        "StressTest",
        back_populates="recovery_plans",
        foreign_keys=[stress_test_id],
    )
    indicators: Mapped[list["RecoveryIndicator"]] = relationship(
        "RecoveryIndicator",
        back_populates="recovery_plan",
        cascade="all, delete-orphan",
    )
    measures: Mapped[list["RecoveryMeasure"]] = relationship(
        "RecoveryMeasure",
        back_populates="recovery_plan",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<RecoveryPlan {self.name} status={self.status}>"


class RecoveryIndicator(Base):
    """
    KPI or milestone to track recovery progress (e.g. systems restored %, revenue recovered).
    """
    __tablename__ = "recovery_indicators"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    recovery_plan_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("recovery_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    indicator_type: Mapped[str] = mapped_column(
        String(32),
        default="kpi",
        comment="kpi | milestone | metric",
    )
    target_value: Mapped[Optional[float]] = mapped_column(Float)
    current_value: Mapped[Optional[float]] = mapped_column(Float)
    unit: Mapped[Optional[str]] = mapped_column(String(64), comment="%, EUR, count, etc.")
    frequency: Mapped[Optional[str]] = mapped_column(
        String(32),
        comment="daily | weekly | monthly",
    )

    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    recovery_plan: Mapped["RecoveryPlan"] = relationship(
        "RecoveryPlan",
        back_populates="indicators",
    )

    def __repr__(self) -> str:
        return f"<RecoveryIndicator {self.name} type={self.indicator_type}>"


class RecoveryMeasure(Base):
    """
    Concrete recovery action (preventive, detective, corrective).
    """
    __tablename__ = "recovery_measures"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    recovery_plan_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("recovery_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[str] = mapped_column(
        String(32),
        default="corrective",
        comment="preventive | detective | corrective",
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default="medium",
        comment="critical | high | medium | low",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="pending",
        index=True,
        comment="pending | in_progress | done",
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    responsible_role: Mapped[Optional[str]] = mapped_column(String(255))

    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    recovery_plan: Mapped["RecoveryPlan"] = relationship(
        "RecoveryPlan",
        back_populates="measures",
    )

    def __repr__(self) -> str:
        return f"<RecoveryMeasure {self.name} status={self.status}>"
