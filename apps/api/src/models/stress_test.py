"""Stress Test models - stress testing scenarios and their impacts."""
import enum
import os
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

# Conditionally import GeoAlchemy2 for PostGIS support
# Falls back gracefully for SQLite
USE_POSTGIS = os.environ.get("USE_SQLITE", "true").lower() != "true"

if USE_POSTGIS:
    try:
        from geoalchemy2 import Geometry
        HAS_POSTGIS = True
    except ImportError:
        HAS_POSTGIS = False
else:
    HAS_POSTGIS = False


class StressTestType(str, enum.Enum):
    """Types of stress tests."""
    POLITICAL = "political"              # Смена режима, санкции, эмбарго
    MILITARY = "military"                # Конфликты, оккупация, блокада
    CLIMATE = "climate"                  # Наводнения, засухи, ураганы
    FINANCIAL = "financial"              # Кризис ликвидности, дефолт
    SOCIAL = "social"                    # Миграция, демографические изменения
    PANDEMIC = "pandemic"                # COVID-19, грипп, биоугрозы
    REGULATORY = "regulatory"            # Базель, требования ЦБ
    PROTEST = "protest"                  # Массовые демонстрации, забастовки
    UPRISING = "uprising"                # Гражданские конфликты, революции
    CIVIL_UNREST = "civil_unrest"        # Массовые беспорядки, погромы
    # Climate sub-types for detailed disaster simulation
    WIND = "wind"                        # Ураганный ветер (категории 1-5)
    METRO_FLOOD = "metro_flood"          # Затопление метро
    HEAT = "heat"                        # Тепловой стресс
    HEAVY_RAIN = "heavy_rain"            # Сильные осадки
    DROUGHT = "drought"                  # Засуха
    UV = "uv"                            # УФ-индекс


class StressTestStatus(str, enum.Enum):
    """Stress test execution status."""
    DRAFT = "draft"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ZoneLevel(str, enum.Enum):
    """Risk zone severity levels."""
    CRITICAL = "critical"    # Красная зона
    HIGH = "high"            # Оранжевая зона
    MEDIUM = "medium"        # Желтая зона
    LOW = "low"              # Зеленая зона


class OrganizationType(str, enum.Enum):
    """Types of organizations affected by stress tests."""
    DEVELOPER = "developer"          # Девелоперы
    INSURER = "insurer"              # Страховые компании
    MILITARY = "military"            # Военные структуры
    BANK = "bank"                    # Банки
    ENTERPRISE = "enterprise"        # Предприятия
    GOVERNMENT = "government"        # Государственные органы
    INFRASTRUCTURE = "infrastructure" # Критическая инфраструктура


class ImpactType(str, enum.Enum):
    """Types of impact on organizations."""
    FINANCIAL = "financial"          # Финансовое влияние
    OPERATIONAL = "operational"      # Операционное влияние
    REPUTATIONAL = "reputational"    # Репутационное влияние
    REGULATORY = "regulatory"        # Регуляторное влияние
    STRATEGIC = "strategic"          # Стратегическое влияние


class StressTest(Base):
    """
    Stress test scenario definition.
    
    Represents a potential risk event with geographic scope,
    severity parameters, and impact metrics.
    """
    __tablename__ = "stress_tests"
    
    # Identity
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Classification
    test_type: Mapped[str] = mapped_column(
        String(50),
        default=StressTestType.CLIMATE.value,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default=StressTestStatus.DRAFT.value,
    )
    
    # Geographic Scope (simplified for SQLite)
    # For PostGIS: use Geometry column
    center_latitude: Mapped[Optional[float]] = mapped_column(Float)
    center_longitude: Mapped[Optional[float]] = mapped_column(Float)
    radius_km: Mapped[Optional[float]] = mapped_column(Float, default=100.0)
    
    # Polygon as JSON text (for complex shapes)
    geographic_polygon: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="GeoJSON polygon coordinates as JSON string",
    )
    
    # Region names
    region_name: Mapped[Optional[str]] = mapped_column(String(255))
    country_codes: Mapped[Optional[str]] = mapped_column(
        String(100),
        comment="Comma-separated country codes, e.g., DE,AT,CH",
    )
    
    # Severity Parameters
    severity: Mapped[float] = mapped_column(
        Float,
        default=0.5,
        comment="Event severity 0.0-1.0",
    )
    probability: Mapped[float] = mapped_column(
        Float,
        default=0.1,
        comment="Probability of occurrence 0.0-1.0",
    )
    
    # Time Horizon
    time_horizon_months: Mapped[int] = mapped_column(
        Integer,
        default=12,
        comment="Analysis time horizon in months",
    )
    
    # Impact Metrics
    pd_multiplier: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        comment="Probability of Default multiplier",
    )
    lgd_multiplier: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        comment="Loss Given Default multiplier",
    )
    valuation_impact_pct: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        comment="Asset valuation impact percentage",
    )
    
    # Recovery
    recovery_time_months: Mapped[Optional[int]] = mapped_column(
        Integer,
        comment="Expected recovery time in months",
    )
    
    # Additional Parameters (JSON)
    parameters: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Additional scenario parameters as JSON",
    )
    
    # Results (computed after run)
    affected_assets_count: Mapped[Optional[int]] = mapped_column(Integer)
    total_exposure: Mapped[Optional[float]] = mapped_column(Float)
    expected_loss: Mapped[Optional[float]] = mapped_column(Float)
    
    # Linked Historical Event
    historical_event_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("historical_events.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    # Audit
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
    zones: Mapped[list["RiskZone"]] = relationship(
        "RiskZone",
        back_populates="stress_test",
        cascade="all, delete-orphan",
    )
    reports: Mapped[list["StressTestReport"]] = relationship(
        "StressTestReport",
        back_populates="stress_test",
        cascade="all, delete-orphan",
    )
    
    def __repr__(self) -> str:
        return f"<StressTest {self.name} ({self.test_type})>"


class RiskZone(Base):
    """
    Risk zone within a stress test.
    
    Represents a geographic area with a specific risk level.
    Supports PostGIS geometry when PostgreSQL is used.
    """
    __tablename__ = "risk_zones"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    stress_test_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("stress_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Zone Level
    zone_level: Mapped[str] = mapped_column(
        String(20),
        default=ZoneLevel.MEDIUM.value,
    )
    
    # Geographic Definition (basic - always available)
    center_latitude: Mapped[Optional[float]] = mapped_column(Float)
    center_longitude: Mapped[Optional[float]] = mapped_column(Float)
    radius_km: Mapped[Optional[float]] = mapped_column(Float)
    polygon: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="GeoJSON polygon as JSON string (fallback for SQLite)",
    )
    
    # PostGIS Geometry columns are added dynamically via migration
    # when using PostgreSQL. See alembic/versions/ for details.
    # - geometry: Geometry('POLYGON', srid=4326) for zone boundary
    # - center_point: Geometry('POINT', srid=4326) for center
    
    # Zone Metrics
    risk_score: Mapped[float] = mapped_column(Float, default=0.5)
    affected_assets_count: Mapped[int] = mapped_column(Integer, default=0)
    total_exposure: Mapped[Optional[float]] = mapped_column(Float)
    expected_loss: Mapped[Optional[float]] = mapped_column(Float)
    
    # Zone Name
    name: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Relationships
    stress_test: Mapped["StressTest"] = relationship(
        "StressTest",
        back_populates="zones",
    )
    zone_assets: Mapped[list["ZoneAsset"]] = relationship(
        "ZoneAsset",
        back_populates="zone",
        cascade="all, delete-orphan",
    )
    
    def __repr__(self) -> str:
        return f"<RiskZone {self.zone_level} ({self.name})>"


class ZoneAsset(Base):
    """
    Link between risk zone and affected asset.
    
    Contains impact assessment for each asset.
    """
    __tablename__ = "zone_assets"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    zone_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("risk_zones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Impact Assessment
    impact_severity: Mapped[float] = mapped_column(
        Float,
        default=0.5,
        comment="Impact severity 0.0-1.0",
    )
    expected_loss: Mapped[Optional[float]] = mapped_column(Float)
    recovery_time_months: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Impact Details (JSON)
    impact_details: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Detailed impact analysis as JSON",
    )
    
    # Relationships
    zone: Mapped["RiskZone"] = relationship(
        "RiskZone",
        back_populates="zone_assets",
    )
    
    def __repr__(self) -> str:
        return f"<ZoneAsset zone={self.zone_id} asset={self.asset_id}>"


class StressTestReport(Base):
    """
    Generated report for a stress test.
    """
    __tablename__ = "stress_test_reports"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    stress_test_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("stress_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Report Content
    report_data: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Full report as JSON",
    )
    summary: Mapped[Optional[str]] = mapped_column(Text)
    
    # Generated Files
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500))
    html_path: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Metadata
    generated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    generated_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    # Relationships
    stress_test: Mapped["StressTest"] = relationship(
        "StressTest",
        back_populates="reports",
    )
    action_plans: Mapped[list["ActionPlan"]] = relationship(
        "ActionPlan",
        back_populates="report",
        cascade="all, delete-orphan",
    )
    
    def __repr__(self) -> str:
        return f"<StressTestReport {self.id}>"


class ActionPlan(Base):
    """
    Action plan for a specific organization type.
    """
    __tablename__ = "action_plans"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    report_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("stress_test_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Target Organization
    organization_type: Mapped[str] = mapped_column(
        String(50),
        default=OrganizationType.ENTERPRISE.value,
    )
    organization_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Plan Details
    actions: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="List of actions as JSON",
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default="medium",
        comment="Priority: critical, high, medium, low",
    )
    timeline: Mapped[Optional[str]] = mapped_column(
        String(50),
        comment="Timeline: immediate, 24h, 72h, week, month",
    )
    
    # ROI Metrics
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float)
    risk_reduction: Mapped[Optional[float]] = mapped_column(Float)
    roi_percentage: Mapped[Optional[float]] = mapped_column(Float)
    
    # Relationships
    report: Mapped["StressTestReport"] = relationship(
        "StressTestReport",
        back_populates="action_plans",
    )
    
    def __repr__(self) -> str:
        return f"<ActionPlan {self.organization_type} priority={self.priority}>"
