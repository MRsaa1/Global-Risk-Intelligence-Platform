"""Fraud Detection API endpoints."""
import json
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.fraud import DamageClaim, DamageClaimEvidence, ClaimStatus, ClaimType, DamageType
from src.services.damage_reconstruction import DamageReconstructionService
from src.services.before_after_comparison import BeforeAfterComparisonService

router = APIRouter()


# ==================== Schemas ====================

class ClaimCreate(BaseModel):
    """Create claim request."""
    asset_id: str
    claim_type: str = Field(default="insurance")
    title: str
    description: Optional[str] = None
    claimed_damage_type: str = Field(default="other")
    damage_date: Optional[datetime] = None
    damage_location: Optional[str] = None
    claimed_loss_amount: float = Field(default=0, ge=0)
    claimant_name: Optional[str] = None
    policy_number: Optional[str] = None


class ClaimUpdate(BaseModel):
    """Update claim request."""
    status: Optional[str] = None
    description: Optional[str] = None
    assessed_loss_amount: Optional[float] = None
    approved_amount: Optional[float] = None
    adjuster_name: Optional[str] = None
    internal_notes: Optional[str] = None


class ClaimResponse(BaseModel):
    """Claim response."""
    id: str
    claim_number: str
    asset_id: str
    claim_type: str
    status: str
    title: str
    description: Optional[str]
    claimed_damage_type: str
    damage_date: Optional[datetime]
    damage_location: Optional[str]
    claimed_loss_amount: float
    assessed_loss_amount: Optional[float]
    approved_amount: Optional[float]
    fraud_risk_level: Optional[str]
    fraud_score: Optional[float]
    has_before_data: bool
    has_after_data: bool
    comparison_status: Optional[str]
    geometry_match_score: Optional[float]
    claimant_name: Optional[str]
    adjuster_name: Optional[str]
    policy_number: Optional[str]
    reported_at: datetime
    reviewed_at: Optional[datetime]
    resolved_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class EvidenceCreate(BaseModel):
    """Add evidence request."""
    evidence_type: str = Field(default="photo")
    title: Optional[str] = None
    description: Optional[str] = None
    file_path: str
    captured_at: Optional[datetime] = None
    is_before: bool = False
    is_after: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class EvidenceResponse(BaseModel):
    """Evidence response."""
    id: str
    claim_id: str
    evidence_type: str
    title: Optional[str]
    description: Optional[str]
    file_path: str
    captured_at: Optional[datetime]
    is_before: bool
    is_after: bool
    is_verified: bool
    latitude: Optional[float]
    longitude: Optional[float]
    file_hash: Optional[str]
    geometry_hash: Optional[str]
    created_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ComparisonResponse(BaseModel):
    """Comparison result response."""
    claim_id: str
    before_data_id: str
    after_data_id: str
    match_result: str
    confidence_score: float
    geometry_match_score: float
    volume_difference_pct: float
    surface_difference_pct: float
    total_differences: int
    significant_differences: int
    fraud_score: float
    fraud_indicators: list[str]
    damage_verified: bool
    verified_damage_areas: list[str]
    claimed_vs_verified_ratio: float
    recommendations: list[str]


# ==================== Claims CRUD ====================

@router.get("/claims", response_model=list[ClaimResponse])
async def list_claims(
    status: Optional[str] = None,
    claim_type: Optional[str] = None,
    asset_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all damage claims."""
    query = select(DamageClaim).order_by(DamageClaim.reported_at.desc())
    
    if status:
        query = query.where(DamageClaim.status == status)
    if claim_type:
        query = query.where(DamageClaim.claim_type == claim_type)
    if asset_id:
        query = query.where(DamageClaim.asset_id == asset_id)
    
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/claims", response_model=ClaimResponse)
async def create_claim(
    data: ClaimCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new damage claim."""
    claim_number = f"CLM-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid4())[:8].upper()}"
    
    claim = DamageClaim(
        id=str(uuid4()),
        claim_number=claim_number,
        asset_id=data.asset_id,
        claim_type=data.claim_type,
        title=data.title,
        description=data.description,
        claimed_damage_type=data.claimed_damage_type,
        damage_date=data.damage_date,
        damage_location=data.damage_location,
        claimed_loss_amount=data.claimed_loss_amount,
        claimant_name=data.claimant_name,
        policy_number=data.policy_number,
        reported_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    
    db.add(claim)
    await db.commit()
    await db.refresh(claim)
    
    return claim


@router.get("/claims/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get claim by ID."""
    result = await db.execute(
        select(DamageClaim).where(DamageClaim.id == claim_id)
    )
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    return claim


@router.patch("/claims/{claim_id}", response_model=ClaimResponse)
async def update_claim(
    claim_id: str,
    data: ClaimUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update claim."""
    result = await db.execute(
        select(DamageClaim).where(DamageClaim.id == claim_id)
    )
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(claim, key, value)
    
    if data.status == "verified":
        claim.reviewed_at = datetime.utcnow()
    if data.status in ["approved", "rejected", "closed"]:
        claim.resolved_at = datetime.utcnow()
    
    claim.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(claim)
    
    return claim


@router.delete("/claims/{claim_id}")
async def delete_claim(
    claim_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete claim."""
    result = await db.execute(
        select(DamageClaim).where(DamageClaim.id == claim_id)
    )
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    await db.delete(claim)
    await db.commit()
    
    return {"status": "deleted", "id": claim_id}


# ==================== Evidence ====================

@router.get("/claims/{claim_id}/evidence", response_model=list[EvidenceResponse])
async def list_claim_evidence(
    claim_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all evidence for a claim."""
    result = await db.execute(
        select(DamageClaimEvidence)
        .where(DamageClaimEvidence.claim_id == claim_id)
        .order_by(DamageClaimEvidence.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/claims/{claim_id}/evidence", response_model=EvidenceResponse)
async def add_evidence(
    claim_id: str,
    data: EvidenceCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add evidence to a claim."""
    # Verify claim exists
    result = await db.execute(
        select(DamageClaim).where(DamageClaim.id == claim_id)
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    evidence = DamageClaimEvidence(
        id=str(uuid4()),
        claim_id=claim_id,
        evidence_type=data.evidence_type,
        title=data.title,
        description=data.description,
        file_path=data.file_path,
        captured_at=data.captured_at,
        is_before=data.is_before,
        is_after=data.is_after,
        latitude=data.latitude,
        longitude=data.longitude,
        created_at=datetime.utcnow(),
    )
    
    db.add(evidence)
    
    # Update claim flags
    if data.is_before:
        claim.has_before_data = True
    if data.is_after:
        claim.has_after_data = True
    
    await db.commit()
    await db.refresh(evidence)
    
    return evidence


# ==================== Reconstruction ====================

@router.post("/claims/{claim_id}/reconstruct", response_model=dict)
async def queue_reconstruction(
    claim_id: str,
    evidence_ids: list[str] = [],
    db: AsyncSession = Depends(get_db),
):
    """
    Queue 3D reconstruction job for a claim.
    
    Processes evidence (photos, point clouds) to create
    3D reconstruction for damage verification.
    """
    service = DamageReconstructionService(db)
    
    try:
        job = await service.queue_reconstruction(
            claim_id=claim_id,
            evidence_ids=evidence_ids,
        )
        
        return {
            "job_id": job.job_id,
            "claim_id": job.claim_id,
            "status": job.status,
            "progress": job.progress,
            "created_at": job.created_at.isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/reconstruction/{job_id}", response_model=dict)
async def get_reconstruction_status(
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get reconstruction job status."""
    service = DamageReconstructionService(db)
    job = await service.get_job_status(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "job_id": job.job_id,
        "claim_id": job.claim_id,
        "status": job.status,
        "progress": job.progress,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "result_path": job.result_path,
        "error_message": job.error_message,
    }


# ==================== Comparison ====================

@router.post("/claims/{claim_id}/compare", response_model=ComparisonResponse)
async def compare_before_after(
    claim_id: str,
    before_data_id: Optional[str] = None,
    after_data_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Compare before and after 3D data for a claim.
    
    Performs geometry comparison for damage verification
    and fraud detection.
    """
    service = BeforeAfterComparisonService(db)
    
    try:
        result = await service.compare(
            claim_id=claim_id,
            before_data_id=before_data_id,
            after_data_id=after_data_id,
        )
        
        # Update claim with comparison results
        claim_result = await db.execute(
            select(DamageClaim).where(DamageClaim.id == claim_id)
        )
        claim = claim_result.scalar_one_or_none()
        if claim:
            claim.comparison_status = result.match_result
            claim.geometry_match_score = result.geometry_match_score
            claim.fraud_score = result.fraud_score
            claim.fraud_risk_level = (
                "critical" if result.fraud_score > 0.7 else
                "high" if result.fraud_score > 0.5 else
                "medium" if result.fraud_score > 0.3 else
                "low"
            )
            claim.fraud_indicators = json.dumps(result.fraud_indicators)
            await db.commit()
        
        return ComparisonResponse(
            claim_id=result.claim_id,
            before_data_id=result.before_data_id,
            after_data_id=result.after_data_id,
            match_result=result.match_result,
            confidence_score=result.confidence_score,
            geometry_match_score=result.geometry_match_score,
            volume_difference_pct=result.volume_difference_pct,
            surface_difference_pct=result.surface_difference_pct,
            total_differences=result.total_differences,
            significant_differences=result.significant_differences,
            fraud_score=result.fraud_score,
            fraud_indicators=result.fraud_indicators,
            damage_verified=result.damage_verified,
            verified_damage_areas=result.verified_damage_areas,
            claimed_vs_verified_ratio=result.claimed_vs_verified_ratio,
            recommendations=result.recommendations,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/claims/duplicate-check", response_model=list[dict])
async def check_duplicates(
    claim_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Check for potential duplicate claims."""
    service = BeforeAfterComparisonService(db)

    duplicates = await service.check_duplicates(claim_id)
    return duplicates


# ==================== Fraud detector (rules + SENTINEL alerts) ====================

class FraudRuleCreate(BaseModel):
    """Create fraud detection rule."""
    name: str
    rule_type: str = Field(default="amount_threshold")
    field_name: Optional[str] = None
    threshold_value: Optional[float] = None
    window_hours: Optional[int] = None


@router.get("/detection-rules", response_model=list)
async def list_detection_rules(db: AsyncSession = Depends(get_db)):
    """List fraud detection rules (amount threshold, frequency per claimant)."""
    from src.services import fraud_detector_service
    return await fraud_detector_service.list_rules(db)


@router.post("/detection-rules", response_model=dict)
async def create_detection_rule(
    body: FraudRuleCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a fraud detection rule. When rule fires, SENTINEL alert is created."""
    from src.services import fraud_detector_service
    rule = await fraud_detector_service.create_rule(
        db,
        name=body.name,
        rule_type=body.rule_type,
        field_name=body.field_name,
        threshold_value=body.threshold_value,
        window_hours=body.window_hours,
    )
    await db.commit()
    return {"id": rule.id, "name": rule.name, "rule_type": rule.rule_type}


@router.post("/run-detection", response_model=dict)
async def run_fraud_detection(db: AsyncSession = Depends(get_db)):
    """Run active fraud rules against claims; create SENTINEL alerts when rules fire."""
    from src.services import fraud_detector_service
    result = await fraud_detector_service.run_detection(db)
    return result
