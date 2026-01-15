"""
Cascade GNN - Graph Neural Network for Cascade Risk Modeling.

Uses PyTorch Geometric (PyG) for graph-based risk propagation.
Falls back to NetworkX-based simulation if PyG unavailable.

Features:
- Dependency graph construction
- Risk propagation modeling
- Cascade simulation
- Critical path identification
- Vulnerability analysis
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set
from enum import Enum
import numpy as np

logger = logging.getLogger(__name__)

# Try to import PyG
try:
    import torch
    import torch.nn.functional as F
    from torch_geometric.nn import GCNConv, SAGEConv, GATConv
    from torch_geometric.data import Data
    HAS_PYG = True
    logger.info("PyTorch Geometric available for GNN cascade modeling")
except ImportError:
    HAS_PYG = False
    logger.info("PyTorch Geometric not available, using NetworkX fallback")

# NetworkX as fallback
try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False


class NodeType(str, Enum):
    """Types of nodes in the dependency graph."""
    ASSET = "asset"
    INFRASTRUCTURE = "infrastructure"
    SUPPLIER = "supplier"
    CUSTOMER = "customer"
    REGION = "region"
    SECTOR = "sector"


class EdgeType(str, Enum):
    """Types of edges (dependencies)."""
    PHYSICAL = "physical"  # Physical proximity/connection
    FINANCIAL = "financial"  # Financial dependency
    OPERATIONAL = "operational"  # Operational dependency
    SUPPLY = "supply"  # Supply chain
    UTILITY = "utility"  # Utility (power, water, telecom)


@dataclass
class GraphNode:
    """Node in the dependency graph."""
    id: str
    node_type: NodeType
    name: str
    value: float  # Asset value or importance
    risk_score: float  # Current risk score (0-100)
    sector: str
    region: str
    features: Dict[str, float] = field(default_factory=dict)


@dataclass
class GraphEdge:
    """Edge in the dependency graph."""
    source_id: str
    target_id: str
    edge_type: EdgeType
    weight: float  # Dependency strength (0-1)
    propagation_delay_hours: float = 1.0


@dataclass
class CascadeSimulationResult:
    """Result of cascade simulation."""
    trigger_node: str
    trigger_severity: float
    simulation_steps: int
    affected_nodes: List[str]
    total_loss: float
    peak_affected_time: int  # Step when most nodes affected
    propagation_paths: List[List[str]]
    node_impacts: Dict[str, float]  # node_id -> impact severity
    critical_nodes: List[str]  # Nodes that amplify cascade
    containment_points: List[str]  # Where to intervene


@dataclass
class VulnerabilityAnalysis:
    """Network vulnerability analysis."""
    most_critical_nodes: List[Tuple[str, float]]  # (node_id, criticality_score)
    single_points_of_failure: List[str]
    cluster_vulnerabilities: List[Dict[str, Any]]
    network_resilience_score: float  # 0-100
    recommendations: List[str]


# ============================================================================
# GNN MODEL (if PyG available)
# ============================================================================

if HAS_PYG:
    class CascadeGNN(torch.nn.Module):
        """
        Graph Neural Network for cascade risk propagation.
        
        Architecture:
        - Input: Node features (risk scores, value, sector embedding)
        - 3 GCN layers with residual connections
        - Output: Predicted impact for each node
        """
        
        def __init__(self, in_channels: int, hidden_channels: int = 64, out_channels: int = 1):
            super().__init__()
            
            # Graph convolution layers
            self.conv1 = GCNConv(in_channels, hidden_channels)
            self.conv2 = GCNConv(hidden_channels, hidden_channels)
            self.conv3 = GCNConv(hidden_channels, out_channels)
            
            # Batch normalization
            self.bn1 = torch.nn.BatchNorm1d(hidden_channels)
            self.bn2 = torch.nn.BatchNorm1d(hidden_channels)
            
            # Dropout
            self.dropout = torch.nn.Dropout(0.2)
        
        def forward(self, x, edge_index, edge_weight=None):
            # Layer 1
            x1 = self.conv1(x, edge_index, edge_weight)
            x1 = self.bn1(x1)
            x1 = F.relu(x1)
            x1 = self.dropout(x1)
            
            # Layer 2 with residual
            x2 = self.conv2(x1, edge_index, edge_weight)
            x2 = self.bn2(x2)
            x2 = F.relu(x2) + x1  # Residual connection
            x2 = self.dropout(x2)
            
            # Layer 3
            x3 = self.conv3(x2, edge_index, edge_weight)
            
            return torch.sigmoid(x3)  # Output between 0 and 1


# ============================================================================
# CASCADE GNN SERVICE
# ============================================================================

class CascadeGNNService:
    """
    Service for graph-based cascade risk modeling.
    
    Uses GNN when available, falls back to simulation otherwise.
    """
    
    def __init__(self):
        self.nodes: Dict[str, GraphNode] = {}
        self.edges: List[GraphEdge] = []
        self.nx_graph: Optional[Any] = None
        self.pyg_data: Optional[Any] = None
        self.gnn_model: Optional[Any] = None
        
        if HAS_PYG:
            self.gnn_model = CascadeGNN(in_channels=8, hidden_channels=64, out_channels=1)
            self.gnn_model.eval()
    
    def add_node(self, node: GraphNode):
        """Add a node to the graph."""
        self.nodes[node.id] = node
    
    def add_edge(self, edge: GraphEdge):
        """Add an edge to the graph."""
        self.edges.append(edge)
    
    def build_graph(self):
        """Build graph representations (NetworkX and/or PyG)."""
        if HAS_NETWORKX:
            self.nx_graph = nx.DiGraph()
            
            # Add nodes
            for node_id, node in self.nodes.items():
                self.nx_graph.add_node(
                    node_id,
                    node_type=node.node_type.value,
                    value=node.value,
                    risk_score=node.risk_score,
                    sector=node.sector,
                    region=node.region,
                )
            
            # Add edges
            for edge in self.edges:
                self.nx_graph.add_edge(
                    edge.source_id,
                    edge.target_id,
                    edge_type=edge.edge_type.value,
                    weight=edge.weight,
                    delay=edge.propagation_delay_hours,
                )
        
        if HAS_PYG and self.nodes:
            self._build_pyg_data()
    
    def _build_pyg_data(self):
        """Build PyTorch Geometric Data object."""
        if not HAS_PYG:
            return
        
        node_ids = list(self.nodes.keys())
        id_to_idx = {nid: i for i, nid in enumerate(node_ids)}
        
        # Build node features
        # Features: [risk_score, value_normalized, sector_enc (4), region_enc (2)]
        features = []
        for node_id in node_ids:
            node = self.nodes[node_id]
            sector_enc = [0, 0, 0, 0]
            sector_idx = hash(node.sector) % 4
            sector_enc[sector_idx] = 1
            region_enc = [0, 0]
            region_idx = hash(node.region) % 2
            region_enc[region_idx] = 1
            
            feature = [
                node.risk_score / 100,
                min(1.0, node.value / 1e9),  # Normalize to billions
            ] + sector_enc + region_enc
            features.append(feature)
        
        x = torch.tensor(features, dtype=torch.float)
        
        # Build edge index
        edge_sources = []
        edge_targets = []
        edge_weights = []
        
        for edge in self.edges:
            if edge.source_id in id_to_idx and edge.target_id in id_to_idx:
                edge_sources.append(id_to_idx[edge.source_id])
                edge_targets.append(id_to_idx[edge.target_id])
                edge_weights.append(edge.weight)
        
        edge_index = torch.tensor([edge_sources, edge_targets], dtype=torch.long)
        edge_weight = torch.tensor(edge_weights, dtype=torch.float)
        
        self.pyg_data = Data(x=x, edge_index=edge_index, edge_attr=edge_weight)
        self.node_id_to_idx = id_to_idx
        self.idx_to_node_id = {v: k for k, v in id_to_idx.items()}
    
    async def simulate_cascade(
        self,
        trigger_node_id: str,
        trigger_severity: float = 0.8,
        max_steps: int = 10,
        propagation_threshold: float = 0.1,
    ) -> CascadeSimulationResult:
        """
        Simulate cascade propagation from trigger node.
        
        Args:
            trigger_node_id: Node where cascade starts
            trigger_severity: Initial severity (0-1)
            max_steps: Maximum simulation steps
            propagation_threshold: Minimum severity to propagate
            
        Returns:
            CascadeSimulationResult with affected nodes and losses
        """
        if trigger_node_id not in self.nodes:
            raise ValueError(f"Trigger node {trigger_node_id} not in graph")
        
        # Use GNN if available and graph is built
        if HAS_PYG and self.pyg_data is not None and self.gnn_model is not None:
            return await self._simulate_with_gnn(
                trigger_node_id, trigger_severity, max_steps, propagation_threshold
            )
        elif HAS_NETWORKX and self.nx_graph is not None:
            return await self._simulate_with_networkx(
                trigger_node_id, trigger_severity, max_steps, propagation_threshold
            )
        else:
            return await self._simulate_basic(
                trigger_node_id, trigger_severity, max_steps, propagation_threshold
            )
    
    async def _simulate_with_gnn(
        self,
        trigger_node_id: str,
        trigger_severity: float,
        max_steps: int,
        propagation_threshold: float,
    ) -> CascadeSimulationResult:
        """Simulate using GNN for propagation prediction."""
        if not HAS_PYG or self.gnn_model is None:
            return await self._simulate_basic(
                trigger_node_id, trigger_severity, max_steps, propagation_threshold
            )
        
        # Initialize node states
        trigger_idx = self.node_id_to_idx[trigger_node_id]
        node_impacts = {trigger_node_id: trigger_severity}
        affected_at_step = {0: [trigger_node_id]}
        
        # Modify input features to include trigger
        x = self.pyg_data.x.clone()
        x[trigger_idx, 0] = trigger_severity  # Set trigger node risk to severity
        
        # Run GNN to get propagation predictions
        with torch.no_grad():
            predictions = self.gnn_model(
                x, 
                self.pyg_data.edge_index,
                self.pyg_data.edge_attr,
            )
        
        # Convert predictions to impacts
        for idx in range(len(predictions)):
            node_id = self.idx_to_node_id[idx]
            if node_id != trigger_node_id:
                impact = float(predictions[idx]) * trigger_severity
                if impact >= propagation_threshold:
                    node_impacts[node_id] = impact
        
        # Sort affected nodes by impact
        affected_nodes = sorted(
            [n for n in node_impacts.keys() if n != trigger_node_id],
            key=lambda n: node_impacts[n],
            reverse=True,
        )
        
        # Calculate total loss
        total_loss = sum(
            self.nodes[n].value * node_impacts[n]
            for n in node_impacts
            if n in self.nodes
        )
        
        # Identify critical nodes (high impact and high connectivity)
        critical_nodes = [
            n for n in affected_nodes
            if node_impacts.get(n, 0) > 0.5
        ][:5]
        
        # Identify containment points
        containment_points = self._find_containment_points(trigger_node_id, affected_nodes)
        
        return CascadeSimulationResult(
            trigger_node=trigger_node_id,
            trigger_severity=trigger_severity,
            simulation_steps=1,  # GNN is single-step
            affected_nodes=affected_nodes,
            total_loss=total_loss,
            peak_affected_time=1,
            propagation_paths=[[trigger_node_id] + affected_nodes[:3]],
            node_impacts=node_impacts,
            critical_nodes=critical_nodes,
            containment_points=containment_points,
        )
    
    async def _simulate_with_networkx(
        self,
        trigger_node_id: str,
        trigger_severity: float,
        max_steps: int,
        propagation_threshold: float,
    ) -> CascadeSimulationResult:
        """Simulate using NetworkX graph traversal."""
        if not HAS_NETWORKX or self.nx_graph is None:
            return await self._simulate_basic(
                trigger_node_id, trigger_severity, max_steps, propagation_threshold
            )
        
        # BFS-based cascade simulation
        node_impacts = {trigger_node_id: trigger_severity}
        active_nodes = {trigger_node_id}
        affected_at_step = {0: [trigger_node_id]}
        propagation_paths = []
        
        for step in range(1, max_steps + 1):
            new_active = set()
            step_affected = []
            
            for node in active_nodes:
                current_impact = node_impacts.get(node, 0)
                
                # Get successors
                for successor in self.nx_graph.successors(node):
                    if successor not in node_impacts:
                        # Get edge weight
                        edge_data = self.nx_graph.edges[node, successor]
                        weight = edge_data.get('weight', 0.5)
                        
                        # Calculate propagated impact
                        propagated_impact = current_impact * weight * 0.8  # Decay factor
                        
                        if propagated_impact >= propagation_threshold:
                            node_impacts[successor] = propagated_impact
                            new_active.add(successor)
                            step_affected.append(successor)
                            propagation_paths.append([trigger_node_id, node, successor])
            
            if step_affected:
                affected_at_step[step] = step_affected
            
            active_nodes = new_active
            
            if not active_nodes:
                break
        
        # Calculate total loss
        affected_nodes = list(node_impacts.keys())
        affected_nodes.remove(trigger_node_id)
        
        total_loss = sum(
            self.nodes[n].value * node_impacts[n]
            for n in node_impacts
            if n in self.nodes
        )
        
        # Find peak affected time
        peak_step = max(affected_at_step.keys(), key=lambda s: len(affected_at_step[s]))
        
        # Critical nodes
        critical_nodes = [
            n for n, impact in sorted(node_impacts.items(), key=lambda x: x[1], reverse=True)
            if impact > 0.5 and n != trigger_node_id
        ][:5]
        
        containment_points = self._find_containment_points(trigger_node_id, affected_nodes)
        
        return CascadeSimulationResult(
            trigger_node=trigger_node_id,
            trigger_severity=trigger_severity,
            simulation_steps=len(affected_at_step),
            affected_nodes=affected_nodes,
            total_loss=total_loss,
            peak_affected_time=peak_step,
            propagation_paths=propagation_paths[:10],
            node_impacts=node_impacts,
            critical_nodes=critical_nodes,
            containment_points=containment_points,
        )
    
    async def _simulate_basic(
        self,
        trigger_node_id: str,
        trigger_severity: float,
        max_steps: int,
        propagation_threshold: float,
    ) -> CascadeSimulationResult:
        """Basic simulation without graph libraries."""
        # Build adjacency from edges
        adjacency = {}
        for edge in self.edges:
            if edge.source_id not in adjacency:
                adjacency[edge.source_id] = []
            adjacency[edge.source_id].append((edge.target_id, edge.weight))
        
        # BFS simulation
        node_impacts = {trigger_node_id: trigger_severity}
        visited = {trigger_node_id}
        queue = [(trigger_node_id, trigger_severity, 0)]
        affected_nodes = []
        
        while queue:
            node, impact, step = queue.pop(0)
            
            if step >= max_steps:
                continue
            
            for target, weight in adjacency.get(node, []):
                if target not in visited:
                    new_impact = impact * weight * 0.8
                    if new_impact >= propagation_threshold:
                        visited.add(target)
                        node_impacts[target] = new_impact
                        affected_nodes.append(target)
                        queue.append((target, new_impact, step + 1))
        
        total_loss = sum(
            self.nodes.get(n, GraphNode(n, NodeType.ASSET, n, 0, 0, "", "")).value * impact
            for n, impact in node_impacts.items()
        )
        
        return CascadeSimulationResult(
            trigger_node=trigger_node_id,
            trigger_severity=trigger_severity,
            simulation_steps=max_steps,
            affected_nodes=affected_nodes,
            total_loss=total_loss,
            peak_affected_time=1,
            propagation_paths=[[trigger_node_id] + affected_nodes[:3]],
            node_impacts=node_impacts,
            critical_nodes=affected_nodes[:5],
            containment_points=[],
        )
    
    def _find_containment_points(
        self,
        trigger_node: str,
        affected_nodes: List[str],
    ) -> List[str]:
        """Find nodes where intervention would stop cascade."""
        if not HAS_NETWORKX or self.nx_graph is None:
            return []
        
        containment = []
        
        # Find articulation points (cut vertices)
        try:
            # Create subgraph of affected nodes
            subgraph = self.nx_graph.subgraph([trigger_node] + affected_nodes)
            
            # For directed graph, check nodes that disconnect graph
            for node in affected_nodes[:10]:
                # Check if removing this node disconnects others
                test_graph = subgraph.copy()
                test_graph.remove_node(node)
                
                if not nx.is_weakly_connected(test_graph) if test_graph.number_of_nodes() > 0 else True:
                    containment.append(node)
        except:
            pass
        
        return containment[:5]
    
    async def analyze_vulnerability(self) -> VulnerabilityAnalysis:
        """
        Analyze network vulnerability.
        
        Returns:
            VulnerabilityAnalysis with critical nodes and resilience metrics
        """
        if not self.nodes:
            return VulnerabilityAnalysis(
                most_critical_nodes=[],
                single_points_of_failure=[],
                cluster_vulnerabilities=[],
                network_resilience_score=50.0,
                recommendations=["Add nodes to the network for analysis"],
            )
        
        critical_nodes = []
        spof = []
        
        if HAS_NETWORKX and self.nx_graph is not None:
            # Calculate node criticality (betweenness centrality)
            try:
                centrality = nx.betweenness_centrality(self.nx_graph)
                critical_nodes = sorted(
                    [(n, c) for n, c in centrality.items()],
                    key=lambda x: x[1],
                    reverse=True,
                )[:10]
            except:
                pass
            
            # Find single points of failure
            try:
                for node in self.nx_graph.nodes():
                    test_graph = self.nx_graph.copy()
                    test_graph.remove_node(node)
                    if not nx.is_weakly_connected(test_graph):
                        spof.append(node)
            except:
                pass
        else:
            # Simple criticality based on edge count
            edge_count = {}
            for edge in self.edges:
                edge_count[edge.source_id] = edge_count.get(edge.source_id, 0) + 1
                edge_count[edge.target_id] = edge_count.get(edge.target_id, 0) + 1
            
            critical_nodes = sorted(
                [(n, c / len(self.edges)) for n, c in edge_count.items()],
                key=lambda x: x[1],
                reverse=True,
            )[:10]
        
        # Calculate resilience score
        if len(self.nodes) > 0:
            avg_connectivity = len(self.edges) / len(self.nodes)
            resilience = min(100, 40 + avg_connectivity * 20 - len(spof) * 5)
        else:
            resilience = 50.0
        
        # Generate recommendations
        recommendations = []
        if spof:
            recommendations.append(f"Address {len(spof)} single points of failure: {', '.join(spof[:3])}")
        if critical_nodes:
            top_critical = critical_nodes[0][0]
            recommendations.append(f"Add redundancy for critical node: {top_critical}")
        if resilience < 60:
            recommendations.append("Increase network connectivity to improve resilience")
        
        return VulnerabilityAnalysis(
            most_critical_nodes=critical_nodes,
            single_points_of_failure=spof,
            cluster_vulnerabilities=[],
            network_resilience_score=round(resilience, 1),
            recommendations=recommendations,
        )
    
    def create_sample_graph(self, num_nodes: int = 20):
        """Create a sample dependency graph for testing."""
        import random
        
        sectors = ["Energy", "Finance", "Manufacturing", "Technology", "Healthcare"]
        regions = ["North", "South", "East", "West", "Central"]
        
        # Create nodes
        for i in range(num_nodes):
            node = GraphNode(
                id=f"asset_{i}",
                node_type=NodeType.ASSET,
                name=f"Asset {i}",
                value=random.uniform(10_000_000, 500_000_000),
                risk_score=random.uniform(20, 80),
                sector=random.choice(sectors),
                region=random.choice(regions),
            )
            self.add_node(node)
        
        # Create edges (random connections)
        node_ids = list(self.nodes.keys())
        for i in range(num_nodes * 2):
            source = random.choice(node_ids)
            target = random.choice(node_ids)
            if source != target:
                edge = GraphEdge(
                    source_id=source,
                    target_id=target,
                    edge_type=random.choice(list(EdgeType)),
                    weight=random.uniform(0.3, 0.9),
                )
                self.add_edge(edge)
        
        self.build_graph()


# Global service instance
cascade_gnn_service = CascadeGNNService()
