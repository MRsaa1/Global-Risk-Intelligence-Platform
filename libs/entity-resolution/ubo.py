"""
Ultimate Beneficial Owner (UBO) graph builder.
"""

from typing import Any, Dict, List, Optional
import structlog

logger = structlog.get_logger(__name__)


class UBOGraphBuilder:
    """Builds UBO graphs for entity ownership analysis."""

    def __init__(self):
        """Initialize UBO graph builder."""
        self._ownership_cache: Dict[str, List[Dict[str, Any]]] = {}

    def build_ubo_graph(self, entity_lei: str, threshold: float = 0.25) -> Dict[str, Any]:
        """
        Build UBO graph for an entity.

        Args:
            entity_lei: LEI of the entity
            threshold: Ownership threshold (default 25%)

        Returns:
            UBO graph structure
        """
        logger.info("Building UBO graph", entity_lei=entity_lei, threshold=threshold)

        # Placeholder implementation
        # In production, would:
        # 1. Query ownership data from registries
        # 2. Traverse ownership chain
        # 3. Identify UBOs (individuals with >threshold ownership)
        # 4. Build graph structure

        graph = {
            "root_entity": entity_lei,
            "threshold": threshold,
            "ubos": [],
            "ownership_chain": [],
            "graph": {
                "nodes": [],
                "edges": [],
            },
        }

        # Example: would recursively traverse ownership
        ownership_data = self._get_ownership_data(entity_lei)
        for owner in ownership_data:
            if owner.get("ownership_percentage", 0) >= threshold:
                if owner.get("entity_type") == "INDIVIDUAL":
                    graph["ubos"].append(owner)
                else:
                    # Recursively check owned entity
                    sub_graph = self.build_ubo_graph(owner.get("lei", ""), threshold)
                    graph["ownership_chain"].append(sub_graph)

        return graph

    def _get_ownership_data(self, lei: str) -> List[Dict[str, Any]]:
        """Get ownership data for an entity (placeholder)."""
        # In production, would query:
        # - Corporate registries
        # - SEC filings (for US entities)
        # - Companies House (for UK entities)
        # - Other jurisdiction-specific registries

        return []

    def find_common_ubos(
        self, entity_leis: List[str], threshold: float = 0.25
    ) -> List[Dict[str, Any]]:
        """
        Find common UBOs across multiple entities.

        Args:
            entity_leis: List of entity LEIs
            threshold: Ownership threshold

        Returns:
            List of common UBOs
        """
        logger.info("Finding common UBOs", entity_count=len(entity_leis))

        all_ubos: Dict[str, Dict[str, Any]] = {}

        for lei in entity_leis:
            graph = self.build_ubo_graph(lei, threshold)
            for ubo in graph["ubos"]:
                ubo_id = ubo.get("id") or ubo.get("name", "")
                if ubo_id not in all_ubos:
                    all_ubos[ubo_id] = {
                        **ubo,
                        "entities": [lei],
                    }
                else:
                    all_ubos[ubo_id]["entities"].append(lei)

        # Filter to UBOs that appear in multiple entities
        common_ubos = [
            ubo for ubo in all_ubos.values() if len(ubo["entities"]) > 1
        ]

        return common_ubos

