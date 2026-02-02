"""CMIP6 adapter: climate projections via CMIP6Client."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base import AdapterResult, BaseAdapter, Region, TimeRange


def _projection_to_dict(p: Any) -> Dict[str, Any]:
    return {
        "variable": getattr(p, "variable", ""),
        "scenario": getattr(p, "scenario", ""),
        "period": getattr(p, "period", ""),
        "value": getattr(p, "value", 0.0),
        "lower_bound": getattr(p, "lower_bound", 0.0),
        "upper_bound": getattr(p, "upper_bound", 0.0),
        "baseline_period": getattr(p, "baseline_period", ""),
        "baseline_value": getattr(p, "baseline_value", 0.0),
        "unit": getattr(p, "unit", ""),
        "model_agreement": getattr(p, "model_agreement", 0.0),
        "num_models": getattr(p, "num_models", 0),
    }


class CMIP6Adapter(BaseAdapter):
    """Adapter for CMIP6 climate projections (Copernicus CDS)."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None

    def _get_client(self) -> Any:
        if self._client is None:
            from src.services.external.cmip6_client import cmip6_client
            self._client = cmip6_client
        return self._client

    def name(self) -> str:
        return "cmip6"

    def description(self) -> str:
        return "CMIP6 climate projections (temperature, precipitation, sea level) by location."

    def params_schema(self) -> Dict[str, Any]:
        return {
            "scenarios": {
                "type": "list",
                "description": "SSP scenarios, e.g. ['ssp245','ssp585']",
                "default": ["ssp245", "ssp585"],
            },
        }

    async def fetch(
        self,
        region: Region,
        time_range: Optional[TimeRange] = None,
        **params: Any,
    ) -> AdapterResult:
        lat, lon = region.center
        client = self._get_client()
        scenarios = params.get("scenarios")
        if isinstance(scenarios, (list, tuple)) and scenarios:
            try:
                from src.services.external.cmip6_client import SSPScenario
                scenarios = [SSPScenario(s) for s in scenarios if isinstance(s, str)]
            except Exception:
                scenarios = None
        if not scenarios:
            from src.services.external.cmip6_client import SSPScenario
            scenarios = [SSPScenario.SSP245, SSPScenario.SSP585]

        loc = await client.get_location_climate(lat, lon, scenarios=scenarios)

        proj_out: Dict[str, List[Dict[str, Any]]] = {}
        for k, v in (loc.projections or {}).items():
            proj_out[k] = [_projection_to_dict(p) for p in v]

        data: Dict[str, Any] = {
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "current_temp_annual": loc.current_temp_annual,
            "current_precip_annual": loc.current_precip_annual,
            "koppen_climate": loc.koppen_climate,
            "heat_stress_risk": loc.heat_stress_risk,
            "drought_risk": loc.drought_risk,
            "flood_risk": loc.flood_risk,
            "sea_level_risk": loc.sea_level_risk,
            "projections": proj_out,
        }
        return AdapterResult(
            data=data,
            meta={"lat": lat, "lon": lon, "scenarios": [s.value for s in scenarios]},
            source="CMIP6 / Copernicus CDS",
        )
