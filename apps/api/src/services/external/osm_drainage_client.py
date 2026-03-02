"""
OSM Overpass API client for waterways and drainage within a bbox.

Used for channel geometry (width, density) in flood hydrology.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


@dataclass
class DrainageNetwork:
    """Drainage network summary within a bbox."""
    waterway_km: float
    waterway_count: int
    area_km2: float
    density_km_per_km2: float
    source: str = "osm_overpass"


class OSMDrainageClient:
    """Client for OSM Overpass (waterways/drainage)."""

    def __init__(self, timeout: float = 15.0, cache_ttl_hours: int = 24):
        self.timeout = timeout
        self._cache: Dict[str, Tuple[DrainageNetwork, datetime]] = {}
        self._cache_ttl = timedelta(hours=cache_ttl_hours)

    def _bbox_query(self, min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> str:
        return f"[bbox:{min_lat},{min_lon},{max_lat},{max_lon}]"

    async def get_drainage_network(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
    ) -> DrainageNetwork:
        """
        Get waterways (rivers, streams, drains) within bbox.

        Returns total length (km), count, and density for flood model.

        Args:
            min_lat, min_lon, max_lat, max_lon: Bounding box in degrees

        Returns:
            DrainageNetwork; on failure returns zero lengths
        """
        cache_key = f"drain_{min_lat:.3f}_{min_lon:.3f}_{max_lat:.3f}_{max_lon:.3f}"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return data
        query = f"""
        [out:json][timeout:25];
        (
          way["waterway"~"river|stream|canal|drain"]{self._bbox_query(min_lat, min_lon, max_lat, max_lon)};
        );
        out body;
        >;
        out skel qt;
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(OVERPASS_URL, data={"data": query})
                resp.raise_for_status()
                data = resp.json()
                elements = data.get("elements", [])
                total_km = 0.0
                for el in elements:
                    if el.get("type") != "way":
                        continue
                    nodes = el.get("nodes", [])
                    if len(nodes) < 2:
                        continue
                    # Approximate length: sum of segment lengths (rough 111km/deg at mid-lat)
                    geom = el.get("geometry")
                    if geom and len(geom) >= 2:
                        for i in range(1, len(geom)):
                            lat1, lon1 = geom[i - 1].get("lat"), geom[i - 1].get("lon")
                            lat2, lon2 = geom[i].get("lat"), geom[i].get("lon")
                            if None in (lat1, lon1, lat2, lon2):
                                continue
                            dlat = (lat2 - lat1) * 111.0
                            dlon = (lon2 - lon1) * (111.0 * 0.7)
                            total_km += (dlat ** 2 + dlon ** 2) ** 0.5
                    else:
                        total_km += 0.5 * (len(nodes) - 1)
                way_count = len([e for e in elements if e.get("type") == "way"])
                area_km2 = abs(max_lat - min_lat) * 111.0 * abs(max_lon - min_lon) * 111.0 * 0.7
                density = total_km / area_km2 if area_km2 > 0 else 0.0
                result = DrainageNetwork(
                    waterway_km=round(total_km, 2),
                    waterway_count=way_count,
                    area_km2=round(area_km2, 2),
                    density_km_per_km2=round(density, 4),
                    source="osm_overpass",
                )
                self._cache[cache_key] = (result, datetime.utcnow())
                return result
        except Exception as e:
            logger.warning("OSM Overpass drainage request failed: %s", e)
        area_km2 = abs(max_lat - min_lat) * 111.0 * abs(max_lon - min_lon) * 111.0 * 0.7
        result = DrainageNetwork(
            waterway_km=0.0,
            waterway_count=0,
            area_km2=round(area_km2, 2),
            density_km_per_km2=0.0,
            source="fallback",
        )
        self._cache[cache_key] = (result, datetime.utcnow())
        return result


osm_drainage_client = OSMDrainageClient()
