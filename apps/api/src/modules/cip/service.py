"""CIP module service layer."""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    CriticalInfrastructure,
    InfrastructureDependency,
    InfrastructureType,
    CriticalityLevel,
    OperationalStatus,
)

logger = logging.getLogger(__name__)


class CIPService:
    """Service for Critical Infrastructure Protection operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.module_namespace = "cip"
    
    # ==========================================
    # Infrastructure Registration
    # ==========================================
    
    async def register_infrastructure(
        self,
        name: str,
        infrastructure_type: str,
        latitude: float,
        longitude: float,
        criticality_level: str = "tier_3",
        country_code: str = "DE",
        region: Optional[str] = None,
        city: Optional[str] = None,
        description: Optional[str] = None,
        capacity_value: Optional[float] = None,
        capacity_unit: Optional[str] = None,
        population_served: Optional[int] = None,
        owner_organization: Optional[str] = None,
        operator_organization: Optional[str] = None,
        asset_id: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None,
    ) -> CriticalInfrastructure:
        """
        Register a new critical infrastructure asset.
        
        Returns the created infrastructure record.
        """
        # Generate CIP ID
        type_prefix = infrastructure_type.upper().replace("_", "-")[:10]
        cip_id = f"CIP-{type_prefix}-{country_code.upper()}-{str(uuid4())[:8].upper()}"
        
        infrastructure = CriticalInfrastructure(
            id=str(uuid4()),
            cip_id=cip_id,
            name=name,
            description=description,
            asset_id=asset_id,
            infrastructure_type=infrastructure_type,
            criticality_level=criticality_level,
            operational_status=OperationalStatus.OPERATIONAL.value,
            latitude=latitude,
            longitude=longitude,
            country_code=country_code,
            region=region,
            city=city,
            capacity_value=capacity_value,
            capacity_unit=capacity_unit,
            population_served=population_served,
            owner_organization=owner_organization,
            operator_organization=operator_organization,
            extra_data=json.dumps(extra_data) if extra_data else None,
            created_at=datetime.utcnow(),
            created_by=created_by,
        )
        
        self.db.add(infrastructure)
        await self.db.flush()
        
        logger.info(f"Registered infrastructure: {cip_id} - {name}")
        
        return infrastructure
    
    async def get_infrastructure(self, infrastructure_id: str) -> Optional[CriticalInfrastructure]:
        """Get infrastructure by ID or CIP ID."""
        result = await self.db.execute(
            select(CriticalInfrastructure).where(
                (CriticalInfrastructure.id == infrastructure_id) |
                (CriticalInfrastructure.cip_id == infrastructure_id)
            )
        )
        return result.scalar_one_or_none()
    
    async def list_infrastructure(
        self,
        infrastructure_type: Optional[str] = None,
        criticality_level: Optional[str] = None,
        country_code: Optional[str] = None,
        region: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[CriticalInfrastructure]:
        """List infrastructure with optional filters."""
        query = select(CriticalInfrastructure)
        
        if infrastructure_type:
            query = query.where(CriticalInfrastructure.infrastructure_type == infrastructure_type)
        if criticality_level:
            query = query.where(CriticalInfrastructure.criticality_level == criticality_level)
        if country_code:
            query = query.where(CriticalInfrastructure.country_code == country_code)
        if region:
            query = query.where(CriticalInfrastructure.region == region)
        
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def update_infrastructure(
        self,
        infrastructure_id: str,
        updates: Dict[str, Any],
    ) -> Optional[CriticalInfrastructure]:
        """Update infrastructure attributes."""
        infrastructure = await self.get_infrastructure(infrastructure_id)
        if not infrastructure:
            return None
        
        for key, value in updates.items():
            if hasattr(infrastructure, key):
                if key == "extra_data" and isinstance(value, dict):
                    value = json.dumps(value)
                setattr(infrastructure, key, value)
        
        infrastructure.updated_at = datetime.utcnow()
        await self.db.flush()
        
        return infrastructure
    
    async def delete_infrastructure(self, infrastructure_id: str) -> bool:
        """Delete infrastructure by ID."""
        infrastructure = await self.get_infrastructure(infrastructure_id)
        if not infrastructure:
            return False
        
        await self.db.delete(infrastructure)
        await self.db.flush()
        
        logger.info(f"Deleted infrastructure: {infrastructure.cip_id}")
        return True
    
    # ==========================================
    # Dependency Management
    # ==========================================
    
    async def add_dependency(
        self,
        source_id: str,
        target_id: str,
        dependency_type: str = "operational",
        strength: float = 1.0,
        propagation_delay_minutes: Optional[int] = None,
        description: Optional[str] = None,
    ) -> InfrastructureDependency:
        """
        Add a dependency relationship between infrastructure assets.
        
        source_id: upstream infrastructure that target depends on
        target_id: downstream infrastructure that depends on source
        """
        dependency = InfrastructureDependency(
            id=str(uuid4()),
            source_id=source_id,
            target_id=target_id,
            dependency_type=dependency_type,
            strength=strength,
            propagation_delay_minutes=propagation_delay_minutes,
            description=description,
            created_at=datetime.utcnow(),
        )
        
        self.db.add(dependency)
        await self.db.flush()
        
        logger.info(f"Added dependency: {source_id} -> {target_id}")
        
        return dependency
    
    async def get_dependencies(
        self,
        infrastructure_id: str,
        direction: str = "both",  # "upstream", "downstream", "both"
    ) -> Dict[str, List[InfrastructureDependency]]:
        """Get dependencies for an infrastructure asset."""
        result = {"upstream": [], "downstream": []}
        
        if direction in ("upstream", "both"):
            # Infrastructure that this depends on
            query = select(InfrastructureDependency).where(
                InfrastructureDependency.target_id == infrastructure_id
            )
            upstream = await self.db.execute(query)
            result["upstream"] = list(upstream.scalars().all())
        
        if direction in ("downstream", "both"):
            # Infrastructure that depends on this
            query = select(InfrastructureDependency).where(
                InfrastructureDependency.source_id == infrastructure_id
            )
            downstream = await self.db.execute(query)
            result["downstream"] = list(downstream.scalars().all())
        
        return result
    
    async def remove_dependency(self, dependency_id: str) -> bool:
        """Remove a dependency relationship."""
        result = await self.db.execute(
            select(InfrastructureDependency).where(
                InfrastructureDependency.id == dependency_id
            )
        )
        dependency = result.scalar_one_or_none()
        
        if not dependency:
            return False
        
        await self.db.delete(dependency)
        await self.db.flush()
        
        return True
    
    # ==========================================
    # Risk Assessment
    # ==========================================
    
    async def calculate_cascade_risk(
        self,
        infrastructure_id: str,
        depth: int = 3,
    ) -> Dict[str, Any]:
        """
        Calculate cascade risk for an infrastructure asset.
        
        Analyzes the dependency graph to determine potential cascade effects
        if this infrastructure fails.
        """
        infrastructure = await self.get_infrastructure(infrastructure_id)
        if not infrastructure:
            return {"error": "Infrastructure not found"}
        
        # Get all downstream dependencies recursively
        affected = []
        to_process = [infrastructure_id]
        processed = set()
        current_depth = 0
        
        while to_process and current_depth < depth:
            next_level = []
            for infra_id in to_process:
                if infra_id in processed:
                    continue
                processed.add(infra_id)
                
                deps = await self.get_dependencies(infra_id, direction="downstream")
                for dep in deps["downstream"]:
                    if dep.target_id not in processed:
                        next_level.append(dep.target_id)
                        affected.append({
                            "infrastructure_id": dep.target_id,
                            "depth": current_depth + 1,
                            "dependency_strength": dep.strength,
                            "propagation_delay": dep.propagation_delay_minutes,
                        })
            
            to_process = next_level
            current_depth += 1
        
        # Calculate aggregate metrics
        total_population_affected = 0
        for item in affected:
            infra = await self.get_infrastructure(item["infrastructure_id"])
            if infra and infra.population_served:
                total_population_affected += infra.population_served
        
        return {
            "infrastructure_id": infrastructure_id,
            "cip_id": infrastructure.cip_id,
            "name": infrastructure.name,
            "cascade_depth_analyzed": depth,
            "affected_count": len(affected),
            "affected_infrastructure": affected,
            "total_population_at_risk": total_population_affected,
            "cascade_risk_score": min(100, len(affected) * 10 + (total_population_affected / 10000)),
        }
    
    async def get_vulnerability_assessment(
        self,
        infrastructure_id: str,
    ) -> Dict[str, Any]:
        """Get comprehensive vulnerability assessment."""
        infrastructure = await self.get_infrastructure(infrastructure_id)
        if not infrastructure:
            return {"error": "Infrastructure not found"}
        
        deps = await self.get_dependencies(infrastructure_id)
        cascade = await self.calculate_cascade_risk(infrastructure_id)
        
        return {
            "infrastructure_id": infrastructure_id,
            "cip_id": infrastructure.cip_id,
            "name": infrastructure.name,
            "criticality_level": infrastructure.criticality_level,
            "operational_status": infrastructure.operational_status,
            "scores": {
                "vulnerability": infrastructure.vulnerability_score or 50,
                "exposure": infrastructure.exposure_score or 50,
                "resilience": infrastructure.resilience_score or 50,
                "cascade_risk": cascade.get("cascade_risk_score", 0),
            },
            "dependencies": {
                "upstream_count": len(deps["upstream"]),
                "downstream_count": len(deps["downstream"]),
            },
            "recovery": {
                "estimated_hours": infrastructure.estimated_recovery_hours,
                "has_backup": bool(infrastructure.backup_systems),
            },
            "population_served": infrastructure.population_served,
        }
    
    # ==========================================
    # Statistics
    # ==========================================
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get CIP module statistics."""
        # Count by type
        type_counts = await self.db.execute(
            select(
                CriticalInfrastructure.infrastructure_type,
                func.count(CriticalInfrastructure.id)
            ).group_by(CriticalInfrastructure.infrastructure_type)
        )
        by_type = {row[0]: row[1] for row in type_counts.fetchall()}
        
        # Count by criticality
        crit_counts = await self.db.execute(
            select(
                CriticalInfrastructure.criticality_level,
                func.count(CriticalInfrastructure.id)
            ).group_by(CriticalInfrastructure.criticality_level)
        )
        by_criticality = {row[0]: row[1] for row in crit_counts.fetchall()}
        
        # Count by status
        status_counts = await self.db.execute(
            select(
                CriticalInfrastructure.operational_status,
                func.count(CriticalInfrastructure.id)
            ).group_by(CriticalInfrastructure.operational_status)
        )
        by_status = {row[0]: row[1] for row in status_counts.fetchall()}
        
        # Total count
        total = await self.db.execute(
            select(func.count(CriticalInfrastructure.id))
        )
        total_count = total.scalar() or 0
        
        # Dependency count
        dep_total = await self.db.execute(
            select(func.count(InfrastructureDependency.id))
        )
        dep_count = dep_total.scalar() or 0
        
        return {
            "total_infrastructure": total_count,
            "total_dependencies": dep_count,
            "by_type": by_type,
            "by_criticality": by_criticality,
            "by_status": by_status,
        }
