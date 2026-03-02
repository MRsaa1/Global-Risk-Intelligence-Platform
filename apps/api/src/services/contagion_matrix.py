"""
Cross-Sector Financial Contagion Matrix
========================================

Implements the Financial Contagion Calculator from Universal Stress Testing Methodology.

Features:
- 5x5 Cross-sector transmission matrix
- First, second, and third order effects
- Network cascade propagation with adjacency matrix
- Amplification factor calculation
- Critical node identification

Reference: Universal Stress Testing Methodology v1.0, Part 2.4
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class SectorType(str, Enum):
    """Sector types for contagion matrix."""
    INSURANCE = "insurance"
    REAL_ESTATE = "real_estate"
    FINANCIAL = "financial"
    ENTERPRISE = "enterprise"
    DEFENSE = "defense"


# Sector ordering for matrix indexing
SECTOR_ORDER = [
    SectorType.INSURANCE,
    SectorType.REAL_ESTATE,
    SectorType.FINANCIAL,
    SectorType.ENTERPRISE,
    SectorType.DEFENSE
]

SECTOR_INDEX = {sector: i for i, sector in enumerate(SECTOR_ORDER)}


# =============================================================================
# TRANSMISSION MATRIX (Empirical Coefficients)
# =============================================================================

# Cross-sector transmission matrix from methodology
# Rows: source sector, Columns: target sector
# [Insurance, RealEstate, Financial, Enterprise, Defense]
TRANSMISSION_MATRIX = np.array([
    [1.0,  0.15, 0.25, 0.10, 0.05],  # From Insurance
    [0.20, 1.0,  0.35, 0.15, 0.03],  # From Real Estate
    [0.30, 0.40, 1.0,  0.45, 0.10],  # From Financial
    [0.10, 0.12, 0.20, 1.0,  0.25],  # From Enterprise
    [0.05, 0.05, 0.08, 0.30, 1.0]   # From Defense
])

# Sector labels for output
SECTOR_LABELS = ["insurance", "real_estate", "financial", "enterprise", "defense"]


@dataclass
class ContagionResult:
    """Result of financial contagion calculation."""
    primary_loss: float
    source_sector: str
    insurance_impact: float
    real_estate_impact: float
    financial_impact: float
    enterprise_impact: float
    defense_impact: float
    total_system_loss: float
    amplification_factor: float
    first_order_effects: Dict[str, float]
    second_order_effects: Dict[str, float]
    third_order_effects: Dict[str, float]


@dataclass
class CascadeResult:
    """Result of network cascade calculation."""
    total_loss: float
    amplification_factor: float
    node_losses: Dict[str, float]
    cascade_steps: int
    cascade_history: List[Dict[str, float]]
    critical_nodes: List[str]
    single_points_of_failure: List[str]


# =============================================================================
# FINANCIAL CONTAGION CALCULATOR
# =============================================================================

def calculate_financial_contagion(
    primary_loss: float,
    sector: str,
    market_conditions: Optional[Dict[str, Any]] = None,
    stress_multiplier: float = 1.0
) -> ContagionResult:
    """
    Calculate financial transmission to other sectors.
    
    Implements the cross-sector financial contagion model from methodology.
    Uses first, second, and third order effects with diminishing transmission.
    
    Args:
        primary_loss: Initial loss in the source sector
        sector: Source sector name
        market_conditions: Optional dict with market stress factors
        stress_multiplier: Multiplier for transmission rates under stress
    
    Returns:
        ContagionResult with all sector impacts and amplification factor
    """
    # Get sector index
    try:
        sector_enum = SectorType(sector.lower())
        sector_idx = SECTOR_INDEX[sector_enum]
    except (ValueError, KeyError):
        logger.warning(f"Unknown sector {sector}, defaulting to enterprise")
        sector_idx = SECTOR_INDEX[SectorType.ENTERPRISE]
        sector_enum = SectorType.ENTERPRISE
    
    # Apply stress multiplier to transmission matrix (capped)
    stressed_matrix = np.minimum(TRANSMISSION_MATRIX * stress_multiplier, 1.0)
    
    # Apply market conditions if provided
    if market_conditions:
        liquidity_stress = market_conditions.get("liquidity_stress", 1.0)
        credit_stress = market_conditions.get("credit_stress", 1.0)
        
        # Financial sector more affected by liquidity/credit stress
        stressed_matrix[SECTOR_INDEX[SectorType.FINANCIAL], :] *= (1 + 0.2 * liquidity_stress)
        stressed_matrix[:, SECTOR_INDEX[SectorType.FINANCIAL]] *= (1 + 0.2 * credit_stress)
    
    # First-order transmission (direct impact)
    first_order = primary_loss * stressed_matrix[sector_idx, :]
    
    # Second-order (feedback loops) - 30% of first order transmission
    second_order = stressed_matrix.T @ first_order * 0.3
    
    # Third-order (diminishing) - 10% of second order
    third_order = stressed_matrix.T @ second_order * 0.1
    
    # Total impact per sector
    total_impact = first_order + second_order + third_order
    
    # Calculate amplification factor
    amplification_factor = np.sum(total_impact) / primary_loss if primary_loss > 0 else 1.0
    
    # Build result dictionaries
    first_order_dict = {label: round(val, 2) for label, val in zip(SECTOR_LABELS, first_order)}
    second_order_dict = {label: round(val, 2) for label, val in zip(SECTOR_LABELS, second_order)}
    third_order_dict = {label: round(val, 2) for label, val in zip(SECTOR_LABELS, third_order)}
    
    return ContagionResult(
        primary_loss=round(primary_loss, 2),
        source_sector=sector_enum.value,
        insurance_impact=round(total_impact[0], 2),
        real_estate_impact=round(total_impact[1], 2),
        financial_impact=round(total_impact[2], 2),
        enterprise_impact=round(total_impact[3], 2),
        defense_impact=round(total_impact[4], 2),
        total_system_loss=round(np.sum(total_impact), 2),
        amplification_factor=round(amplification_factor, 4),
        first_order_effects=first_order_dict,
        second_order_effects=second_order_dict,
        third_order_effects=third_order_dict
    )


# =============================================================================
# NETWORK CASCADE MODEL
# =============================================================================

def calculate_cascade_impact(
    initial_shock: Dict[str, float],
    adjacency_matrix: np.ndarray,
    contagion_rates: np.ndarray,
    node_capacities: np.ndarray,
    node_names: Optional[List[str]] = None,
    max_iterations: int = 10
) -> CascadeResult:
    """
    Calculate cascade propagation through interconnected network.
    
    Implements the Network Cascade Model from methodology.
    
    Args:
        initial_shock: Dict mapping node_id (index as string) to initial loss
        adjacency_matrix: Network connections (n_nodes x n_nodes)
        contagion_rates: Transmission probability per node
        node_capacities: Absorption capacity per node
        node_names: Optional list of node names for output
        max_iterations: Maximum cascade iterations
    
    Returns:
        CascadeResult with total losses, path analysis, critical nodes
    """
    n_nodes = len(node_capacities)
    
    if node_names is None:
        node_names = [f"Node_{i}" for i in range(n_nodes)]
    
    cumulative_losses = np.zeros(n_nodes)
    current_shock = np.zeros(n_nodes)
    
    # Initialize with direct shock
    for node_id_str, loss in initial_shock.items():
        try:
            node_id = int(node_id_str)
            if 0 <= node_id < n_nodes:
                current_shock[node_id] = loss
                cumulative_losses[node_id] = loss
        except ValueError:
            continue
    
    cascade_history = [{name: round(loss, 2) for name, loss in zip(node_names, cumulative_losses.copy())}]
    
    for iteration in range(max_iterations):
        # Calculate transmitted shock
        # T = A^T @ (shock * contagion_rates)
        transmitted = adjacency_matrix.T @ (current_shock * contagion_rates)
        
        # Apply capacity absorption
        remaining_capacity = np.maximum(node_capacities - cumulative_losses, 0)
        absorbed = np.minimum(transmitted, remaining_capacity)
        overflow = transmitted - absorbed
        
        # Overflow becomes new shock
        current_shock = overflow
        cumulative_losses += absorbed
        
        cascade_history.append({name: round(loss, 2) for name, loss in zip(node_names, cumulative_losses.copy())})
        
        # Stop if no more propagation
        if np.sum(current_shock) < 1e-6:
            break
    
    # Calculate metrics
    direct_loss = sum(initial_shock.values())
    total_loss = float(np.sum(cumulative_losses))
    amplification = total_loss / direct_loss if direct_loss > 0 else 1.0
    
    # Identify critical nodes (highest loss)
    loss_ranking = sorted(
        [(name, loss) for name, loss in zip(node_names, cumulative_losses)],
        key=lambda x: x[1],
        reverse=True
    )
    critical_nodes = [name for name, loss in loss_ranking[:3] if loss > 0]
    
    # Identify single points of failure (nodes with high centrality but low redundancy)
    in_degrees = np.sum(adjacency_matrix, axis=0)
    out_degrees = np.sum(adjacency_matrix, axis=1)
    centrality = (in_degrees + out_degrees) / (2 * (n_nodes - 1)) if n_nodes > 1 else np.zeros(n_nodes)
    
    spof_candidates = [
        node_names[i] for i in range(n_nodes)
        if centrality[i] > 0.5 and cumulative_losses[i] > 0
    ]
    
    return CascadeResult(
        total_loss=round(total_loss, 2),
        amplification_factor=round(amplification, 4),
        node_losses={name: round(loss, 2) for name, loss in zip(node_names, cumulative_losses)},
        cascade_steps=len(cascade_history),
        cascade_history=cascade_history,
        critical_nodes=critical_nodes,
        single_points_of_failure=spof_candidates[:3]
    )


# =============================================================================
# SIMPLIFIED CASCADE FOR QUICK CALCULATIONS
# =============================================================================

def quick_cascade_calculation(
    primary_loss: float,
    n_entities: int,
    sector: str,
    severity: float
) -> Dict[str, Any]:
    """
    Quick cascade calculation for Report V2 integration.
    
    Simplified version that doesn't require full network topology.
    
    Args:
        primary_loss: Initial loss
        n_entities: Number of affected entities
        sector: Source sector
        severity: Severity level (0-1)
    
    Returns:
        Dict with cascade metrics for Report V2
    """
    # Use financial contagion model for cross-sector
    contagion = calculate_financial_contagion(
        primary_loss=primary_loss,
        sector=sector,
        stress_multiplier=1 + severity
    )
    
    # Estimate within-sector cascade based on entity count and severity
    # More entities = more potential for cascade
    entity_factor = min(1 + np.log10(max(n_entities, 1)) * 0.2, 2.0)
    severity_factor = 1 + severity * 0.5
    
    within_sector_amp = entity_factor * severity_factor
    
    # Combined amplification
    combined_amp = contagion.amplification_factor * within_sector_amp * 0.5 + within_sector_amp * 0.5
    
    # Cascade velocity (hours) - faster for financial, slower for real estate
    velocity_map = {
        "insurance": 24,
        "real_estate": 72,
        "financial": 4,
        "enterprise": 12,
        "defense": 48
    }
    cascade_velocity = velocity_map.get(sector.lower(), 24)
    
    # Network fragility (0-1)
    fragility = min(severity * 0.6 + (n_entities / 1000) * 0.2, 1.0)
    
    return {
        "amplification_factor": round(combined_amp, 2),
        "cascade_velocity_hours": cascade_velocity,
        "network_fragility_index": round(fragility, 4),
        "cross_sector_transmission": {
            "to_insurance": round(contagion.insurance_impact, 2),
            "to_real_estate": round(contagion.real_estate_impact, 2),
            "to_financial": round(contagion.financial_impact, 2),
            "to_enterprise": round(contagion.enterprise_impact, 2),
            "to_defense": round(contagion.defense_impact, 2)
        },
        "total_system_impact": round(contagion.total_system_loss, 2),
        "first_order_effects": contagion.first_order_effects,
        "second_order_effects": contagion.second_order_effects
    }


# =============================================================================
# CRITICAL PATH ANALYSIS
# =============================================================================

def identify_critical_path(
    adjacency_matrix: np.ndarray,
    node_values: np.ndarray,
    node_names: Optional[List[str]] = None
) -> List[str]:
    """
    Identify critical cascade path based on node values and connections.
    
    Args:
        adjacency_matrix: Network connections
        node_values: Value/importance of each node
        node_names: Optional node names
    
    Returns:
        Ordered list of nodes in critical path
    """
    n_nodes = len(node_values)
    
    if node_names is None:
        node_names = [f"Node_{i}" for i in range(n_nodes)]
    
    # Find node with highest "cascade potential" (value × out-degree)
    out_degrees = np.sum(adjacency_matrix, axis=1)
    cascade_potential = node_values * out_degrees
    
    # Build path from highest cascade potential nodes
    visited = set()
    path = []
    
    # Start from highest potential
    current = int(np.argmax(cascade_potential))
    
    while current not in visited and len(path) < 5:
        visited.add(current)
        path.append(node_names[current])
        
        # Find next node with highest value among connected nodes
        connected = np.where(adjacency_matrix[current] > 0)[0]
        if len(connected) == 0:
            break
        
        unvisited_connected = [c for c in connected if c not in visited]
        if not unvisited_connected:
            break
        
        current = max(unvisited_connected, key=lambda x: node_values[x])
    
    return path


def get_infrastructure_cascade_path(
    event_type: str,
    severity: float,
    city_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get typical infrastructure cascade path based on event type.
    
    Returns realistic cascade paths for common stress events.
    When city_name contains "Montreal" and event_type is flood, returns
    Montreal-specific nodes (Hydro P43, Pierrefonds WTP, Lakeshore Hospital, etc.).
    
    Args:
        event_type: Type of stress event
        severity: Severity level
        city_name: Optional city name for city-specific cascade path
    
    Returns:
        Dict with cascade path and critical nodes
    """
    city = (city_name or "").strip()
    event_lower = event_type.lower()
    is_montreal_flood = "montreal" in city.lower() and (
        event_lower == "flood" or "flood" in event_lower or "climate" in event_lower
    )

    # Montreal-specific flood cascade path
    if is_montreal_flood:
        cascade_info = {
            "path": "Hydro P43 → WTP Pierrefonds → Lakeshore Hospital → Galipeault Bridge",
            "critical_nodes": [
                {"name": "Hydro-Québec Sub-Station P43", "centrality": 0.89, "affected_people": 340000},
                {"name": "Pierrefonds Water Treatment Plant", "centrality": 0.82, "dependent_entities": 156},
                {"name": "Lakeshore General Hospital", "centrality": 0.75, "affected_people": 85000}
            ],
            "spof": ["Hydro-Québec Sub-Station P43", "Pierrefonds Water Treatment Plant", "Galipeault Bridge"]
        }
        scaled_nodes = []
        for node in cascade_info["critical_nodes"]:
            scaled_node = node.copy()
            for key in ["affected_people", "dependent_entities", "daily_crossings", "connected_users",
                        "subscribers", "transactions_daily", "merchants", "users", "daily_volume_bn",
                        "counterparties", "cedants", "containers_monthly", "daily_shipments", "daily_cars"]:
                if key in scaled_node:
                    scaled_node[key] = int(scaled_node[key] * (0.5 + severity * 0.5))
            scaled_nodes.append(scaled_node)
        return {
            "cascade_path": cascade_info["path"],
            "critical_nodes": scaled_nodes,
            "single_points_of_failure": cascade_info["spof"],
            "contagion_velocity_hours": int(4 + (1 - severity) * 20)
        }

    # Predefined cascade paths by event type
    cascade_paths = {
        "flood": {
            "path": "Power Grid → Water Treatment → Hospitals → Transportation",
            "critical_nodes": [
                {"name": "Power Substation", "centrality": 0.89, "affected_people": 340000},
                {"name": "Water Treatment Plant", "centrality": 0.82, "dependent_entities": 156},
                {"name": "Regional Hospital", "centrality": 0.75, "affected_people": 85000}
            ],
            "spof": ["Central Power Substation", "Main Water Intake", "Primary Data Center"]
        },
        "seismic": {
            "path": "Structures → Transportation → Utilities → Communications",
            "critical_nodes": [
                {"name": "Major Bridge", "centrality": 0.91, "daily_crossings": 125000},
                {"name": "Gas Distribution Hub", "centrality": 0.85, "connected_users": 280000},
                {"name": "Telecom Central Office", "centrality": 0.78, "subscribers": 450000}
            ],
            "spof": ["Bridge Span 3", "Gas Regulator Station", "Fiber Optic Hub"]
        },
        "cyber": {
            "path": "IT Systems → Operations → Finance → Customer Services",
            "critical_nodes": [
                {"name": "Core Banking Platform", "centrality": 0.95, "transactions_daily": 2500000},
                {"name": "Payment Gateway", "centrality": 0.88, "merchants": 45000},
                {"name": "Identity System", "centrality": 0.82, "users": 1200000}
            ],
            "spof": ["Primary Database Cluster", "HSM Vault", "API Gateway"]
        },
        "financial": {
            "path": "Banks → Insurers → Real Estate → Corporates",
            "critical_nodes": [
                {"name": "Clearing House", "centrality": 0.94, "daily_volume_bn": 450},
                {"name": "Major Bank", "centrality": 0.87, "counterparties": 2500},
                {"name": "Reinsurer", "centrality": 0.79, "cedants": 180}
            ],
            "spof": ["Central Counterparty", "SWIFT Gateway", "Repo Market"]
        },
        "supply_chain": {
            "path": "Suppliers → Manufacturing → Logistics → Retail",
            "critical_nodes": [
                {"name": "Port Terminal", "centrality": 0.88, "containers_monthly": 125000},
                {"name": "Distribution Center", "centrality": 0.82, "daily_shipments": 45000},
                {"name": "Rail Hub", "centrality": 0.76, "daily_cars": 8500}
            ],
            "spof": ["Single-source Component", "Customs Clearance", "Last-mile Carrier"]
        }
    }
    
    # Get path for event type (default to flood)
    event_lower = event_type.lower()
    cascade_info = cascade_paths.get(event_lower, cascade_paths["flood"])
    
    # Scale affected numbers by severity
    scaled_nodes = []
    for node in cascade_info["critical_nodes"]:
        scaled_node = node.copy()
        for key in ["affected_people", "dependent_entities", "daily_crossings", "connected_users", 
                    "subscribers", "transactions_daily", "merchants", "users", "daily_volume_bn",
                    "counterparties", "cedants", "containers_monthly", "daily_shipments", "daily_cars"]:
            if key in scaled_node:
                scaled_node[key] = int(scaled_node[key] * (0.5 + severity * 0.5))
        scaled_nodes.append(scaled_node)
    
    return {
        "cascade_path": cascade_info["path"],
        "critical_nodes": scaled_nodes,
        "single_points_of_failure": cascade_info["spof"],
        "contagion_velocity_hours": int(4 + (1 - severity) * 20)  # 4-24 hours
    }
