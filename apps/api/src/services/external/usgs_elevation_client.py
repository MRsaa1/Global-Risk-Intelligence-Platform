"""
USGS 3DEP Elevation Point Query Service (EPQS) client.

Data source: USGS 3D Elevation Program (3DEP), see
https://www.usgs.gov/3d-elevation-program and Circular 1553
(https://pubs.usgs.gov/circ/1553/cir1553.pdf).

API (single-point): https://epqs.nationalmap.gov/v1/json — same backend as
the interactive UI at https://apps.nationalmap.gov/epqs/.
Docs: https://epqs.nationalmap.gov/v1/docs
For many points, consider Bulk Point Query: https://apps.nationalmap.gov/bulkpqs/
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)
# EPQS single-point API; bulk: https://apps.nationalmap.gov/bulkpqs/
USGS_EPQS_URL = "https://epqs.nationalmap.gov/v1/json"


@dataclass
class ElevationPoint:
    lat: float
    lon: float
    elevation_m: float


class USGSElevationClient:
    def __init__(self, timeout: float = 10.0, cache_ttl_hours: int = 24):
        self.timeout = timeout
        self._cache: Dict[str, Tuple[float, datetime]] = {}
        self._cache_ttl = timedelta(hours=cache_ttl_hours)

    async def get_elevation(self, lat: float, lon: float) -> Optional[float]:
        cache_key = f"pt_{lat:.4f}_{lon:.4f}"
        if cache_key in self._cache:
            val, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return val
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    USGS_EPQS_URL,
                    params={"x": lon, "y": lat, "units": "Meters"},
                )
                resp.raise_for_status()
                data = resp.json()
                value = data.get("value")
                if value is not None:
                    elev = float(value)
                    self._cache[cache_key] = (elev, datetime.utcnow())
                    return elev
        except Exception as e:
            logger.warning("USGS 3DEP elevation request failed: %s", e)
        return None

    async def get_elevation_profile(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        resolution_deg: float = 0.01,
    ) -> List[ElevationPoint]:
        points: List[ElevationPoint] = []
        lat = min_lat
        while lat <= max_lat:
            lon = min_lon
            while lon <= max_lon:
                elev = await self.get_elevation(lat, lon)
                if elev is not None:
                    points.append(ElevationPoint(lat=lat, lon=lon, elevation_m=elev))
                lon += resolution_deg
            lat += resolution_deg
        return points


usgs_elevation_client = USGSElevationClient()
