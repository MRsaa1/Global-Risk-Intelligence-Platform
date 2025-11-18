"""
Risk Network Graphs

Network visualization of risk relationships.
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class NetworkNode:
    """Network node."""
    node_id: str
    label: str
    node_type: str  # "portfolio", "counterparty", "risk_factor"
    size: float = 1.0
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class NetworkEdge:
    """Network edge."""
    source_id: str
    target_id: str
    weight: float = 1.0
    edge_type: str = "exposure"  # "exposure", "correlation", "dependency"
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class RiskNetworkGraph:
    """
    Risk Network Graph.
    
    Network visualization of risk relationships.
    """

    def __init__(self):
        """Initialize network graph."""
        self.nodes: Dict[str, NetworkNode] = {}
        self.edges: List[NetworkEdge] = []

    def add_node(
        self,
        node_id: str,
        label: str,
        node_type: str,
        size: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Add node to graph.

        Args:
            node_id: Node identifier
            label: Node label
            node_type: Type of node
            size: Node size (for visualization)
            metadata: Optional metadata
        """
        node = NetworkNode(
            node_id=node_id,
            label=label,
            node_type=node_type,
            size=size,
            metadata=metadata or {},
        )
        self.nodes[node_id] = node
        logger.debug("Node added", node_id=node_id)

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        weight: float = 1.0,
        edge_type: str = "exposure",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Add edge to graph.

        Args:
            source_id: Source node ID
            target_id: Target node ID
            weight: Edge weight
            edge_type: Type of edge
            metadata: Optional metadata
        """
        if source_id not in self.nodes:
            raise ValueError(f"Source node {source_id} not found")
        if target_id not in self.nodes:
            raise ValueError(f"Target node {target_id} not found")

        edge = NetworkEdge(
            source_id=source_id,
            target_id=target_id,
            weight=weight,
            edge_type=edge_type,
            metadata=metadata or {},
        )
        self.edges.append(edge)
        logger.debug("Edge added", source_id=source_id, target_id=target_id)

    def find_central_nodes(self, n: int = 5) -> List[NetworkNode]:
        """
        Find most central nodes (highest degree).

        Args:
            n: Number of nodes to return

        Returns:
            List of central nodes
        """
        node_degrees = {}
        for edge in self.edges:
            node_degrees[edge.source_id] = node_degrees.get(edge.source_id, 0) + 1
            node_degrees[edge.target_id] = node_degrees.get(edge.target_id, 0) + 1

        sorted_nodes = sorted(
            node_degrees.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        return [self.nodes[node_id] for node_id, _ in sorted_nodes[:n]]

    def find_communities(self) -> Dict[str, List[str]]:
        """
        Find communities in network (simplified).

        Returns:
            Dictionary of communities
        """
        # Simplified community detection
        communities = {}
        visited = set()

        for node_id in self.nodes.keys():
            if node_id in visited:
                continue

            community = self._dfs_community(node_id, visited)
            community_id = f"community_{len(communities)}"
            communities[community_id] = community

        return communities

    def _dfs_community(
        self,
        node_id: str,
        visited: set,
    ) -> List[str]:
        """DFS to find community."""
        visited.add(node_id)
        community = [node_id]

        for edge in self.edges:
            if edge.source_id == node_id and edge.target_id not in visited:
                community.extend(self._dfs_community(edge.target_id, visited))
            elif edge.target_id == node_id and edge.source_id not in visited:
                community.extend(self._dfs_community(edge.source_id, visited))

        return community

    def export_for_cytoscape(self) -> Dict[str, Any]:
        """
        Export for Cytoscape.js visualization.

        Returns:
            Cytoscape-compatible data structure
        """
        return {
            "nodes": [
                {
                    "data": {
                        "id": node.node_id,
                        "label": node.label,
                        "type": node.node_type,
                        "size": node.size,
                        **node.metadata,
                    }
                }
                for node in self.nodes.values()
            ],
            "edges": [
                {
                    "data": {
                        "source": edge.source_id,
                        "target": edge.target_id,
                        "weight": edge.weight,
                        "type": edge.edge_type,
                        **edge.metadata,
                    }
                }
                for edge in self.edges
            ],
        }

    def export_for_d3_force(self) -> Dict[str, Any]:
        """
        Export for D3.js force-directed layout.

        Returns:
            D3-compatible data structure
        """
        return {
            "nodes": [
                {
                    "id": node.node_id,
                    "name": node.label,
                    "type": node.node_type,
                    "size": node.size,
                    **node.metadata,
                }
                for node in self.nodes.values()
            ],
            "links": [
                {
                    "source": edge.source_id,
                    "target": edge.target_id,
                    "value": edge.weight,
                    "type": edge.edge_type,
                }
                for edge in self.edges
            ],
        }

