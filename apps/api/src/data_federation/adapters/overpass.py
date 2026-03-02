"""
OpenStreetMap Overpass API adapter for city/place data (CityOS ingest).

Fetches nodes with place=city (or town) in a bbox; returns normalized list for CityTwin creation.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

from .base import AdapterResult, BaseAdapter, Region, TimeRange

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


class OverpassAdapter(BaseAdapter):
    """Fetch city/place data from OpenStreetMap Overpass API."""

    def name(self) -> str:
        return "overpass"

    def description(self) -> str:
        return "OpenStreetMap Overpass API: cities and places in a bounding box (for CityOS ingest)."

    def params_schema(self) -> Dict[str, Any]:
        return {
            "place_types": "list of place types: city, town, village (default: city, town)",
            "limit": "max number of nodes to return (default 500)",
        }

    async def fetch(
        self,
        region: Region,
        time_range: TimeRange | None = None,
        **params: Any,
    ) -> AdapterResult:
        limit = int(params.get("limit") or 500)
        place_types = params.get("place_types") or ["city", "town"]
        if isinstance(place_types, str):
            place_types = [place_types]
        bbox = region.bbox
        if not bbox:
            return AdapterResult(
                data={"cities": []},
                meta={"error": "bbox required (min_lat, min_lon, max_lat, max_lon)"},
                source=self.name(),
            )
        min_lat, min_lon, max_lat, max_lon = bbox
        # Overpass bbox: south, west, north, east
        bbox_str = f"{min_lat},{min_lon},{max_lat},{max_lon}"
        parts = []
        for pt in place_types:
            parts.append(f'node["place"="{pt}"]({bbox_str});')
        query = "[out:json];\n(" + "\n".join(parts) + "\n);\nout body;"
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(OVERPASS_URL, data={"data": query})
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            logger.warning("Overpass request failed: %s", e)
            return AdapterResult(
                data={"cities": []},
                meta={"error": str(e)},
                source=self.name(),
            )
        elements = data.get("elements") or []
        cities: List[Dict[str, Any]] = []
        for el in elements[:limit]:
            if el.get("type") != "node":
                continue
            lat = el.get("lat")
            lon = el.get("lon")
            tags = el.get("tags") or {}
            name = tags.get("name") or tags.get("name:en") or ""
            if not name:
                continue
            pop = tags.get("population")
            if isinstance(pop, str) and pop.isdigit():
                pop = int(pop)
            country = tags.get("addr:country") or tags.get("is_in:country_code") or ""
            cities.append({
                "name": name,
                "lat": lat,
                "lon": lon,
                "population": pop,
                "country_code": (country or "").upper()[:2] or None,
                "place": tags.get("place"),
            })
        return AdapterResult(
            data={"cities": cities},
            meta={"count": len(cities), "bbox": bbox_str},
            source=self.name(),
        )
