"""
Data Federation layer: adapters and pipelines for weather, climate, and geodata.

DFM-style adapters wrap external sources (USGS, Weather, NOAA, FEMA, CMIP6, NIM).
Pipelines orchestrate adapters to produce geodata, climate overlay, and forecasts.
"""

from .adapters.base import AdapterResult, BaseAdapter, Region, TimeRange
from .adapters.registry import get_adapter, list_adapters

__all__ = [
    "AdapterResult",
    "BaseAdapter",
    "Region",
    "TimeRange",
    "get_adapter",
    "list_adapters",
]
