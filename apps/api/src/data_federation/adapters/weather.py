"""Weather adapter: current weather and flood risk via WeatherClient."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .base import AdapterResult, BaseAdapter, Region, TimeRange


class WeatherAdapter(BaseAdapter):
    """Adapter for OpenWeather / weather and flood risk."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None

    def _get_client(self) -> Any:
        if self._client is None:
            from src.services.external.weather_client import WeatherClient
            self._client = WeatherClient()
        return self._client

    def name(self) -> str:
        return "weather"

    def description(self) -> str:
        return "Current weather and flood risk (OpenWeather or climate zone estimate)."

    def params_schema(self) -> Dict[str, Any]:
        return {}

    async def fetch(
        self,
        region: Region,
        time_range: Optional[TimeRange] = None,
        **params: Any,
    ) -> AdapterResult:
        lat, lon = region.center
        client = self._get_client()

        weather = await client.get_current_weather(lat, lon)
        flood = await client.get_flood_risk(lat, lon)

        data: Dict[str, Any] = {
            "flood_risk": flood,
            "current_weather": weather,
        }
        meta: Dict[str, Any] = {"lat": lat, "lon": lon}
        if weather:
            meta["source"] = "OpenWeather API"
        else:
            meta["source"] = "Climate zone estimate"

        return AdapterResult(data=data, meta=meta, source=meta.get("source", "weather"))
