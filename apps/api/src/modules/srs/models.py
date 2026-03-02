"""SRS module database models."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class SovereignFundStatus(str, enum.Enum):
    """Status of a sovereign fund."""
    ACTIVE = "active"
    FROZEN = "frozen"
    LIQUIDATING = "liquidating"
    PLANNED = "planned"


class SovereignFund(Base):
    """Sovereign wealth fund for SRS module."""
    __tablename__ = "srs_sovereign_funds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    srs_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    total_assets_usd: Mapped[Optional[float]] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[str] = mapped_column(String(20), default=SovereignFundStatus.ACTIVE.value)
    established_year: Mapped[Optional[int]] = mapped_column(Integer)
    mandate: Mapped[Optional[str]] = mapped_column(Text)
    extra_data: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)


class ResourceDeposit(Base):
    """Resource deposit (natural resources) linked to sovereign wealth."""
    __tablename__ = "srs_resource_deposits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    srs_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)  # oil, gas, minerals, etc.
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    sovereign_fund_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("srs_sovereign_funds.id", ondelete="SET NULL"), index=True
    )
    estimated_value_usd: Mapped[Optional[float]] = mapped_column(Float)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    description: Mapped[Optional[str]] = mapped_column(Text)
    extraction_horizon_years: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)


class SRSIndicator(Base):
    """Stored indicator snapshot for sovereign risk (regime stability, digital sovereignty, etc.)."""
    __tablename__ = "srs_indicators"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    indicator_type: Mapped[str] = mapped_column(String(50), nullable=False)  # regime_stability, digital_sovereignty, etc.
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(20))
    source: Mapped[Optional[str]] = mapped_column(String(255))
    measured_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
