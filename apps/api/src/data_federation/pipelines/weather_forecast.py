"""weather_forecast pipeline: NIM (FourCastNet) + Weather fallback."""
from __future__ import annotations

from ..adapters.registry import get_adapter
from .base import BasePipeline, PipelineContext, PipelineResult


class WeatherForecastPipeline(BasePipeline):
    """Pipeline: NIM FourCastNet forecast with Weather adapter fallback."""

    @property
    def id(self) -> str:
        return "weather_forecast"

    @property
    def name(self) -> str:
        return "Weather Forecast"

    @property
    def description(self) -> str:
        return "FourCastNet NIM forecast; fallback to Weather adapter if NIM unavailable."

    async def run(self, context: PipelineContext) -> PipelineResult:
        region = context.region
        opts = context.options or {}

        nim = get_adapter("nim")
        forecasts = None
        source = "weather_fallback"

        if nim:
            r = await nim.fetch(
                region,
                context.time_range,
                simulation_length=opts.get("simulation_length", 4),
            )
            if r.data.get("available") and r.data.get("forecasts"):
                forecasts = r.data
                source = "fourcastnet-nim"

        if not forecasts or not forecasts.get("forecasts"):
            weather = get_adapter("weather")
            if weather:
                r = await weather.fetch(region, context.time_range)
                w = r.data.get("current_weather") or r.data.get("flood_risk", {}).get("current_weather")
                if w:
                    forecasts = {
                        "forecasts": [
                            {
                                "forecast_time": None,
                                "lead_hours": 0,
                                "temperature_k": (w.get("temp") or 288) + 273.15,
                                "wind_u_ms": 0,
                                "wind_v_ms": w.get("wind_speed") or 0,
                                "precipitation_mm": w.get("rain_1h") or 0,
                            }
                        ],
                        "latitude": region.center[0],
                        "longitude": region.center[1],
                        "model": "openweather",
                        "available": True,
                    }
                    source = "OpenWeather"

        if not forecasts:
            forecasts = {
                "forecasts": [],
                "latitude": region.center[0],
                "longitude": region.center[1],
                "model": "none",
                "available": False,
            }

        return PipelineResult(
            artifacts={"forecast": forecasts},
            meta={"source": source, "pipeline": self.id},
            pipeline_id=self.id,
        )
