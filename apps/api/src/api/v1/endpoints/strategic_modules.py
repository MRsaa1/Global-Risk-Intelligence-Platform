"""
Strategic Modules registry API — list and get modules (V2 Phase 1).

Aligns with STRATEGIC_MODULES_V2_ROADMAP: base StrategicModule and registry;
CIP, SCSS, SRO registered at startup.
"""
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from src.modules import ModuleRegistry
from src.modules.base import ModuleAccessLevel

router = APIRouter()


def _module_to_dict(module: Any) -> Dict[str, Any]:
    """Serialize a StrategicModule for API response."""
    return {
        "name": module.name,
        "description": module.description,
        "access_level": module.access_level.value if isinstance(module.access_level, ModuleAccessLevel) else str(module.access_level),
        "version": module.version,
        "enabled": getattr(module, "enabled", True),
        "api_prefix": module.get_api_prefix(),
        "layer_dependencies": module.get_layer_dependencies(),
        "knowledge_graph_nodes": module.get_knowledge_graph_nodes(),
        "knowledge_graph_edges": module.get_knowledge_graph_edges(),
        "simulation_scenarios": module.get_simulation_scenarios(),
        "agents": module.get_agents(),
    }


@router.get("", response_model=List[Dict[str, Any]])
async def list_strategic_modules():
    """
    List all registered strategic modules (CIP, SCSS, SRO and any future Phase 1+).
    Used by dashboard and Strategic Modules page.
    """
    modules = ModuleRegistry.list_all()
    return [_module_to_dict(m) for m in modules]


@router.get("/{name}", response_model=Dict[str, Any])
async def get_strategic_module(name: str):
    """Get a single strategic module by name (e.g. cip, scss, sro)."""
    module = ModuleRegistry.get(name)
    if not module:
        raise HTTPException(status_code=404, detail=f"Strategic module '{name}' not found")
    return _module_to_dict(module)
