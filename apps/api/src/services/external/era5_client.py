"""
ERA5 Climate Reanalysis data client (Copernicus CDS API).

Historical climate data for Layer 3 simulation: temperature, precipitation, wind, SLP.
"""
import logging
from typing import Any, Dict, List, Optional

from src.core.config import settings

logger = logging.getLogger(__name__)


class ERA5Client:
    """Client for ERA5 climate reanalysis data via Copernicus CDS."""

    def __init__(self):
        self.cds_api_key = getattr(settings, "cds_api_key", "") or ""
        self.cds_api_url = getattr(settings, "cds_api_url", "https://cds.climate.copernicus.eu/api/v2") or ""

    @property
    def enabled(self) -> bool:
        return bool(self.cds_api_key)

    async def get_climate_reanalysis(
        self,
        lat: float,
        lng: float,
        variables: Optional[List[str]] = None,
        year: int = 2024,
        months: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Fetch ERA5 reanalysis data for a location."""
        variables = variables or ["2m_temperature", "total_precipitation", "10m_u_component_of_wind", "mean_sea_level_pressure"]
        months = months or list(range(1, 13))

        if not self.enabled:
            return self._mock_data(lat, lng, variables, year)

        try:
            import cdsapi
            c = cdsapi.Client(url=self.cds_api_url, key=self.cds_api_key)
            result = c.retrieve("reanalysis-era5-single-levels-monthly-means", {
                "product_type": "monthly_averaged_reanalysis",
                "variable": variables,
                "year": str(year),
                "month": [f"{m:02d}" for m in months],
                "time": "00:00",
                "area": [lat + 0.5, lng - 0.5, lat - 0.5, lng + 0.5],
                "format": "netcdf",
            })
            return {
                "source": "era5_cds",
                "lat": lat, "lng": lng,
                "year": year,
                "variables": variables,
                "status": "downloaded",
                "file": str(result),
            }
        except Exception as e:
            logger.warning("ERA5 CDS query failed: %s", e)
            return self._mock_data(lat, lng, variables, year)

    def _mock_data(self, lat: float, lng: float, variables: List[str], year: int) -> Dict[str, Any]:
        import random
        monthly = {}
        for v in variables:
            if "temperature" in v:
                monthly[v] = [round(273 + 10 + 15 * abs(6.5 - m) / 6.5 + random.gauss(0, 2), 1) for m in range(1, 13)]
            elif "precipitation" in v:
                monthly[v] = [round(max(0, 50 + 30 * (1 - abs(6.5 - m) / 6.5) + random.gauss(0, 15)), 1) for m in range(1, 13)]
            elif "wind" in v:
                monthly[v] = [round(3 + random.gauss(0, 1.5), 1) for m in range(1, 13)]
            else:
                monthly[v] = [round(101325 + random.gauss(0, 500), 0) for m in range(1, 13)]
        return {
            "source": "mock",
            "lat": lat, "lng": lng,
            "year": year,
            "monthly_data": monthly,
            "note": "Set CDS_API_KEY for real ERA5 data",
        }


era5_client = ERA5Client()
