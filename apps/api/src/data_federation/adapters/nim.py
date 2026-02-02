"""NIM adapter: FourCastNet weather forecast via NVIDIA NIM."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from .base import AdapterResult, BaseAdapter, Region, TimeRange


class NIMAdapter(BaseAdapter):
    """Adapter for FourCastNet NIM (local inference) weather forecast."""

    def __init__(self) -> None:
        self._service: Optional[Any] = None

    def _get_service(self) -> Any:
        if self._service is None:
            from src.services.nvidia_nim import nim_service
            self._service = nim_service
        return self._service

    def name(self) -> str:
        return "nim"

    def description(self) -> str:
        return "FourCastNet NIM: AI weather forecast (local GPU)."

    def params_schema(self) -> Dict[str, Any]:
        return {
            "simulation_length": {"type": "int", "default": 4, "description": "Number of 6-hour steps"},
        }

    async def fetch(
        self,
        region: Region,
        time_range: Optional[TimeRange] = None,
        **params: Any,
    ) -> AdapterResult:
        import numpy as np

        lat, lon = region.center
        sim_len = params.get("simulation_length", 4)
        if not isinstance(sim_len, int) or sim_len < 1:
            sim_len = 4
        sim_len = min(40, max(1, sim_len))

        svc = self._get_service()
        input_time = datetime.utcnow()
        # Mock input (same pattern as nvidia endpoint)
        input_data = np.random.randn(1, 1, 73, 721, 1440).astype("float32")

        forecasts = await svc.fourcastnet_forecast(
            input_data=input_data,
            input_time=input_time,
            simulation_length=sim_len,
        )

        if not forecasts:
            return AdapterResult(
                data={"forecasts": [], "model": "fourcastnet-nim", "available": False},
                meta={"lat": lat, "lon": lon, "simulation_length": sim_len},
                source="FourCastNet NIM",
            )

        lat_idx = int((lat + 90) / 180 * 720)
        lon_idx = int(lon / 360 * 1440) % 1440

        out = []
        for f in forecasts:
            out.append({
                "forecast_time": f.time.isoformat(),
                "lead_hours": f.lead_hours,
                "temperature_k": float(f.temperature_2m[lat_idx, lon_idx]),
                "wind_u_ms": float(f.wind_u_10m[lat_idx, lon_idx]),
                "wind_v_ms": float(f.wind_v_10m[lat_idx, lon_idx]),
                "precipitation_mm": float(f.precipitation[lat_idx, lon_idx]),
            })

        return AdapterResult(
            data={
                "forecasts": out,
                "latitude": lat,
                "longitude": lon,
                "input_time": input_time.isoformat(),
                "model": "fourcastnet-nim",
                "available": True,
            },
            meta={"lat": lat, "lon": lon, "simulation_length": sim_len},
            source="FourCastNet NIM",
        )
