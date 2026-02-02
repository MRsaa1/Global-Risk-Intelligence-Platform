"""Project Finance models - Projects and Phases."""
import enum
from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class ProjectType(str, enum.Enum):
    """Type of infrastructure project."""
    ROAD = "road"
    RAIL = "rail"
    RENEWABLE = "renewable"
    INDUSTRIAL = "industrial"
    COMMERCIAL = "commercial"
    RESIDENTIAL = "residential"
    MIXED_USE = "mixed_use"
    PORT = "port"
    AIRPORT = "airport"
    UTILITY = "utility"
    OTHER = "other"


class ProjectStatus(str, enum.Enum):
    """Project lifecycle status."""
    DEVELOPMENT = "development"
    PLANNING = "planning"
    FINANCING = "financing"
    CONSTRUCTION = "construction"
    COMMISSIONING = "commissioning"
    OPERATION = "operation"
    DECOMMISSIONED = "decommissioned"


class PhaseType(str, enum.Enum):
    """Type of project phase."""
    DEVELOPMENT = "development"
    PLANNING = "planning"
    PERMITTING = "permitting"
    FINANCING = "financing"
    PROCUREMENT = "procurement"
    CONSTRUCTION = "construction"
    COMMISSIONING = "commissioning"
    OPERATION = "operation"
    MAINTENANCE = "maintenance"


class Project(Base):
    """
    Infrastructure or real estate project for Project Finance.
    
    Tracks CAPEX, OPEX, phases, and links to physical assets.
    """
    __tablename__ = "projects"
    
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
    project_type: Mapped[str] = mapped_column(
        String(50),
        default=ProjectType.COMMERCIAL.value,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default=ProjectStatus.DEVELOPMENT.value,
    )
    
    # Financial
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    total_capex_planned: Mapped[Optional[float]] = mapped_column(Float)
    total_capex_actual: Mapped[Optional[float]] = mapped_column(Float)
    annual_opex_planned: Mapped[Optional[float]] = mapped_column(Float)
    annual_opex_actual: Mapped[Optional[float]] = mapped_column(Float)
    annual_revenue_projected: Mapped[Optional[float]] = mapped_column(Float)
    
    # Calculated financials
    irr: Mapped[Optional[float]] = mapped_column(Float)
    npv: Mapped[Optional[float]] = mapped_column(Float)
    payback_period_years: Mapped[Optional[float]] = mapped_column(Float)
    
    # Asset links
    primary_asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="SET NULL"),
    )
    linked_asset_ids: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    
    # Location
    country_code: Mapped[str] = mapped_column(String(2), default="DE")
    region: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Timeline
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    target_completion_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_completion_date: Mapped[Optional[date]] = mapped_column(Date)
    operation_start_date: Mapped[Optional[date]] = mapped_column(Date)
    
    # Progress
    overall_completion_pct: Mapped[Optional[float]] = mapped_column(Float)
    
    # Risk
    risk_score: Mapped[Optional[float]] = mapped_column(Float)
    risk_factors: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    
    # Ownership
    owner_id: Mapped[Optional[str]] = mapped_column(String(36))
    sponsor_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Metadata
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    # Relationships
    phases = relationship("ProjectPhase", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Project {self.code}: {self.name}>"


class ProjectPhase(Base):
    """
    Individual phase within a project.
    
    Tracks schedule, budget, and completion for each phase.
    """
    __tablename__ = "project_phases"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Identity
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    phase_type: Mapped[str] = mapped_column(
        String(50),
        default=PhaseType.CONSTRUCTION.value,
    )
    sequence_number: Mapped[int] = mapped_column(Integer, default=1)
    
    # Timeline
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_start_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_end_date: Mapped[Optional[date]] = mapped_column(Date)
    
    # Progress
    completion_pct: Mapped[float] = mapped_column(Float, default=0)
    
    # Budget
    capex_planned: Mapped[Optional[float]] = mapped_column(Float)
    capex_actual: Mapped[Optional[float]] = mapped_column(Float)
    opex_annual_planned: Mapped[Optional[float]] = mapped_column(Float)
    opex_annual_actual: Mapped[Optional[float]] = mapped_column(Float)
    
    # Variance
    cost_variance_pct: Mapped[Optional[float]] = mapped_column(Float)
    schedule_variance_days: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Milestones (JSON array)
    milestones: Mapped[Optional[str]] = mapped_column(Text)
    
    # Dependencies (JSON array of phase IDs)
    dependencies: Mapped[Optional[str]] = mapped_column(Text)
    
    # Metadata
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="phases")
    
    def __repr__(self) -> str:
        return f"<ProjectPhase {self.name}: {self.completion_pct}%>"
