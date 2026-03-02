"""
Weather ingestion job: Open-Meteo (and optionally OpenWeather).

Schedule: every 30 min.
Returns affected_city_ids from weather points for risk recalculation.
"""
import asyncio
from typing import Any, Dict, List, Set

from src.services.ingestion.pipeline import run_ingestion_job
from src.services.ingestion.location_resolver import lat_lng_to_nearby_city_ids
from src.services.external.open_meteo_client import open_meteo_client

# Sample cities (lat, lng): NYC, London, Tokyo
_WEATHER_POINTS = [(40.71, -74.01), (51.51, -0.13), (35.68, 139.69)]


def _serialize(obj: Any) -> Any:
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if hasattr(obj, "__dict__") and not isinstance(obj, type):
        return {k: _serialize(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
    if isinstance(obj, (list, tuple)):
        return [_serialize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


async def _fetch_weather() -> Dict[str, Any]:
    forecasts = await asyncio.gather(
        *[open_meteo_client.get_forecast(lat, lng) for lat, lng in _WEATHER_POINTS]
    )
    affected: Set[str] = set()
    for lat, lng in _WEATHER_POINTS:
        for cid in lat_lng_to_nearby_city_ids(lat, lng, radius_km=80.0, max_cities=15):
            affected.add(cid)
    data = {
        "points": [_serialize(f) for f in forecasts],
        "count": len(forecasts),
    }
    summary = {"points_count": len(forecasts), "affected_cities": len(affected), "risk_type": "climate"}
    return {
        "data": data,
        "affected_city_ids": list(affected)[:200] if affected else None,
        "summary": summary,
        "channel": "weather",
        "risk_type": "climate",
    }


async def run_weather_job() -> Dict[str, Any]:
    return await run_ingestion_job(
        source_id="weather",
        fetch_fn=_fetch_weather,
        channel="weather",
    )
