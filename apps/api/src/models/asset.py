"""Asset models - physical assets with geospatial data."""
import enum
import os
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base

# Check if using SQLite (no PostGIS support)
USE_SQLITE = os.environ.get("USE_SQLITE", "true").lower() == "true"


class AssetType(str, enum.Enum):
    """Types of physical assets."""
    COMMERCIAL_OFFICE = "commercial_office"
    COMMERCIAL_RETAIL = "commercial_retail"
    INDUSTRIAL = "industrial"
    RESIDENTIAL_MULTI = "residential_multi"
    RESIDENTIAL_SINGLE = "residential_single"
    INFRASTRUCTURE_POWER = "infrastructure_power"
    INFRASTRUCTURE_WATER = "infrastructure_water"
    INFRASTRUCTURE_TRANSPORT = "infrastructure_transport"
    ENERGY_SOLAR = "energy_solar"
    ENERGY_WIND = "energy_wind"
    ENERGY_CONVENTIONAL = "energy_conventional"
    LOGISTICS = "logistics"
    DATA_CENTER = "data_center"
    HEALTHCARE = "healthcare"
    EDUCATION = "education"
    OTHER = "other"


class AssetStatus(str, enum.Enum):
    """Asset lifecycle status."""
    DRAFT = "draft"
    ACTIVE = "active"
    UNDER_CONSTRUCTION = "under_construction"
    RENOVATION = "renovation"
    INACTIVE = "inactive"
    DECOMMISSIONED = "decommissioned"


class Asset(Base):
    """
    Physical asset with geospatial location.
    
    Layer 1: Living Digital Twin - Identity component.
    """
    __tablename__ = "assets"
    
    # Identity
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    pars_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        comment="PARS Protocol ID (e.g., PARS-EU-DE-MUC-1234)",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Classification
    asset_type: Mapped[str] = mapped_column(
        String(50),
        default=AssetType.COMMERCIAL_OFFICE.value,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default=AssetStatus.DRAFT.value,
    )
    
    # Location (simple lat/lon for SQLite compatibility)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    address: Mapped[Optional[str]] = mapped_column(Text)
    country_code: Mapped[str] = mapped_column(String(2), default="DE")
    region: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    postal_code: Mapped[Optional[str]] = mapped_column(String(20))
    
    # Physical Attributes
    gross_floor_area_m2: Mapped[Optional[float]] = mapped_column(Float)
    net_leasable_area_m2: Mapped[Optional[float]] = mapped_column(Float)
    floors_above_ground: Mapped[Optional[int]]
    floors_below_ground: Mapped[Optional[int]]
    year_built: Mapped[Optional[int]]
    year_renovated: Mapped[Optional[int]]
    construction_type: Mapped[Optional[str]] = mapped_column(String(100))
    
    # BIM/3D Model Reference
    bim_file_path: Mapped[Optional[str]] = mapped_column(String(500))
    point_cloud_path: Mapped[Optional[str]] = mapped_column(String(500))
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Financial Summary (synced from Layer 3)
    current_valuation: Mapped[Optional[float]] = mapped_column(Float)
    valuation_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    valuation_currency: Mapped[str] = mapped_column(String(3), default="EUR")
    
    # Risk Scores (computed)
    climate_risk_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Composite climate risk 0-100",
    )
    physical_risk_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Physical condition risk 0-100",
    )
    network_risk_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Dependency/cascade risk 0-100",
    )
    
    # Extra Data
    extra_data: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text for SQLite
    tags: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text for SQLite
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    # Relationships (optional for SQLite)
    # digital_twin relationship handled in DigitalTwin model
    # provenance_records relationship handled in DataProvenance model
    
    def __repr__(self) -> str:
        return f"<Asset {self.pars_id}: {self.name}>"
