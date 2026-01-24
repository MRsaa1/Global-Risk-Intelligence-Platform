"""Base class for strategic modules."""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, List


class ModuleAccessLevel(str, Enum):
    """Access level for a strategic module."""

    PUBLIC = "public"
    COMMERCIAL = "commercial"
    CLASSIFIED = "classified"
    META = "meta"


class StrategicModule(ABC):
    """Base class for all strategic modules."""

    def __init__(
        self,
        name: str,
        description: str,
        access_level: ModuleAccessLevel,
        version: str = "1.0.0",
    ):
        self.name = name
        self.description = description
        self.access_level = access_level
        self.version = version
        self.enabled = True

    @abstractmethod
    def get_layer_dependencies(self) -> Dict[str, List[str]]:
        """Return which layers this module depends on."""
        ...

    @abstractmethod
    def get_knowledge_graph_nodes(self) -> List[str]:
        """Return node types this module adds to Knowledge Graph."""
        ...

    @abstractmethod
    def get_knowledge_graph_edges(self) -> List[str]:
        """Return edge types this module adds to Knowledge Graph."""
        ...

    @abstractmethod
    def get_simulation_scenarios(self) -> List[str]:
        """Return simulation scenarios this module provides."""
        ...

    @abstractmethod
    def get_agents(self) -> List[str]:
        """Return agent types this module provides."""
        ...

    def get_api_prefix(self) -> str:
        """Return API prefix for this module."""
        return f"/api/v1/{self.name.lower()}"

    def check_access(self, user_context: Dict) -> bool:
        """Check if user has access to this module."""
        if self.access_level == ModuleAccessLevel.PUBLIC:
            return True
        if self.access_level == ModuleAccessLevel.COMMERCIAL:
            return user_context.get("authenticated", False)
        if self.access_level == ModuleAccessLevel.CLASSIFIED:
            return user_context.get("security_clearance", False)
        if self.access_level == ModuleAccessLevel.META:
            return user_context.get("meta_access", False)
        return False
