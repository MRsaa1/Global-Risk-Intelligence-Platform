"""
Open-Meteo Weather API Client.

Free, no API key. Used for precipitation (flood risk), wind (hurricane/storm),
and temperature extremes. Complements or replaces OpenWeather when key is not set.
"""
import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
REQUEST_TIMEOUT = 15.0
CACHE_TTL = timedelta(hours=3)
MAX_RETRIES = 2


@dataclass
class OpenMeteoForecast:
    """Weather forecast snapshot for risk (flood/hurricane)."""
    lat: float
    lng: float
    precipitation_mm_1h: Optional[float] = None
    precipitation_mm_24h: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    temperature_2m_c: Optional[float] = None
    relative_humidity_2m: Optional[float] = None
    quality: float = 0.0
    fetched_at: Optional[datetime] = None


class OpenMeteoClient:
    """Client for Open-Meteo Forecast API. No API key required."""

    def __init__(self, timeout: float = REQUEST_TIMEOUT, cache_ttl: timedelta = CACHE_TTL):
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}
        self._cache_ttl = cache_ttl

    def _cache_key(self, lat: float, lng: float) -> str:
        return f"om:{lat:.2f},{lng:.2f}"

    def _get_cached(self, key: str) -> Optional[OpenMeteoForecast]:
        if key not in self._cache:
            return None
        data, expiry = self._cache[key]
        if datetime.utcnow() > expiry:
            del self._cache[key]
            return None
        return data

    def _set_cached(self, key: str, data: OpenMeteoForecast) -> None:
        self._cache[key] = (data, datetime.utcnow() + self._cache_ttl)

    async def get_forecast(
        self,
        lat: float,
        lng: float,
        hourly_days: int = 2,
    ) -> OpenMeteoForecast:
        """
        Get current and short-term forecast for flood/wind risk.
        Returns precipitation (mm), wind speed (km/h), temperature, humidity.
        """
        cache_key = self._cache_key(lat, lng)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        params = {
            "latitude": lat,
            "longitude": lng,
            "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
            "hourly": "precipitation,precipitation_probability,temperature_2m,wind_speed_10m,relative_humidity_2m",
            "forecast_days": min(hourly_days, 3),
            "timezone": "UTC",
        }

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.get(OPEN_METEO_URL, params=params)
                    if resp.status_code == 429:
                        logger.debug("Open-Meteo HTTP 429 (rate limit)")
                        if attempt < MAX_RETRIES:
                            await asyncio.sleep(2.0 * (attempt + 1))
                            continue
                        return OpenMeteoForecast(lat=lat, lng=lng, quality=0.0)
                    if resp.status_code != 200:
                        logger.warning("Open-Meteo HTTP %s", resp.status_code)
                        return OpenMeteoForecast(lat=lat, lng=lng, quality=0.0)
                    data = resp.json()
                    out = self._parse_forecast(data, lat, lng)
                    self._set_cached(cache_key, out)
                    return out
            except Exception as e:
                logger.debug("Open-Meteo error (attempt %s): %s", attempt + 1, e)
        return OpenMeteoForecast(lat=lat, lng=lng, quality=0.0)

    def _parse_forecast(self, data: Dict[str, Any], lat: float, lng: float) -> OpenMeteoForecast:
        """Parse API response into OpenMeteoForecast."""
        current = data.get("current") or {}
        hourly = data.get("hourly") or {}
        now = datetime.utcnow()

        prec_1h = None
        if isinstance(current.get("precipitation"), (int, float)):
            prec_1h = float(current["precipitation"])
        prec_24h = None
        hp = hourly.get("precipitation")
        if isinstance(hp, list) and len(hp) >= 24:
            try:
                prec_24h = sum(float(x) for x in hp[:24] if x is not None)
            except (TypeError, ValueError):
                pass

        wind = current.get("wind_speed_10m")
        if wind is not None:
            try:
                wind = float(wind)
            except (TypeError, ValueError):
                wind = None
        temp = current.get("temperature_2m")
        if temp is not None:
            try:
                temp = float(temp)
            except (TypeError, ValueError):
                temp = None
        humidity = current.get("relative_humidity_2m")
        if humidity is not None:
            try:
                humidity = float(humidity)
            except (TypeError, ValueError):
                humidity = None

        n = sum(1 for v in (prec_1h, wind, temp) if v is not None)
        quality = (n / 3.0) if n else 0.0

        return OpenMeteoForecast(
            lat=lat,
            lng=lng,
            precipitation_mm_1h=prec_1h,
            precipitation_mm_24h=prec_24h,
            wind_speed_kmh=wind,
            temperature_2m_c=temp,
            relative_humidity_2m=humidity,
            quality=quality,
            fetched_at=now,
        )

    async def get_flood_risk_signal(self, lat: float, lng: float) -> Dict[str, Any]:
        """
        Derive a simple flood risk signal (0..1) from precipitation and humidity.
        For use in risk_signal_aggregator / city_risk_calculator.
        """
        f = await self.get_forecast(lat, lng)
        rain = f.precipitation_mm_1h or 0.0
        humidity = (f.relative_humidity_2m or 50) / 100.0
        rain_factor = min(1.0, rain / 50.0)
        flood_risk = min(1.0, rain_factor * 0.7 + humidity * 0.3)
        return {
            "flood_risk": round(flood_risk, 4),
            "precipitation_mm_1h": f.precipitation_mm_1h,
            "relative_humidity_2m": f.relative_humidity_2m,
            "source": "Open-Meteo",
            "quality": f.quality,
            "fetched_at": f.fetched_at.isoformat() if f.fetched_at else None,
        }

    def clear_cache(self) -> None:
        self._cache.clear()


open_meteo_client = OpenMeteoClient()
