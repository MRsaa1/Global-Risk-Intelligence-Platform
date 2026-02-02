"""
Knowledge Graph Service - Network Intelligence Layer.

Manages the Neo4j knowledge graph for:
- Asset dependencies
- Infrastructure relationships
- Cascade risk modeling
- Hidden exposure discovery
"""
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from neo4j import AsyncGraphDatabase

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class GraphNode:
    """Represents a node in the knowledge graph."""
    id: str
    label: str  # Asset, Infrastructure, Entity, etc.
    properties: dict


@dataclass
class GraphRelationship:
    """Represents a relationship in the knowledge graph."""
    source_id: str
    target_id: str
    relationship_type: str  # DEPENDS_ON, SUPPLIES_TO, etc.
    properties: dict


@dataclass
class CascadeResult:
    """Result of cascade simulation."""
    trigger_event: str
    affected_nodes: list[str]
    total_exposure: float
    cascade_depth: int
    timeline: list[dict]


class KnowledgeGraphService:
    """
    Service for managing the Knowledge Graph (Neo4j).
    
    Layer 2: Network Intelligence
    
    Key capabilities:
    - Model dependencies between assets and infrastructure
    - Discover hidden exposures
    - Simulate cascade failures
    - Calculate network risk scores
    """
    
    def __init__(self):
        self.driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )

    @property
    def is_available(self) -> bool:
        """
        Config-based availability.

        Important:
        - We do NOT attempt a connection here, to avoid hammering Neo4j with
          bad credentials (can trigger AuthenticationRateLimit).
        - Health/Overseer can run a lightweight query *only when enabled*.
        """
        if not getattr(settings, "enable_neo4j", False):
            return False
        if not (settings.neo4j_uri and settings.neo4j_user and settings.neo4j_password):
            return False
        return True
    
    async def close(self):
        """Close the driver connection."""
        await self.driver.close()
    
    # ==================== NODE OPERATIONS ====================
    
    async def create_asset_node(
        self,
        asset_id: UUID,
        name: str,
        asset_type: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        valuation: Optional[float] = None,
        **properties,
    ) -> GraphNode:
        """Create or update an Asset node in the graph."""
        async with self.driver.session() as session:
            query = """
            MERGE (a:Asset {id: $id})
            SET a.name = $name,
                a.asset_type = $asset_type,
                a.latitude = $latitude,
                a.longitude = $longitude,
                a.valuation = $valuation,
                a.updated_at = datetime()
            SET a += $properties
            RETURN a
            """
            result = await session.run(
                query,
                id=str(asset_id),
                name=name,
                asset_type=asset_type,
                latitude=latitude,
                longitude=longitude,
                valuation=valuation,
                properties=properties,
            )
            record = await result.single()
            node_data = dict(record["a"])
            
            return GraphNode(
                id=node_data["id"],
                label="Asset",
                properties=node_data,
            )
    
    async def create_infrastructure_node(
        self,
        infra_id: str,
        name: str,
        infra_type: str,  # power_grid, water, telecom, transport
        capacity: Optional[float] = None,
        **properties,
    ) -> GraphNode:
        """Create or update an Infrastructure node."""
        async with self.driver.session() as session:
            query = """
            MERGE (i:Infrastructure {id: $id})
            SET i.name = $name,
                i.infra_type = $infra_type,
                i.capacity = $capacity,
                i.updated_at = datetime()
            SET i += $properties
            RETURN i
            """
            result = await session.run(
                query,
                id=infra_id,
                name=name,
                infra_type=infra_type,
                capacity=capacity,
                properties=properties,
            )
            record = await result.single()
            node_data = dict(record["i"])
            
            return GraphNode(
                id=node_data["id"],
                label="Infrastructure",
                properties=node_data,
            )
    
    # ==================== RELATIONSHIP OPERATIONS ====================
    
    async def create_dependency(
        self,
        source_id: str,
        target_id: str,
        dependency_type: str = "DEPENDS_ON",
        criticality: float = 0.5,
        **properties,
    ) -> GraphRelationship:
        """
        Create a dependency relationship between nodes.
        
        Args:
            source_id: ID of the dependent node
            target_id: ID of the node being depended on
            dependency_type: Type of dependency (DEPENDS_ON, SUPPLIES_TO, etc.)
            criticality: How critical this dependency is (0-1)
        """
        async with self.driver.session() as session:
            query = f"""
            MATCH (source {{id: $source_id}})
            MATCH (target {{id: $target_id}})
            MERGE (source)-[r:{dependency_type}]->(target)
            SET r.criticality = $criticality,
                r.created_at = datetime()
            SET r += $properties
            RETURN source.id as source, target.id as target, type(r) as rel_type
            """
            result = await session.run(
                query,
                source_id=source_id,
                target_id=target_id,
                criticality=criticality,
                properties=properties,
            )
            record = await result.single()
            
            return GraphRelationship(
                source_id=record["source"],
                target_id=record["target"],
                relationship_type=record["rel_type"],
                properties={"criticality": criticality, **properties},
            )
    
    # ==================== QUERY OPERATIONS ====================
    
    async def get_dependencies(
        self,
        asset_id: str,
        depth: int = 3,
    ) -> list[dict]:
        """
        Get all dependencies for an asset up to specified depth.
        
        Returns the full dependency tree.
        """
        async with self.driver.session() as session:
            query = """
            MATCH path = (a:Asset {id: $asset_id})-[:DEPENDS_ON*1..$depth]->(dep)
            RETURN 
                [node in nodes(path) | {id: node.id, name: node.name, labels: labels(node)}] as nodes,
                [rel in relationships(path) | {type: type(rel), criticality: rel.criticality}] as relationships,
                length(path) as depth
            """
            result = await session.run(query, asset_id=asset_id, depth=depth)
            
            dependencies = []
            async for record in result:
                dependencies.append({
                    "nodes": record["nodes"],
                    "relationships": record["relationships"],
                    "depth": record["depth"],
                })
            
            return dependencies
    
    async def find_hidden_exposures(
        self,
        portfolio_ids: list[str],
        exposure_type: str = "infrastructure",
    ) -> list[dict]:
        """
        Find hidden exposures across a portfolio.
        
        Discovers shared dependencies that create correlated risk.
        
        Example: Multiple assets depending on the same power grid sector.
        """
        async with self.driver.session() as session:
            query = """
            MATCH (a:Asset)-[:DEPENDS_ON*1..3]->(shared:Infrastructure)
            WHERE a.id IN $portfolio_ids
            WITH shared, collect(distinct a) as dependent_assets
            WHERE size(dependent_assets) > 1
            RETURN 
                shared.id as infrastructure_id,
                shared.name as infrastructure_name,
                shared.infra_type as type,
                [a in dependent_assets | {id: a.id, name: a.name, valuation: a.valuation}] as exposed_assets,
                size(dependent_assets) as asset_count,
                reduce(total = 0.0, a in dependent_assets | total + coalesce(a.valuation, 0)) as total_exposure
            ORDER BY total_exposure DESC
            """
            result = await session.run(query, portfolio_ids=portfolio_ids)
            
            exposures = []
            async for record in result:
                exposures.append({
                    "infrastructure_id": record["infrastructure_id"],
                    "infrastructure_name": record["infrastructure_name"],
                    "type": record["type"],
                    "exposed_assets": record["exposed_assets"],
                    "asset_count": record["asset_count"],
                    "total_exposure": record["total_exposure"],
                })
            
            return exposures
    
    async def simulate_cascade(
        self,
        trigger_node_id: str,
        failure_threshold: float = 0.7,
        time_steps: int = 12,
    ) -> CascadeResult:
        """
        Simulate cascade failure propagation through the network.
        
        Args:
            trigger_node_id: ID of the initially failing node
            failure_threshold: Stress threshold that triggers failure
            time_steps: Number of time steps to simulate
            
        Returns:
            CascadeResult with affected nodes and timeline
        """
        async with self.driver.session() as session:
            # Get downstream nodes
            query = """
            MATCH path = (trigger {id: $trigger_id})<-[:DEPENDS_ON*1..5]-(affected)
            RETURN 
                affected.id as node_id,
                affected.name as node_name,
                labels(affected)[0] as node_type,
                affected.valuation as valuation,
                length(path) as cascade_depth,
                [rel in relationships(path) | rel.criticality] as criticalities
            ORDER BY cascade_depth
            """
            result = await session.run(query, trigger_id=trigger_node_id)
            
            affected_nodes = []
            total_exposure = 0.0
            max_depth = 0
            timeline = []
            
            async for record in result:
                # Calculate cascading impact based on criticalities
                criticalities = record["criticalities"]
                impact_factor = 1.0
                for crit in criticalities:
                    impact_factor *= (crit or 0.5)
                
                if impact_factor >= (1 - failure_threshold):
                    affected_nodes.append(record["node_id"])
                    valuation = record["valuation"] or 0
                    total_exposure += valuation * impact_factor
                    max_depth = max(max_depth, record["cascade_depth"])
                    
                    timeline.append({
                        "time_step": record["cascade_depth"],
                        "node_id": record["node_id"],
                        "node_name": record["node_name"],
                        "impact_factor": impact_factor,
                        "exposure": valuation * impact_factor,
                    })
            
            return CascadeResult(
                trigger_event=trigger_node_id,
                affected_nodes=affected_nodes,
                total_exposure=total_exposure,
                cascade_depth=max_depth,
                timeline=sorted(timeline, key=lambda x: x["time_step"]),
            )
    
    async def calculate_network_risk_score(
        self,
        asset_id: str,
    ) -> dict:
        """
        Calculate network risk score for an asset.
        
        Considers:
        - Number of dependencies
        - Criticality of dependencies
        - Redundancy (alternative paths)
        - Centrality in the network
        """
        async with self.driver.session() as session:
            query = """
            MATCH (a:Asset {id: $asset_id})
            
            // Count direct dependencies
            OPTIONAL MATCH (a)-[dep:DEPENDS_ON]->(direct)
            WITH a, count(direct) as direct_deps, collect(dep.criticality) as criticalities
            
            // Count indirect dependencies (depth 2-3)
            OPTIONAL MATCH (a)-[:DEPENDS_ON*2..3]->(indirect)
            WITH a, direct_deps, criticalities, count(distinct indirect) as indirect_deps
            
            // Count dependents (who depends on this asset)
            OPTIONAL MATCH (dependent)-[:DEPENDS_ON*1..2]->(a)
            WITH a, direct_deps, criticalities, indirect_deps, count(distinct dependent) as dependents
            
            RETURN {
                asset_id: a.id,
                direct_dependencies: direct_deps,
                indirect_dependencies: indirect_deps,
                dependents: dependents,
                avg_criticality: CASE WHEN size(criticalities) > 0 
                    THEN reduce(sum = 0.0, c in criticalities | sum + coalesce(c, 0.5)) / size(criticalities)
                    ELSE 0.0 END,
                network_score: (direct_deps * 10 + indirect_deps * 5 + dependents * 3) * 
                    CASE WHEN size(criticalities) > 0 
                        THEN reduce(sum = 0.0, c in criticalities | sum + coalesce(c, 0.5)) / size(criticalities)
                        ELSE 0.5 END
            } as metrics
            """
            result = await session.run(query, asset_id=asset_id)
            record = await result.single()
            
            if record:
                metrics = record["metrics"]
                # Normalize score to 0-100
                raw_score = metrics.get("network_score", 0)
                normalized_score = min(100, raw_score * 2)
                
                return {
                    "asset_id": asset_id,
                    "network_risk_score": normalized_score,
                    "direct_dependencies": metrics.get("direct_dependencies", 0),
                    "indirect_dependencies": metrics.get("indirect_dependencies", 0),
                    "dependents": metrics.get("dependents", 0),
                    "avg_criticality": metrics.get("avg_criticality", 0),
                }
            
            return {
                "asset_id": asset_id,
                "network_risk_score": 0,
                "direct_dependencies": 0,
                "indirect_dependencies": 0,
                "dependents": 0,
                "avg_criticality": 0,
            }

    async def get_related_entities(
        self,
        entity_name_or_id: str,
        max_depth: int = 2,
        limit: int = 20,
    ) -> list[dict]:
        """
        Find nodes by name or id and return related entities (neighbors via DEPENDS_ON, SUPPLIES_TO).
        Used for stress test execute: enrich report and LLM context with graph context.
        """
        if not entity_name_or_id or not entity_name_or_id.strip():
            return []
        query_param = entity_name_or_id.strip()
        async with self.driver.session() as session:
            # Find node(s) by id or name contains (case-insensitive)
            find_query = """
            MATCH (n)
            WHERE n.id = $query OR toLower(toString(n.name)) CONTAINS toLower($query)
            WITH n LIMIT 1
            OPTIONAL MATCH (n)-[r:DEPENDS_ON|SUPPLIES_TO]-(related)
            WHERE type(r) IN ['DEPENDS_ON', 'SUPPLIES_TO']
            RETURN related.id as id, related.name as name,
                   labels(related)[0] as label, type(r) as rel_type
            LIMIT $limit
            """
            result = await session.run(
                find_query,
                query=query_param,
                limit=limit,
            )
            seen = set()
            related = []
            async for record in result:
                rid = record.get("id")
                if rid and rid not in seen:
                    seen.add(rid)
                    related.append({
                        "id": rid,
                        "name": record.get("name") or rid,
                        "label": record.get("label") or "Entity",
                        "relationship_type": record.get("rel_type") or "RELATED",
                    })
            return related

    async def get_entity_by_name_or_id(self, entity_name_or_id: str) -> Optional[dict]:
        """
        Find a single node by name or id. Returns labels and properties for ontology/KG classification.
        """
        if not entity_name_or_id or not entity_name_or_id.strip():
            return None
        query_param = entity_name_or_id.strip()
        async with self.driver.session() as session:
            q = """
            MATCH (n)
            WHERE n.id = $query OR toLower(toString(n.name)) CONTAINS toLower($query)
            RETURN n, labels(n) as labels
            LIMIT 1
            """
            result = await session.run(q, query=query_param)
            record = await result.single()
            if not record:
                return None
            node = record["n"]
            labels_list = record["labels"] or []
            return {
                "id": node.get("id"),
                "name": node.get("name"),
                "labels": labels_list,
                "asset_type": node.get("asset_type"),
                "infra_type": node.get("infra_type"),
            }
    
    # ==================== INITIALIZATION ====================
    
    async def initialize_schema(self):
        """Create indexes and constraints for optimal performance."""
        async with self.driver.session() as session:
            # Create indexes
            await session.run("CREATE INDEX asset_id IF NOT EXISTS FOR (a:Asset) ON (a.id)")
            await session.run("CREATE INDEX infra_id IF NOT EXISTS FOR (i:Infrastructure) ON (i.id)")
            await session.run("CREATE INDEX entity_id IF NOT EXISTS FOR (e:Entity) ON (e.id)")
            
            # Create constraints
            await session.run(
                "CREATE CONSTRAINT asset_unique IF NOT EXISTS FOR (a:Asset) REQUIRE a.id IS UNIQUE"
            )
            await session.run(
                "CREATE CONSTRAINT infra_unique IF NOT EXISTS FOR (i:Infrastructure) REQUIRE i.id IS UNIQUE"
            )
            
            logger.info("Knowledge Graph schema initialized")
    
    async def seed_sample_data(self):
        """Seed sample infrastructure data for development."""
        async with self.driver.session() as session:
            # Create sample infrastructure nodes
            await session.run("""
                MERGE (p1:Infrastructure {id: 'power_grid_sector_7'})
                SET p1.name = 'Power Grid Sector 7',
                    p1.infra_type = 'power_grid',
                    p1.capacity = 500.0,
                    p1.region = 'Munich'
                    
                MERGE (p2:Infrastructure {id: 'power_grid_sector_12'})
                SET p2.name = 'Power Grid Sector 12',
                    p2.infra_type = 'power_grid',
                    p2.capacity = 350.0,
                    p2.region = 'Berlin'
                    
                MERGE (w1:Infrastructure {id: 'water_district_a'})
                SET w1.name = 'Water District A',
                    w1.infra_type = 'water',
                    w1.capacity = 1000.0
                    
                MERGE (t1:Infrastructure {id: 'telecom_hub_central'})
                SET t1.name = 'Central Telecom Hub',
                    t1.infra_type = 'telecom',
                    t1.capacity = 10000.0
            """)
            
            logger.info("Sample infrastructure data seeded")
    
    async def clear_all(self):
        """
        Clear all nodes and relationships from the knowledge graph.
        
        WARNING: This is destructive and should only be used in development.
        """
        async with self.driver.session() as session:
            # Delete all nodes and relationships
            result = await session.run("MATCH (n) DETACH DELETE n RETURN count(n) as deleted")
            record = await result.single()
            deleted_count = record["deleted"] if record else 0
            logger.info(f"Cleared {deleted_count} nodes from Knowledge Graph")
            return deleted_count


# Global service instance (lazy initialization)
_knowledge_graph_service: Optional[KnowledgeGraphService] = None


def get_knowledge_graph_service() -> KnowledgeGraphService:
    """Get or create the knowledge graph service."""
    global _knowledge_graph_service
    if _knowledge_graph_service is None:
        _knowledge_graph_service = KnowledgeGraphService()
    return _knowledge_graph_service
