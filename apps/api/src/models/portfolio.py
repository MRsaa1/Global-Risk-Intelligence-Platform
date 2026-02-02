"""Portfolio and REIT models."""
import enum
from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class PortfolioType(str, enum.Enum):
    """Type of portfolio."""
    FUND = "fund"
    REIT = "reit"
    PENSION = "pension"
    INSURANCE = "insurance"
    SOVEREIGN = "sovereign"
    CUSTOM = "custom"


class Portfolio(Base):
    """
    Portfolio of assets for REIT and fund management.
    
    Tracks NAV, FFO, yield, and other REIT-specific metrics.
    """
    __tablename__ = "portfolios"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Identity
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    code: Mapped[Optional[str]] = mapped_column(String(50), unique=True)
    
    # Classification
    portfolio_type: Mapped[str] = mapped_column(
        String(50),
        default=PortfolioType.CUSTOM.value,
    )
    
    # Ownership
    owner_id: Mapped[Optional[str]] = mapped_column(String(36))
    manager_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Financial basics
    base_currency: Mapped[str] = mapped_column(String(3), default="EUR")
    inception_date: Mapped[Optional[date]] = mapped_column(Date)
    
    # REIT Metrics (calculated)
    nav: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Net Asset Value",
    )
    nav_per_share: Mapped[Optional[float]] = mapped_column(Float)
    ffo: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Funds From Operations (annual)",
    )
    affo: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Adjusted FFO",
    )
    yield_pct: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Dividend yield percentage",
    )
    dividend_per_share: Mapped[Optional[float]] = mapped_column(Float)
    
    # Leverage
    total_debt: Mapped[Optional[float]] = mapped_column(Float)
    total_equity: Mapped[Optional[float]] = mapped_column(Float)
    debt_to_equity: Mapped[Optional[float]] = mapped_column(Float)
    loan_to_value: Mapped[Optional[float]] = mapped_column(Float)
    interest_coverage: Mapped[Optional[float]] = mapped_column(Float)
    
    # Occupancy and income
    occupancy: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Average occupancy rate (0-1)",
    )
    noi_annual: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Net Operating Income",
    )
    cap_rate: Mapped[Optional[float]] = mapped_column(Float)
    
    # Risk metrics
    var_95: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Value at Risk at 95%",
    )
    climate_risk_score: Mapped[Optional[float]] = mapped_column(Float)
    concentration_risk: Mapped[Optional[float]] = mapped_column(Float)
    
    # Statistics
    asset_count: Mapped[int] = mapped_column(default=0)
    total_gfa_m2: Mapped[Optional[float]] = mapped_column(Float)
    
    # Benchmark
    benchmark_index: Mapped[Optional[str]] = mapped_column(String(100))
    ytd_return: Mapped[Optional[float]] = mapped_column(Float)
    
    # Metadata
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    # Relationships
    assets = relationship("PortfolioAsset", back_populates="portfolio", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Portfolio {self.code}: {self.name}>"


class PortfolioAsset(Base):
    """
    Asset allocation within a portfolio.
    
    Links assets to portfolios with ownership percentage and targets.
    """
    __tablename__ = "portfolio_assets"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    portfolio_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        index=True,
    )
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Ownership
    share_pct: Mapped[float] = mapped_column(
        Float,
        default=100.0,
        comment="Ownership percentage (0-100)",
    )
    
    # Acquisition
    acquisition_date: Mapped[Optional[date]] = mapped_column(Date)
    acquisition_price: Mapped[Optional[float]] = mapped_column(Float)
    
    # Current valuation
    current_value: Mapped[Optional[float]] = mapped_column(Float)
    valuation_date: Mapped[Optional[date]] = mapped_column(Date)
    
    # Performance
    target_irr: Mapped[Optional[float]] = mapped_column(Float)
    actual_irr: Mapped[Optional[float]] = mapped_column(Float)
    unrealized_gain_loss: Mapped[Optional[float]] = mapped_column(Float)
    
    # Income
    annual_noi: Mapped[Optional[float]] = mapped_column(Float)
    annual_rent: Mapped[Optional[float]] = mapped_column(Float)
    occupancy: Mapped[Optional[float]] = mapped_column(Float)
    
    # Weight in portfolio
    weight_pct: Mapped[Optional[float]] = mapped_column(Float)
    
    # Strategy
    investment_strategy: Mapped[Optional[str]] = mapped_column(String(50))  # core, core_plus, value_add, opportunistic
    hold_period_years: Mapped[Optional[int]]
    exit_date_target: Mapped[Optional[date]] = mapped_column(Date)
    
    # Notes
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    # Metadata
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="assets")
    
    def __repr__(self) -> str:
        return f"<PortfolioAsset {self.asset_id}: {self.share_pct}%>"
