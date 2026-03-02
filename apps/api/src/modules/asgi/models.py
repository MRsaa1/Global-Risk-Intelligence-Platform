"""ASGI Phase 3 database models."""
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class AISystem(Base):
    """AI System Registry - base table for capability/drift references."""
    __tablename__ = "asgi_ai_systems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[Optional[str]] = mapped_column(String(50))
    system_type: Mapped[Optional[str]] = mapped_column(String(50))  # llm, agent, multimodal
    capability_level: Mapped[Optional[str]] = mapped_column(String(20))  # narrow, general, frontier
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)

    capability_events: Mapped[list["CapabilityEvent"]] = relationship(
        "CapabilityEvent", back_populates="ai_system", cascade="all, delete-orphan"
    )
    goal_drift_snapshots: Mapped[list["GoalDriftSnapshot"]] = relationship(
        "GoalDriftSnapshot", back_populates="ai_system", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AISystem {self.id}: {self.name}>"


class CapabilityEvent(Base):
    """Capability emergence events - benchmark jumps, novel capabilities, reasoning expansion."""
    __tablename__ = "asgi_capability_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ai_system_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("asgi_ai_systems.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[Optional[str]] = mapped_column(String(50))  # benchmark_jump, novel_capability, reasoning_expansion
    metrics: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    severity: Mapped[Optional[int]] = mapped_column(Integer)
    response_action: Mapped[Optional[str]] = mapped_column(String(50))  # MONITOR, PAUSE, REVIEW, SHUTDOWN
    response_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    responded_by: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)

    ai_system: Mapped["AISystem"] = relationship("AISystem", back_populates="capability_events")


class GoalDriftSnapshot(Base):
    """Goal drift snapshots - plan embeddings, constraint sets, drift from baseline."""
    __tablename__ = "asgi_goal_drift_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ai_system_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("asgi_ai_systems.id", ondelete="CASCADE"), index=True
    )
    snapshot_date: Mapped[Optional[date]] = mapped_column(Date)
    plan_embedding: Mapped[Optional[str]] = mapped_column(Text)  # JSON array for SQLite
    constraint_set: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    objective_hash: Mapped[Optional[bytes]] = mapped_column(LargeBinary)
    drift_from_baseline: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)

    ai_system: Mapped["AISystem"] = relationship("AISystem", back_populates="goal_drift_snapshots")


class AuditEvent(Base):
    """Individual audit events in hash chain for integrity verification."""
    __tablename__ = "asgi_audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prev_hash: Mapped[Optional[str]] = mapped_column(String(64))
    content: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)


class AuditAnchor(Base):
    """Cryptographic audit anchors - Merkle roots for tamper-evident logs."""
    __tablename__ = "asgi_audit_anchors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    merkle_root: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    event_count: Mapped[Optional[int]] = mapped_column(Integer)
    anchor_type: Mapped[Optional[str]] = mapped_column(String(20))  # internal, blockchain, notary
    anchor_reference: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)


class ComplianceFramework(Base):
    """Multi-jurisdiction compliance frameworks (EU AI Act, US EO 14110, etc.)."""
    __tablename__ = "asgi_compliance_frameworks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    framework_code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[Optional[str]] = mapped_column(String(200))
    jurisdiction: Mapped[Optional[str]] = mapped_column(String(100))
    requirements: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    mapping_to_asgi: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    effective_date: Mapped[Optional[date]] = mapped_column(Date)
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
