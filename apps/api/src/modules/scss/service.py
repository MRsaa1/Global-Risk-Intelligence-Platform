"""SCSS module service layer."""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    Supplier,
    SupplyRoute,
    SupplyChainRisk,
    SupplierType,
    SupplierTier,
    RiskLevel,
)

logger = logging.getLogger(__name__)


class SCSSService:
    """Service for Supply Chain Sovereignty System operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.module_namespace = "scss"
    
    # ==========================================
    # Supplier Management
    # ==========================================
    
    async def register_supplier(
        self,
        name: str,
        supplier_type: str,
        country_code: str = "DE",
        tier: str = "tier_1",
        region: Optional[str] = None,
        city: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        description: Optional[str] = None,
        industry_sector: Optional[str] = None,
        is_critical: bool = False,
        extra_data: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None,
    ) -> Supplier:
        """Register a new supplier."""
        # Generate SCSS ID
        type_prefix = supplier_type.upper().replace("_", "-")[:10]
        scss_id = f"SCSS-{type_prefix}-{country_code.upper()}-{str(uuid4())[:8].upper()}"
        
        supplier = Supplier(
            id=str(uuid4()),
            scss_id=scss_id,
            name=name,
            description=description,
            supplier_type=supplier_type,
            tier=tier,
            country_code=country_code,
            region=region,
            city=city,
            latitude=latitude,
            longitude=longitude,
            industry_sector=industry_sector,
            is_critical=is_critical,
            extra_data=json.dumps(extra_data) if extra_data else None,
            created_at=datetime.utcnow(),
            created_by=created_by,
        )
        
        self.db.add(supplier)
        await self.db.flush()
        
        logger.info(f"Registered supplier: {scss_id} - {name}")
        
        return supplier
    
    async def get_supplier(self, supplier_id: str) -> Optional[Supplier]:
        """Get supplier by ID or SCSS ID."""
        result = await self.db.execute(
            select(Supplier).where(
                (Supplier.id == supplier_id) |
                (Supplier.scss_id == supplier_id)
            )
        )
        return result.scalar_one_or_none()
    
    async def list_suppliers(
        self,
        supplier_type: Optional[str] = None,
        tier: Optional[str] = None,
        country_code: Optional[str] = None,
        is_critical: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Supplier]:
        """List suppliers with optional filters."""
        query = select(Supplier)
        
        if supplier_type:
            query = query.where(Supplier.supplier_type == supplier_type)
        if tier:
            query = query.where(Supplier.tier == tier)
        if country_code:
            query = query.where(Supplier.country_code == country_code)
        if is_critical is not None:
            query = query.where(Supplier.is_critical == is_critical)
        
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def update_supplier(
        self,
        supplier_id: str,
        updates: Dict[str, Any],
    ) -> Optional[Supplier]:
        """Update supplier attributes."""
        supplier = await self.get_supplier(supplier_id)
        if not supplier:
            return None
        
        for key, value in updates.items():
            if hasattr(supplier, key):
                if key == "extra_data" and isinstance(value, dict):
                    value = json.dumps(value)
                setattr(supplier, key, value)
        
        supplier.updated_at = datetime.utcnow()
        await self.db.flush()
        
        return supplier
    
    async def delete_supplier(self, supplier_id: str) -> bool:
        """Delete supplier by ID."""
        supplier = await self.get_supplier(supplier_id)
        if not supplier:
            return False
        
        await self.db.delete(supplier)
        await self.db.flush()
        
        logger.info(f"Deleted supplier: {supplier.scss_id}")
        return True
    
    # ==========================================
    # Supply Route Management
    # ==========================================
    
    async def add_route(
        self,
        source_id: str,
        target_id: str,
        target_type: str = "supplier",
        transport_mode: Optional[str] = None,
        distance_km: Optional[float] = None,
        transit_time_days: Optional[int] = None,
        is_primary: bool = True,
        description: Optional[str] = None,
    ) -> SupplyRoute:
        """Add a supply route between entities."""
        route = SupplyRoute(
            id=str(uuid4()),
            source_id=source_id,
            target_id=target_id,
            target_type=target_type,
            transport_mode=transport_mode,
            distance_km=distance_km,
            transit_time_days=transit_time_days,
            is_primary=is_primary,
            description=description,
            created_at=datetime.utcnow(),
        )
        
        self.db.add(route)
        await self.db.flush()
        
        logger.info(f"Added route: {source_id} -> {target_id}")
        
        return route
    
    async def get_routes(
        self,
        supplier_id: str,
        direction: str = "both",
    ) -> Dict[str, List[SupplyRoute]]:
        """Get routes for a supplier."""
        result = {"outgoing": [], "incoming": []}
        
        if direction in ("outgoing", "both"):
            query = select(SupplyRoute).where(SupplyRoute.source_id == supplier_id)
            outgoing = await self.db.execute(query)
            result["outgoing"] = list(outgoing.scalars().all())
        
        if direction in ("incoming", "both"):
            query = select(SupplyRoute).where(SupplyRoute.target_id == supplier_id)
            incoming = await self.db.execute(query)
            result["incoming"] = list(incoming.scalars().all())
        
        return result
    
    async def delete_route(self, route_id: str) -> bool:
        """Delete a supply route."""
        result = await self.db.execute(
            select(SupplyRoute).where(SupplyRoute.id == route_id)
        )
        route = result.scalar_one_or_none()
        
        if not route:
            return False
        
        await self.db.delete(route)
        await self.db.flush()
        
        return True
    
    # ==========================================
    # Risk Assessment
    # ==========================================
    
    async def create_risk(
        self,
        title: str,
        risk_type: str,
        risk_level: str = "medium",
        description: Optional[str] = None,
        affected_supplier_ids: Optional[List[str]] = None,
        affected_region: Optional[str] = None,
        probability: Optional[float] = None,
        impact_score: Optional[float] = None,
        estimated_loss: Optional[float] = None,
        created_by: Optional[str] = None,
    ) -> SupplyChainRisk:
        """Create a supply chain risk entry."""
        risk = SupplyChainRisk(
            id=str(uuid4()),
            title=title,
            risk_type=risk_type,
            risk_level=risk_level,
            description=description,
            affected_supplier_ids=json.dumps(affected_supplier_ids) if affected_supplier_ids else None,
            affected_region=affected_region,
            probability=probability,
            impact_score=impact_score,
            estimated_loss=estimated_loss,
            identified_at=datetime.utcnow(),
            created_by=created_by,
        )
        
        self.db.add(risk)
        await self.db.flush()
        
        logger.info(f"Created risk: {risk_level} - {title}")
        
        return risk
    
    async def list_risks(
        self,
        risk_level: Optional[str] = None,
        risk_type: Optional[str] = None,
        mitigation_status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[SupplyChainRisk]:
        """List supply chain risks."""
        query = select(SupplyChainRisk)
        
        if risk_level:
            query = query.where(SupplyChainRisk.risk_level == risk_level)
        if risk_type:
            query = query.where(SupplyChainRisk.risk_type == risk_type)
        if mitigation_status:
            query = query.where(SupplyChainRisk.mitigation_status == mitigation_status)
        
        query = query.order_by(SupplyChainRisk.identified_at.desc())
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def calculate_sovereignty_score(
        self,
        supplier_id: str,
    ) -> Dict[str, Any]:
        """Calculate sovereignty score for a supplier."""
        supplier = await self.get_supplier(supplier_id)
        if not supplier:
            return {"error": "Supplier not found"}
        
        # Get routes to calculate dependency
        routes = await self.get_routes(supplier_id)
        
        # Calculate score components
        geo_risk = supplier.geopolitical_risk or 50
        concentration = supplier.concentration_risk or 50
        financial = supplier.financial_stability or 50
        
        # Route diversity factor
        route_count = len(routes["incoming"]) + len(routes["outgoing"])
        route_diversity = min(100, route_count * 20)  # More routes = higher score
        
        # Calculate weighted score
        sovereignty_score = (
            (100 - geo_risk) * 0.3 +
            (100 - concentration) * 0.3 +
            financial * 0.2 +
            route_diversity * 0.2
        )
        
        return {
            "supplier_id": supplier_id,
            "scss_id": supplier.scss_id,
            "name": supplier.name,
            "sovereignty_score": round(sovereignty_score, 2),
            "components": {
                "geopolitical_stability": round(100 - geo_risk, 2),
                "supply_diversification": round(100 - concentration, 2),
                "financial_health": round(financial, 2),
                "route_diversity": round(route_diversity, 2),
            },
            "route_count": route_count,
            "recommendations": self._get_sovereignty_recommendations(sovereignty_score),
        }
    
    def _get_sovereignty_recommendations(self, score: float) -> List[str]:
        """Get recommendations based on sovereignty score."""
        recommendations = []
        
        if score < 30:
            recommendations.append("CRITICAL: Identify alternative suppliers immediately")
            recommendations.append("Conduct emergency supply chain audit")
            recommendations.append("Build strategic reserves")
        elif score < 50:
            recommendations.append("Develop backup supplier relationships")
            recommendations.append("Increase inventory buffers")
            recommendations.append("Monitor geopolitical developments")
        elif score < 70:
            recommendations.append("Continue diversification efforts")
            recommendations.append("Regular supplier assessments")
        else:
            recommendations.append("Maintain current supplier relationships")
            recommendations.append("Periodic review of supply chain health")
        
        return recommendations
    
    # ==========================================
    # Statistics
    # ==========================================
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get SCSS module statistics."""
        # Count by type
        type_counts = await self.db.execute(
            select(
                Supplier.supplier_type,
                func.count(Supplier.id)
            ).group_by(Supplier.supplier_type)
        )
        by_type = {row[0]: row[1] for row in type_counts.fetchall()}
        
        # Count by tier
        tier_counts = await self.db.execute(
            select(
                Supplier.tier,
                func.count(Supplier.id)
            ).group_by(Supplier.tier)
        )
        by_tier = {row[0]: row[1] for row in tier_counts.fetchall()}
        
        # Count by country
        country_counts = await self.db.execute(
            select(
                Supplier.country_code,
                func.count(Supplier.id)
            ).group_by(Supplier.country_code)
        )
        by_country = {row[0]: row[1] for row in country_counts.fetchall()}
        
        # Total counts
        total_suppliers = await self.db.execute(
            select(func.count(Supplier.id))
        )
        supplier_count = total_suppliers.scalar() or 0
        
        total_routes = await self.db.execute(
            select(func.count(SupplyRoute.id))
        )
        route_count = total_routes.scalar() or 0
        
        total_risks = await self.db.execute(
            select(func.count(SupplyChainRisk.id))
        )
        risk_count = total_risks.scalar() or 0
        
        critical_suppliers = await self.db.execute(
            select(func.count(Supplier.id)).where(Supplier.is_critical == True)
        )
        critical_count = critical_suppliers.scalar() or 0
        
        return {
            "total_suppliers": supplier_count,
            "total_routes": route_count,
            "total_risks": risk_count,
            "critical_suppliers": critical_count,
            "by_type": by_type,
            "by_tier": by_tier,
            "by_country": by_country,
        }
