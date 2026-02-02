"""Fraud Detection models - Damage Claims and Verification."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class ClaimType(str, enum.Enum):
    """Type of damage claim."""
    INSURANCE = "insurance"
    COLLATERAL = "collateral"
    WARRANTY = "warranty"
    OTHER = "other"


class ClaimStatus(str, enum.Enum):
    """Status of damage claim."""
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    EVIDENCE_REQUESTED = "evidence_requested"
    VERIFIED = "verified"
    DISPUTED = "disputed"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"
    CLOSED = "closed"


class DamageType(str, enum.Enum):
    """Type of damage claimed."""
    FLOOD = "flood"
    FIRE = "fire"
    WIND = "wind"
    EARTHQUAKE = "earthquake"
    STRUCTURAL = "structural"
    VANDALISM = "vandalism"
    THEFT = "theft"
    SUBSIDENCE = "subsidence"
    OTHER = "other"


class EvidenceType(str, enum.Enum):
    """Type of evidence for claim."""
    PHOTO = "photo"
    VIDEO = "video"
    POINT_CLOUD = "point_cloud"
    BIM = "bim"
    SATELLITE = "satellite"
    DRONE = "drone"
    DOCUMENT = "document"
    REPORT = "report"
    OTHER = "other"


class FraudRiskLevel(str, enum.Enum):
    """Fraud risk assessment level."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DamageClaim(Base):
    """
    Damage claim for insurance or collateral assessment.
    
    Supports 3D comparison for fraud detection.
    """
    __tablename__ = "damage_claims"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Reference
    claim_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Classification
    claim_type: Mapped[str] = mapped_column(
        String(50),
        default=ClaimType.INSURANCE.value,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default=ClaimStatus.SUBMITTED.value,
    )
    
    # Description
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Damage details
    claimed_damage_type: Mapped[str] = mapped_column(
        String(50),
        default=DamageType.OTHER.value,
    )
    damage_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    damage_location: Mapped[Optional[str]] = mapped_column(String(255))
    damage_extent: Mapped[Optional[str]] = mapped_column(Text)  # JSON description
    
    # Financial
    claimed_loss_amount: Mapped[float] = mapped_column(Float, default=0)
    assessed_loss_amount: Mapped[Optional[float]] = mapped_column(Float)
    approved_amount: Mapped[Optional[float]] = mapped_column(Float)
    deductible: Mapped[Optional[float]] = mapped_column(Float)
    
    # Fraud detection
    fraud_risk_level: Mapped[Optional[str]] = mapped_column(String(20))
    fraud_score: Mapped[Optional[float]] = mapped_column(Float)
    fraud_indicators: Mapped[Optional[str]] = mapped_column(Text)  # JSON list
    is_duplicate_suspected: Mapped[bool] = mapped_column(Boolean, default=False)
    duplicate_claim_ids: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    
    # 3D comparison
    has_before_data: Mapped[bool] = mapped_column(Boolean, default=False)
    has_after_data: Mapped[bool] = mapped_column(Boolean, default=False)
    comparison_status: Mapped[Optional[str]] = mapped_column(String(50))
    comparison_result: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    geometry_match_score: Mapped[Optional[float]] = mapped_column(Float)
    
    # Timeline
    reported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Parties
    claimant_id: Mapped[Optional[str]] = mapped_column(String(36))
    claimant_name: Mapped[Optional[str]] = mapped_column(String(255))
    adjuster_id: Mapped[Optional[str]] = mapped_column(String(36))
    adjuster_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Policy reference
    policy_number: Mapped[Optional[str]] = mapped_column(String(100))
    policy_type: Mapped[Optional[str]] = mapped_column(String(50))
    coverage_limit: Mapped[Optional[float]] = mapped_column(Float)
    
    # Notes
    internal_notes: Mapped[Optional[str]] = mapped_column(Text)
    
    # Metadata
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    # Relationships
    evidence = relationship("DamageClaimEvidence", back_populates="claim", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<DamageClaim {self.claim_number}: {self.status}>"


class DamageClaimEvidence(Base):
    """
    Evidence associated with a damage claim.
    
    Supports various evidence types including 3D data for comparison.
    """
    __tablename__ = "damage_claim_evidence"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    claim_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("damage_claims.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Classification
    evidence_type: Mapped[str] = mapped_column(
        String(50),
        default=EvidenceType.PHOTO.value,
    )
    
    # Description
    title: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Storage
    file_path: Mapped[str] = mapped_column(String(500))
    file_name: Mapped[Optional[str]] = mapped_column(String(255))
    file_size_bytes: Mapped[Optional[int]]
    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Capture metadata
    captured_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    captured_by: Mapped[Optional[str]] = mapped_column(String(255))
    capture_device: Mapped[Optional[str]] = mapped_column(String(255))
    capture_location: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Geolocation
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    
    # Before/After classification
    is_before: Mapped[bool] = mapped_column(Boolean, default=False)
    is_after: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Verification
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text)
    
    # Integrity
    file_hash: Mapped[Optional[str]] = mapped_column(String(64))
    geometry_hash: Mapped[Optional[str]] = mapped_column(String(64))
    
    # Analysis results
    analysis_results: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    
    # Metadata
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    # Relationships
    claim = relationship("DamageClaim", back_populates="evidence")
    
    def __repr__(self) -> str:
        return f"<DamageClaimEvidence {self.evidence_type}: {self.file_name}>"
