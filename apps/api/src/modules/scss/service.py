"""SCSS module service layer."""
import json
import logging
from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    Supplier,
    SupplyRoute,
    SupplyChain,
    SupplyChainRisk,
    SupplierType,
    SupplierTier,
    RiskLevel,
    AuditLog,
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


class SCSSService:
    """Service for Supply Chain Sovereignty System operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.module_namespace = "scss"

    async def log_audit(
        self,
        entity_type: str,
        entity_id: Optional[str],
        action: str,
        changed_by: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Phase 6: Write audit trail entry (supplier, route, risk, scenario, export)."""
        entry = AuditLog(
            id=str(uuid4()),
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            changed_by=changed_by,
            changed_at=datetime.utcnow(),
            details_json=json.dumps(details) if details else None,
        )
        self.db.add(entry)
        await self.db.flush()
    
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
        materials: Optional[List[str]] = None,
        capacity: Optional[int] = None,
        lead_time_days: Optional[int] = None,
        geopolitical_risk: Optional[float] = None,
        extra_data: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None,
    ) -> Supplier:
        """Register a new supplier (FR-SCSS-001)."""
        # Merge materials/capacity into extra_data for storage (no schema change)
        merged_extra = dict(extra_data) if extra_data else {}
        if materials is not None:
            merged_extra["materials"] = materials
        if capacity is not None:
            merged_extra["capacity"] = capacity
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
            lead_time_days=lead_time_days,
            geopolitical_risk=geopolitical_risk,
            extra_data=json.dumps(merged_extra) if merged_extra else None,
            created_at=datetime.utcnow(),
            created_by=created_by,
        )
        
        self.db.add(supplier)
        await self.db.flush()
        await self.log_audit("supplier", supplier.id, "create", created_by, {"scss_id": scss_id, "name": name})
        
        logger.info(f"Registered supplier: {scss_id} - {name}")
        
        # Sync to Knowledge Graph when Neo4j is enabled
        kg = _get_kg()
        if kg:
            try:
                await kg.create_supplier_node(
                    supplier.id,
                    name,
                    supplier_type,
                    tier=tier,
                    country_code=country_code,
                    scss_id=scss_id,
                    region=region,
                    city=city,
                )
            except Exception as e:
                logger.warning("SCSS KG sync (register) failed: %s", e)
        
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
        
        # materials/capacity stored in extra_data
        materials = updates.pop("materials", None)
        capacity = updates.pop("capacity", None)
        if materials is not None or capacity is not None:
            extra = json.loads(supplier.extra_data) if supplier.extra_data else {}
            if materials is not None:
                extra["materials"] = materials
            if capacity is not None:
                extra["capacity"] = capacity
            # Merge with any extra_data passed in updates
            if "extra_data" in updates and isinstance(updates["extra_data"], dict):
                extra.update(updates["extra_data"])
            updates["extra_data"] = json.dumps(extra)
        
        for key, value in updates.items():
            if hasattr(supplier, key):
                if key == "extra_data" and isinstance(value, dict):
                    value = json.dumps(value)
                setattr(supplier, key, value)
        
        supplier.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.log_audit("supplier", supplier_id, "update", updates.get("updated_by"), {"updates": list(updates.keys())})
        
        return supplier
    
    async def delete_supplier(self, supplier_id: str) -> bool:
        """Delete supplier by ID."""
        supplier = await self.get_supplier(supplier_id)
        if not supplier:
            return False
        scss_id, name = supplier.scss_id, supplier.name
        await self.log_audit("supplier", supplier_id, "delete", None, {"scss_id": scss_id, "name": name})
        await self.db.delete(supplier)
        await self.db.flush()
        
        logger.info(f"Deleted supplier: {scss_id}")
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
        
        # Sync SUPPLIES_TO to Knowledge Graph when both source and target are suppliers
        kg = _get_kg()
        if kg:
            try:
                source_supplier = await self.get_supplier(source_id)
                target_supplier = await self.get_supplier(target_id)
                if source_supplier and target_supplier:
                    criticality = 0.8 if is_primary else 0.5
                    await kg.create_dependency(
                        source_id,
                        target_id,
                        dependency_type="SUPPLIES_TO",
                        criticality=criticality,
                        transit_time_days=transit_time_days,
                        transport_mode=transport_mode,
                    )
            except Exception as e:
                logger.warning("SCSS KG sync (route) failed: %s", e)
        
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
    # Bottleneck Analysis
    # ==========================================
    
    async def analyze_bottlenecks(
        self,
        supplier_ids: Optional[List[str]] = None,
        min_geopolitical_risk: float = 70.0,
    ) -> Dict[str, Any]:
        """
        Identify supply chain bottlenecks.
        
        Bottleneck types:
        - single_point_of_failure: supplier is the only source for one or more targets
        - high_geopolitical_critical: high geopolitical risk and marked critical
        - concentration: only supplier in country for this supplier_type
        
        Returns list of bottlenecks with supplier_id, risk_type, bottleneck_score,
        affected_downstream_count, and recommendations.
        """
        # Load suppliers (filter by supplier_ids if provided)
        query = select(Supplier)
        if supplier_ids:
            query = query.where(Supplier.id.in_(supplier_ids))
        suppliers_result = await self.db.execute(query)
        suppliers = list(suppliers_result.scalars().all())
        supplier_map = {s.id: s for s in suppliers}
        
        if not suppliers:
            return {
                "bottlenecks": [],
                "total_suppliers_analyzed": 0,
                "summary": {"critical": 0, "high": 0, "medium": 0},
            }
        
        # Load all routes involving these suppliers
        ids = [s.id for s in suppliers]
        routes_result = await self.db.execute(
            select(SupplyRoute).where(
                (SupplyRoute.source_id.in_(ids)) | (SupplyRoute.target_id.in_(ids))
            )
        )
        routes = list(routes_result.scalars().all())
        
        # Build graph: outgoing[source_id] -> [(target_id, route_id)], target_sources[target_id] -> set(source_ids)
        outgoing: Dict[str, List[tuple]] = {}
        target_sources: Dict[str, set] = {}
        for r in routes:
            outgoing.setdefault(r.source_id, []).append((r.target_id, r.id))
            target_sources.setdefault(r.target_id, set()).add(r.source_id)
        
        # Count suppliers per (country_code, supplier_type) for concentration
        country_type_count: Dict[tuple, int] = {}
        for s in suppliers:
            key = (s.country_code or "", s.supplier_type or "other")
            country_type_count[key] = country_type_count.get(key, 0) + 1
        
        bottlenecks: List[Dict[str, Any]] = []
        
        for s in suppliers:
            risk_types: List[str] = []
            score_components: List[float] = []
            affected_downstream = 0
            
            # Single point of failure: this supplier is the only source for some target(s)
            out_list = outgoing.get(s.id, [])
            for target_id, _ in out_list:
                if target_sources.get(target_id) == {s.id}:
                    risk_types.append("single_point_of_failure")
                    affected_downstream += 1
                    score_components.append(0.9)
                    break
            if not any(rt == "single_point_of_failure" for rt in risk_types) and out_list:
                # Has downstream but not single point
                affected_downstream = len(out_list)
            
            # High geopolitical + critical
            geo_risk = s.geopolitical_risk or 0
            if geo_risk >= min_geopolitical_risk and s.is_critical:
                risk_types.append("high_geopolitical_critical")
                score_components.append(0.85)
            
            # Concentration: only supplier in country for this type
            key = (s.country_code or "", s.supplier_type or "other")
            if country_type_count.get(key, 0) == 1:
                risk_types.append("concentration")
                score_components.append(0.6)
            
            if not risk_types:
                continue
            
            bottleneck_score = min(1.0, sum(score_components) / len(score_components) + 0.1 * len(risk_types))
            severity = "critical" if bottleneck_score >= 0.8 else "high" if bottleneck_score >= 0.6 else "medium"
            
            recommendations: List[str] = []
            if "single_point_of_failure" in risk_types:
                recommendations.append("Identify alternative suppliers for downstream nodes")
            if "high_geopolitical_critical" in risk_types:
                recommendations.append("Diversify geography; reduce dependence on high-risk region")
            if "concentration" in risk_types:
                recommendations.append("Add suppliers in same category from other regions")
            
            bottlenecks.append({
                "supplier_id": s.id,
                "scss_id": s.scss_id,
                "name": s.name,
                "country_code": s.country_code,
                "supplier_type": s.supplier_type,
                "risk_types": risk_types,
                "bottleneck_score": round(bottleneck_score, 3),
                "severity": severity,
                "affected_downstream_count": affected_downstream,
                "geopolitical_risk": geo_risk,
                "is_critical": s.is_critical,
                "recommendations": recommendations,
            })
        
        # Sort by score descending
        bottlenecks.sort(key=lambda x: -x["bottleneck_score"])
        
        summary = {"critical": 0, "high": 0, "medium": 0}
        for b in bottlenecks:
            summary[b["severity"]] = summary.get(b["severity"], 0) + 1
        
        # Diversification score: 1 - (single_points / total_suppliers); higher = more diversified
        spof_count = sum(1 for b in bottlenecks if "single_point_of_failure" in b["risk_types"])
        diversification_score = round(max(0, 1.0 - (spof_count / max(1, len(suppliers)))), 3)
        
        return {
            "bottlenecks": bottlenecks,
            "total_suppliers_analyzed": len(suppliers),
            "summary": summary,
            "bottleneck_score": round(sum(b["bottleneck_score"] for b in bottlenecks) / max(1, len(bottlenecks)), 3) if bottlenecks else 0.0,
            "diversification_score": diversification_score,
        }
    
    # ==========================================
    # Alternative Supplier Recommendations (SCSS_ADVISOR)
    # ==========================================
    
    async def find_alternative_suppliers(
        self,
        supplier_id: str,
        limit: int = 10,
        prefer_different_country: bool = True,
        same_supplier_type: bool = True,
    ) -> Dict[str, Any]:
        """
        Find alternative suppliers for a given supplier (SCSS_ADVISOR logic).
        
        Ranks alternatives by: lower geopolitical risk, different country (if requested),
        same or similar supplier_type, financial stability, sovereignty score.
        """
        supplier = await self.get_supplier(supplier_id)
        if not supplier:
            return {"error": "Supplier not found", "alternatives": []}
        
        # All other suppliers (exclude self)
        query = select(Supplier).where(
            Supplier.id != supplier.id,
            Supplier.is_active == True,
        )
        if same_supplier_type and supplier.supplier_type:
            query = query.where(Supplier.supplier_type == supplier.supplier_type)
        
        result = await self.db.execute(query)
        candidates = list(result.scalars().all())
        
        if not candidates:
            return {
                "supplier_id": supplier_id,
                "scss_id": supplier.scss_id,
                "name": supplier.name,
                "alternatives": [],
                "message": "No alternative suppliers found for this type/criteria.",
            }
        
        # Score each candidate (higher = better alternative)
        def score_alternative(c: Supplier) -> float:
            score = 0.0
            # Prefer lower geopolitical risk
            geo = c.geopolitical_risk or 50
            score += (100 - geo) * 0.3
            # Prefer different country (diversification)
            if prefer_different_country and (c.country_code or "") != (supplier.country_code or ""):
                score += 25
            # Prefer higher sovereignty / financial stability
            score += (c.sovereignty_score or 50) * 0.2
            score += (c.financial_stability or 50) * 0.15
            # Prefer has_alternative = False (they are not themselves a bottleneck)
            if not c.has_alternative:
                score += 10
            return score
        
        scored = [(c, score_alternative(c)) for c in candidates]
        scored.sort(key=lambda x: -x[1])
        top = scored[:limit]
        
        alternatives = []
        for c, sc in top:
            pros: List[str] = []
            cons: List[str] = []
            if (c.geopolitical_risk or 100) < (supplier.geopolitical_risk or 100):
                pros.append("Lower geopolitical risk")
            if prefer_different_country and (c.country_code or "") != (supplier.country_code or ""):
                pros.append("Geographic diversification")
            if (c.sovereignty_score or 0) > (supplier.sovereignty_score or 0):
                pros.append("Higher sovereignty score")
            if c.lead_time_days is not None and supplier.lead_time_days is not None and c.lead_time_days > supplier.lead_time_days:
                cons.append(f"Longer lead time (+{c.lead_time_days - supplier.lead_time_days} days)")
            
            alternatives.append({
                "supplier_id": c.id,
                "scss_id": c.scss_id,
                "name": c.name,
                "country_code": c.country_code,
                "supplier_type": c.supplier_type,
                "score": round(sc, 2),
                "geopolitical_risk": c.geopolitical_risk,
                "sovereignty_score": c.sovereignty_score,
                "lead_time_days": c.lead_time_days,
                "pros": pros or ["Potential alternative"],
                "cons": cons,
            })
        
        return {
            "supplier_id": supplier_id,
            "scss_id": supplier.scss_id,
            "name": supplier.name,
            "alternatives": alternatives,
        }
    
    # ==========================================
    # Supply Chains CRUD (FR-SCSS-002)
    # ==========================================

    async def create_supply_chain(
        self,
        name: str,
        root_supplier_id: str,
        description: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> Optional[SupplyChain]:
        """Create a named supply chain."""
        root = await self.get_supplier(root_supplier_id)
        if not root:
            return None
        chain = SupplyChain(
            id=str(uuid4()),
            name=name,
            root_supplier_id=root_supplier_id,
            description=description,
            created_at=datetime.utcnow(),
            created_by=created_by,
        )
        self.db.add(chain)
        await self.db.flush()
        return chain

    async def list_supply_chains(self, limit: int = 50) -> List[Dict[str, Any]]:
        """List supply chains."""
        result = await self.db.execute(
            select(SupplyChain).order_by(SupplyChain.created_at.desc()).limit(limit)
        )
        chains = list(result.scalars().all())
        return [
            {"id": c.id, "name": c.name, "root_supplier_id": c.root_supplier_id, "description": c.description}
            for c in chains
        ]

    async def get_supply_chain(self, chain_id: str) -> Optional[SupplyChain]:
        """Get supply chain by ID."""
        result = await self.db.execute(select(SupplyChain).where(SupplyChain.id == chain_id))
        return result.scalar_one_or_none()
    
    # ==========================================
    # Supply Chain Mapping (FR-SCSS-002)
    # ==========================================
    
    async def map_supply_chain(
        self,
        root_supplier_id: str,
        max_tiers: int = 5,
        max_nodes: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Build multi-tier supply chain graph from a root node (BFS over incoming edges).
        
        Returns nodes by tier, edges, and geographic/concentration summary.
        """
        root = await self.get_supplier(root_supplier_id)
        if not root:
            return {"error": "Root supplier not found", "nodes": [], "edges": []}
        
        # Load all routes (incoming: target_id = X means X is supplied by source_id)
        routes_result = await self.db.execute(select(SupplyRoute))
        routes = list(routes_result.scalars().all())
        
        # incoming[node_id] -> list of (source_id, route)
        incoming: Dict[str, List[Tuple[str, SupplyRoute]]] = {}
        for r in routes:
            incoming.setdefault(r.target_id, []).append((r.source_id, r))
        
        # BFS from root (backward: who supplies root, then who supplies them, ...)
        visited: Set[str] = set()
        tier_list: Dict[int, List[str]] = {0: [root.id]}
        visited.add(root.id)
        queue: deque[Tuple[str, int]] = deque([(root.id, 0)])
        
        while queue:
            if max_nodes is not None and len(visited) >= max_nodes:
                break
            node_id, tier = queue.popleft()
            if tier >= max_tiers:
                continue
            for source_id, route in incoming.get(node_id, []):
                if source_id not in visited:
                    if max_nodes is not None and len(visited) >= max_nodes:
                        break
                    visited.add(source_id)
                    tier_list.setdefault(tier + 1, []).append(source_id)
                    queue.append((source_id, tier + 1))
        
        # Load all supplier details for visited nodes
        if not visited:
            visited.add(root.id)
        suppliers_result = await self.db.execute(
            select(Supplier).where(Supplier.id.in_(visited))
        )
        suppliers = {s.id: s for s in suppliers_result.scalars().all()}
        
        nodes: List[Dict[str, Any]] = []
        for t in sorted(tier_list.keys()):
            for sid in tier_list[t]:
                s = suppliers.get(sid)
                if not s:
                    continue
                nodes.append({
                    "id": s.id,
                    "scss_id": s.scss_id,
                    "name": s.name,
                    "tier": t,
                    "supplier_type": s.supplier_type,
                    "country_code": s.country_code,
                    "region": s.region,
                    "city": s.city,
                    "geopolitical_risk": s.geopolitical_risk,
                    "is_critical": s.is_critical,
                    "latitude": s.latitude,
                    "longitude": s.longitude,
                    "lead_time_days": s.lead_time_days,
                })
        
        # Edges that are part of this graph (source and target in visited)
        edges: List[Dict[str, Any]] = []
        for r in routes:
            if r.source_id in visited and r.target_id in visited:
                edges.append({
                    "id": r.id,
                    "source_id": r.source_id,
                    "target_id": r.target_id,
                    "transport_mode": r.transport_mode,
                    "transit_time_days": r.transit_time_days,
                    "is_primary": r.is_primary,
                })
        
        # Geographic concentration summary
        country_counts: Dict[str, int] = {}
        for sid in visited:
            s = suppliers.get(sid)
            if s and s.country_code:
                country_counts[s.country_code] = country_counts.get(s.country_code, 0) + 1
        total = len(visited)
        geographic_summary = [
            {"country_code": cc, "supplier_count": cnt, "share_pct": round(100 * cnt / total, 1)}
            for cc, cnt in sorted(country_counts.items(), key=lambda x: -x[1])
        ]
        
        # Phase 2: chain metrics (SPOF, critical bottlenecks, resilience)
        bottleneck_result = await self.analyze_bottlenecks(supplier_ids=list(visited))
        bottlenecks_list = bottleneck_result.get("bottlenecks", [])
        single_points_of_failure = [
            b["supplier_id"] for b in bottlenecks_list
            if "single_point_of_failure" in b.get("risk_types", [])
        ]
        critical_bottlenecks_count = bottleneck_result.get("summary", {}).get("critical", 0)
        diversification_score = bottleneck_result.get("diversification_score") or 0.0
        herfindahl = sum((g["share_pct"] / 100.0) ** 2 for g in geographic_summary) if geographic_summary else 0.0
        geographic_spread = max(0.0, 1.0 - herfindahl)
        resilience_score = round(0.5 * diversification_score + 0.5 * geographic_spread, 3)
        
        return {
            "root_supplier_id": root_supplier_id,
            "root_name": root.name,
            "max_tiers": max_tiers,
            "total_nodes": len(visited),
            "total_edges": len(edges),
            "nodes": nodes,
            "edges": edges,
            "tiers": {str(k): tier_list[k] for k in sorted(tier_list.keys())},
            "geographic_summary": geographic_summary,
            "single_points_of_failure": single_points_of_failure,
            "critical_bottlenecks_count": critical_bottlenecks_count,
            "resilience_score": resilience_score,
        }
    
    # ==========================================
    # Geopolitical Simulation (FR-SCSS-006)
    # ==========================================
    
    async def run_geopolitical_simulation(
        self,
        scenario: str,
        scenario_params: Optional[Dict[str, Any]] = None,
        root_supplier_id: Optional[str] = None,
        supplier_ids: Optional[List[str]] = None,
        duration_months: int = 12,
    ) -> Dict[str, Any]:
        """
        Run a geopolitical scenario on the supply chain (Phase 4: scope, timeline, mitigation).
        
        Scenarios: trade_war (tariff), sanctions (country cutoff), disaster (capacity loss).
        Returns impact, recovery_plan, cost_analysis, timeline, mitigation_strategies.
        """
        params = scenario_params or {}
        cascade = params.get("cascade", True)
        country_codes_param = params.get("country_codes") or ([params.get("country_code")] if params.get("country_code") else None)
        
        # Resolve scope: explicit supplier_ids > root_chain > all
        if supplier_ids:
            suppliers_result = await self.db.execute(
                select(Supplier).where(Supplier.id.in_(supplier_ids), Supplier.is_active == True)
            )
            suppliers = list(suppliers_result.scalars().all())
        elif root_supplier_id:
            chain = await self.map_supply_chain(root_supplier_id, max_tiers=10)
            if "error" in chain:
                return {"error": chain["error"], "impact": {}, "recovery_plan": [], "cost_analysis": {}, "timeline": [], "mitigation_strategies": []}
            ids = {n["id"] for n in chain.get("nodes", [])}
            suppliers_result = await self.db.execute(
                select(Supplier).where(Supplier.id.in_(ids))
            )
            suppliers = list(suppliers_result.scalars().all())
        else:
            suppliers_result = await self.db.execute(select(Supplier).where(Supplier.is_active == True))
            suppliers = list(suppliers_result.scalars().all())
        
        if not suppliers:
            return {
                "scenario": scenario,
                "impact": {"affected_suppliers": 0, "message": "No suppliers in scope"},
                "recovery_plan": ["Add suppliers and re-run simulation"],
                "cost_analysis": {"estimated_cost_increase_pct": 0, "estimated_revenue_impact_usd": 0},
                "timeline": [{"month": m, "capacity_pct": 100.0} for m in range(1, duration_months + 1)],
                "mitigation_strategies": [],
            }
        
        affected: List[Dict[str, Any]] = []
        cost_increase_pct = 0.0
        capacity_loss_pct = 0.0
        
        if scenario == "trade_war":
            # Tariff on target country/countries
            target_countries = [c.upper() for c in (country_codes_param or ["CN"]) if c]
            if not target_countries:
                target_countries = ["CN"]
            tariff_pct = float(params.get("tariff_pct", 25))
            for s in suppliers:
                if (s.country_code or "").upper() in target_countries:
                    share = 1.0 / max(1, len(suppliers))  # simplistic: equal share
                    cost_increase_pct += share * min(100, tariff_pct)
                    affected.append({
                        "supplier_id": s.id,
                        "scss_id": s.scss_id,
                        "name": s.name,
                        "country_code": s.country_code,
                        "impact": f"Tariff {tariff_pct}% applied",
                    })
        
        elif scenario == "sanctions":
            # Country cutoff (immediate)
            target_countries = [c.upper() for c in (country_codes_param or ["RU"]) if c]
            if not target_countries:
                target_countries = ["RU"]
            for s in suppliers:
                if (s.country_code or "").upper() in target_countries:
                    affected.append({
                        "supplier_id": s.id,
                        "scss_id": s.scss_id,
                        "name": s.name,
                        "country_code": s.country_code,
                        "impact": "Supplier cutoff (sanctions)",
                    })
            if affected:
                # Assume 100% cost of replacement + delay
                cost_increase_pct = min(100, 35.0)  # e.g. 35% BOM from affected
                capacity_loss_pct = 100.0 * len(affected) / max(1, len(suppliers))
        
        elif scenario == "disaster":
            # Capacity loss by severity (e.g. region or country)
            severity = float(params.get("severity", 7))  # 1-10
            target_region = (params.get("region") or params.get("country_code") or "").upper()
            for s in suppliers:
                match = (target_region and (s.region or s.country_code or "").upper() == target_region) or (
                    not target_region and (s.geopolitical_risk or 0) >= 70
                )
                if match:
                    loss = min(100, severity * 10)
                    capacity_loss_pct += loss / max(1, len(suppliers))
                    affected.append({
                        "supplier_id": s.id,
                        "scss_id": s.scss_id,
                        "name": s.name,
                        "country_code": s.country_code,
                        "impact": f"Capacity loss ~{loss:.0f}%",
                    })
        
        else:
            return {"error": f"Unknown scenario: {scenario}", "supported": ["trade_war", "sanctions", "disaster"]}
        
        # Demo fallback: when scope is a chain and no supplier matched the region, mark one supplier as affected
        # so the UI can show impact and red routes on the map (avoids all-zeros mock result).
        demo_fallback = False
        if not affected and suppliers and (root_supplier_id or supplier_ids):
            demo_fallback = True
            # Pick first supplier that is not the root (so at least one link can be red on the map)
            root_id = root_supplier_id or (supplier_ids[0] if supplier_ids else None)
            candidate = next((s for s in suppliers if s.id != root_id), suppliers[0])
            affected.append({
                "supplier_id": candidate.id,
                "scss_id": candidate.scss_id,
                "name": candidate.name,
                "country_code": candidate.country_code,
                "impact": "Simulated as affected for demo (no supplier in scope matched selected region)",
            })
            cost_increase_pct = min(100, 18.0)
            capacity_loss_pct = 100.0 * len(affected) / max(1, len(suppliers))
        
        # Recovery plan
        recovery_plan: List[str] = []
        if scenario == "trade_war":
            recovery_plan.append("Diversify sourcing to non-target countries")
            recovery_plan.append("Negotiate long-term contracts with alternative suppliers")
        elif scenario == "sanctions":
            recovery_plan.append("Identify and qualify alternative suppliers immediately")
            recovery_plan.append("Activate contingency inventory if available")
            recovery_plan.append("Communicate with customers on lead time impact")
        elif scenario == "disaster":
            recovery_plan.append("Activate backup suppliers in unaffected regions")
            recovery_plan.append("Increase safety stock for critical components")
        
        # Cost analysis (simplified)
        estimated_revenue_impact = 0.0
        if affected:
            estimated_revenue_impact = cost_increase_pct * 1e6  # placeholder $1M base
        
        # Phase 4: timeline (capacity % by month)
        timeline: List[Dict[str, Any]] = []
        if cascade and duration_months > 0:
            drop = min(100, capacity_loss_pct + cost_increase_pct * 0.3)  # combined effect
            recovery_end = max(1, duration_months * 2 // 3)  # recover by 2/3 of horizon
            for month in range(1, duration_months + 1):
                if month == 1:
                    cap = max(0, 100 - drop)
                elif month <= recovery_end:
                    cap = max(0, 100 - drop + (drop * (month - 1) / recovery_end))
                else:
                    cap = min(100, 100 - drop * 0.35)  # partial long-term recovery
                timeline.append({"month": month, "capacity_pct": round(cap, 1)})
        else:
            cap = max(0, 100 - min(100, capacity_loss_pct))
            for month in range(1, duration_months + 1):
                timeline.append({"month": month, "capacity_pct": round(cap, 1)})
        
        # Phase 4: mitigation strategies (cost, impact reduction, ROI placeholder)
        mitigation_strategies: List[Dict[str, Any]] = []
        for i, rec in enumerate(recovery_plan[:5]):
            cost = (2.0 + i) * 1e6  # placeholder $2M–$6M
            impact_red = max(10, 60 - i * 10)
            mitigation_strategies.append({
                "name": rec,
                "cost_usd": int(cost),
                "impact_reduction_pct": impact_red,
                "roi": round(estimated_revenue_impact / cost, 2) if cost > 0 else 0,
            })
        
        # KPI impact: lead time, price, financial result (for frontend "Расчёт последствий")
        time_to_critical = 90 if scenario == "sanctions" else 180
        if scenario == "sanctions":
            lead_time_delay_days = min(120, 30 + len(affected) * 8)  # switch suppliers
        elif scenario == "trade_war":
            lead_time_delay_days = min(60, 15 + len(affected) * 5)   # reroute / renegotiate
        else:
            lead_time_delay_days = min(90, 20 + len(affected) * 10)  # disaster recovery
        recovery_month = next((t["month"] for t in timeline if (t.get("capacity_pct") or 0) >= 80), duration_months)
        margin_impact_pct = -min(100, cost_increase_pct * 0.7) if cost_increase_pct else 0  # rough margin drag
        kpi_impact = {
            "lead_time_delay_days": lead_time_delay_days,
            "lead_time_impact": f"+{lead_time_delay_days} days (est. delivery delay)",
            "cost_increase_pct": round(cost_increase_pct, 2),
            "price_impact": f"+{round(cost_increase_pct, 1)}% BOM / cost of supply",
            "revenue_impact_usd": round(estimated_revenue_impact, 0),
            "margin_impact_pct": round(margin_impact_pct, 2),
            "financial_summary": f"Revenue impact ≈ ${abs(estimated_revenue_impact):,.0f}; margin drag ≈ {abs(margin_impact_pct):.1f}%",
            "time_to_critical_days": time_to_critical,
            "time_to_recovery_months": recovery_month,
            "capacity_loss_pct": round(capacity_loss_pct, 2),
            "affected_suppliers_count": len(affected),
        }
        
        return {
            "scenario": scenario,
            "duration_months": duration_months,
            "params": params,
            "demo_fallback": demo_fallback,
            "impact": {
                "affected_suppliers": len(affected),
                "affected_list": affected,
                "cost_increase_pct": round(cost_increase_pct, 2),
                "capacity_loss_pct": round(capacity_loss_pct, 2),
            },
            "kpi_impact": kpi_impact,
            "recovery_plan": recovery_plan,
            "cost_analysis": {
                "estimated_cost_increase_pct": round(cost_increase_pct, 2),
                "estimated_revenue_impact_usd": round(estimated_revenue_impact, 0),
                "time_to_critical_days": time_to_critical,
            },
            "timeline": timeline,
            "mitigation_strategies": mitigation_strategies,
        }
    
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

    async def get_executive_report_data(self, root_supplier_id: Optional[str] = None) -> Dict[str, Any]:
        """Phase 6: Build data for executive report (health score, top risks, recommendations)."""
        stats = await self.get_statistics()
        bottleneck_result = await self.analyze_bottlenecks()
        bottlenecks = bottleneck_result.get("bottlenecks", [])[:10]
        diversification_score = bottleneck_result.get("diversification_score") or 0.0
        # Recent scenario runs from audit log
        audit_r = await self.db.execute(
            select(AuditLog)
            .where(AuditLog.entity_type == "scenario", AuditLog.action == "simulate")
            .order_by(AuditLog.changed_at.desc())
            .limit(5)
        )
        recent_scenarios = []
        for row in audit_r.scalars().all():
            recent_scenarios.append({
                "at": row.changed_at.isoformat() if row.changed_at else None,
                "entity_id": row.entity_id,
                "details": json.loads(row.details_json) if row.details_json else {},
            })
        # Health score: combination of diversification, critical ratio, risk count
        total = max(1, stats.get("total_suppliers", 0))
        critical = stats.get("critical_suppliers", 0)
        risk_count = stats.get("total_risks", 0)
        health_score = round(
            diversification_score * 50
            + max(0, 50 - critical / total * 30 - min(risk_count * 2, 20)),
            1,
        )
        health_score = max(0, min(100, health_score))
        recommendations: List[str] = []
        if diversification_score < 0.5:
            recommendations.append("Increase supplier diversification to reduce single points of failure.")
        if bottlenecks:
            recommendations.append(f"Address {len(bottlenecks)} identified bottlenecks; consider alternative sourcing.")
        if critical / total > 0.2:
            recommendations.append("Review concentration of critical suppliers; diversify where possible.")
        if not recommendations:
            recommendations.append("Maintain current monitoring and periodic scenario analysis.")
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "health_score": health_score,
            "total_suppliers": stats.get("total_suppliers", 0),
            "total_routes": stats.get("total_routes", 0),
            "total_risks": stats.get("total_risks", 0),
            "critical_suppliers": stats.get("critical_suppliers", 0),
            "diversification_score": diversification_score,
            "top_risks": [
                {"name": b.get("name"), "scss_id": b.get("scss_id"), "risk_types": b.get("risk_types"), "bottleneck_score": b.get("bottleneck_score")}
                for b in bottlenecks
            ],
            "recent_scenarios": recent_scenarios,
            "recommendations": recommendations,
            "by_country": stats.get("by_country", {}),
            "present_url": "/present?context=scss&report=executive",
        }
