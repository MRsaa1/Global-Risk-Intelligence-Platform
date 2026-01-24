"""CIP Module implementation."""
from typing import Dict, List

from src.modules.base import ModuleAccessLevel, StrategicModule


class CIPModule(StrategicModule):
    """
    Critical Infrastructure Protection (CIP) Module.
    
    Provides tools for modeling, monitoring, and protecting critical infrastructure
    including power grids, water systems, transportation networks, and communications.
    
    Phase 1 Priority: HIGHEST (months 1-12)
    Access Level: Commercial
    """
    
    def __init__(self):
        super().__init__(
            name="CIP",
            description="Critical Infrastructure Protection - Model, monitor, and protect essential infrastructure systems",
            access_level=ModuleAccessLevel.COMMERCIAL,
            version="1.0.0",
        )
    
    def get_layer_dependencies(self) -> Dict[str, List[str]]:
        """Return which layers this module depends on."""
        return {
            "layer_0_provenance": ["data_verification", "source_tracking"],
            "layer_1_digital_twin": ["infrastructure_modeling", "3d_visualization"],
            "layer_2_knowledge_graph": ["dependency_mapping", "network_analysis"],
            "layer_3_simulation": ["cascade_simulation", "failure_scenarios"],
            "layer_4_agents": ["cip_sentinel", "monitoring"],
        }
    
    def get_knowledge_graph_nodes(self) -> List[str]:
        """Return node types this module adds to Knowledge Graph."""
        return [
            "INFRASTRUCTURE",
            "CRITICAL_NODE",
            "POWER_PLANT",
            "SUBSTATION",
            "WATER_FACILITY",
            "TRANSPORT_HUB",
            "TELECOM_NODE",
            "DATA_CENTER",
        ]
    
    def get_knowledge_graph_edges(self) -> List[str]:
        """Return edge types this module adds to Knowledge Graph."""
        return [
            "DEPENDS_ON",
            "SUPPLIES",
            "CONTROLS",
            "BACKS_UP",
            "ADJACENT_TO",
            "SHARES_CORRIDOR",
        ]
    
    def get_simulation_scenarios(self) -> List[str]:
        """Return simulation scenarios this module provides."""
        return [
            "infrastructure_cascade",
            "power_grid_failure",
            "water_system_disruption",
            "communications_outage",
            "multi_sector_cascade",
            "cyber_attack_infrastructure",
            "natural_disaster_infrastructure",
        ]
    
    def get_agents(self) -> List[str]:
        """Return agent types this module provides."""
        return [
            "CIP_SENTINEL",  # 24/7 infrastructure monitoring
            "CASCADE_ANALYZER",  # Cascade failure prediction
            "RECOVERY_PLANNER",  # Recovery sequence optimization
        ]
