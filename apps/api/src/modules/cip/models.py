"""CIP module database models."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text  # noqa: F401
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class InfrastructureType(str, enum.Enum):
    """Types of critical infrastructure."""
    POWER_GENERATION = "power_generation"
    POWER_TRANSMISSION = "power_transmission"
    POWER_DISTRIBUTION = "power_distribution"
    WATER_TREATMENT = "water_treatment"
    WATER_DISTRIBUTION = "water_distribution"
    WASTEWATER = "wastewater"
    TELECOMMUNICATIONS = "telecommunications"
    DATA_CENTER = "data_center"
    TRANSPORTATION_RAIL = "transportation_rail"
    TRANSPORTATION_ROAD = "transportation_road"
    TRANSPORTATION_AIR = "transportation_air"
    TRANSPORTATION_PORT = "transportation_port"
    PIPELINE_OIL = "pipeline_oil"
    PIPELINE_GAS = "pipeline_gas"
    HEALTHCARE_FACILITY = "healthcare_facility"
    EMERGENCY_SERVICES = "emergency_services"
    FINANCIAL_SYSTEM = "financial_system"
    FOOD_SUPPLY = "food_supply"
    OTHER = "other"


class CriticalityLevel(str, enum.Enum):
    """Criticality level for infrastructure."""
    TIER_1 = "tier_1"  # National/critical - failure causes widespread impact
    TIER_2 = "tier_2"  # Regional - failure affects multiple communities
    TIER_3 = "tier_3"  # Local - failure affects single community
    TIER_4 = "tier_4"  # Supporting - indirect impact


class OperationalStatus(str, enum.Enum):
    """Operational status of infrastructure."""
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class CriticalInfrastructure(Base):
    """
    Critical infrastructure asset for CIP module.
    
    Extends the base asset concept with infrastructure-specific attributes
    for dependency mapping, criticality assessment, and cascade analysis.
    """
    __tablename__ = "cip_infrastructure"
    
    # Identity
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    cip_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        comment="CIP-specific ID (e.g., CIP-POWER-DE-MUC-001)",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Link to base asset (optional)
    asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    # Classification
    infrastructure_type: Mapped[str] = mapped_column(
        String(50),
        default=InfrastructureType.OTHER.value,
    )
    criticality_level: Mapped[str] = mapped_column(
        String(20),
        default=CriticalityLevel.TIER_3.value,
    )
    operational_status: Mapped[str] = mapped_column(
        String(20),
        default=OperationalStatus.OPERATIONAL.value,
    )
    
    # Location
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    country_code: Mapped[str] = mapped_column(String(2), default="DE")
    region: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Capacity & Performance
    capacity_value: Mapped[Optional[float]] = mapped_column(Float)
    capacity_unit: Mapped[Optional[str]] = mapped_column(String(50))  # MW, m³/day, Gbps, etc.
    current_load_percent: Mapped[Optional[float]] = mapped_column(Float)
    
    # Population/Service Metrics
    population_served: Mapped[Optional[int]] = mapped_column(Integer)
    service_area_km2: Mapped[Optional[float]] = mapped_column(Float)
    
    # Dependencies (JSON as text for SQLite compatibility)
    upstream_dependencies: Mapped[Optional[str]] = mapped_column(Text)  # JSON list of CIP IDs
    downstream_dependents: Mapped[Optional[str]] = mapped_column(Text)  # JSON list of CIP IDs
    
    # Risk Assessment
    vulnerability_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Vulnerability assessment 0-100",
    )
    exposure_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Exposure to threats 0-100",
    )
    resilience_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Recovery capability 0-100",
    )
    cascade_risk_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Risk of causing cascade failures 0-100",
    )
    
    # Recovery
    estimated_recovery_hours: Mapped[Optional[float]] = mapped_column(Float)
    backup_systems: Mapped[Optional[str]] = mapped_column(Text)  # JSON description
    
    # Owner/Operator
    owner_organization: Mapped[Optional[str]] = mapped_column(String(255))
    operator_organization: Mapped[Optional[str]] = mapped_column(String(255))
    regulatory_authority: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Extra Data
    extra_data: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    tags: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    def __repr__(self) -> str:
        return f"<CriticalInfrastructure {self.cip_id}: {self.name}>"


class InfrastructureDependency(Base):
    """
    Dependency relationship between infrastructure assets.
    
    Used for cascade failure analysis and dependency mapping.
    """
    __tablename__ = "cip_dependencies"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Source (upstream) infrastructure
    source_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("cip_infrastructure.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Target (downstream) infrastructure
    target_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("cip_infrastructure.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Dependency characteristics
    dependency_type: Mapped[str] = mapped_column(
        String(50),
        default="operational",  # operational, informational, physical, logical
    )
    strength: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        comment="Dependency strength 0-1 (1 = critical)",
    )
    
    # Time characteristics
    propagation_delay_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Description
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f"<Dependency {self.source_id} -> {self.target_id}>"


class CIPCascadeSimulation(Base):
    """Stored cascade simulation run (FR-CIP-006, FR-CIP-007)."""
    __tablename__ = "cip_cascade_simulations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[Optional[str]] = mapped_column(String(255))
    initial_failure_ids: Mapped[Optional[str]] = mapped_column(Text, comment="JSON array of infrastructure IDs")
    time_horizon_hours: Mapped[int] = mapped_column(Integer, default=72)
    timeline: Mapped[Optional[str]] = mapped_column(Text, comment="JSON array of {step, hour, affected_ids, impact_score}")
    affected_assets: Mapped[Optional[str]] = mapped_column(Text, comment="JSON array of affected infra IDs with depth")
    impact_score: Mapped[Optional[float]] = mapped_column(Float)
    recovery_time_hours: Mapped[Optional[float]] = mapped_column(Float)
    total_affected: Mapped[Optional[int]] = mapped_column(Integer)
    population_affected: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
