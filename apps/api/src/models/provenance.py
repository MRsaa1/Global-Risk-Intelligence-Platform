"""Data Provenance models - Layer 0: Verified Truth."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class VerificationStatus(str, enum.Enum):
    """Verification status of data."""
    PENDING = "pending"
    VERIFIED = "verified"
    DISPUTED = "disputed"
    EXPIRED = "expired"


class VerificationType(str, enum.Enum):
    """Type of verification performed."""
    MEASUREMENT = "measurement"
    DAMAGE_CLAIM = "damage_claim"
    BEFORE_AFTER = "before_after"
    SENSOR = "sensor"
    MANUAL = "manual"


class ComparisonResult(str, enum.Enum):
    """Result of comparison verification."""
    MATCH = "match"
    MISMATCH = "mismatch"
    INCONCLUSIVE = "inconclusive"
    PARTIAL_MATCH = "partial_match"


class DataProvenance(Base):
    """
    Cryptographic proof of data origin and integrity.
    
    Layer 0: Verified Truth - every data point has traceable provenance.
    """
    __tablename__ = "data_provenance"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Reference to asset
    asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    # What data this proves
    data_type: Mapped[str] = mapped_column(String(100))
    data_point: Mapped[str] = mapped_column(String(255))
    data_value: Mapped[str] = mapped_column(Text)  # JSON as text
    
    # Source Information
    source_type: Mapped[str] = mapped_column(String(100))
    source_id: Mapped[Optional[str]] = mapped_column(String(255))
    source_name: Mapped[Optional[str]] = mapped_column(String(255))
    source_metadata: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    
    # Timestamp
    measurement_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime)
    received_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Cryptographic Proof
    data_hash: Mapped[str] = mapped_column(String(64), index=True)
    signature: Mapped[Optional[str]] = mapped_column(Text)
    signature_algorithm: Mapped[Optional[str]] = mapped_column(String(50))
    geometry_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        comment="Hash of geometry data for 3D comparison",
    )
    
    # Verification
    status: Mapped[str] = mapped_column(
        String(20),
        default=VerificationStatus.PENDING.value,
    )
    verification_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        comment="Type: measurement, damage_claim, before_after",
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    verified_by: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Fraud Detection Link
    linked_claim_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        comment="Link to damage claim for fraud detection",
    )
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Relationships - simplified for SQLite
    # asset: Mapped[Optional["Asset"]] = relationship(back_populates="provenance_records")
    # verification_records: Mapped[list["VerificationRecord"]] = relationship(back_populates="provenance")
    
    def __repr__(self) -> str:
        return f"<DataProvenance {self.data_type}: {self.data_point}>"


class VerificationRecord(Base):
    """Record of verification attempts for provenance data."""
    __tablename__ = "verification_records"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    provenance_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("data_provenance.id", ondelete="CASCADE"),
    )
    
    # Verification Details
    verification_type: Mapped[str] = mapped_column(String(50))
    verifier_id: Mapped[Optional[str]] = mapped_column(String(255))
    verifier_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Result
    result: Mapped[str] = mapped_column(String(50))
    comparison_result: Mapped[Optional[str]] = mapped_column(
        String(50),
        comment="Comparison result: match, mismatch, inconclusive, partial_match",
    )
    confidence_score: Mapped[Optional[float]] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    # Evidence
    evidence: Mapped[Optional[str]] = mapped_column(Text)  # JSON as text
    
    # Geometry comparison details
    geometry_diff_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        comment="JSON summary of geometry differences",
    )
    
    # Timestamp
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Relationships - simplified for SQLite
    # provenance: Mapped["DataProvenance"] = relationship(back_populates="verification_records")
    
    def __repr__(self) -> str:
        return f"<VerificationRecord {self.verification_type}: {self.result}>"
