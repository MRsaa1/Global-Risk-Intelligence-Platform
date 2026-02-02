"""FEMA adapter: National Risk Index by location via FEMAClient."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .base import AdapterResult, BaseAdapter, Region, TimeRange


class FEMAAdapter(BaseAdapter):
    """Adapter for FEMA National Risk Index (county risk by lat/lon)."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None

    def _get_client(self) -> Any:
        if self._client is None:
            from src.services.external.fema_client import fema_client
            self._client = fema_client
        return self._client

    def name(self) -> str:
        return "fema"

    def description(self) -> str:
        return "FEMA National Risk Index: community and hazard risk by location."

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
        risk = await client.get_risk_by_location(lat, lon)

        if risk is None:
            return AdapterResult(
                data={"risk": None, "found": False},
                meta={"lat": lat, "lon": lon},
                source="FEMA NRI",
            )

        data: Dict[str, Any] = {
            "found": True,
            "fips_code": risk.fips_code,
            "county_name": risk.county_name,
            "state": risk.state,
            "risk_score": risk.risk_score,
            "risk_rating": risk.risk_rating,
            "eal_score": risk.eal_score,
            "eal_rating": risk.eal_rating,
            "eal_value": risk.eal_value,
            "sovi_score": risk.sovi_score,
            "sovi_rating": risk.sovi_rating,
            "resl_score": risk.resl_score,
            "resl_rating": risk.resl_rating,
            "population": risk.population,
            "building_value": risk.building_value,
        }
        return AdapterResult(
            data={"risk": data},
            meta={"lat": lat, "lon": lon},
            source="FEMA National Risk Index",
        )
