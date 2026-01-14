"""
Graph Neural Networks for Risk Cascade Prediction
==================================================

Using NVIDIA DGL (Deep Graph Library) for:
- Cascade prediction: Which assets will be affected by an event?
- Risk propagation: How does risk spread through the network?
- Early warning: Where will the risk spread next?
- Network analysis: Which nodes are critical?

Models:
- GraphSAGE: For large graphs with millions of nodes
- GAT (Graph Attention): For weighted edges (different importance of connections)
- GCN (Graph Convolution): For node classification by risk level
"""

from .cascade_gnn import CascadePredictor
from .risk_propagation import RiskPropagationModel
from .network_analyzer import NetworkAnalyzer

__all__ = [
    "CascadePredictor",
    "RiskPropagationModel", 
    "NetworkAnalyzer",
]
