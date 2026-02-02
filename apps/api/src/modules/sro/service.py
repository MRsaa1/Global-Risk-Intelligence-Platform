"""SRO module service layer."""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    FinancialInstitution,
    RiskCorrelation,
    SystemicRiskIndicator,
    InstitutionType,
    SystemicImportance,
    IndicatorType,
)

logger = logging.getLogger(__name__)


class SROService:
    """Service for Systemic Risk Observatory operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.module_namespace = "sro"
    
    # ==========================================
    # Institution Management
    # ==========================================
    
    async def register_institution(
        self,
        name: str,
        institution_type: str,
        country_code: str = "DE",
        systemic_importance: str = "low",
        headquarters_city: Optional[str] = None,
        description: Optional[str] = None,
        total_assets: Optional[float] = None,
        market_cap: Optional[float] = None,
        regulator: Optional[str] = None,
        lei_code: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None,
    ) -> FinancialInstitution:
        """Register a new financial institution."""
        # Generate SRO ID
        type_prefix = institution_type.upper().replace("_", "-")[:10]
        sro_id = f"SRO-{type_prefix}-{country_code.upper()}-{str(uuid4())[:8].upper()}"
        
        institution = FinancialInstitution(
            id=str(uuid4()),
            sro_id=sro_id,
            name=name,
            description=description,
            institution_type=institution_type,
            systemic_importance=systemic_importance,
            country_code=country_code,
            headquarters_city=headquarters_city,
            total_assets=total_assets,
            market_cap=market_cap,
            regulator=regulator,
            lei_code=lei_code,
            extra_data=json.dumps(extra_data) if extra_data else None,
            created_at=datetime.utcnow(),
            created_by=created_by,
        )
        
        self.db.add(institution)
        await self.db.flush()
        
        logger.info(f"Registered institution: {sro_id} - {name}")
        
        return institution
    
    async def get_institution(self, institution_id: str) -> Optional[FinancialInstitution]:
        """Get institution by ID or SRO ID."""
        result = await self.db.execute(
            select(FinancialInstitution).where(
                (FinancialInstitution.id == institution_id) |
                (FinancialInstitution.sro_id == institution_id)
            )
        )
        return result.scalar_one_or_none()
    
    async def list_institutions(
        self,
        institution_type: Optional[str] = None,
        systemic_importance: Optional[str] = None,
        country_code: Optional[str] = None,
        under_stress: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[FinancialInstitution]:
        """List institutions with optional filters."""
        query = select(FinancialInstitution)
        
        if institution_type:
            query = query.where(FinancialInstitution.institution_type == institution_type)
        if systemic_importance:
            query = query.where(FinancialInstitution.systemic_importance == systemic_importance)
        if country_code:
            query = query.where(FinancialInstitution.country_code == country_code)
        if under_stress is not None:
            query = query.where(FinancialInstitution.under_stress == under_stress)
        
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def update_institution(
        self,
        institution_id: str,
        updates: Dict[str, Any],
    ) -> Optional[FinancialInstitution]:
        """Update institution attributes."""
        institution = await self.get_institution(institution_id)
        if not institution:
            return None
        
        for key, value in updates.items():
            if hasattr(institution, key):
                if key == "extra_data" and isinstance(value, dict):
                    value = json.dumps(value)
                setattr(institution, key, value)
        
        institution.updated_at = datetime.utcnow()
        await self.db.flush()
        
        return institution
    
    async def delete_institution(self, institution_id: str) -> bool:
        """Delete institution by ID."""
        institution = await self.get_institution(institution_id)
        if not institution:
            return False
        
        await self.db.delete(institution)
        await self.db.flush()
        
        logger.info(f"Deleted institution: {institution.sro_id}")
        return True
    
    # ==========================================
    # Correlation Management
    # ==========================================
    
    async def add_correlation(
        self,
        institution_a_id: str,
        institution_b_id: str,
        correlation_coefficient: float,
        relationship_type: str = "counterparty",
        exposure_amount: Optional[float] = None,
        contagion_probability: Optional[float] = None,
        description: Optional[str] = None,
    ) -> RiskCorrelation:
        """Add a risk correlation between institutions."""
        correlation = RiskCorrelation(
            id=str(uuid4()),
            institution_a_id=institution_a_id,
            institution_b_id=institution_b_id,
            correlation_coefficient=correlation_coefficient,
            relationship_type=relationship_type,
            exposure_amount=exposure_amount,
            contagion_probability=contagion_probability,
            description=description,
            calculation_date=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
        
        self.db.add(correlation)
        await self.db.flush()
        
        logger.info(f"Added correlation: {institution_a_id} <-> {institution_b_id}")
        
        return correlation
    
    async def get_correlations(
        self,
        institution_id: str,
    ) -> List[RiskCorrelation]:
        """Get all correlations for an institution."""
        result = await self.db.execute(
            select(RiskCorrelation).where(
                (RiskCorrelation.institution_a_id == institution_id) |
                (RiskCorrelation.institution_b_id == institution_id)
            )
        )
        return list(result.scalars().all())
    
    async def delete_correlation(self, correlation_id: str) -> bool:
        """Delete a correlation."""
        result = await self.db.execute(
            select(RiskCorrelation).where(RiskCorrelation.id == correlation_id)
        )
        correlation = result.scalar_one_or_none()
        
        if not correlation:
            return False
        
        await self.db.delete(correlation)
        await self.db.flush()
        
        return True
    
    # ==========================================
    # Indicator Management
    # ==========================================
    
    async def record_indicator(
        self,
        indicator_type: str,
        indicator_name: str,
        value: float,
        scope: str = "market",
        institution_id: Optional[str] = None,
        previous_value: Optional[float] = None,
        warning_threshold: Optional[float] = None,
        critical_threshold: Optional[float] = None,
        data_source: Optional[str] = None,
    ) -> SystemicRiskIndicator:
        """Record a systemic risk indicator value."""
        # Calculate change
        change_pct = None
        if previous_value and previous_value != 0:
            change_pct = ((value - previous_value) / abs(previous_value)) * 100
        
        # Check if threshold is breached
        is_breached = False
        if critical_threshold and value >= critical_threshold:
            is_breached = True
        elif warning_threshold and value >= warning_threshold:
            is_breached = True
        
        indicator = SystemicRiskIndicator(
            id=str(uuid4()),
            indicator_type=indicator_type,
            indicator_name=indicator_name,
            value=value,
            previous_value=previous_value,
            change_pct=change_pct,
            scope=scope,
            institution_id=institution_id,
            warning_threshold=warning_threshold,
            critical_threshold=critical_threshold,
            is_breached=is_breached,
            observation_date=datetime.utcnow(),
            data_source=data_source,
            created_at=datetime.utcnow(),
        )
        
        self.db.add(indicator)
        await self.db.flush()
        
        if is_breached:
            logger.warning(f"Threshold breached: {indicator_name} = {value}")
        
        return indicator
    
    async def get_latest_indicators(
        self,
        indicator_type: Optional[str] = None,
        scope: Optional[str] = None,
        institution_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[SystemicRiskIndicator]:
        """Get latest indicator readings."""
        query = select(SystemicRiskIndicator)
        
        if indicator_type:
            query = query.where(SystemicRiskIndicator.indicator_type == indicator_type)
        if scope:
            query = query.where(SystemicRiskIndicator.scope == scope)
        if institution_id:
            query = query.where(SystemicRiskIndicator.institution_id == institution_id)
        
        query = query.order_by(SystemicRiskIndicator.observation_date.desc())
        query = query.limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_breached_indicators(self) -> List[SystemicRiskIndicator]:
        """Get all currently breached indicators."""
        result = await self.db.execute(
            select(SystemicRiskIndicator)
            .where(SystemicRiskIndicator.is_breached == True)
            .order_by(SystemicRiskIndicator.observation_date.desc())
        )
        return list(result.scalars().all())
    
    # ==========================================
    # Risk Assessment
    # ==========================================
    
    async def calculate_systemic_risk_score(
        self,
        institution_id: str,
    ) -> Dict[str, Any]:
        """Calculate systemic risk score for an institution."""
        institution = await self.get_institution(institution_id)
        if not institution:
            return {"error": "Institution not found"}
        
        # Get correlations
        correlations = await self.get_correlations(institution_id)
        
        # Calculate components
        contagion = institution.contagion_risk or 50
        interconnectedness = institution.interconnectedness_score or 50
        leverage = min(100, (institution.leverage_ratio or 10) * 5)
        
        # Network effect based on correlations
        network_exposure = 0
        for corr in correlations:
            network_exposure += abs(corr.correlation_coefficient) * (corr.exposure_amount or 0)
        
        # Normalize network exposure
        if institution.total_assets and institution.total_assets > 0:
            network_risk = min(100, (network_exposure / institution.total_assets) * 100)
        else:
            network_risk = len(correlations) * 10  # Fallback
        
        # Calculate weighted score
        systemic_score = (
            contagion * 0.25 +
            interconnectedness * 0.25 +
            leverage * 0.25 +
            network_risk * 0.25
        )
        
        return {
            "institution_id": institution_id,
            "sro_id": institution.sro_id,
            "name": institution.name,
            "systemic_risk_score": round(systemic_score, 2),
            "systemic_importance": institution.systemic_importance,
            "components": {
                "contagion_risk": round(contagion, 2),
                "interconnectedness": round(interconnectedness, 2),
                "leverage_contribution": round(leverage, 2),
                "network_risk": round(network_risk, 2),
            },
            "correlations_count": len(correlations),
            "under_stress": institution.under_stress,
            "risk_level": self._get_risk_level(systemic_score),
        }
    
    def _get_risk_level(self, score: float) -> str:
        """Convert score to risk level."""
        if score >= 75:
            return "critical"
        elif score >= 50:
            return "high"
        elif score >= 25:
            return "medium"
        return "low"
    
    async def get_contagion_analysis(
        self,
        institution_id: str,
        depth: int = 2,
    ) -> Dict[str, Any]:
        """Analyze potential contagion spread from an institution."""
        institution = await self.get_institution(institution_id)
        if not institution:
            return {"error": "Institution not found"}
        
        # Build contagion tree
        affected = []
        to_process = [institution_id]
        processed = set()
        current_depth = 0
        
        while to_process and current_depth < depth:
            next_level = []
            for inst_id in to_process:
                if inst_id in processed:
                    continue
                processed.add(inst_id)
                
                correlations = await self.get_correlations(inst_id)
                for corr in correlations:
                    # Get the other institution
                    other_id = corr.institution_b_id if corr.institution_a_id == inst_id else corr.institution_a_id
                    
                    if other_id not in processed:
                        next_level.append(other_id)
                        
                        # Get other institution details
                        other_inst = await self.get_institution(other_id)
                        if other_inst:
                            affected.append({
                                "institution_id": other_id,
                                "sro_id": other_inst.sro_id,
                                "name": other_inst.name,
                                "depth": current_depth + 1,
                                "correlation": corr.correlation_coefficient,
                                "exposure": corr.exposure_amount,
                                "contagion_probability": corr.contagion_probability,
                            })
            
            to_process = next_level
            current_depth += 1
        
        # Calculate aggregate impact
        total_exposure = sum(a.get("exposure") or 0 for a in affected)
        
        return {
            "source_institution": {
                "id": institution_id,
                "sro_id": institution.sro_id,
                "name": institution.name,
            },
            "analysis_depth": depth,
            "affected_count": len(affected),
            "total_exposure_at_risk": total_exposure,
            "affected_institutions": affected,
            "contagion_risk_score": min(100, len(affected) * 15 + (total_exposure / 1_000_000_000) * 10),
        }
    
    # ==========================================
    # Statistics
    # ==========================================
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get SRO module statistics."""
        # Count by type
        type_counts = await self.db.execute(
            select(
                FinancialInstitution.institution_type,
                func.count(FinancialInstitution.id)
            ).group_by(FinancialInstitution.institution_type)
        )
        by_type = {row[0]: row[1] for row in type_counts.fetchall()}
        
        # Count by systemic importance
        importance_counts = await self.db.execute(
            select(
                FinancialInstitution.systemic_importance,
                func.count(FinancialInstitution.id)
            ).group_by(FinancialInstitution.systemic_importance)
        )
        by_importance = {row[0]: row[1] for row in importance_counts.fetchall()}
        
        # Total counts
        total_institutions = await self.db.execute(
            select(func.count(FinancialInstitution.id))
        )
        institution_count = total_institutions.scalar() or 0
        
        total_correlations = await self.db.execute(
            select(func.count(RiskCorrelation.id))
        )
        correlation_count = total_correlations.scalar() or 0
        
        total_indicators = await self.db.execute(
            select(func.count(SystemicRiskIndicator.id))
        )
        indicator_count = total_indicators.scalar() or 0
        
        breached_indicators = await self.db.execute(
            select(func.count(SystemicRiskIndicator.id))
            .where(SystemicRiskIndicator.is_breached == True)
        )
        breached_count = breached_indicators.scalar() or 0
        
        stressed_institutions = await self.db.execute(
            select(func.count(FinancialInstitution.id))
            .where(FinancialInstitution.under_stress == True)
        )
        stressed_count = stressed_institutions.scalar() or 0
        
        return {
            "total_institutions": institution_count,
            "total_correlations": correlation_count,
            "total_indicators": indicator_count,
            "breached_indicators": breached_count,
            "institutions_under_stress": stressed_count,
            "by_type": by_type,
            "by_systemic_importance": by_importance,
        }
