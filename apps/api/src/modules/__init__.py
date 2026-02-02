"""Strategic modules - extends 5-Layer Architecture with domain-specific modules."""
from .base import ModuleAccessLevel, StrategicModule
from .registry import ModuleRegistry


def _register_builtin_modules() -> None:
    """Register CIP, SCSS, SRO with the registry (V2 Phase 1 modules)."""
    from .cip.module import CIPModule
    from .scss.module import SCSSModule
    from .sro.module import SROModule

    ModuleRegistry.register(CIPModule())
    ModuleRegistry.register(SCSSModule())
    ModuleRegistry.register(SROModule())


_register_builtin_modules()

__all__ = ["ModuleAccessLevel", "StrategicModule", "ModuleRegistry"]
