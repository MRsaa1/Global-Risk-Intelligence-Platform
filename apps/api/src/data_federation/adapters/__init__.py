"""DFM-style adapters for external data sources."""

from .base import AdapterResult, BaseAdapter
from .registry import get_adapter, list_adapters

__all__ = [
    "AdapterResult",
    "BaseAdapter",
    "get_adapter",
    "list_adapters",
]
