"""Strategic modules - extends 5-Layer Architecture with domain-specific modules."""
from .base import ModuleAccessLevel, StrategicModule
from .registry import ModuleRegistry

__all__ = ["ModuleAccessLevel", "StrategicModule", "ModuleRegistry"]
