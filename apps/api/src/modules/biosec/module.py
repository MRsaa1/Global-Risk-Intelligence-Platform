"""BIOSEC Module implementation - Biosecurity & Pandemic Monitoring."""
from typing import Dict, List

from src.modules.base import ModuleAccessLevel, StrategicModule


class BIOSECModule(StrategicModule):
    """
    Biosecurity & Pandemic Module (BIOSEC).

    Monitors biological threats including BSL-4 lab safety, pandemic pathogens,
    dual-use research, and airport connectivity for spread modeling.

    Access Level: CLASSIFIED
    """

    def __init__(self):
        super().__init__(
            name="BIOSEC",
            description="Biosecurity & Pandemic Module - BSL-4 lab monitoring, pandemic modeling, and pathogen tracking",
            access_level=ModuleAccessLevel.CLASSIFIED,
            version="1.0.0",
        )

    def get_layer_dependencies(self) -> Dict[str, List[str]]:
        return {
            "layer_0_provenance": ["who_data_verification", "cdc_feed_validation"],
            "layer_1_digital_twin": ["lab_facility_models", "airport_network"],
            "layer_2_knowledge_graph": ["pathogen_registry", "lab_network", "airport_graph"],
            "layer_3_simulation": ["pandemic_spread", "containment_scenario"],
            "layer_4_agents": ["biosec_sentinel"],
        }

    def get_knowledge_graph_nodes(self) -> List[str]:
        return [
            "BSL4_LAB",
            "PATHOGEN",
            "AIRPORT_HUB",
            "HOSPITAL_NETWORK",
            "VACCINE_FACILITY",
            "QUARANTINE_ZONE",
        ]

    def get_knowledge_graph_edges(self) -> List[str]:
        return [
            "RESEARCHES",
            "FLIGHT_ROUTE",
            "OUTBREAK_ORIGIN",
            "SUPPLIES_VACCINE",
            "CONTAINMENT_ZONE",
        ]

    def get_simulation_scenarios(self) -> List[str]:
        return [
            "pandemic_spread_sir",
            "lab_accident_containment",
            "engineered_pathogen_release",
            "airport_network_transmission",
            "vaccine_distribution_optimization",
            "dual_use_research_scenario",
        ]

    def get_agents(self) -> List[str]:
        return [
            "BIOSEC_SENTINEL",     # 24/7 pathogen/outbreak monitoring
            "PANDEMIC_MODELER",    # SIR/SEIR spread modeling
        ]
