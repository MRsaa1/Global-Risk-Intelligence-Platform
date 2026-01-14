"""Historical Event models - past events for calibration and learning."""
from datetime import datetime, date
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base
from src.models.stress_test import StressTestType


class HistoricalEvent(Base):
    """
    Historical event record for stress test calibration.
    
    Used to:
    - Learn from past events
    - Calibrate stress test parameters
    - Provide context via RAG
    - Validate predictions
    """
    __tablename__ = "historical_events"
    
    # Identity
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Classification
    event_type: Mapped[str] = mapped_column(
        String(50),
        default=StressTestType.CLIMATE.value,
        index=True,
    )
    
    # Temporal
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    duration_days: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Geographic
    region_name: Mapped[Optional[str]] = mapped_column(String(255))
    country_codes: Mapped[Optional[str]] = mapped_column(
        String(100),
        comment="Comma-separated country codes",
    )
    center_latitude: Mapped[Optional[float]] = mapped_column(Float)
    center_longitude: Mapped[Optional[float]] = mapped_column(Float)
    affected_area_km2: Mapped[Optional[float]] = mapped_column(Float)
    
    # Geographic polygon (GeoJSON as text)
    geographic_polygon: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="GeoJSON polygon as JSON string",
    )
    
    # Impact Metrics - Actual Observed
    severity_actual: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Observed severity 0.0-1.0",
    )
    financial_loss_eur: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Total financial losses in EUR",
    )
    insurance_claims_eur: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Insurance claims paid in EUR",
    )
    affected_population: Mapped[Optional[int]] = mapped_column(Integer)
    casualties: Mapped[Optional[int]] = mapped_column(Integer)
    displaced_people: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Asset Impact
    affected_assets_count: Mapped[Optional[int]] = mapped_column(Integer)
    destroyed_assets_count: Mapped[Optional[int]] = mapped_column(Integer)
    damaged_assets_count: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Recovery
    recovery_time_months: Mapped[Optional[int]] = mapped_column(Integer)
    reconstruction_cost_eur: Mapped[Optional[float]] = mapped_column(Float)
    
    # Risk Multipliers (observed)
    pd_multiplier_observed: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Observed PD multiplier during event",
    )
    lgd_multiplier_observed: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Observed LGD multiplier during event",
    )
    valuation_impact_pct_observed: Mapped[Optional[float]] = mapped_column(
        Float,
        comment="Observed valuation impact %",
    )
    
    # Cascade Effects
    cascade_effects: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Cascade/secondary effects as JSON",
    )
    affected_sectors: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="List of affected sectors as JSON",
    )
    
    # Impact by Organization Type (JSON)
    impact_developers: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Impact on developers as JSON",
    )
    impact_insurers: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Impact on insurers as JSON",
    )
    impact_military: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Impact on military as JSON",
    )
    impact_banks: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Impact on banks as JSON",
    )
    impact_enterprises: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Impact on enterprises as JSON",
    )
    
    # Data Sources
    sources: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Data sources as JSON array",
    )
    source_urls: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Source URLs as JSON array",
    )
    
    # Lessons Learned
    lessons_learned: Mapped[Optional[str]] = mapped_column(Text)
    recommendations: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Recommendations as JSON array",
    )
    
    # Tags and Classification
    tags: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="Tags as JSON array",
    )
    
    # Verification
    is_verified: Mapped[bool] = mapped_column(default=False)
    verified_by: Mapped[Optional[str]] = mapped_column(String(100))
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
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
    
    def __repr__(self) -> str:
        return f"<HistoricalEvent {self.name} ({self.event_type})>"
    
    def to_calibration_params(self) -> dict:
        """
        Extract calibration parameters for stress tests.
        
        Returns parameters that can be used to calibrate
        new stress tests based on this historical event.
        """
        return {
            "event_type": self.event_type,
            "severity": self.severity_actual,
            "duration_days": self.duration_days,
            "recovery_time_months": self.recovery_time_months,
            "pd_multiplier": self.pd_multiplier_observed or 1.0,
            "lgd_multiplier": self.lgd_multiplier_observed or 1.0,
            "valuation_impact_pct": self.valuation_impact_pct_observed or 0.0,
            "financial_loss_eur": self.financial_loss_eur,
            "affected_area_km2": self.affected_area_km2,
        }
