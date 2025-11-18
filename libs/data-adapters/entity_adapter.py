"""
Entity data adapter for loading entity information.
"""

from typing import Any, Dict, List, Optional
import structlog

from libs.entity_resolution import EntityResolver, SanctionsChecker

logger = structlog.get_logger(__name__)


class EntityAdapter:
    """Adapter for entity data with resolution and sanctions checking."""

    def __init__(
        self,
        entity_resolver: Optional[EntityResolver] = None,
        sanctions_checker: Optional[SanctionsChecker] = None,
    ):
        """
        Initialize entity adapter.

        Args:
            entity_resolver: Entity resolver instance
            sanctions_checker: Sanctions checker instance
        """
        self.resolver = entity_resolver or EntityResolver()
        self.sanctions_checker = sanctions_checker or SanctionsChecker()

    def get_entity_info(
        self, lei: Optional[str] = None, name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive entity information.

        Args:
            lei: Legal Entity Identifier
            name: Entity name

        Returns:
            Dictionary with entity information, relationships, and sanctions status
        """
        entity_info = {}

        # Resolve by LEI if provided
        if lei:
            resolved = self.resolver.resolve_by_lei(lei)
            if resolved:
                entity_info.update(resolved)
                entity_name = resolved.get("legal_name")
            else:
                entity_name = name
        else:
            entity_name = name

        # Resolve by name if LEI not found
        if not entity_info and name:
            matches = self.resolver.resolve_by_name(name)
            if matches:
                entity_info = matches[0]

        # Get relationships
        if lei:
            relationships = self.resolver.get_entity_relationships(lei)
            entity_info["relationships"] = relationships

        # Check sanctions
        if entity_name or entity_info.get("legal_name"):
            sanctions_result = self.sanctions_checker.check_entity(
                entity_name or entity_info.get("legal_name", ""), lei
            )
            entity_info["sanctions_status"] = sanctions_result

        return entity_info

    def batch_get_entity_info(self, entities: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        Get entity information for multiple entities.

        Args:
            entities: List of entities with 'lei' and/or 'name'

        Returns:
            List of entity information dictionaries
        """
        results = []
        for entity in entities:
            info = self.get_entity_info(
                lei=entity.get("lei"), name=entity.get("name")
            )
            results.append(info)
        return results

