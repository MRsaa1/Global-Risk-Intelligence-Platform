"""
Interactive Scenario Trees

Tree visualization for scenario analysis.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class ScenarioNode:
    """Scenario tree node."""
    node_id: str
    name: str
    scenario_type: str  # "baseline", "adverse", "severely_adverse"
    probability: float
    value: float
    children: List['ScenarioNode'] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.children is None:
            self.children = []
        if self.metadata is None:
            self.metadata = {}


class ScenarioTree:
    """
    Interactive Scenario Tree.
    
    Tree structure for scenario analysis and visualization.
    """

    def __init__(self):
        """Initialize scenario tree."""
        self.root: Optional[ScenarioNode] = None
        self.nodes: Dict[str, ScenarioNode] = {}

    def add_node(
        self,
        node_id: str,
        name: str,
        scenario_type: str,
        probability: float,
        value: float,
        parent_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Add node to tree.

        Args:
            node_id: Node identifier
            name: Node name
            scenario_type: Type of scenario
            probability: Probability of scenario
            value: Scenario value (e.g., loss)
            parent_id: Parent node ID (None for root)
            metadata: Optional metadata
        """
        node = ScenarioNode(
            node_id=node_id,
            name=name,
            scenario_type=scenario_type,
            probability=probability,
            value=value,
            metadata=metadata or {},
        )

        self.nodes[node_id] = node

        if parent_id is None:
            self.root = node
        else:
            parent = self.nodes.get(parent_id)
            if parent:
                parent.children.append(node)
            else:
                raise ValueError(f"Parent node {parent_id} not found")

        logger.debug("Node added", node_id=node_id, parent_id=parent_id)

    def calculate_expected_value(self) -> float:
        """
        Calculate expected value across all scenarios.

        Returns:
            Expected value
        """
        if not self.root:
            return 0.0

        return self._calculate_node_expected_value(self.root)

    def _calculate_node_expected_value(self, node: ScenarioNode) -> float:
        """Recursively calculate expected value."""
        if not node.children:
            return node.probability * node.value

        child_expected = sum(
            self._calculate_node_expected_value(child) for child in node.children
        )
        return node.probability * child_expected

    def find_critical_path(self) -> List[ScenarioNode]:
        """
        Find critical path (highest risk).

        Returns:
            List of nodes in critical path
        """
        if not self.root:
            return []

        return self._find_critical_path_recursive(self.root, [])

    def _find_critical_path_recursive(
        self,
        node: ScenarioNode,
        current_path: List[ScenarioNode],
    ) -> List[ScenarioNode]:
        """Recursively find critical path."""
        current_path = current_path + [node]

        if not node.children:
            return current_path

        # Find child with highest risk
        max_child = max(node.children, key=lambda n: n.value)
        return self._find_critical_path_recursive(max_child, current_path)

    def export_for_d3(self) -> Dict[str, Any]:
        """
        Export tree for D3.js visualization.

        Returns:
            D3-compatible tree structure
        """
        if not self.root:
            return {}

        return self._export_node_d3(self.root)

    def _export_node_d3(self, node: ScenarioNode) -> Dict[str, Any]:
        """Recursively export node for D3."""
        d3_node = {
            "id": node.node_id,
            "name": node.name,
            "scenario_type": node.scenario_type,
            "probability": node.probability,
            "value": node.value,
            "metadata": node.metadata,
        }

        if node.children:
            d3_node["children"] = [self._export_node_d3(child) for child in node.children]

        return d3_node

    def get_scenario_statistics(self) -> Dict[str, Any]:
        """
        Get statistics across all scenarios.

        Returns:
            Statistics dictionary
        """
        if not self.root:
            return {}

        all_values = self._collect_all_values(self.root)
        
        return {
            "min": min(all_values),
            "max": max(all_values),
            "mean": sum(all_values) / len(all_values) if all_values else 0,
            "expected_value": self.calculate_expected_value(),
            "scenario_count": len(all_values),
        }

    def _collect_all_values(self, node: ScenarioNode) -> List[float]:
        """Recursively collect all values."""
        values = [node.value]
        for child in node.children:
            values.extend(self._collect_all_values(child))
        return values

