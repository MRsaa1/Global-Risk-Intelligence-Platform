"""CADAPT Module implementation - Climate Adaptation & Local Resilience."""
from typing import Dict, List

from src.modules.base import ModuleAccessLevel, StrategicModule


class CADAPTModule(StrategicModule):
    """
    Climate Adaptation & Local Resilience Module (CADAPT).

    Track B revenue engine: helps municipalities assess, plan, and fund
    climate adaptation measures with grant matching and ROI optimization.

    Access Level: COMMERCIAL
    """

    def __init__(self):
        super().__init__(
            name="CADAPT",
            description="Climate Adaptation & Local Resilience - Municipal adaptation planning, grant matching, and ROI optimization",
            access_level=ModuleAccessLevel.COMMERCIAL,
            version="1.0.0",
        )

    def get_layer_dependencies(self) -> Dict[str, List[str]]:
        return {
            "layer_0_provenance": ["grant_data_verification", "cost_data_sources"],
            "layer_1_digital_twin": ["city_model", "infrastructure_overlay"],
            "layer_2_knowledge_graph": ["adaptation_measures", "grant_programs"],
            "layer_3_simulation": ["roi_calculation", "cost_benefit_analysis"],
            "layer_4_agents": ["cadapt_advisor"],
        }

    def get_knowledge_graph_nodes(self) -> List[str]:
        return [
            "ADAPTATION_MEASURE",
            "GRANT_PROGRAM",
            "MUNICIPALITY",
            "BUDGET_LINE",
            "CLIMATE_RISK_ZONE",
        ]

    def get_knowledge_graph_edges(self) -> List[str]:
        return [
            "ELIGIBLE_FOR",
            "FUNDED_BY",
            "MITIGATES",
            "COSTS",
            "RETURNS",
        ]

    def get_simulation_scenarios(self) -> List[str]:
        return [
            "adaptation_roi",
            "grant_matching",
            "budget_impact",
            "cost_benefit_analysis",
            "resilience_improvement",
        ]

    def get_agents(self) -> List[str]:
        return [
            "CADAPT_ADVISOR",     # Adaptation planning guidance
            "GRANT_MATCHER",      # Grant opportunity matching
        ]
