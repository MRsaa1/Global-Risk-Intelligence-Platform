"""
Cascade GNN - Predicts risk cascade through asset network
==========================================================

Uses PyTorch Geometric (PyG) for Graph Neural Networks to predict:
1. Which assets will be affected by an event
2. In what order they will be affected
3. The probability of impact for each asset
4. The expected loss for each asset

Supported platforms:
- Apple Silicon (M1/M2/M3) via MPS backend
- NVIDIA GPUs via CUDA backend
- CPU fallback

Architecture:
- Input: Neo4j knowledge graph exported to PyG Data format
- Model: GraphSAGE / GAT for message passing
- Output: Risk probabilities per node
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import time

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import Data
from torch_geometric.nn import SAGEConv, GATConv, GCNConv

logger = logging.getLogger(__name__)


def get_device() -> torch.device:
    """
    Get the best available device for computation.
    
    Priority:
    1. NVIDIA CUDA (for servers with NVIDIA GPU)
    2. Apple MPS (for M1/M2/M3 Macs)
    3. CPU (fallback)
    """
    if torch.cuda.is_available():
        logger.info("Using CUDA (NVIDIA GPU)")
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        logger.info("Using MPS (Apple Silicon GPU)")
        return torch.device("mps")
    else:
        logger.info("Using CPU")
        return torch.device("cpu")


class GNNModelType(str, Enum):
    """Available GNN model types."""
    GRAPHSAGE = "graphsage"
    GAT = "gat"  # Graph Attention Network
    GCN = "gcn"  # Graph Convolutional Network


@dataclass
class CascadePrediction:
    """Prediction result for a single asset."""
    asset_id: str
    asset_name: str
    impact_probability: float  # 0-1
    expected_loss: float  # EUR
    time_to_impact_hours: float
    cascade_depth: int  # How many hops from source
    risk_level: str  # critical, high, medium, low


@dataclass
class CascadeResult:
    """Full cascade prediction result."""
    source_event_id: str
    source_event_type: str
    total_affected_assets: int
    total_expected_loss: float
    max_cascade_depth: int
    predictions: List[CascadePrediction]
    computation_time_ms: float


# =============================================================================
# GNN Models using PyTorch Geometric
# =============================================================================

class GraphSAGEModel(nn.Module):
    """
    GraphSAGE model for cascade prediction.
    
    Good for large graphs, inductive learning (can predict on unseen nodes).
    """
    
    def __init__(
        self,
        in_channels: int,
        hidden_channels: int = 64,
        out_channels: int = 1,
        num_layers: int = 2,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.convs = nn.ModuleList()
        self.convs.append(SAGEConv(in_channels, hidden_channels))
        for _ in range(num_layers - 2):
            self.convs.append(SAGEConv(hidden_channels, hidden_channels))
        self.convs.append(SAGEConv(hidden_channels, out_channels))
        self.dropout = dropout
        
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = F.relu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.convs[-1](x, edge_index)
        return torch.sigmoid(x)  # Probability output


class GATModel(nn.Module):
    """
    Graph Attention Network for cascade prediction.
    
    Uses attention mechanism to weight neighbor contributions.
    Good for heterogeneous graphs with different edge importances.
    """
    
    def __init__(
        self,
        in_channels: int,
        hidden_channels: int = 64,
        out_channels: int = 1,
        num_heads: int = 4,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.conv1 = GATConv(in_channels, hidden_channels, heads=num_heads, dropout=dropout)
        self.conv2 = GATConv(hidden_channels * num_heads, out_channels, heads=1, concat=False, dropout=dropout)
        self.dropout = dropout
        
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv1(x, edge_index)
        x = F.elu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        return torch.sigmoid(x)


class GCNModel(nn.Module):
    """
    Graph Convolutional Network for cascade prediction.
    
    Simple and efficient, good baseline model.
    """
    
    def __init__(
        self,
        in_channels: int,
        hidden_channels: int = 64,
        out_channels: int = 1,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.conv1 = GCNConv(in_channels, hidden_channels)
        self.conv2 = GCNConv(hidden_channels, out_channels)
        self.dropout = dropout
        
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        return torch.sigmoid(x)


# =============================================================================
# Cascade Predictor Service
# =============================================================================

class CascadePredictor:
    """
    Predicts risk cascade through asset network using GNN.
    
    Flow:
    1. Export graph from Neo4j to PyG Data format
    2. Apply trained GNN model
    3. Get risk probabilities for all nodes
    4. Filter and rank by impact probability
    
    Example:
        predictor = CascadePredictor()
        await predictor.initialize()
        result = await predictor.predict_cascade(
            source_asset_id="asset-123",
            event_type="flood",
            severity=0.7
        )
        for pred in result.predictions:
            print(f"{pred.asset_name}: {pred.impact_probability:.2%}")
    """
    
    def __init__(
        self,
        model_type: GNNModelType = GNNModelType.GRAPHSAGE,
        model_path: Optional[str] = None,
        hidden_channels: int = 64,
    ):
        self.model_type = model_type
        self.model_path = model_path
        self.hidden_channels = hidden_channels
        self.model: Optional[nn.Module] = None
        self.device = get_device()
        self.graph_data: Optional[Data] = None
        self.asset_id_to_idx: Dict[str, int] = {}
        self.idx_to_asset: Dict[int, Dict[str, Any]] = {}
        self._initialized = False
        
    async def initialize(self, num_features: int = 10):
        """
        Initialize GNN model.
        
        Args:
            num_features: Number of node features
        """
        logger.info(f"Initializing CascadePredictor with {self.model_type} on {self.device}")
        
        # Create model based on type
        if self.model_type == GNNModelType.GRAPHSAGE:
            self.model = GraphSAGEModel(
                in_channels=num_features,
                hidden_channels=self.hidden_channels,
                out_channels=1,
            )
        elif self.model_type == GNNModelType.GAT:
            self.model = GATModel(
                in_channels=num_features,
                hidden_channels=self.hidden_channels,
                out_channels=1,
            )
        else:  # GCN
            self.model = GCNModel(
                in_channels=num_features,
                hidden_channels=self.hidden_channels,
                out_channels=1,
            )
            
        self.model = self.model.to(self.device)
        
        # Load pre-trained weights if available
        if self.model_path:
            try:
                state_dict = torch.load(self.model_path, map_location=self.device)
                self.model.load_state_dict(state_dict)
                logger.info(f"Loaded model from {self.model_path}")
            except Exception as e:
                logger.warning(f"Could not load model: {e}")
                
        self._initialized = True
        logger.info("CascadePredictor initialized successfully")
        
    async def load_graph_from_neo4j(
        self,
        neo4j_uri: str,
        neo4j_user: str,
        neo4j_password: str,
    ):
        """
        Load knowledge graph from Neo4j into PyG format.
        
        Creates:
        - Node features from asset properties
        - Edge index from relationships
        - Mappings between asset IDs and node indices
        """
        from neo4j import GraphDatabase
        
        logger.info(f"Loading graph from Neo4j: {neo4j_uri}")
        
        driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))
        
        try:
            with driver.session() as session:
                # Get all assets (nodes)
                result = session.run("""
                    MATCH (a:Asset)
                    RETURN a.id as id, a.name as name, a.asset_type as type,
                           a.current_valuation as value, a.climate_risk_score as climate_risk,
                           a.physical_risk_score as physical_risk, a.network_risk_score as network_risk,
                           a.latitude as lat, a.longitude as lon
                    ORDER BY a.id
                """)
                
                nodes = []
                for i, record in enumerate(result):
                    asset_id = record["id"]
                    self.asset_id_to_idx[asset_id] = i
                    self.idx_to_asset[i] = {
                        "id": asset_id,
                        "name": record["name"] or f"Asset {i}",
                        "type": record["type"] or "unknown",
                        "value": record["value"] or 0,
                    }
                    
                    # Create feature vector
                    features = [
                        float(record["value"] or 0) / 1e9,  # Normalize value
                        float(record["climate_risk"] or 50) / 100,
                        float(record["physical_risk"] or 50) / 100,
                        float(record["network_risk"] or 50) / 100,
                        float(record["lat"] or 0) / 90,  # Normalize lat
                        float(record["lon"] or 0) / 180,  # Normalize lon
                        1.0 if record["type"] == "commercial_office" else 0.0,
                        1.0 if record["type"] == "industrial" else 0.0,
                        1.0 if record["type"] == "infrastructure" else 0.0,
                        1.0,  # Bias term
                    ]
                    nodes.append(features)
                
                # Get all relationships (edges)
                result = session.run("""
                    MATCH (a:Asset)-[r]->(b:Asset)
                    RETURN a.id as source, b.id as target, type(r) as rel_type
                """)
                
                edges = []
                for record in result:
                    source_id = record["source"]
                    target_id = record["target"]
                    if source_id in self.asset_id_to_idx and target_id in self.asset_id_to_idx:
                        edges.append([
                            self.asset_id_to_idx[source_id],
                            self.asset_id_to_idx[target_id]
                        ])
                
                # Create PyG Data object
                if nodes and edges:
                    x = torch.tensor(nodes, dtype=torch.float)
                    edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()
                    self.graph_data = Data(x=x, edge_index=edge_index)
                    self.graph_data = self.graph_data.to(self.device)
                    logger.info(f"Loaded graph: {len(nodes)} nodes, {len(edges)} edges")
                else:
                    logger.warning("No data found in Neo4j")
                    
        finally:
            driver.close()
            
    async def create_sample_graph(self, num_nodes: int = 100, num_edges: int = 300):
        """
        Create a sample graph for testing (when Neo4j is not available).
        """
        logger.info(f"Creating sample graph: {num_nodes} nodes, {num_edges} edges")
        
        import random
        
        # Create node features
        nodes = []
        for i in range(num_nodes):
            self.asset_id_to_idx[f"asset-{i}"] = i
            self.idx_to_asset[i] = {
                "id": f"asset-{i}",
                "name": f"Asset {i}",
                "type": random.choice(["office", "industrial", "infrastructure"]),
                "value": random.uniform(1e6, 1e9),
            }
            features = [random.random() for _ in range(10)]
            nodes.append(features)
            
        # Create random edges
        edges = []
        for _ in range(num_edges):
            source = random.randint(0, num_nodes - 1)
            target = random.randint(0, num_nodes - 1)
            if source != target:
                edges.append([source, target])
                
        x = torch.tensor(nodes, dtype=torch.float)
        edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()
        self.graph_data = Data(x=x, edge_index=edge_index)
        self.graph_data = self.graph_data.to(self.device)
        
        # Initialize model with correct number of features
        if not self._initialized:
            await self.initialize(num_features=10)
        
    async def predict_cascade(
        self,
        source_asset_id: str,
        event_type: str,
        severity: float = 0.5,
        max_depth: int = 5,
        min_probability: float = 0.1,
    ) -> CascadeResult:
        """
        Predict which assets will be affected by an event.
        
        Args:
            source_asset_id: ID of the asset where event occurs
            event_type: Type of stress event (flood, fire, default, etc.)
            severity: Severity of event (0-1)
            max_depth: Maximum cascade depth to consider
            min_probability: Minimum probability to include in results
            
        Returns:
            CascadeResult with predictions for affected assets
        """
        start_time = time.time()
        
        if not self._initialized:
            await self.initialize()
            
        if self.graph_data is None:
            await self.create_sample_graph()
            
        if source_asset_id not in self.asset_id_to_idx:
            logger.warning(f"Source asset {source_asset_id} not found in graph")
            return CascadeResult(
                source_event_id=source_asset_id,
                source_event_type=event_type,
                total_affected_assets=0,
                total_expected_loss=0.0,
                max_cascade_depth=0,
                predictions=[],
                computation_time_ms=0.0,
            )
            
        logger.info(f"Predicting cascade from {source_asset_id}, event={event_type}, severity={severity}")
        
        # Set model to eval mode
        self.model.eval()
        
        # Modify source node features to indicate event
        source_idx = self.asset_id_to_idx[source_asset_id]
        x = self.graph_data.x.clone()
        x[source_idx, 0] = severity  # Set first feature to severity
        
        # Forward pass
        with torch.no_grad():
            probabilities = self.model(x, self.graph_data.edge_index)
            probabilities = probabilities.squeeze().cpu().numpy()
            
        # Create predictions
        predictions = []
        total_loss = 0.0
        
        for idx, prob in enumerate(probabilities):
            if prob >= min_probability and idx != source_idx:
                asset = self.idx_to_asset[idx]
                expected_loss = float(asset["value"]) * float(prob) * severity
                total_loss += expected_loss
                
                # Determine risk level
                if prob >= 0.7:
                    risk_level = "critical"
                elif prob >= 0.5:
                    risk_level = "high"
                elif prob >= 0.3:
                    risk_level = "medium"
                else:
                    risk_level = "low"
                    
                predictions.append(CascadePrediction(
                    asset_id=asset["id"],
                    asset_name=asset["name"],
                    impact_probability=float(prob),
                    expected_loss=expected_loss,
                    time_to_impact_hours=24.0 * (1.0 - prob),  # Higher prob = faster impact
                    cascade_depth=1,  # Simplified
                    risk_level=risk_level,
                ))
                
        # Sort by probability
        predictions.sort(key=lambda p: p.impact_probability, reverse=True)
        
        computation_time = (time.time() - start_time) * 1000
        
        return CascadeResult(
            source_event_id=source_asset_id,
            source_event_type=event_type,
            total_affected_assets=len(predictions),
            total_expected_loss=total_loss,
            max_cascade_depth=max_depth,
            predictions=predictions,
            computation_time_ms=computation_time,
        )
        
    async def train(
        self,
        train_data: List[Tuple[str, str, List[str]]],  # (source, event_type, affected_assets)
        epochs: int = 100,
        learning_rate: float = 0.01,
    ):
        """
        Train GNN model on historical cascade data.
        
        Args:
            train_data: List of (source_asset_id, event_type, affected_asset_ids)
            epochs: Number of training epochs
            learning_rate: Learning rate for optimizer
        """
        if not self._initialized:
            await self.initialize()
            
        if self.graph_data is None:
            logger.error("No graph data loaded. Call load_graph_from_neo4j first.")
            return
            
        logger.info(f"Training GNN model on {len(train_data)} cascades for {epochs} epochs")
        
        self.model.train()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)
        criterion = nn.BCELoss()
        
        for epoch in range(epochs):
            total_loss = 0.0
            
            for source_id, event_type, affected_ids in train_data:
                if source_id not in self.asset_id_to_idx:
                    continue
                    
                # Create target labels
                labels = torch.zeros(len(self.idx_to_asset), dtype=torch.float, device=self.device)
                for aid in affected_ids:
                    if aid in self.asset_id_to_idx:
                        labels[self.asset_id_to_idx[aid]] = 1.0
                        
                # Forward pass
                optimizer.zero_grad()
                predictions = self.model(self.graph_data.x, self.graph_data.edge_index).squeeze()
                
                # Compute loss
                loss = criterion(predictions, labels)
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
                
            if (epoch + 1) % 10 == 0:
                avg_loss = total_loss / len(train_data) if train_data else 0
                logger.info(f"Epoch {epoch + 1}/{epochs}, Loss: {avg_loss:.4f}")
                
        logger.info("Training complete")
        
        # Save model
        if self.model_path:
            torch.save(self.model.state_dict(), self.model_path)
            logger.info(f"Model saved to {self.model_path}")


# Singleton instance
cascade_predictor = CascadePredictor()
