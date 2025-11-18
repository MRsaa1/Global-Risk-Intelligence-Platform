"""
SQLAlchemy models for API Gateway.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON, Enum as SQLEnum, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()


class ScenarioStatus(str, enum.Enum):
    """Scenario status enum."""
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class CalculationStatus(str, enum.Enum):
    """Calculation status enum."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Scenario(Base):
    """Scenario model."""
    __tablename__ = "scenarios"

    scenario_id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(ScenarioStatus), default=ScenarioStatus.DRAFT)
    scenario_data = Column(JSON, nullable=True)  # Full scenario DSL as JSON
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String(255), nullable=True)

    # Relationships
    calculations = relationship("Calculation", back_populates="scenario", cascade="all, delete-orphan")

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "scenario_id": self.scenario_id,
            "name": self.name,
            "description": self.description,
            "status": self.status.value if self.status else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
        }


class Calculation(Base):
    """Calculation model."""
    __tablename__ = "calculations"

    calculation_id = Column(String(255), primary_key=True)
    scenario_id = Column(String(255), ForeignKey("scenarios.scenario_id"), nullable=False)
    portfolio_id = Column(String(255), nullable=False)
    status = Column(SQLEnum(CalculationStatus), default=CalculationStatus.PENDING)
    results = Column(JSON, nullable=True)  # Calculation results
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_by = Column(String(255), nullable=True)

    # Relationships
    scenario = relationship("Scenario", back_populates="calculations")

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "calculation_id": self.calculation_id,
            "scenario_id": self.scenario_id,
            "portfolio_id": self.portfolio_id,
            "status": self.status.value if self.status else None,
            "results": self.results,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_by": self.created_by,
        }


class Portfolio(Base):
    """Portfolio model."""
    __tablename__ = "portfolios"

    portfolio_id = Column(String(255), primary_key=True)
    portfolio_name = Column(String(255), nullable=False)
    as_of_date = Column(DateTime, nullable=False)
    currency = Column(String(10), default="USD")
    total_notional = Column(Float, default=0.0)
    total_market_value = Column(Float, default=0.0)
    total_rwa = Column(Float, default=0.0)
    position_count = Column(Integer, default=0)
    portfolio_data = Column(JSON, nullable=True)  # Full portfolio data
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "portfolio_id": self.portfolio_id,
            "portfolio_name": self.portfolio_name,
            "as_of_date": self.as_of_date.isoformat() if self.as_of_date else None,
            "currency": self.currency,
            "total_notional": self.total_notional,
            "total_market_value": self.total_market_value,
            "total_rwa": self.total_rwa,
            "position_count": self.position_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class User(Base):
    """User model for authentication."""
    __tablename__ = "users"

    user_id = Column(String(255), primary_key=True)
    username = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # For local auth
    role = Column(String(50), default="user")
    is_active = Column(Integer, default=1)  # 1 = active, 0 = inactive
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Convert to dictionary (without password)."""
        return {
            "user_id": self.user_id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": bool(self.is_active),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

