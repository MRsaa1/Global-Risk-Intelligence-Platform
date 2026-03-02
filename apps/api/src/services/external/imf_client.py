"""
IMF Data API Client (SDMX REST).

Fetches inflation and other indicators when available. Free, no auth.
Cache 24h. Used to supplement World Bank for economic risk factor.
IMF uses 2-letter country codes (e.g. UA, US).
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# IMF Data API (SDMX REST) - dataservicedsg.imf.org
IMF_BASE_URL = "https://dataservicedsg.imf.org/rest/data"
REQUEST_TIMEOUT = 20.0
CACHE_TTL = timedelta(hours=24)
MAX_RETRIES = 2

# IFS dataset: PCPI_IX = Consumer Price Index, PCPIPCH = Inflation rate
# Format: IFS/dataset.freq.country.indicator e.g. IFS/M.UA.PCPI_IX
IMF_IFS_INFLATION = "PCPIPCH"  # Inflation, average consumer prices (percent change)


@dataclass
class IMFDataPoint:
    """Single observation from IMF."""
    country_code: str
    indicator: str
    value: Optional[float]
    period: str
    fetched_at: datetime


@dataclass
class IMFCountrySnapshot:
    """Minimal snapshot for risk (inflation etc)."""
    country_code: str
    inflation_pct: Optional[float] = None
    quality: float = 0.0
    fetched_at: Optional[datetime] = None


class IMFClient:
    """
    Client for IMF Data API (SDMX REST).
    Fallback/supplement to World Bank; same 24h cache.
    """

    def __init__(self, timeout: float = REQUEST_TIMEOUT, cache_ttl: timedelta = CACHE_TTL):
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}
        self._cache_ttl = cache_ttl

    @staticmethod
    def country_iso2_for_imf(country_iso2_or_name: str) -> str:
        """IMF uses 2-letter ISO. Pass through if already 2 chars, else take first 2 of name or map."""
        key = (country_iso2_or_name or "").strip().upper()
        if len(key) == 2:
            return key
        if len(key) == 3:
            return key[:2]  # UKR -> UK (wrong for Ukraine; IMF may use UA)
        return key[:2] if key else ""

    def _cache_key(self, country: str, series: str) -> str:
        return f"imf:{country}:{series}"

    def _get_cached(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        data, expiry = self._cache[key]
        if datetime.utcnow() > expiry:
            del self._cache[key]
            return None
        return data

    def _set_cached(self, key: str, data: Any) -> None:
        self._cache[key] = (data, datetime.utcnow() + self._cache_ttl)

    async def get_ifs_series(
        self,
        country_iso2: str,
        indicator: str = IMF_IFS_INFLATION,
        start: str = "2020",
        end: str = "2026",
    ) -> List[IMFDataPoint]:
        """
        Fetch IFS time series. Country = 2-letter (e.g. US, UA).
        Returns list of period-value pairs.
        """
        country = (country_iso2 or "")[:2].upper()
        if not country:
            return []
        cache_key = self._cache_key(country, indicator)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # SDMX REST: CompactData/IFS/M.US.PCPIPCH
        path = f"{IMF_BASE_URL}/IFS/M.{country}.{indicator}"
        params = {"startPeriod": start, "endPeriod": end}

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.get(path, params=params)
                    if resp.status_code != 200:
                        logger.debug("IMF API HTTP %s for %s %s", resp.status_code, country, indicator)
                        return []
                    data = resp.json()
                    out = self._parse_sdmx(data, country, indicator)
                    self._set_cached(cache_key, out)
                    return out
            except Exception as e:
                logger.warning("IMF API error (attempt %s): %s", attempt + 1, e)
        return []

    def _parse_sdmx(
        self,
        data: Any,
        country_code: str,
        indicator: str,
    ) -> List[IMFDataPoint]:
        """Parse SDMX JSON structure for CompactData."""
        out: List[IMFDataPoint] = []
        now = datetime.utcnow()
        try:
            if isinstance(data, dict):
                ds = data.get("CompactData", data.get("DataSet", {}))
                if isinstance(ds, dict):
                    ds = ds.get("Series", ds.get("Obs", []))
                if not isinstance(ds, list):
                    ds = [ds] if ds else []
                for s in ds:
                    if not isinstance(s, dict):
                        continue
                    obs_list = s.get("Obs", s.get("ObsDimension", []))
                    if not isinstance(obs_list, list):
                        obs_list = [obs_list] if obs_list else []
                    for obs in obs_list:
                        if isinstance(obs, dict):
                            period = str(obs.get("TIME_PERIOD", obs.get("@TIME_PERIOD", obs.get("ObsDimension", ""))))
                            val = obs.get("OBS_VALUE", obs.get("@OBS_VALUE", obs.get("Value")))
                            try:
                                fval = float(val) if val is not None else None
                            except (TypeError, ValueError):
                                fval = None
                            if period:
                                out.append(IMFDataPoint(
                                    country_code=country_code,
                                    indicator=indicator,
                                    value=fval,
                                    period=period,
                                    fetched_at=now,
                                ))
        except Exception as e:
            logger.debug("IMF parse error: %s", e)
        return out

    async def get_country_snapshot(self, country_iso2: str) -> IMFCountrySnapshot:
        """Get latest inflation (and optionally other series) for country."""
        points = await self.get_ifs_series(country_iso2, IMF_IFS_INFLATION)
        latest = None
        if points:
            with_val = [p for p in points if p.value is not None]
            if with_val:
                with_val.sort(key=lambda p: p.period, reverse=True)
                latest = with_val[0].value
        quality = 1.0 if latest is not None else 0.0
        return IMFCountrySnapshot(
            country_code=(country_iso2 or "")[:2].upper(),
            inflation_pct=latest,
            quality=quality,
            fetched_at=datetime.utcnow(),
        )

    def clear_cache(self) -> None:
        self._cache.clear()


imf_client = IMFClient()
