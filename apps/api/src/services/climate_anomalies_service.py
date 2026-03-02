"""
Climate Anomalies Service (CPU-only, no GPU).

Provides heat stress, heavy rain, drought, and UV forecasts from Open-Meteo
for 3D visualization layers. No NVIDIA Earth-2 required.
"""
from collections import defaultdict
from dataclasses import dataclass
from typing import List, Optional, Tuple

import structlog

from src.services.climate_data import climate_service

logger = structlog.get_logger()


def _buffer_polygon(lat: float, lon: float, radius_deg: float = 0.18) -> List[List[float]]:
    """Axis-aligned buffer (~20km at mid-latitudes) so zones are visible on the globe. Returns [lng, lat] per vertex."""
    return [
        [lon - radius_deg, lat - radius_deg],
        [lon + radius_deg, lat - radius_deg],
        [lon + radius_deg, lat + radius_deg],
        [lon - radius_deg, lat + radius_deg],
        [lon - radius_deg, lat - radius_deg],
    ]


# --- Heat stress ---
@dataclass
class HeatDay:
    date: str
    max_temp_c: float
    risk_level: str


@dataclass
class HeatForecastResult:
    latitude: float
    longitude: float
    days: int
    daily: List[HeatDay]
    max_temp_c: float
    max_risk_level: str
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


def _temp_to_risk(temp_c: float) -> str:
    if temp_c >= 40:
        return "extreme"
    if temp_c >= 35:
        return "high"
    if temp_c >= 30:
        return "elevated"
    return "normal"


# --- Heavy rain ---
@dataclass
class HeavyRainDay:
    date: str
    precipitation_mm: float
    risk_level: str


@dataclass
class HeavyRainForecastResult:
    latitude: float
    longitude: float
    days: int
    daily: List[HeavyRainDay]
    max_precipitation_mm: float
    max_risk_level: str
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


def _precip_to_risk(precip_mm: float) -> str:
    if precip_mm >= 50:
        return "extreme"
    if precip_mm >= 20:
        return "high"
    if precip_mm >= 10:
        return "elevated"
    return "normal"


# --- Drought ---
@dataclass
class DroughtForecastResult:
    latitude: float
    longitude: float
    drought_risk: str
    value_mm_30d: float
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


# --- UV ---
@dataclass
class UvDay:
    date: str
    max_uv: float
    risk_level: str


@dataclass
class UvForecastResult:
    latitude: float
    longitude: float
    days: int
    daily: List[UvDay]
    max_uv: float
    max_risk_level: str
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


def _uv_to_risk(uv: float) -> str:
    if uv >= 11:
        return "extreme"
    if uv >= 8:
        return "high"
    if uv >= 6:
        return "elevated"
    return "normal"


@dataclass
class AnomaliesResult:
    """Result for get_anomalies (dashboard today-card)."""
    alerts: List[str]
    heat_stress_active: bool


class ClimateAnomaliesService:
    """CPU-only climate anomalies from Open-Meteo."""

    async def get_heat_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        include_polygon: bool = True,
    ) -> HeatForecastResult:
        forecasts = await climate_service.get_forecast(latitude, longitude, days=min(days, 16))
        daily_max: dict = defaultdict(list)
        for f in forecasts:
            day_key = f.timestamp.strftime("%Y-%m-%d")
            daily_max[day_key].append(f.temperature_c)
        daily = []
        max_temp = -999.0
        max_risk = "normal"
        for date_str in sorted(daily_max.keys()):
            temps = daily_max[date_str]
            t = max(temps) if temps else 0.0
            risk = _temp_to_risk(t)
            daily.append(HeatDay(date=date_str, max_temp_c=round(t, 1), risk_level=risk))
            if t > max_temp:
                max_temp = t
                max_risk = risk
        polygon = _buffer_polygon(latitude, longitude) if include_polygon else None
        return HeatForecastResult(
            latitude=latitude,
            longitude=longitude,
            days=len(daily),
            daily=daily,
            max_temp_c=round(max_temp, 1),
            max_risk_level=max_risk,
            polygon=polygon,
            source="open_meteo",
        )

    async def get_heavy_rain_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        include_polygon: bool = True,
    ) -> HeavyRainForecastResult:
        forecasts = await climate_service.get_forecast(latitude, longitude, days=min(days, 16))
        daily_precip: dict = defaultdict(float)
        for f in forecasts:
            day_key = f.timestamp.strftime("%Y-%m-%d")
            daily_precip[day_key] += f.precipitation_mm
        daily = []
        max_precip = 0.0
        max_risk = "normal"
        for date_str in sorted(daily_precip.keys()):
            p = daily_precip[date_str]
            risk = _precip_to_risk(p)
            daily.append(HeavyRainDay(date=date_str, precipitation_mm=round(p, 2), risk_level=risk))
            if p > max_precip:
                max_precip = p
                max_risk = risk
        polygon = _buffer_polygon(latitude, longitude) if include_polygon else None
        return HeavyRainForecastResult(
            latitude=latitude,
            longitude=longitude,
            days=len(daily),
            daily=daily,
            max_precipitation_mm=round(max_precip, 2),
            max_risk_level=max_risk,
            polygon=polygon,
            source="open_meteo",
        )

    async def get_drought_forecast(
        self,
        latitude: float,
        longitude: float,
        include_polygon: bool = True,
    ) -> DroughtForecastResult:
        indicators = await climate_service.get_climate_indicators(latitude, longitude)
        drought = next((i for i in indicators if i.name == "drought_risk"), None)
        risk = drought.risk_level if drought else "normal"
        value = drought.value if drought else 0.0
        polygon = _buffer_polygon(latitude, longitude) if include_polygon else None
        return DroughtForecastResult(
            latitude=latitude,
            longitude=longitude,
            drought_risk=risk,
            value_mm_30d=round(value, 2),
            polygon=polygon,
            source="open_meteo",
        )

    async def get_uv_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        include_polygon: bool = True,
    ) -> UvForecastResult:
        forecasts = await climate_service.get_forecast(latitude, longitude, days=min(days, 16))
        daily_uv: dict = defaultdict(list)
        for f in forecasts:
            day_key = f.timestamp.strftime("%Y-%m-%d")
            daily_uv[day_key].append(getattr(f, "uv_index", 0) or 0)
        daily = []
        max_uv = 0.0
        max_risk = "normal"
        for date_str in sorted(daily_uv.keys()):
            uvs = daily_uv[date_str]
            u = max(uvs) if uvs else 0.0
            risk = _uv_to_risk(u)
            daily.append(UvDay(date=date_str, max_uv=round(u, 1), risk_level=risk))
            if u > max_uv:
                max_uv = u
                max_risk = risk
        polygon = _buffer_polygon(latitude, longitude) if include_polygon else None
        return UvForecastResult(
            latitude=latitude,
            longitude=longitude,
            days=len(daily),
            daily=daily,
            max_uv=round(max_uv, 1),
            max_risk_level=max_risk,
            polygon=polygon,
            source="open_meteo",
        )

    async def get_anomalies(
        self,
        latitude: float,
        longitude: float,
        days: int = 3,
    ) -> AnomaliesResult:
        """
        Lightweight anomalies for dashboard: heat stress and optional alerts.
        One Open-Meteo forecast call. Used by today-card.
        """
        try:
            heat = await self.get_heat_forecast(latitude, longitude, days=min(days, 5), include_polygon=False)
            alerts: List[str] = []
            if heat.max_risk_level in ("high", "extreme"):
                alerts.append(f"Heat stress {heat.max_risk_level}: max {heat.max_temp_c}°C")
            heat_stress_active = heat.max_risk_level in ("elevated", "high", "extreme")
            return AnomaliesResult(alerts=alerts, heat_stress_active=heat_stress_active)
        except Exception as e:
            logger.debug("get_anomalies failed: %s", e)
            return AnomaliesResult(alerts=[], heat_stress_active=False)


climate_anomalies_service = ClimateAnomaliesService()
