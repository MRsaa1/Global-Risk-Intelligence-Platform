"""SRO Module implementation."""
from typing import Dict, List

from src.modules.base import ModuleAccessLevel, StrategicModule


class SROModule(StrategicModule):
    """
    Systemic Risk Observatory (SRO) Module.
    
    Provides tools for monitoring, measuring, and mitigating systemic risks
    in the financial system through network analysis and early warning systems.
    
    Phase 1 Priority: HIGH (months 1-12)
    Access Level: Commercial
    """
    
    def __init__(self):
        super().__init__(
            name="SRO",
            description="Systemic Risk Observatory - Monitor and mitigate financial system risks",
            access_level=ModuleAccessLevel.COMMERCIAL,
            version="1.0.0",
        )
    
    def get_layer_dependencies(self) -> Dict[str, List[str]]:
        """Return which layers this module depends on."""
        return {
            "layer_0_provenance": ["financial_data_verification", "source_tracking"],
            "layer_1_digital_twin": ["institution_modeling", "market_visualization"],
            "layer_2_knowledge_graph": ["network_analysis", "correlation_mapping"],
            "layer_3_simulation": ["contagion_simulation", "stress_scenarios"],
            "layer_4_agents": ["sro_sentinel", "early_warning"],
        }
    
    def get_knowledge_graph_nodes(self) -> List[str]:
        """Return node types this module adds to Knowledge Graph."""
        return [
            "FINANCIAL_INSTITUTION",
            "BANK",
            "INSURER",
            "ASSET_MANAGER",
            "MARKET",
            "INSTRUMENT",
            "COUNTERPARTY",
            "REGULATOR",
        ]
    
    def get_knowledge_graph_edges(self) -> List[str]:
        """Return edge types this module adds to Knowledge Graph."""
        return [
            "CORRELATED_WITH",
            "COUNTERPARTY_TO",
            "OWNS_STAKE_IN",
            "FUNDS",
            "INSURES",
            "REGULATES",
            "TRADES_WITH",
        ]
    
    def get_simulation_scenarios(self) -> List[str]:
        """Return simulation scenarios this module provides."""
        return [
            "systemic_contagion",
            "bank_run",
            "credit_freeze",
            "liquidity_crisis",
            "market_crash",
            "counterparty_default",
            "correlation_spike",
        ]
    
    def get_agents(self) -> List[str]:
        """Return agent types this module provides."""
        return [
            "SRO_SENTINEL",  # Early warning system
            "CONTAGION_ANALYZER",  # Network contagion analysis
            "STRESS_ADVISOR",  # Stress test recommendations
        ]
