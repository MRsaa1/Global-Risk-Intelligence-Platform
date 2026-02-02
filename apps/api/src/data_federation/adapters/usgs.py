"""USGS adapter: earthquakes via USGSClient."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .base import AdapterResult, BaseAdapter, Region, TimeRange


class USGSAdapter(BaseAdapter):
    """Adapter for USGS Earthquake Catalog API."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None

    def _get_client(self) -> Any:
        if self._client is None:
            from src.services.external.usgs_client import USGSClient
            self._client = USGSClient()
        return self._client

    def name(self) -> str:
        return "usgs"

    def description(self) -> str:
        return "USGS Earthquake Catalog: recent earthquakes by location and radius."

    def params_schema(self) -> Dict[str, Any]:
        return {
            "days": {"type": "int", "default": 365, "description": "Days to look back"},
            "min_magnitude": {"type": "float", "default": 2.5, "description": "Minimum magnitude"},
        }

    async def fetch(
        self,
        region: Region,
        time_range: Optional[TimeRange] = None,
        **params: Any,
    ) -> AdapterResult:
        lat, lon = region.center
        radius_km = region.radius_km
        days = params.get("days", 365) if isinstance(params.get("days"), int) else 365
        min_mag = params.get("min_magnitude", 2.5)
        if isinstance(min_mag, (int, float)):
            min_mag = float(min_mag)
        else:
            min_mag = 2.5

        client = self._get_client()
        events = await client.get_recent_earthquakes(
            lat=lat,
            lng=lon,
            radius_km=radius_km,
            days=days,
            min_magnitude=min_mag,
        )

        # Normalize to serializable dicts
        out = []
        for e in events:
            t = e.get("time")
            if hasattr(t, "isoformat"):
                t = t.isoformat()
            out.append({
                "id": e.get("id"),
                "magnitude": e.get("magnitude"),
                "place": e.get("place"),
                "time": t,
                "depth": e.get("depth"),
                "coordinates": e.get("coordinates"),
                "type": e.get("type"),
                "tsunami": e.get("tsunami", False),
            })

        return AdapterResult(
            data={"earthquakes": out, "count": len(out)},
            meta={
                "lat": lat,
                "lon": lon,
                "radius_km": radius_km,
                "days": days,
                "min_magnitude": min_mag,
            },
            source="USGS Earthquake Catalog",
        )
