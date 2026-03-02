"""FST (Financial System Stress Test Engine) module - Phase 1 Pilot."""
from typing import Dict, List

from src.modules.base import ModuleAccessLevel, StrategicModule


class FSTModule(StrategicModule):
    """
    Financial System Stress Test Engine (FST) Module.

    Stress-testing of banking and derivatives under physical shocks
    (climate, pandemic, grid failure) and financial unwinding.
    Decision-support only; no execution of trades or policy.
    Phase 1: Pilot.
    """

    def __init__(self):
        super().__init__(
            name="FST",
            description="Financial System Stress Test Engine - Banking and derivatives stress under physical shocks; decision-support only",
            access_level=ModuleAccessLevel.COMMERCIAL,
            version="1.0.0",
        )

    def get_layer_dependencies(self) -> Dict[str, List[str]]:
        return {
            "layer_0_provenance": ["verified_financial_data", "verified_physical_data"],
            "layer_1_digital_twin": ["institutions", "portfolios"],
            "layer_2_knowledge_graph": ["financial_physical_correlation"],
            "layer_3_simulation": ["stress_scenarios", "unwinding", "contagion"],
            "layer_4_agents": ["analyst", "reporter"],
        }

    def get_knowledge_graph_nodes(self) -> List[str]:
        return ["FINANCIAL_INSTITUTION", "MARKET", "PORTFOLIO", "PHYSICAL_SHOCK"]

    def get_knowledge_graph_edges(self) -> List[str]:
        return ["EXPOSED_TO_SHOCK", "CORRELATED_WITH", "CONTAGION_PATH"]

    def get_simulation_scenarios(self) -> List[str]:
        return [
            "banking_crisis_physical_shock",
            "derivatives_unwinding",
            "climate_stress_bank_capital",
            "pandemic_liquidity_stress",
            "grid_failure_financial_cascade",
        ]

    def get_agents(self) -> List[str]:
        return ["ANALYST", "REPORTER"]
