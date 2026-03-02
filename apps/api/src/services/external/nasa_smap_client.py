"""
NASA SMAP soil moisture client. Fallback: antecedent precipitation estimate.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class SoilMoistureData:
    lat: float
    lon: float
    volumetric_pct: float
    source: str
    timestamp_utc: Optional[datetime] = None


class NASASMAPClient:
    def __init__(self, timeout: float = 10.0, cache_ttl_hours: int = 24):
        self.timeout = timeout
        self._cache: Dict[str, Tuple[SoilMoistureData, datetime]] = {}
        self._cache_ttl = timedelta(hours=cache_ttl_hours)

    async def get_soil_moisture(
        self,
        lat: float,
        lon: float,
        antecedent_precip_mm: Optional[float] = None,
    ) -> SoilMoistureData:
        cache_key = f"smap_{lat:.3f}_{lon:.3f}_{antecedent_precip_mm or 0:.1f}"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return data
        if antecedent_precip_mm is not None:
            if antecedent_precip_mm > 80:
                vol = 38.0
            elif antecedent_precip_mm > 40:
                vol = 28.0
            elif antecedent_precip_mm > 15:
                vol = 18.0
            else:
                vol = 12.0
        else:
            vol = 20.0
        result = SoilMoistureData(
            lat=lat,
            lon=lon,
            volumetric_pct=vol,
            source="antecedent_precip",
            timestamp_utc=datetime.utcnow(),
        )
        self._cache[cache_key] = (result, datetime.utcnow())
        return result


nasa_smap_client = NASASMAPClient()
