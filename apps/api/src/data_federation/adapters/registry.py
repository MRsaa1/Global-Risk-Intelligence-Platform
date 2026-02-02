"""Adapter registry: get_adapter, list_adapters."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base import BaseAdapter
from .usgs import USGSAdapter
from .weather import WeatherAdapter
from .noaa import NOAAAdapter
from .fema import FEMAAdapter
from .cmip6 import CMIP6Adapter
from .nim import NIMAdapter


_REGISTRY: Dict[str, BaseAdapter] = {}


def _ensure_registry() -> None:
    if _REGISTRY:
        return
    for cls in (
        USGSAdapter,
        WeatherAdapter,
        NOAAAdapter,
        FEMAAdapter,
        CMIP6Adapter,
        NIMAdapter,
    ):
        inst = cls()
        _REGISTRY[inst.name()] = inst


def get_adapter(name: str) -> Optional[BaseAdapter]:
    """Return adapter by name, or None if not found."""
    _ensure_registry()
    return _REGISTRY.get(name)


def list_adapters() -> List[Dict[str, Any]]:
    """List all adapters with name, description, params_schema."""
    _ensure_registry()
    return [
        {
            "name": a.name(),
            "description": a.description(),
            "params": a.params_schema(),
        }
        for a in _REGISTRY.values()
    ]
