"""SRO module database models."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class InstitutionType(str, enum.Enum):
    """Types of financial institutions."""
    BANK = "bank"
    INVESTMENT_BANK = "investment_bank"
    INSURANCE = "insurance"
    REINSURANCE = "reinsurance"
    ASSET_MANAGER = "asset_manager"
    HEDGE_FUND = "hedge_fund"
    PENSION_FUND = "pension_fund"
    SOVEREIGN_WEALTH = "sovereign_wealth"
    CENTRAL_BANK = "central_bank"
    EXCHANGE = "exchange"
    CLEARING_HOUSE = "clearing_house"
    OTHER = "other"


class SystemicImportance(str, enum.Enum):
    """Systemic importance classification."""
    GSIB = "gsib"  # Global Systemically Important Bank
    DSIB = "dsib"  # Domestic Systemically Important Bank
    GSII = "gsii"  # Global Systemically Important Insurer
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class IndicatorType(str, enum.Enum):
    """Types of systemic risk indicators."""
    CONTAGION = "contagion"
    CONCENTRATION = "concentration"
    LEVERAGE = "leverage"
    LIQUIDITY = "liquidity"
    INTERCONNECTEDNESS = "interconnectedness"
    COMPLEXITY = "complexity"
    VOLATILITY = "volatility"
    CORRELATION = "correlation"


class FinancialInstitution(Base):
    """
    Financial institution entity for systemic risk monitoring.
    
    Tracks institutions with systemic importance assessment
    and interconnection mapping.
    """
    __tablename__ = "sro_institutions"
    
    # Identity
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    sro_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        comment="SRO-specific ID (e.g., SRO-BANK-DE-ABC123)",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Classification
    institution_type: Mapped[str] = mapped_column(
        String(50),
        default=InstitutionType.OTHER.value,
    )
    systemic_importance: Mapped[str] = mapped_column(
        String(20),
        default=SystemicImportance.LOW.value,
    )
    
    # Location
    country_code: Mapped[str] = mapped_column(String(2), default="DE")
    headquarters_city: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Financial Metrics
    total_assets: Mapped[Optional[float]] = mapped_column(Float)
    total_liabilities: Mapped[Optional[float]] = mapped_column(Float)
    tier1_capital: Mapped[Optional[float]] = mapped_column(Float)
    market_cap: Mapped[Optional[float]] = mapped_column(Float)
    
    # G-SIB / Regulatory (Phase 1.3)
    gsib_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="G-SIB systemically important bank score",
    )
    tier1_capital_ratio: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Tier 1 capital ratio (percentage)",
    )
    liquidity_coverage_ratio: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="LCR (Liquidity Coverage Ratio)",
    )

    # Risk Scores
    systemic_risk_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Overall systemic risk contribution 0-100",
    )
    contagion_risk: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Risk of spreading distress 0-100",
    )
    interconnectedness_score: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Network centrality score 0-100",
    )
    leverage_ratio: Mapped[Optional[float]] = mapped_column(Float)
    liquidity_ratio: Mapped[Optional[float]] = mapped_column(Float)
    
    # Regulatory
    regulator: Mapped[Optional[str]] = mapped_column(String(100))
    lei_code: Mapped[Optional[str]] = mapped_column(
        String(20),
        comment="Legal Entity Identifier",
    )
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    under_stress: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Extra Data
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    def __repr__(self) -> str:
        return f"<FinancialInstitution {self.sro_id}: {self.name}>"


class RiskCorrelation(Base):
    """
    Risk correlation between financial institutions.
    
    Tracks how stress in one institution affects others.
    """
    __tablename__ = "sro_correlations"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Linked institutions
    institution_a_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sro_institutions.id", ondelete="CASCADE"),
        index=True,
    )
    institution_b_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sro_institutions.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Correlation metrics
    correlation_coefficient: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        comment="Return correlation -1 to 1",
    )
    exposure_amount: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Direct exposure amount",
    )
    contagion_probability: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Probability of contagion 0-1",
    )
    
    # Relationship type
    relationship_type: Mapped[str] = mapped_column(
        String(50),
        default="counterparty",
        comment="counterparty, ownership, derivative, funding, etc.",
    )
    
    # Time period
    calculation_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    lookback_days: Mapped[int] = mapped_column(Integer, default=252)
    
    # Description
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f"<RiskCorrelation {self.institution_a_id} <-> {self.institution_b_id}>"


class SystemicRiskIndicator(Base):
    """
    Time-series systemic risk indicators.
    
    Tracks market-wide and institution-specific risk metrics over time.
    """
    __tablename__ = "sro_indicators"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Classification
    indicator_type: Mapped[str] = mapped_column(
        String(50),
        index=True,
    )
    indicator_name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Scope
    scope: Mapped[str] = mapped_column(
        String(50),
        default="market",
        comment="market, sector, institution",
    )
    institution_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("sro_institutions.id", ondelete="CASCADE"),
        nullable=True,
    )
    
    # Value
    value: Mapped[float] = mapped_column(Float)
    previous_value: Mapped[Optional[float]] = mapped_column(Float)
    change_pct: Mapped[Optional[float]] = mapped_column(Float)
    
    # Thresholds
    warning_threshold: Mapped[Optional[float]] = mapped_column(Float)
    critical_threshold: Mapped[Optional[float]] = mapped_column(Float)
    is_breached: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Time
    observation_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    
    # Source
    data_source: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f"<SystemicRiskIndicator {self.indicator_name}: {self.value}>"


class Market(Base):
    """Financial market entity (SRO Phase 1.3)."""
    __tablename__ = "sro_markets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    market_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_class: Mapped[str] = mapped_column(String(50), nullable=False)
    market_structure: Mapped[str] = mapped_column(String(50), default="centralized_exchange")
    daily_volume_usd: Mapped[Optional[float]] = mapped_column(Float)
    bid_ask_spread: Mapped[Optional[float]] = mapped_column(Float)
    market_depth: Mapped[Optional[float]] = mapped_column(Float)
    concentration_hhi: Mapped[Optional[float]] = mapped_column(Float)
    circuit_breaker_thresholds: Mapped[Optional[str]] = mapped_column(Text)
    central_counterparty: Mapped[Optional[str]] = mapped_column(String(100))
    country_code: Mapped[Optional[str]] = mapped_column(String(2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)


class InstitutionExposure(Base):
    """Institution exposure to CIP asset, SCSS supplier, or market (SRO Phase 1.3)."""
    __tablename__ = "sro_institution_exposures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    institution_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sro_institutions.id", ondelete="CASCADE"),
        index=True,
    )
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    exposure_amount_usd: Mapped[Optional[float]] = mapped_column(Float)
    sector_concentration: Mapped[Optional[float]] = mapped_column(Float)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)


class Scenario(Base):
    """Systemic risk scenario definition (SRO Phase 1.3)."""
    __tablename__ = "sro_scenarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    scenario_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    definition_yaml: Mapped[Optional[str]] = mapped_column(Text)
    initial_shocks: Mapped[Optional[str]] = mapped_column(Text)
    transmission_channels: Mapped[Optional[str]] = mapped_column(Text)
    interventions: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)


class SimulationRun(Base):
    """Simulation run result (SRO Phase 1.3)."""
    __tablename__ = "sro_simulation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    scenario_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("sro_scenarios.id", ondelete="SET NULL"),
        index=True,
    )
    results_json: Mapped[Optional[str]] = mapped_column(Text)
    monte_carlo_runs: Mapped[Optional[int]] = mapped_column(Integer)
    percentiles: Mapped[Optional[str]] = mapped_column(Text)
    critical_path: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="completed")
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))


class AuditLog(Base):
    """Immutable audit log for simulations and decisions (SRO Phase 1.3)."""
    __tablename__ = "sro_audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    log_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    scenario_id: Mapped[Optional[str]] = mapped_column(String(36))
    scenario_snapshot: Mapped[Optional[str]] = mapped_column(Text)
    results_snapshot: Mapped[Optional[str]] = mapped_column(Text)
    decisions_snapshot: Mapped[Optional[str]] = mapped_column(Text)
    user_id: Mapped[Optional[str]] = mapped_column(String(36))
    user_role: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
