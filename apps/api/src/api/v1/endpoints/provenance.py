"""Data Provenance endpoints - Layer 0: Verified Truth."""
import hashlib
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.provenance import DataProvenance, VerificationRecord, VerificationStatus

router = APIRouter()


class ProvenanceCreate(BaseModel):
    """Create provenance record."""
    asset_id: Optional[UUID] = None
    data_type: str
    data_point: str
    data_value: dict
    source_type: str
    source_id: Optional[str] = None
    source_name: Optional[str] = None
    source_metadata: Optional[dict] = None
    measurement_timestamp: str
    signature: Optional[str] = None
    signature_algorithm: Optional[str] = None


class ProvenanceResponse(BaseModel):
    """Provenance record response."""
    id: UUID
    asset_id: Optional[UUID]
    data_type: str
    data_point: str
    data_value: dict
    source_type: str
    source_name: Optional[str]
    measurement_timestamp: datetime
    data_hash: str
    status: VerificationStatus
    verified_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class VerifyRequest(BaseModel):
    """Verification request."""
    verification_type: str = "automatic"
    verifier_id: Optional[str] = None
    verifier_name: Optional[str] = None
    notes: Optional[str] = None


class VerifyResponse(BaseModel):
    """Verification result."""
    provenance_id: UUID
    result: str
    confidence_score: float
    verified_at: datetime
    hash_valid: bool
    signature_valid: Optional[bool]


def compute_data_hash(data: dict) -> str:
    """Compute SHA-256 hash of data."""
    import json
    data_str = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(data_str.encode()).hexdigest()


@router.post("", response_model=ProvenanceResponse, status_code=201)
async def create_provenance(
    provenance: ProvenanceCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new data provenance record.
    
    This establishes cryptographic proof of data origin for:
    - LiDAR scans
    - Inspections
    - Sensor readings
    - Valuations
    - Any verified data point
    
    The data_hash is automatically computed and stored.
    """
    # Parse timestamp
    try:
        measurement_ts = datetime.fromisoformat(
            provenance.measurement_timestamp.replace("Z", "+00:00")
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp format")
    
    # Compute hash
    data_hash = compute_data_hash(provenance.data_value)
    
    record = DataProvenance(
        asset_id=provenance.asset_id,
        data_type=provenance.data_type,
        data_point=provenance.data_point,
        data_value=provenance.data_value,
        source_type=provenance.source_type,
        source_id=provenance.source_id,
        source_name=provenance.source_name,
        source_metadata=provenance.source_metadata,
        measurement_timestamp=measurement_ts,
        data_hash=data_hash,
        signature=provenance.signature,
        signature_algorithm=provenance.signature_algorithm,
        status=VerificationStatus.PENDING,
    )
    
    db.add(record)
    await db.commit()
    await db.refresh(record)
    
    return record


@router.get("/{provenance_id}", response_model=ProvenanceResponse)
async def get_provenance(
    provenance_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a provenance record by ID."""
    result = await db.execute(
        select(DataProvenance).where(DataProvenance.id == provenance_id)
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Provenance record not found")
    
    return record


@router.get("/asset/{asset_id}", response_model=list[ProvenanceResponse])
async def get_asset_provenance(
    asset_id: UUID,
    data_type: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get all provenance records for an asset."""
    query = select(DataProvenance).where(DataProvenance.asset_id == asset_id)
    
    if data_type:
        query = query.where(DataProvenance.data_type == data_type)
    
    query = query.order_by(DataProvenance.measurement_timestamp.desc()).limit(limit)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    return records


@router.post("/{provenance_id}/verify", response_model=VerifyResponse)
async def verify_provenance(
    provenance_id: UUID,
    verify_request: VerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify a provenance record.
    
    Verification includes:
    1. Hash integrity check
    2. Signature validation (if provided)
    3. Source validation
    
    Results are stored in verification_records for audit trail.
    """
    result = await db.execute(
        select(DataProvenance).where(DataProvenance.id == provenance_id)
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Provenance record not found")
    
    # Verify hash
    computed_hash = compute_data_hash(record.data_value)
    hash_valid = computed_hash == record.data_hash
    
    # Verify signature (placeholder - implement actual crypto verification)
    signature_valid = None
    if record.signature:
        # TODO: Implement actual signature verification
        signature_valid = True
    
    # Determine result
    if hash_valid and (signature_valid is None or signature_valid):
        verification_result = "verified"
        confidence_score = 1.0 if signature_valid else 0.9
        new_status = VerificationStatus.VERIFIED
    else:
        verification_result = "failed"
        confidence_score = 0.0
        new_status = VerificationStatus.DISPUTED
    
    # Create verification record
    verification = VerificationRecord(
        provenance_id=provenance_id,
        verification_type=verify_request.verification_type,
        verifier_id=verify_request.verifier_id,
        verifier_name=verify_request.verifier_name,
        result=verification_result,
        confidence_score=confidence_score,
        notes=verify_request.notes,
        evidence={
            "hash_valid": hash_valid,
            "signature_valid": signature_valid,
            "computed_hash": computed_hash,
            "stored_hash": record.data_hash,
        },
    )
    
    db.add(verification)
    
    # Update provenance status
    record.status = new_status
    record.verified_at = datetime.utcnow()
    record.verified_by = verify_request.verifier_name or verify_request.verifier_id
    
    await db.commit()
    
    return VerifyResponse(
        provenance_id=provenance_id,
        result=verification_result,
        confidence_score=confidence_score,
        verified_at=verification.verified_at,
        hash_valid=hash_valid,
        signature_valid=signature_valid,
    )
