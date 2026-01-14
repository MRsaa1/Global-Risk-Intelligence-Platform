"""Digital Twin models - Living memory of assets."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class TwinState(str, enum.Enum):
    """Digital twin synchronization state."""
    INITIALIZING = "initializing"
    SYNCHRONIZED = "synchronized"
    STALE = "stale"
    ERROR = "error"
    ARCHIVED = "archived"


class DigitalTwin(Base):
    """
    Living Digital Twin - complete temporal representation of an asset.
    
    Layer 1: Combines geometry, timeline, current state, exposures, and futures.
    """
    __tablename__ = "digital_twins"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        unique=True,
    )
    
    # State
    state: Mapped[str] = mapped_column(
        String(20),
        default=TwinState.INITIALIZING.value,
    )
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    sync_source: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Geometry (stored in MinIO, reference here)
    geometry_type: Mapped[Optional[str]] = mapped_column(String(50))
    geometry_path: Mapped[Optional[str]] = mapped_column(String(500))
    geometry_hash: Mapped[Optional[str]] = mapped_column(String(64))
    geometry_metadata: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    
    # Current Physical State
    structural_integrity: Mapped[Optional[float]] = mapped_column(Float)
    condition_score: Mapped[Optional[float]] = mapped_column(Float)
    remaining_useful_life_years: Mapped[Optional[float]] = mapped_column(Float)
    
    # Current Sensor Data
    sensor_data: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    sensor_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Climate Exposures
    climate_exposures: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    climate_exposures_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Infrastructure Dependencies
    infrastructure_dependencies: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    
    # Financial Metrics
    financial_metrics: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    financial_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Simulated Futures
    future_scenarios: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    scenarios_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Relationships - simplified for SQLite
    # asset: Mapped["Asset"] = relationship(back_populates="digital_twin")
    # timeline: Mapped[list["TwinTimeline"]] = relationship(back_populates="digital_twin")
    
    def __repr__(self) -> str:
        return f"<DigitalTwin {self.id} for asset {self.asset_id}>"


class TwinTimeline(Base):
    """Timeline events for a Digital Twin."""
    __tablename__ = "twin_timeline"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    digital_twin_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("digital_twins.id", ondelete="CASCADE"),
    )
    
    # Event
    event_type: Mapped[str] = mapped_column(String(50))
    event_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    event_title: Mapped[str] = mapped_column(String(255))
    event_description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Data
    data: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    attachments: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    
    # Provenance
    source: Mapped[Optional[str]] = mapped_column(String(100))
    verification_hash: Mapped[Optional[str]] = mapped_column(String(64))
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    # Relationships - simplified for SQLite
    # digital_twin: Mapped["DigitalTwin"] = relationship(back_populates="timeline")
    
    def __repr__(self) -> str:
        return f"<TwinTimeline {self.event_type}: {self.event_title}>"
