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
    CIPCascadeSimulation,
    InfrastructureType,
    CriticalityLevel,
    OperationalStatus,
)

logger = logging.getLogger(__name__)


def _get_kg():
    """Lazy-import Knowledge Graph service; returns None if disabled or unavailable."""
    try:
        from src.services.knowledge_graph import get_knowledge_graph_service
        kg = get_knowledge_graph_service()
        return kg if kg.is_available else None
    except Exception:
        return None


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
        
        # Sync to Knowledge Graph when Neo4j is enabled
        kg = _get_kg()
        if kg:
            try:
                await kg.create_infrastructure_node(
                    infrastructure.id,
                    name,
                    infrastructure_type,
                    capacity_value,
                    criticality_level=criticality_level,
                    country_code=country_code,
                    region=region,
                    city=city,
                    cip_id=cip_id,
                )
            except Exception as e:
                logger.warning("CIP KG sync (register) failed: %s", e)
        
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
        
        # Sync to Knowledge Graph when Neo4j is enabled
        kg = _get_kg()
        if kg:
            try:
                await kg.create_dependency(
                    source_id,
                    target_id,
                    dependency_type="DEPENDS_ON",
                    criticality=strength,
                )
            except Exception as e:
                logger.warning("CIP KG sync (dependency) failed: %s", e)
        
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

    async def get_graph(
        self,
        limit: int = 500,
    ) -> Dict[str, Any]:
        """
        Return full dependency graph for visualization: nodes (infrastructure) and edges (dependencies).
        """
        infra_list = await self.list_infrastructure(limit=limit, offset=0)
        nodes = [
            {
                "id": i.id,
                "cip_id": i.cip_id,
                "name": i.name,
                "infrastructure_type": i.infrastructure_type,
                "criticality_level": i.criticality_level,
                "operational_status": i.operational_status or "operational",
                "latitude": i.latitude,
                "longitude": i.longitude,
                "country_code": i.country_code,
                "region": i.region,
                "city": i.city,
                "cascade_risk_score": float(i.cascade_risk_score) if i.cascade_risk_score is not None else None,
                "vulnerability_score": float(i.vulnerability_score) if i.vulnerability_score is not None else None,
            }
            for i in infra_list
        ]
        deps_result = await self.db.execute(select(InfrastructureDependency).limit(limit * 2))
        deps_list = list(deps_result.scalars().all())
        edges = [
            {
                "id": d.id,
                "source_id": d.source_id,
                "target_id": d.target_id,
                "strength": float(d.strength),
                "dependency_type": d.dependency_type,
            }
            for d in deps_list
        ]
        return {"nodes": nodes, "edges": edges}

    
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

    async def run_cascade_simulation(
        self,
        initial_failure_ids: List[str],
        time_horizon_hours: int = 72,
        name: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Run cascade simulation with initial failures. BFS + probabilistic propagation.
        Returns timeline, affected_assets, impact_score, recovery_time.
        """
        if not initial_failure_ids:
            return {"error": "At least one initial failure ID required"}
        timeline = []
        affected_set: Dict[str, Dict] = {}
        to_process = [(fid, 0, 0) for fid in initial_failure_ids]
        processed = set()
        step = 0
        current_hour = 0
        while to_process and current_hour < time_horizon_hours:
            step_affected = []
            next_level = []
            for infra_id, depth, delay in to_process:
                if infra_id in processed:
                    continue
                processed.add(infra_id)
                infra = await self.get_infrastructure(infra_id)
                if not infra:
                    continue
                step_affected.append(infra_id)
                affected_set[infra_id] = {"depth": depth, "infrastructure_id": infra_id}
                deps = await self.get_dependencies(infra_id, direction="downstream")
                for dep in deps["downstream"]:
                    if dep.target_id not in processed:
                        prop_delay = dep.propagation_delay_minutes or 60
                        next_level.append((dep.target_id, depth + 1, current_hour * 60 + prop_delay))
            if step_affected:
                timeline.append({
                    "step": step,
                    "hour": round(current_hour, 1),
                    "affected_ids": step_affected,
                    "impact_score": min(100, len(affected_set) * 8),
                })
            to_process = [(tid, d, 0) for tid, d, _ in next_level] if next_level else []
            current_hour += 1
            step += 1
        total_pop = 0
        for aid in affected_set:
            infra = await self.get_infrastructure(aid)
            if infra and getattr(infra, "population_served", None) is not None:
                total_pop += infra.population_served or 0

        impact_score = min(100, len(affected_set) * 10 + total_pop / 10000)
        recovery_hours = current_hour * 1.5 if affected_set else 0

        sim_id = str(uuid4())
        try:
            sim = CIPCascadeSimulation(
                id=sim_id,
                name=name or f"Cascade {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                initial_failure_ids=json.dumps(initial_failure_ids),
                time_horizon_hours=time_horizon_hours,
                timeline=json.dumps(timeline),
                affected_assets=json.dumps(list(affected_set.values())),
                impact_score=impact_score,
                recovery_time_hours=recovery_hours,
                total_affected=len(affected_set),
                population_affected=total_pop,
                created_at=datetime.utcnow(),
                created_by=created_by,
            )
            self.db.add(sim)
            await self.db.flush()
        except Exception as e:
            logger.warning("Failed to store cascade simulation (table may not exist): %s", e)
            try:
                self.db.expunge(sim)
            except Exception:
                pass

        return {
            "id": sim_id,
            "name": name or f"Cascade {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
            "initial_failure_ids": initial_failure_ids,
            "time_horizon_hours": time_horizon_hours,
            "timeline": timeline,
            "affected_assets": list(affected_set.values()),
            "impact_score": impact_score,
            "recovery_time_hours": recovery_hours,
            "total_affected": len(affected_set),
            "population_affected": total_pop,
        }

    async def get_cascade_simulation(self, simulation_id: str) -> Optional[Dict[str, Any]]:
        """Get stored cascade simulation by ID."""
        result = await self.db.execute(
            select(CIPCascadeSimulation).where(CIPCascadeSimulation.id == simulation_id)
        )
        sim = result.scalar_one_or_none()
        if not sim:
            return None
        return {
            "id": sim.id,
            "name": sim.name,
            "initial_failure_ids": json.loads(sim.initial_failure_ids) if sim.initial_failure_ids else [],
            "time_horizon_hours": sim.time_horizon_hours,
            "timeline": json.loads(sim.timeline) if sim.timeline else [],
            "affected_assets": json.loads(sim.affected_assets) if sim.affected_assets else [],
            "impact_score": sim.impact_score,
            "recovery_time_hours": sim.recovery_time_hours,
            "total_affected": sim.total_affected,
            "population_affected": sim.population_affected,
            "created_at": sim.created_at.isoformat() if sim.created_at else None,
        }

    async def list_cascade_simulations(self, limit: int = 20) -> List[Dict[str, Any]]:
        """List recent cascade simulations."""
        try:
            result = await self.db.execute(
                select(CIPCascadeSimulation)
                .order_by(CIPCascadeSimulation.created_at.desc())
                .limit(limit)
            )
            sims = list(result.scalars().all())
        except Exception as e:
            logger.warning("List cascade simulations failed (table may not exist): %s", e)
            return []
        return [
            {
                "id": s.id,
                "name": s.name,
                "total_affected": s.total_affected,
                "impact_score": s.impact_score,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sims
        ]
    
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
