"""
Wind Impact Service (CPU-only, no GPU).

Uses Open-Meteo forecast wind_speed_10m and maps to Saffir–Simpson
hurricane categories (1–5) for visualization. No NVIDIA Earth-2 required.
"""
from collections import defaultdict
from dataclasses import dataclass
from typing import List, Optional, Tuple

import structlog

from src.services.climate_data import climate_service

logger = structlog.get_logger()

# Wind speed (km/h) thresholds -> (category 1-5, label)
# Saffir–Simpson: Cat1 119-153, Cat2 154-177, Cat3 178-208, Cat4 209-251, Cat5 252+
WIND_CATEGORIES = [
    (252.0, 5, "Cat 5"),
    (209.0, 4, "Cat 4"),
    (178.0, 3, "Cat 3"),
    (154.0, 2, "Cat 2"),
    (119.0, 1, "Cat 1"),
    (0.0, 0, "Tropical Storm"),
]


@dataclass
class WindDay:
    """Wind forecast for a single day."""
    date: str  # YYYY-MM-DD
    wind_speed_kmh: float
    category: int  # 0 = Tropical Storm, 1-5 = Hurricane
    category_label: str


@dataclass
class WindForecastResult:
    """Wind forecast result for a location."""
    latitude: float
    longitude: float
    days: int
    daily: List[WindDay]
    max_wind_kmh: float
    max_category: int
    max_category_label: str
    polygon: Optional[List[List[float]]] = None  # [lng, lat] for 3D viz
    source: str = "open_meteo"


def _wind_to_category(wind_kmh: float) -> Tuple[int, str]:
    """Map wind speed (km/h) to Saffir–Simpson category."""
    for threshold_kmh, cat, label in WIND_CATEGORIES:
        if wind_kmh >= threshold_kmh:
            return cat, label
    return 0, "Tropical Storm"


def _buffer_polygon(lat: float, lon: float, radius_deg: float = 0.18) -> List[List[float]]:
    """Axis-aligned buffer (~20km at mid-latitudes) so zones are visible on the globe. Returns [lng, lat] per vertex."""
    return [
        [lon - radius_deg, lat - radius_deg],
        [lon + radius_deg, lat - radius_deg],
        [lon + radius_deg, lat + radius_deg],
        [lon - radius_deg, lat + radius_deg],
        [lon - radius_deg, lat - radius_deg],
    ]


class WindImpactService:
    """CPU-only wind impact from Open-Meteo forecast."""

    async def get_wind_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        include_polygon: bool = True,
    ) -> WindForecastResult:
        """
        Get wind forecast from Open-Meteo and map to hurricane categories.

        Args:
            latitude: Center latitude
            longitude: Center longitude
            days: Forecast days (1-16)
            include_polygon: If True, add polygon for 3D viz

        Returns:
            WindForecastResult with daily breakdown and summary
        """
        forecasts = await climate_service.get_forecast(
            latitude, longitude, days=min(days, 16)
        )
        daily_wind: dict = defaultdict(list)
        for f in forecasts:
            day_key = f.timestamp.strftime("%Y-%m-%d")
            # wind_speed_ms -> km/h
            wind_kmh = f.wind_speed_ms * 3.6
            daily_wind[day_key].append(wind_kmh)

        daily: List[WindDay] = []
        max_wind = 0.0
        max_cat = 0
        max_label = "Tropical Storm"

        for date_str in sorted(daily_wind.keys()):
            speeds = daily_wind[date_str]
            max_day = max(speeds) if speeds else 0.0
            cat, label = _wind_to_category(max_day)
            daily.append(
                WindDay(
                    date=date_str,
                    wind_speed_kmh=round(max_day, 2),
                    category=cat,
                    category_label=label,
                )
            )
            if max_day > max_wind:
                max_wind = max_day
                max_cat = cat
                max_label = label

        polygon = _buffer_polygon(latitude, longitude) if include_polygon else None

        return WindForecastResult(
            latitude=latitude,
            longitude=longitude,
            days=len(daily),
            daily=daily,
            max_wind_kmh=round(max_wind, 2),
            max_category=max_cat,
            max_category_label=max_label,
            polygon=polygon,
            source="open_meteo",
        )


wind_impact_service = WindImpactService()
