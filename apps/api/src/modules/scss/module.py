"""SCSS Module implementation."""
from typing import Dict, List

from src.modules.base import ModuleAccessLevel, StrategicModule


class SCSSModule(StrategicModule):
    """
    Supply Chain Sovereignty System (SCSS) Module.
    
    Provides tools for mapping, monitoring, and securing supply chains
    with focus on sovereignty, resilience, and alternative sourcing.
    
    Phase 1 Priority: HIGH (months 1-12)
    Access Level: Commercial
    """
    
    def __init__(self):
        super().__init__(
            name="SCSS",
            description="Supply Chain Sovereignty System - Map, monitor, and secure supply chains",
            access_level=ModuleAccessLevel.COMMERCIAL,
            version="1.0.0",
        )
    
    def get_layer_dependencies(self) -> Dict[str, List[str]]:
        """Return which layers this module depends on."""
        return {
            "layer_0_provenance": ["supplier_verification", "origin_tracking"],
            "layer_1_digital_twin": ["supply_chain_modeling", "logistics_visualization"],
            "layer_2_knowledge_graph": ["supplier_network", "dependency_mapping"],
            "layer_3_simulation": ["disruption_scenarios", "alternative_sourcing"],
            "layer_4_agents": ["scss_advisor", "supply_monitoring"],
        }
    
    def get_knowledge_graph_nodes(self) -> List[str]:
        """Return node types this module adds to Knowledge Graph."""
        return [
            "SUPPLIER",
            "RAW_MATERIAL",
            "COMPONENT",
            "LOGISTICS_HUB",
            "PORT",
            "WAREHOUSE",
            "MANUFACTURING_SITE",
            "DISTRIBUTION_CENTER",
        ]
    
    def get_knowledge_graph_edges(self) -> List[str]:
        """Return edge types this module adds to Knowledge Graph."""
        return [
            "SUPPLIES_TO",
            "SOURCES_FROM",
            "TRANSPORTS_VIA",
            "STORES_AT",
            "ALTERNATIVE_FOR",
            "COMPETES_WITH",
        ]
    
    def get_simulation_scenarios(self) -> List[str]:
        """Return simulation scenarios this module provides."""
        return [
            "supply_disruption",
            "geopolitical_block",
            "supplier_bankruptcy",
            "logistics_bottleneck",
            "raw_material_shortage",
            "price_shock",
            "sanctions_impact",
        ]
    
    def get_agents(self) -> List[str]:
        """Return agent types this module provides."""
        return [
            "SCSS_ADVISOR",  # Alternative supplier recommendations
            "SUPPLY_SENTINEL",  # Supply chain monitoring
            "SOURCING_OPTIMIZER",  # Optimal sourcing strategies
        ]
