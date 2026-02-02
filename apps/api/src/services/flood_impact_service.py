"""
Flood Impact Service (CPU-only, no GPU).

Uses Open-Meteo forecast via ClimateDataService and applies simple
precipitation -> flood depth / risk level rules for visualization and stress tests.
No NVIDIA Earth-2 or NIM required.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Tuple

import structlog

from src.services.climate_data import climate_service

logger = structlog.get_logger()

# Configurable thresholds: precipitation_mm (sum per day) -> (flood_depth_m, risk_level)
FLOOD_THRESHOLDS = [
    (150.0, 2.0, "critical"),
    (100.0, 1.0, "high"),
    (50.0, 0.5, "elevated"),
    (20.0, 0.2, "normal"),
]


@dataclass
class FloodDay:
    """Flood forecast for a single day."""
    date: str  # YYYY-MM-DD
    precipitation_mm: float
    flood_depth_m: float
    risk_level: str  # normal, elevated, high, critical


@dataclass
class FloodForecastResult:
    """Full flood forecast result for a location."""
    latitude: float
    longitude: float
    days: int
    daily: List[FloodDay]
    # Summary for visualization: worst day in window
    max_flood_depth_m: float
    max_risk_level: str
    # Optional polygon as list of [lng, lat] for buffer around center (e.g. ~2km)
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


def _precipitation_to_flood(precipitation_mm: float) -> Tuple[float, str]:
    """Map daily precipitation (mm) to flood depth (m) and risk level."""
    depth = 0.0
    risk = "normal"
    for threshold_mm, depth_m, level in FLOOD_THRESHOLDS:
        if precipitation_mm >= threshold_mm:
            depth = depth_m
            risk = level
            break
    return depth, risk


def _buffer_polygon(lat: float, lon: float, radius_deg: float = 0.18) -> List[List[float]]:
    """Axis-aligned buffer (~20km at mid-latitudes) so zones are visible on the globe. Returns [lng, lat] per vertex."""
    return [
        [lon - radius_deg, lat - radius_deg],
        [lon + radius_deg, lat - radius_deg],
        [lon + radius_deg, lat + radius_deg],
        [lon - radius_deg, lat + radius_deg],
        [lon - radius_deg, lat - radius_deg],
    ]


class FloodImpactService:
    """
    CPU-only flood impact from Open-Meteo forecast.
    No GPU or Earth-2 required.
    """

    async def get_flood_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        include_polygon: bool = True,
    ) -> FloodForecastResult:
        """
        Get flood forecast from Open-Meteo and apply precipitation -> depth rules.

        Args:
            latitude: Center latitude
            longitude: Center longitude
            days: Forecast days (1-16)
            include_polygon: If True, add polygon (buffer around point) for 3D viz

        Returns:
            FloodForecastResult with daily breakdown and summary
        """
        forecasts = await climate_service.get_forecast(latitude, longitude, days=min(days, 16))
        # Aggregate by day (date string)
        daily_precip: dict = defaultdict(float)
        for f in forecasts:
            day_key = f.timestamp.strftime("%Y-%m-%d")
            daily_precip[day_key] += f.precipitation_mm

        daily: List[FloodDay] = []
        max_depth = 0.0
        max_risk = "normal"
        risk_order = ["normal", "elevated", "high", "critical"]

        for date_str in sorted(daily_precip.keys()):
            precip = daily_precip[date_str]
            depth, risk = _precipitation_to_flood(precip)
            daily.append(
                FloodDay(
                    date=date_str,
                    precipitation_mm=round(precip, 2),
                    flood_depth_m=round(depth, 2),
                    risk_level=risk,
                )
            )
            if depth > max_depth:
                max_depth = depth
            if risk_order.index(risk) > risk_order.index(max_risk):
                max_risk = risk

        polygon = _buffer_polygon(latitude, longitude) if include_polygon else None

        return FloodForecastResult(
            latitude=latitude,
            longitude=longitude,
            days=len(daily),
            daily=daily,
            max_flood_depth_m=round(max_depth, 2),
            max_risk_level=max_risk,
            polygon=polygon,
            source="open_meteo",
        )


flood_impact_service = FloodImpactService()
