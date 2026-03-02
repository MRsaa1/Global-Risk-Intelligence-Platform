"""ASM Module implementation - Nuclear Safety & Monitoring."""
from typing import Dict, List

from src.modules.base import ModuleAccessLevel, StrategicModule


class ASMModule(StrategicModule):
    """
    Nuclear Safety & Monitoring Module (ASM).

    Monitors nuclear reactors, models nuclear winter climate cascades,
    and tracks geopolitical escalation pathways.

    Access Level: CLASSIFIED
    """

    def __init__(self):
        super().__init__(
            name="ASM",
            description="Nuclear Safety & Monitoring - Reactor monitoring, nuclear winter modeling, and escalation tracking",
            access_level=ModuleAccessLevel.CLASSIFIED,
            version="1.0.0",
        )

    def get_layer_dependencies(self) -> Dict[str, List[str]]:
        return {
            "layer_0_provenance": ["iaea_data_verification"],
            "layer_1_digital_twin": ["reactor_models", "fallout_overlay"],
            "layer_2_knowledge_graph": ["reactor_network", "escalation_graph"],
            "layer_3_simulation": ["nuclear_winter", "escalation_ladder"],
            "layer_4_agents": ["asm_sentinel"],
        }

    def get_knowledge_graph_nodes(self) -> List[str]:
        return [
            "NUCLEAR_REACTOR",
            "NUCLEAR_WARHEAD",
            "NUCLEAR_STATE",
            "FALLOUT_ZONE",
            "EARLY_WARNING_SYSTEM",
        ]

    def get_knowledge_graph_edges(self) -> List[str]:
        return [
            "OPERATED_BY",
            "TARGETS",
            "WITHIN_RANGE",
            "FALLOUT_AFFECTS",
            "ESCALATION_TRIGGERS",
        ]

    def get_simulation_scenarios(self) -> List[str]:
        return [
            "reactor_meltdown",
            "nuclear_exchange_limited",
            "nuclear_exchange_full",
            "nuclear_winter_cascade",
            "escalation_ladder",
            "accidental_launch",
        ]

    def get_agents(self) -> List[str]:
        return [
            "ASM_SENTINEL",         # Nuclear threat monitoring
            "ESCALATION_TRACKER",   # Geopolitical escalation detection
        ]
