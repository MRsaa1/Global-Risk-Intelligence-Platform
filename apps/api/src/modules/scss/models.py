"""SCSS module database models."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class SupplierType(str, enum.Enum):
    """Types of suppliers."""
    RAW_MATERIAL = "raw_material"
    COMPONENT = "component"
    ASSEMBLY = "assembly"
    FINISHED_GOODS = "finished_goods"
    LOGISTICS = "logistics"
    SERVICE = "service"
    TECHNOLOGY = "technology"
    ENERGY = "energy"
    OTHER = "other"


class SupplierTier(str, enum.Enum):
    """Supplier tier levels."""
    TIER_1 = "tier_1"  # Direct suppliers
    TIER_2 = "tier_2"  # Suppliers to Tier 1
    TIER_3 = "tier_3"  # Suppliers to Tier 2
    TIER_N = "tier_n"  # Deep supply chain


class RiskLevel(str, enum.Enum):
    """Risk level classification."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Supplier(Base):
    """
    Supplier entity for supply chain tracking.
    
    Tracks suppliers across the supply chain with risk assessment
    and sovereignty scoring.
    """
    __tablename__ = "scss_suppliers"
    
    # Identity
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    scss_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        comment="SCSS-specific ID (e.g., SCSS-SUPPLIER-DE-ABC123)",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Classification
    supplier_type: Mapped[str] = mapped_column(
        String(50),
        default=SupplierType.OTHER.value,
    )
    tier: Mapped[str] = mapped_column(
        String(20),
        default=SupplierTier.TIER_1.value,
    )
    
    # Location
    country_code: Mapped[str] = mapped_column(String(2), default="DE")
    region: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    
    # Business Info
    industry_sector: Mapped[Optional[str]] = mapped_column(String(100))
    annual_revenue: Mapped[Optional[float]] = mapped_column(Float)
    employee_count: Mapped[Optional[int]] = mapped_column(Integer)
    founded_year: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Sovereignty & Risk Scores
    sovereignty_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Sovereignty/independence score 0-100",
    )
    geopolitical_risk: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Geopolitical risk score 0-100",
    )
    concentration_risk: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Concentration/single-source risk 0-100",
    )
    financial_stability: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Financial stability score 0-100",
    )
    
    # Supply Metrics
    lead_time_days: Mapped[Optional[int]] = mapped_column(Integer)
    on_time_delivery_pct: Mapped[Optional[float]] = mapped_column(Float)
    quality_score: Mapped[Optional[float]] = mapped_column(Float)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    has_alternative: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Extra Data
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[str]] = mapped_column(Text)
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    def __repr__(self) -> str:
        return f"<Supplier {self.scss_id}: {self.name}>"


class SupplyRoute(Base):
    """
    Supply route between entities.
    
    Represents a supply chain link between suppliers, assets, or regions.
    """
    __tablename__ = "scss_routes"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Source and target
    source_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scss_suppliers.id", ondelete="CASCADE"),
        index=True,
    )
    target_id: Mapped[str] = mapped_column(
        String(36),
        index=True,
        comment="Target supplier or asset ID",
    )
    target_type: Mapped[str] = mapped_column(
        String(50),
        default="supplier",
        comment="supplier, asset, region",
    )
    
    # Route characteristics
    transport_mode: Mapped[Optional[str]] = mapped_column(
        String(50),
        comment="sea, air, rail, road, pipeline",
    )
    distance_km: Mapped[Optional[float]] = mapped_column(Float)
    transit_time_days: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Risk assessment
    route_risk_score: Mapped[Optional[float]] = mapped_column(Float)
    chokepoint_exposure: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Exposure to geographic chokepoints 0-100",
    )
    
    # Volume and value
    annual_volume: Mapped[Optional[float]] = mapped_column(Float)
    annual_value: Mapped[Optional[float]] = mapped_column(Float)
    
    # Status
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    has_backup: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Description
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f"<SupplyRoute {self.source_id} -> {self.target_id}>"


class SupplyChain(Base):
    """Named supply chain: raw material -> component -> product (FR-SCSS-002)."""
    __tablename__ = "scss_supply_chains"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    root_supplier_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("scss_suppliers.id", ondelete="SET NULL"),
        index=True,
    )
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))


class SupplyChainRisk(Base):
    """
    Identified supply chain risk event or vulnerability.
    """
    __tablename__ = "scss_risks"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Classification
    risk_type: Mapped[str] = mapped_column(
        String(50),
        comment="geopolitical, natural, financial, operational, cyber",
    )
    risk_level: Mapped[str] = mapped_column(
        String(20),
        default=RiskLevel.MEDIUM.value,
    )
    
    # Description
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Affected entities
    affected_supplier_ids: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="JSON list of affected supplier IDs",
    )
    affected_routes: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="JSON list of affected route IDs",
    )
    affected_region: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Impact assessment
    probability: Mapped[Optional[float]] = mapped_column(Float)
    impact_score: Mapped[Optional[float]] = mapped_column(Float)
    estimated_loss: Mapped[Optional[float]] = mapped_column(Float)
    
    # Mitigation
    mitigation_status: Mapped[str] = mapped_column(
        String(50),
        default="identified",
        comment="identified, assessed, mitigating, mitigated, accepted",
    )
    mitigation_plan: Mapped[Optional[str]] = mapped_column(Text)
    
    # Timeline
    identified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Audit
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    def __repr__(self) -> str:
        return f"<SupplyChainRisk {self.risk_level}: {self.title}>"


# ==================== Phase 5: Sync ====================


class SyncConfig(Base):
    """Configuration for ERP/PLM data sync (cron or webhook)."""
    __tablename__ = "scss_sync_config"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    adapter_type: Mapped[str] = mapped_column(String(50), nullable=False)  # sap, oracle, edi, manual
    cron_expression: Mapped[Optional[str]] = mapped_column(String(100))
    webhook_url: Mapped[Optional[str]] = mapped_column(String(500))
    config_json: Mapped[Optional[str]] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)


class SyncRun(Base):
    """Single sync run (start/finish, counts, status)."""
    __tablename__ = "scss_sync_runs"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    config_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("scss_sync_config.id", ondelete="SET NULL"))
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # running, success, partial, failed
    records_created: Mapped[int] = mapped_column(Integer, default=0)
    records_updated: Mapped[int] = mapped_column(Integer, default=0)
    records_failed: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[Optional[str]] = mapped_column(Text)
    details_json: Mapped[Optional[str]] = mapped_column(Text)


class ImportAudit(Base):
    """Per-entity audit for each sync run (created/updated/failed)."""
    __tablename__ = "scss_import_audit"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    sync_run_id: Mapped[str] = mapped_column(String(36), ForeignKey("scss_sync_runs.id", ondelete="CASCADE"))
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # created, updated, failed
    details_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)


# ==================== Phase 6: Compliance & Audit ====================


class AuditLog(Base):
    """Audit trail: who changed what (supplier, scenario, export)."""
    __tablename__ = "scss_audit_log"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by: Mapped[Optional[str]] = mapped_column(String(255))
    changed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    details_json: Mapped[Optional[str]] = mapped_column(Text)


class SanctionsMatch(Base):
    """Sanctions screening match (OFAC/EU list)."""
    __tablename__ = "scss_sanctions_matches"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    supplier_id: Mapped[str] = mapped_column(String(36), ForeignKey("scss_suppliers.id", ondelete="CASCADE"), nullable=False)
    list_name: Mapped[str] = mapped_column(String(100), nullable=False)
    list_source: Mapped[str] = mapped_column(String(50), nullable=False)  # OFAC, EU
    matched_name: Mapped[Optional[str]] = mapped_column(String(255))
    match_score: Mapped[Optional[float]] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, reviewed, cleared
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(255))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
