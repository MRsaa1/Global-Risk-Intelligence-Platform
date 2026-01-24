"""Registry for strategic modules."""
from typing import Dict, List, Optional

from .base import ModuleAccessLevel, StrategicModule


class ModuleRegistry:
    """Registry for all strategic modules."""

    _modules: Dict[str, StrategicModule] = {}

    @classmethod
    def register(cls, module: StrategicModule) -> None:
        """Register a module."""
        cls._modules[module.name.lower()] = module

    @classmethod
    def get(cls, name: str) -> Optional[StrategicModule]:
        """Get a module by name."""
        return cls._modules.get(name.lower())

    @classmethod
    def list_all(cls) -> List[StrategicModule]:
        """List all registered modules."""
        return list(cls._modules.values())

    @classmethod
    def list_by_access_level(cls, level: ModuleAccessLevel) -> List[StrategicModule]:
        """List modules by access level."""
        return [m for m in cls._modules.values() if m.access_level == level]
