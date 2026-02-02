"""
Base adapter and AdapterResult for Data Federation.

All adapters normalize external data to AdapterResult (data, meta, source)
for use in pipelines.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass
class AdapterResult:
    """Unified result from any DFM adapter."""

    data: Dict[str, Any]
    meta: Dict[str, Any] = field(default_factory=dict)
    source: str = ""

    def __post_init__(self) -> None:
        if not self.data:
            self.data = {}
        if not self.meta:
            self.meta = {}


@dataclass
class Region:
    """Region for adapter queries: center + radius or bbox."""

    lat: Optional[float] = None
    lon: Optional[float] = None
    radius_km: float = 500.0
    bbox: Optional[tuple[float, float, float, float]] = None  # min_lat, min_lon, max_lat, max_lon

    @property
    def center(self) -> tuple[float, float]:
        if self.lat is not None and self.lon is not None:
            return (self.lat, self.lon)
        if self.bbox:
            min_lat, min_lon, max_lat, max_lon = self.bbox
            return ((min_lat + max_lat) / 2.0, (min_lon + max_lon) / 2.0)
        return (0.0, 0.0)


@dataclass
class TimeRange:
    """Time range for adapter queries."""

    start: Optional[datetime] = None
    end: Optional[datetime] = None
    days_back: Optional[int] = None


class BaseAdapter(ABC):
    """Abstract base for DFM adapters."""

    @abstractmethod
    def name(self) -> str:
        """Adapter identifier (e.g. 'usgs', 'weather')."""
        ...

    def description(self) -> str:
        """Human-readable description."""
        return ""

    def params_schema(self) -> Dict[str, Any]:
        """Optional params schema for API docs (e.g. description, types)."""
        return {}

    @abstractmethod
    async def fetch(
        self,
        region: Region,
        time_range: Optional[TimeRange] = None,
        **params: Any,
    ) -> AdapterResult:
        """Fetch data for the given region and optional time range."""
        ...
