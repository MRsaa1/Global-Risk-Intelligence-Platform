"""Strategic modules - extends 5-Layer Architecture with domain-specific modules."""
from .base import ModuleAccessLevel, StrategicModule
from .registry import ModuleRegistry


def _register_builtin_modules() -> None:
    """Register all strategic modules with the registry."""
    from .cip.module import CIPModule
    from .scss.module import SCSSModule
    from .sro.module import SROModule
    from .asgi.module import ASGIModule
    from .erf.module import ERFModule
    from .biosec.module import BIOSECModule
    from .asm.module import ASMModule
    from .cadapt.module import CADAPTModule
    from .srs.module import SRSModule
    from .cityos.module import CityOSModule
    from .fst.module import FSTModule

    ModuleRegistry.register(CIPModule())
    ModuleRegistry.register(SCSSModule())
    ModuleRegistry.register(SROModule())
    ModuleRegistry.register(ASGIModule())
    ModuleRegistry.register(ERFModule())
    ModuleRegistry.register(BIOSECModule())
    ModuleRegistry.register(ASMModule())
    ModuleRegistry.register(CADAPTModule())
    ModuleRegistry.register(SRSModule())
    ModuleRegistry.register(CityOSModule())
    ModuleRegistry.register(FSTModule())


_register_builtin_modules()

__all__ = ["ModuleAccessLevel", "StrategicModule", "ModuleRegistry"]
