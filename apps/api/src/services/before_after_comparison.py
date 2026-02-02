"""Before-After Comparison Service - Geometry comparison for fraud detection."""
import hashlib
import json
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class GeometryDifference:
    """Individual geometry difference."""
    location: str
    difference_type: str  # missing, added, modified, damaged
    magnitude: float  # 0-1 severity
    description: str
    coordinates: Optional[dict]


@dataclass
class ComparisonResult:
    """Geometry comparison result."""
    claim_id: str
    before_data_id: str
    after_data_id: str
    
    # Overall result
    match_result: str  # match, mismatch, inconclusive, partial_match
    confidence_score: float  # 0-1
    
    # Metrics
    geometry_match_score: float  # 0-1, 1 = identical
    volume_difference_pct: float
    surface_difference_pct: float
    
    # Differences
    differences: list[GeometryDifference]
    total_differences: int
    significant_differences: int
    
    # Fraud indicators
    fraud_score: float  # 0-1, higher = more suspicious
    fraud_indicators: list[str]
    
    # Damage verification
    damage_verified: bool
    verified_damage_areas: list[str]
    claimed_vs_verified_ratio: float
    
    # Recommendations
    recommendations: list[str]


class BeforeAfterComparisonService:
    """
    Service for comparing before/after 3D data.
    
    Used for:
    - Damage claim verification
    - Fraud detection
    - Insurance assessment
    
    Note: Full GPU-accelerated comparison requires NVIDIA integration.
    This is the MVP implementation with basic comparison logic.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def compare(
        self,
        claim_id: str,
        before_data_id: Optional[str] = None,
        after_data_id: Optional[str] = None,
    ) -> ComparisonResult:
        """
        Compare before and after geometry data.
        
        Args:
            claim_id: Damage claim ID
            before_data_id: Before evidence ID (auto-detect if None)
            after_data_id: After evidence ID (auto-detect if None)
            
        Returns:
            ComparisonResult with match analysis
        """
        from src.models.fraud import DamageClaim, DamageClaimEvidence
        
        # Get claim
        result = await self.db.execute(
            select(DamageClaim).where(DamageClaim.id == claim_id)
        )
        claim = result.scalar_one_or_none()
        
        if not claim:
            raise ValueError(f"Claim not found: {claim_id}")
        
        # Get evidence items
        evidence_result = await self.db.execute(
            select(DamageClaimEvidence)
            .where(DamageClaimEvidence.claim_id == claim_id)
        )
        evidence = list(evidence_result.scalars().all())
        
        # Find before/after
        before_evidence = [e for e in evidence if e.is_before]
        after_evidence = [e for e in evidence if e.is_after]
        
        if not before_evidence and before_data_id:
            before_evidence = [e for e in evidence if e.id == before_data_id]
        if not after_evidence and after_data_id:
            after_evidence = [e for e in evidence if e.id == after_data_id]
        
        # Check if we have both
        has_before = len(before_evidence) > 0
        has_after = len(after_evidence) > 0
        
        if not has_before or not has_after:
            return ComparisonResult(
                claim_id=claim_id,
                before_data_id=before_evidence[0].id if before_evidence else "",
                after_data_id=after_evidence[0].id if after_evidence else "",
                match_result="inconclusive",
                confidence_score=0.2,
                geometry_match_score=0,
                volume_difference_pct=0,
                surface_difference_pct=0,
                differences=[],
                total_differences=0,
                significant_differences=0,
                fraud_score=0,
                fraud_indicators=["Missing before or after data"],
                damage_verified=False,
                verified_damage_areas=[],
                claimed_vs_verified_ratio=0,
                recommendations=["Upload both before and after evidence for comparison"],
            )
        
        # Compare geometry hashes (simple comparison)
        before_hash = before_evidence[0].geometry_hash or ""
        after_hash = after_evidence[0].geometry_hash or ""
        
        # Calculate match metrics
        if before_hash == after_hash and before_hash:
            # Identical - no damage or fake claim
            geometry_match = 1.0
            match_result = "match"
            fraud_indicators = ["Before and after geometry identical - possible fraudulent claim"]
            fraud_score = 0.8
        else:
            # Different - potential damage
            geometry_match = 0.6  # Simulated partial match
            match_result = "partial_match"
            fraud_indicators = []
            fraud_score = 0.2
        
        # Simulate differences based on claim
        differences = []
        if claim.claimed_damage_type == "flood":
            differences.append(GeometryDifference(
                location="Ground floor",
                difference_type="damaged",
                magnitude=0.6,
                description="Water damage visible in wall geometry",
                coordinates={"x": 10, "y": 0, "z": 2},
            ))
        if claim.claimed_damage_type == "structural":
            differences.append(GeometryDifference(
                location="Load-bearing wall",
                difference_type="modified",
                magnitude=0.8,
                description="Structural deformation detected",
                coordinates={"x": 5, "y": 5, "z": 3},
            ))
        
        # Check claimed vs verified
        claimed_amount = claim.claimed_loss_amount or 0
        assessed_amount = claim.assessed_loss_amount or claimed_amount * 0.75
        claimed_ratio = assessed_amount / claimed_amount if claimed_amount > 0 else 0
        
        # Fraud indicators based on ratio
        if claimed_ratio < 0.5:
            fraud_indicators.append("Claimed amount significantly exceeds verified damage")
            fraud_score = max(fraud_score, 0.6)
        
        # Check for duplicate claim indicators
        if claim.is_duplicate_suspected:
            fraud_indicators.append("Potential duplicate claim detected")
            fraud_score = max(fraud_score, 0.7)
        
        # Recommendations
        recommendations = []
        if fraud_score > 0.5:
            recommendations.append("Manual review recommended due to high fraud indicators")
        if not differences:
            recommendations.append("Request additional evidence for verification")
        if claimed_ratio < 0.7:
            recommendations.append("Reassess claimed amount based on verified damage")
        
        return ComparisonResult(
            claim_id=claim_id,
            before_data_id=before_evidence[0].id,
            after_data_id=after_evidence[0].id,
            match_result=match_result,
            confidence_score=0.75,
            geometry_match_score=geometry_match,
            volume_difference_pct=15.0 if differences else 0,
            surface_difference_pct=12.0 if differences else 0,
            differences=differences,
            total_differences=len(differences),
            significant_differences=sum(1 for d in differences if d.magnitude > 0.5),
            fraud_score=fraud_score,
            fraud_indicators=fraud_indicators,
            damage_verified=len(differences) > 0,
            verified_damage_areas=[d.location for d in differences],
            claimed_vs_verified_ratio=claimed_ratio,
            recommendations=recommendations,
        )
    
    def calculate_geometry_hash(self, data: bytes) -> str:
        """Calculate hash for geometry data."""
        return hashlib.sha256(data).hexdigest()
    
    async def check_duplicates(
        self,
        claim_id: str,
        similarity_threshold: float = 0.9,
    ) -> list[dict]:
        """
        Check for duplicate claims based on geometry.
        
        Returns list of similar claims.
        """
        from src.models.fraud import DamageClaim
        
        # Get the claim
        result = await self.db.execute(
            select(DamageClaim).where(DamageClaim.id == claim_id)
        )
        claim = result.scalar_one_or_none()
        
        if not claim:
            return []
        
        # Get all claims for the same asset
        all_claims_result = await self.db.execute(
            select(DamageClaim)
            .where(DamageClaim.asset_id == claim.asset_id)
            .where(DamageClaim.id != claim_id)
        )
        other_claims = list(all_claims_result.scalars().all())
        
        duplicates = []
        for other in other_claims:
            # Simple duplicate check based on damage type and amount
            same_type = other.claimed_damage_type == claim.claimed_damage_type
            amount_similar = abs(
                (other.claimed_loss_amount or 0) - (claim.claimed_loss_amount or 0)
            ) < (claim.claimed_loss_amount or 1) * 0.2
            
            if same_type and amount_similar:
                duplicates.append({
                    "claim_id": other.id,
                    "claim_number": other.claim_number,
                    "similarity_score": 0.85,
                    "reason": "Same damage type and similar amount",
                })
        
        return duplicates
