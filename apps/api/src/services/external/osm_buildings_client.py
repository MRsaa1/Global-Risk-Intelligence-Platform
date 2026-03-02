"""
OSM Overpass API client for building footprints within a bbox.

Used for per-building flood depth/probability in flood risk visualization.
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
class BuildingFootprint:
    """Single building from OSM with centroid and optional polygon."""
    id: str
    name: str
    lat: float
    lon: float
    polygon: List[Tuple[float, float]]  # [(lat, lon), ...]


class OSMBuildingsClient:
    """Client for OSM Overpass (building footprints)."""

    def __init__(self, timeout: float = 20.0, cache_ttl_hours: int = 24):
        self.timeout = timeout
        self._cache: Dict[str, Tuple[List[BuildingFootprint], datetime]] = {}
        self._cache_ttl = timedelta(hours=cache_ttl_hours)

    def _bbox_query(self, min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> str:
        return f"[bbox:{min_lat},{min_lon},{max_lat},{max_lon}]"

    async def get_buildings(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        limit: int = 200,
    ) -> List[BuildingFootprint]:
        """
        Get building footprints within bbox from OSM Overpass.

        Returns list of BuildingFootprint with id, name, centroid (lat, lon), and polygon.
        Capped at `limit` to avoid huge responses.

        Args:
            min_lat, min_lon, max_lat, max_lon: Bounding box in degrees
            limit: Max number of buildings to return (default 200)

        Returns:
            List of BuildingFootprint; empty on failure
        """
        cache_key = f"bld_{min_lat:.4f}_{min_lon:.4f}_{max_lat:.4f}_{max_lon:.4f}_{limit}"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return data

        # way["building"] with geometry; out geom gives lat/lon per node
        query = f"""
        [out:json][timeout:30];
        (
          way["building"]{self._bbox_query(min_lat, min_lon, max_lat, max_lon)};
        );
        out geom;
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(OVERPASS_URL, data={"data": query})
                resp.raise_for_status()
                data = resp.json()
                elements = data.get("elements", [])
                result: List[BuildingFootprint] = []
                for el in elements:
                    if el.get("type") != "way":
                        continue
                    geom = el.get("geometry")
                    if not geom or len(geom) < 3:
                        continue
                    poly: List[Tuple[float, float]] = []
                    for node in geom:
                        lat = node.get("lat")
                        lon = node.get("lon")
                        if lat is not None and lon is not None:
                            poly.append((lat, lon))
                    if len(poly) < 3:
                        continue
                    # Centroid
                    clat = sum(p[0] for p in poly) / len(poly)
                    clon = sum(p[1] for p in poly) / len(poly)
                    tags = el.get("tags") or {}
                    name = tags.get("name") or tags.get("addr:housenumber") or ""
                    if not name and tags.get("addr:street"):
                        name = tags.get("addr:street", "")
                    result.append(
                        BuildingFootprint(
                            id=str(el.get("id", "")),
                            name=name or f"Building {el.get('id', '')}",
                            lat=round(clat, 6),
                            lon=round(clon, 6),
                            polygon=poly,
                        )
                    )
                    if len(result) >= limit:
                        break
                self._cache[cache_key] = (result, datetime.utcnow())
                return result
        except Exception as e:
            logger.warning("OSM Overpass buildings request failed: %s", e)
        self._cache[cache_key] = ([], datetime.utcnow())
        return []


osm_buildings_client = OSMBuildingsClient()
