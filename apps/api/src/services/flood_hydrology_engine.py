"""
Flood Hydrology Engine — simplified HEC-RAS style (SCS-CN + Manning).

Produces 10/50/100-year flood scenarios from elevation, streamflow, precipitation,
soil moisture, and drainage inputs. Used by flood-risk-product API.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from src.services.external.nasa_smap_client import nasa_smap_client
from src.services.external.osm_drainage_client import osm_drainage_client
from src.services.external.usgs_elevation_client import usgs_elevation_client
from src.services.external.usgs_waterwatch_client import usgs_waterwatch_client

logger = logging.getLogger(__name__)

# IDF-style 24h precipitation (mm) by return period — approximate central US
RETURN_PERIOD_PRECIP_MM: Dict[int, float] = {
    10: 100.0,
    50: 180.0,
    100: 220.0,
}


@dataclass
class FloodScenario:
    return_period_years: int
    flood_depth_m: float
    extent_area_km2: float
    velocity_ms: float
    duration_hours: float
    runoff_depth_mm: float


@dataclass
class FloodCell:
    lat: float
    lon: float
    depth_m: float


@dataclass
class FloodModelResult:
    city_id: str
    city_name: str
    lat: float
    lon: float
    population: int
    area_km2: float
    scenarios: List[FloodScenario]
    data_sources: Dict[str, bool] = field(default_factory=dict)
    avg_slope_pct: float = 0.0
    curve_number: float = 70.0


def _scs_runoff_mm(precip_mm: float, cn: float) -> float:
    """SCS Curve Number runoff: Q = (P - 0.2*S)^2 / (P + 0.8*S), S = 25400/CN - 254."""
    if precip_mm <= 0:
        return 0.0
    s = (25400.0 / cn) - 254.0
    ia = 0.2 * s
    if precip_mm <= ia:
        return 0.0
    q = (precip_mm - ia) ** 2 / (precip_mm + 0.8 * s)
    return max(0.0, q)


def _manning_velocity_mps(depth_m: float, slope: float, n: float = 0.035) -> float:
    """Manning: V = (1/n) * R^(2/3) * S^(1/2). Assume wide channel R ~ depth."""
    if slope <= 0 or depth_m <= 0:
        return 0.5
    s = slope / 100.0
    r = depth_m
    return (1.0 / n) * (r ** (2.0 / 3.0)) * (s ** 0.5)


class FloodHydrologyEngine:
    """
    City-level flood model: SCS-CN runoff + Manning velocity.
    Fetches elevation, streamflow, soil moisture, drainage in parallel.
    """

    def __init__(self):
        self._elevation = usgs_elevation_client
        self._waterwatch = usgs_waterwatch_client
        self._smap = nasa_smap_client
        self._drainage = osm_drainage_client

    async def _get_city_bbox(
        self,
        city_id: Optional[str] = None,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> Tuple[float, float, float, float, float, float, int, str, str]:
        """Return (min_lat, min_lon, max_lat, max_lon, lat, lon, population, city_id, city_name)."""
        from src.data.demo_communities import DEMO_COMMUNITIES as _JSON, TEXAS_COMMUNITIES as _TEX
        _DEMO = {**_JSON, **_TEX}
        if city_id and city_id in _DEMO:
            c = _DEMO[city_id]
            la, ln = c["lat"], c["lng"]
            pop = c.get("population", 10000)
            name = c.get("name", city_id)
        elif lat is not None and lon is not None:
            la, ln = lat, lon
            pop = 15000
            name = "Custom"
            city_id = city_id or "custom"
        else:
            c = _DEMO["bastrop_tx"]
            la, ln = c["lat"], c["lng"]
            pop = c["population"]
            name = c["name"]
            city_id = "bastrop_tx"
        deg = 0.05
        return (
            la - deg,
            ln - deg,
            la + deg,
            ln + deg,
            la,
            ln,
            pop,
            city_id,
            name,
        )

    async def run_city_flood_model(
        self,
        city_id: Optional[str] = None,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        population_override: Optional[int] = None,
    ) -> FloodModelResult:
        """
        Run flood model for a city. Returns 10/50/100-yr scenarios.
        """
        (
            min_lat,
            min_lon,
            max_lat,
            max_lon,
            center_lat,
            center_lon,
            pop_default,
            cid,
            city_name,
        ) = await self._get_city_bbox(city_id, lat, lon)
        population = population_override if population_override is not None else pop_default
        area_km2 = abs(max_lat - min_lat) * 111.0 * abs(max_lon - min_lon) * 111.0 * 0.7

        try:
            from src.services.climate_data import climate_service

            forecast = await climate_service.get_forecast(center_lat, center_lon, days=7)
            antecedent_mm = sum(f.precipitation_mm for f in forecast) if forecast else 20.0
        except Exception:
            antecedent_mm = 20.0

        elev_task = self._elevation.get_elevation(center_lat, center_lon)
        stream_task = self._waterwatch.get_streamflow(center_lat, center_lon, radius_km=30)
        soil_task = self._smap.get_soil_moisture(center_lat, center_lon, antecedent_precip_mm=antecedent_mm)
        drain_task = self._drainage.get_drainage_network(min_lat, min_lon, max_lat, max_lon)

        elev_m, stream, soil, drainage = await asyncio.gather(elev_task, stream_task, soil_task, drain_task)

        data_sources = {
            "elevation": elev_m is not None,
            "streamflow": stream is not None,
            "soil_moisture": True,
            "drainage": drainage.waterway_km > 0,
        }

        cn = 75.0 - (soil.volumetric_pct / 4.0)
        cn = max(55.0, min(85.0, cn))
        avg_slope = 0.5
        if elev_m is not None:
            elev2 = await self._elevation.get_elevation(center_lat + 0.01, center_lon)
            if elev2 is not None:
                avg_slope = max(0.1, abs(elev2 - elev_m) / (0.01 * 111000))

        channel_width_m = 15.0
        if drainage.waterway_km > 0 and drainage.area_km2 > 0:
            channel_width_m = max(5.0, min(50.0, 10.0 + drainage.density_km_per_km2 * 20))

        scenarios: List[FloodScenario] = []
        for return_yr in [10, 50, 100]:
            p_mm = RETURN_PERIOD_PRECIP_MM.get(return_yr, 150.0)
            runoff_mm = _scs_runoff_mm(p_mm, cn)
            runoff_m = runoff_mm / 1000.0
            depth_m = min(3.0, 0.4 * (runoff_m * 100) ** 0.55)
            velocity = _manning_velocity_mps(depth_m, avg_slope)
            extent_km2 = area_km2 * min(1.0, 0.2 + depth_m * 0.3)
            duration_h = 24.0 + (return_yr / 10.0)
            scenarios.append(
                FloodScenario(
                    return_period_years=return_yr,
                    flood_depth_m=round(depth_m, 2),
                    extent_area_km2=round(extent_km2, 2),
                    velocity_ms=round(velocity, 2),
                    duration_hours=round(duration_h, 1),
                    runoff_depth_mm=round(runoff_mm, 1),
                )
            )

        return FloodModelResult(
            city_id=cid,
            city_name=city_name,
            lat=center_lat,
            lon=center_lon,
            population=population,
            area_km2=round(area_km2, 2),
            scenarios=scenarios,
            data_sources=data_sources,
            avg_slope_pct=round(avg_slope * 100, 2),
            curve_number=round(cn, 1),
        )

    def get_depth_grid(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        scenario: FloodScenario,
        resolution_deg: float = 0.005,
    ) -> List[FloodCell]:
        """
        Return a grid of depth values for map rendering.
        Center of bbox gets max depth; decays toward edges.
        """
        cells: List[FloodCell] = []
        mid_lat = (min_lat + max_lat) / 2
        mid_lon = (min_lon + max_lon) / 2
        lat = min_lat
        while lat <= max_lat:
            lon = min_lon
            while lon <= max_lon:
                dist = ((lat - mid_lat) ** 2 + (lon - mid_lon) ** 2) ** 0.5
                decay = max(0.0, 1.0 - dist / 0.04)
                depth = scenario.flood_depth_m * decay
                if depth > 0.05:
                    cells.append(FloodCell(lat=lat, lon=lon, depth_m=round(depth, 2)))
                lon += resolution_deg
            lat += resolution_deg
        return cells


flood_hydrology_engine = FloodHydrologyEngine()
