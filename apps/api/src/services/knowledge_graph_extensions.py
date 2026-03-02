"""
Knowledge Graph Extensions - GraphRAG causal chain extensions.

Extends the knowledge graph with causal chains and entanglement edges.
Kept separate from knowledge_graph.py to avoid modifying the large core file.
"""
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class CausalChain:
    """Causal chain from cause through effects to future risks."""
    chain_id: str
    cause_event: Dict[str, Any] = field(default_factory=dict)
    effects: List[Dict[str, Any]] = field(default_factory=list)
    future_risks: List[Dict[str, Any]] = field(default_factory=list)
    confidence: float = 0.8
    horizon_years: int = 30


class GraphRAGService:
    """
    GraphRAG extensions for causal chains and domain entanglement.
    
    Stores and queries causal links, chains, and cross-domain correlations.
    Uses knowledge graph when available, otherwise in-memory storage.
    """

    def __init__(self, knowledge_graph=None):
        self._kg = knowledge_graph
        self._causal_links: List[Dict[str, Any]] = []
        self._entanglement_edges: Dict[str, List[Dict[str, Any]]] = {}

    def _get_kg(self):
        """Lazy load KnowledgeGraphService."""
        if self._kg is None:
            try:
                from src.services.knowledge_graph import get_knowledge_graph_service
                self._kg = get_knowledge_graph_service()
            except ImportError as e:
                logger.debug(f"Knowledge graph unavailable: {e}")
        return self._kg

    async def store_causal_link(
        self,
        cause_event: Dict[str, Any],
        effect: Dict[str, Any],
        future_risk: Optional[Dict[str, Any]] = None,
        confidence: float = 0.8,
    ) -> str:
        """
        Store a causal link (cause -> effect -> future_risk).

        Args:
            cause_event: Cause event dict
            effect: Effect dict
            future_risk: Optional future risk dict
            confidence: Confidence score 0-1

        Returns:
            ID of stored link
        """
        link_id = str(uuid.uuid4())
        record = {
            "id": link_id,
            "cause_event": cause_event,
            "effect": effect,
            "future_risk": future_risk or {},
            "confidence": confidence,
        }
        self._causal_links.append(record)

        kg = self._get_kg()
        if kg is not None and getattr(kg, "is_available", False):
            try:
                # Store in Neo4j if KG supports causal relationships
                if hasattr(kg, "run_query"):
                    await kg.run_query(
                        """
                        MERGE (c:CausalLink {id: $id})
                        SET c.cause = $cause, c.effect = $effect,
                            c.future_risk = $future_risk, c.confidence = $confidence
                        """,
                        {
                            "id": link_id,
                            "cause": str(cause_event),
                            "effect": str(effect),
                            "future_risk": str(future_risk or {}),
                            "confidence": confidence,
                        },
                    )
            except Exception as e:
                logger.debug(f"KG causal link storage failed: {e}")

        return link_id

    async def query_causal_chains(
        self,
        asset_id: str,
        horizon_years: int = 30,
    ) -> List[CausalChain]:
        """
        Find all causal chains affecting an asset within horizon.

        Args:
            asset_id: Asset ID to query
            horizon_years: Time horizon in years

        Returns:
            List of CausalChain
        """
        kg = self._get_kg()
        chains: List[CausalChain] = []

        # In-memory: filter links that might affect this asset
        for link in self._causal_links:
            effect = link.get("effect", {})
            cause = link.get("cause_event", {})
            if (
                effect.get("asset_id") == asset_id
                or cause.get("asset_id") == asset_id
                or asset_id in str(effect)
                or asset_id in str(cause)
            ):
                chains.append(CausalChain(
                    chain_id=link.get("id", str(uuid.uuid4())),
                    cause_event=cause,
                    effects=[effect],
                    future_risks=[link.get("future_risk", {})] if link.get("future_risk") else [],
                    confidence=link.get("confidence", 0.8),
                    horizon_years=horizon_years,
                ))

        if kg is not None and getattr(kg, "is_available", False) and hasattr(kg, "run_query"):
            try:
                result = await kg.run_query(
                    """
                    MATCH path = (a {id: $asset_id})-[:CAUSES*1..5]->(e)
                    RETURN path
                    LIMIT 50
                    """,
                    {"asset_id": asset_id},
                )
                if result and hasattr(result, "data"):
                    for record in getattr(result, "data", result):
                        chains.append(CausalChain(
                            chain_id=str(uuid.uuid4()),
                            cause_event=record.get("cause", {}),
                            effects=record.get("effects", []),
                            future_risks=[],
                            confidence=0.7,
                            horizon_years=horizon_years,
                        ))
            except Exception as e:
                logger.debug(f"KG causal chain query failed: {e}")

        return chains[:50]

    async def query_similar_historical_chains(
        self,
        current_conditions: Dict[str, Any],
    ) -> List[CausalChain]:
        """
        Find historical causal chains matching current conditions.

        Args:
            current_conditions: Dict describing current state

        Returns:
            List of matching CausalChain
        """
        chains: List[CausalChain] = []
        cond_str = str(current_conditions).lower()

        for link in self._causal_links:
            cause_str = str(link.get("cause_event", {})).lower()
            effect_str = str(link.get("effect", {})).lower()
            if cond_str in cause_str or cond_str in effect_str:
                chains.append(CausalChain(
                    chain_id=link.get("id", str(uuid.uuid4())),
                    cause_event=link.get("cause_event", {}),
                    effects=[link.get("effect", {})],
                    future_risks=[link.get("future_risk", {})] if link.get("future_risk") else [],
                    confidence=link.get("confidence", 0.8),
                    horizon_years=30,
                ))

        return chains[:20]

    async def store_entanglement_edge(
        self,
        domain_a: str,
        domain_b: str,
        coefficient: float,
        mechanism: str,
    ) -> str:
        """
        Store cross-domain correlation/entanglement.

        Args:
            domain_a: First domain
            domain_b: Second domain
            coefficient: Correlation strength -1 to 1
            mechanism: Description of how they are linked

        Returns:
            Edge ID
        """
        edge_id = str(uuid.uuid4())
        edge = {
            "id": edge_id,
            "domain_a": domain_a,
            "domain_b": domain_b,
            "coefficient": coefficient,
            "mechanism": mechanism,
        }
        key = min(domain_a, domain_b)
        self._entanglement_edges.setdefault(key, []).append(edge)
        self._entanglement_edges.setdefault(max(domain_a, domain_b), []).append(edge)

        kg = self._get_kg()
        if kg is not None and getattr(kg, "is_available", False) and hasattr(kg, "run_query"):
            try:
                await kg.run_query(
                    """
                    MERGE (a:Domain {name: $domain_a})
                    MERGE (b:Domain {name: $domain_b})
                    MERGE (a)-[r:ENTANGLED_WITH]-(b)
                    SET r.coefficient = $coef, r.mechanism = $mechanism, r.id = $id
                    """,
                    {
                        "domain_a": domain_a,
                        "domain_b": domain_b,
                        "coef": coefficient,
                        "mechanism": mechanism,
                        "id": edge_id,
                    },
                )
            except Exception as e:
                logger.debug(f"KG entanglement storage failed: {e}")

        return edge_id

    async def query_entangled_domains(self, domain: str) -> List[Dict[str, Any]]:
        """
        Get all domains entangled with the given domain.

        Args:
            domain: Domain name to query

        Returns:
            List of dicts with domain, coefficient, mechanism
        """
        edges = self._entanglement_edges.get(domain, [])
        results = []
        seen = set()
        for e in edges:
            other = e["domain_b"] if e["domain_a"] == domain else e["domain_a"]
            if other not in seen:
                seen.add(other)
                results.append({
                    "domain": other,
                    "coefficient": e.get("coefficient", 0),
                    "mechanism": e.get("mechanism", ""),
                })

        kg = self._get_kg()
        if kg is not None and getattr(kg, "is_available", False) and hasattr(kg, "run_query"):
            try:
                result = await kg.run_query(
                    """
                    MATCH (d:Domain {name: $domain})-[r:ENTANGLED_WITH]-(other:Domain)
                    RETURN other.name as domain, r.coefficient as coefficient, r.mechanism as mechanism
                    """,
                    {"domain": domain},
                )
                if result and hasattr(result, "data"):
                    for rec in getattr(result, "data", result):
                        if isinstance(rec, dict) and rec.get("domain") not in seen:
                            results.append(rec)
            except Exception as e:
                logger.debug(f"KG entanglement query failed: {e}")

        return results


# Module-level singleton
_graph_rag_service: Optional[GraphRAGService] = None


def get_graph_rag_service(knowledge_graph=None) -> GraphRAGService:
    """Get or create GraphRAGService instance."""
    global _graph_rag_service
    if _graph_rag_service is None:
        _graph_rag_service = GraphRAGService(knowledge_graph=knowledge_graph)
    return _graph_rag_service
