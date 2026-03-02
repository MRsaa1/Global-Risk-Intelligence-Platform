"""
USGS WaterWatch / NWIS client for streamflow and gage data.

Streamflow data: NWIS (National Water Information System);
API: https://waterservices.usgs.gov/nwis/
Water year summaries and maps: https://waterwatch.usgs.gov
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)
USGS_NWIS_SITE_URL = "https://waterservices.usgs.gov/nwis/site/"
USGS_NWIS_IV_URL = "https://waterservices.usgs.gov/nwis/iv/"


@dataclass
class StreamflowData:
    site_code: str
    site_name: str
    lat: float
    lon: float
    discharge_cfs: Optional[float]
    gage_height_ft: Optional[float]
    parameter: str
    timestamp_utc: Optional[datetime]


class USGSWaterWatchClient:
    def __init__(self, timeout: float = 10.0, cache_ttl_hours: int = 6):
        self.timeout = timeout
        self._cache: Dict[str, Tuple[StreamflowData, datetime]] = {}
        self._cache_ttl = timedelta(hours=cache_ttl_hours)

    async def get_streamflow(
        self,
        lat: float,
        lon: float,
        radius_km: float = 50.0,
    ) -> Optional[StreamflowData]:
        cache_key = f"flow_{lat:.2f}_{lon:.2f}_{radius_km}"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return data
        try:
            deg = radius_km / 111.0
            bbox = f"{lat - deg},{lon - deg},{lat + deg},{lon + deg}"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                site_resp = await client.get(
                    USGS_NWIS_SITE_URL,
                    params={
                        "format": "json",
                        "bBox": bbox,
                        "siteType": "ST",
                        "hasDataTypeCd": "iv",
                        "siteStatus": "all",
                        "maxSites": 5,
                    },
                )
                site_resp.raise_for_status()
                site_data = site_resp.json()
                sites = site_data.get("value", [])
                if not sites or not isinstance(sites, list):
                    return None
                site = sites[0] if isinstance(sites[0], dict) else {}
                site_no = (
                    site.get("siteCode", [{}])[0].get("value")
                    if isinstance(site.get("siteCode"), list) and site.get("siteCode")
                    else site.get("siteCode") or ""
                )
                if not site_no:
                    return None
                name = site.get("siteName") or "Unknown"
                site_lat = float(site.get("latitude", lat))
                site_lon = float(site.get("longitude", lon))
                iv_resp = await client.get(
                    USGS_NWIS_IV_URL,
                    params={
                        "format": "json",
                        "sites": site_no,
                        "parameterCd": "00060,00065",
                        "siteStatus": "all",
                    },
                )
                iv_resp.raise_for_status()
                iv_data = iv_resp.json()
                series = iv_data.get("value", {}).get("timeSeries") or iv_data.get("value") or []
                discharge_cfs = None
                gage_height_ft = None
                ts_utc = None
                for s in (series if isinstance(series, list) else []):
                    if not isinstance(s, dict):
                        continue
                    code = (
                        s.get("variable", {}).get("variableCode", [{}])[0].get("value")
                        if isinstance(s.get("variable"), dict) else None
                    ) or ""
                    vals = (s.get("values", [{}])[0].get("value", []) if s.get("values") else [])
                    if vals and isinstance(vals[0], dict):
                        v = vals[0]
                        try:
                            fval = float(v.get("value", 0))
                            if "00060" in str(code):
                                discharge_cfs = fval
                            elif "00065" in str(code):
                                gage_height_ft = fval
                            if v.get("dateTime"):
                                ts_utc = datetime.fromisoformat(v["dateTime"].replace("Z", "+00:00"))
                        except (TypeError, ValueError):
                            pass
                result = StreamflowData(
                    site_code=str(site_no),
                    site_name=name,
                    lat=site_lat,
                    lon=site_lon,
                    discharge_cfs=discharge_cfs,
                    gage_height_ft=gage_height_ft,
                    parameter="00060,00065",
                    timestamp_utc=ts_utc,
                )
                self._cache[cache_key] = (result, datetime.utcnow())
                return result
        except Exception as e:
            logger.warning("USGS WaterWatch request failed: %s", e)
        return None


usgs_waterwatch_client = USGSWaterWatchClient()
