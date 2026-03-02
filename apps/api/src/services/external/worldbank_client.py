"""
World Bank Indicators API v2 Client.

Fetches macro indicators: inflation (FP.CPI.TOTL.ZG), GDP growth (NY.GDP.MKTP.KD.ZG),
unemployment (SL.UEM.TOTL.ZS). Free, no auth. Cache 24h (quarterly/annual data).
Used for economic risk factor in risk scoring.
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

WORLDBANK_API_URL = "https://api.worldbank.org/v2"
REQUEST_TIMEOUT = 20.0
CACHE_TTL = timedelta(hours=24)
MAX_RETRIES = 2

# Indicator codes
IND_INFLATION = "FP.CPI.TOTL.ZG"  # Consumer price index (annual %)
IND_GDP_GROWTH = "NY.GDP.MKTP.KD.ZG"  # GDP growth (annual %)
IND_UNEMPLOYMENT = "SL.UEM.TOTL.ZS"  # Unemployment, total (% of labor force)

# ISO2 -> World Bank country code (WB uses ISO3 for most; some use ISO2)
# Map our cities' country names / ISO2 to WB code (3-letter where applicable)
COUNTRY_TO_WB: Dict[str, str] = {
    "US": "USA", "USA": "USA", "United States": "USA",
    "CA": "CAN", "Canada": "CAN",
    "GB": "GBR", "UK": "GBR", "United Kingdom": "GBR",
    "UA": "UKR", "Ukraine": "UKR",
    "DE": "DEU", "Germany": "DEU",
    "FR": "FRA", "France": "FRA",
    "CN": "CHN", "China": "CHN",
    "JP": "JPN", "Japan": "JPN",
    "IN": "IND", "India": "IND",
    "BR": "BRA", "Brazil": "BRA",
    "RU": "RUS", "Russia": "RUS",
    "MX": "MEX", "Mexico": "MEX",
    "AR": "ARG", "Argentina": "ARG",
    "KR": "KOR", "South Korea": "KOR",
    "AU": "AUS", "Australia": "AUS",
    "IT": "ITA", "Italy": "ITA",
    "ES": "ESP", "Spain": "ESP",
    "NL": "NLD", "Netherlands": "NLD",
    "CH": "CHE", "Switzerland": "CHE",
    "PL": "POL", "Poland": "POL",
    "TR": "TUR", "Turkey": "TUR",
    "SA": "SAU", "Saudi Arabia": "SAU",
    "AE": "ARE", "UAE": "ARE",
    "SG": "SGP", "Singapore": "SGP",
    "TW": "TWN", "Taiwan": "TWN",
    "TH": "THA", "Thailand": "THA",
    "ID": "IDN", "Indonesia": "IDN",
    "PH": "PHL", "Philippines": "PHL",
    "VN": "VNM", "Vietnam": "VNM",
    "BD": "BGD", "Bangladesh": "BGD",
    "PK": "PAK", "Pakistan": "PAK",
    "ZA": "ZAF", "South Africa": "ZAF",
    "EG": "EGY", "Egypt": "EGY",
    "NG": "NGA", "Nigeria": "NGA",
    "IR": "IRN", "Iran": "IRN",
    "IL": "ISR", "Israel": "ISR",
    "BE": "BEL", "Belgium": "BEL",
    "AT": "AUT", "Austria": "AUT",
    "SE": "SWE", "Sweden": "SWE",
    "NO": "NOR", "Norway": "NOR",
    "FI": "FIN", "Finland": "FIN",
    "DK": "DNK", "Denmark": "DNK",
    "IE": "IRL", "Ireland": "IRL",
    "GR": "GRC", "Greece": "GRC",
    "PT": "PRT", "Portugal": "PRT",
    "LB": "LBN", "Lebanon": "LBN",
    "CO": "COL", "Colombia": "COL",
    "CL": "CHL", "Chile": "CHL",
    "VE": "VEN", "Venezuela": "VEN",
    "SY": "SYR", "Syria": "SYR",
    "YE": "YEM", "Yemen": "YEM",
    "SD": "SDN", "Sudan": "SDN",
    "AF": "AFG", "Afghanistan": "AFG",
    "BY": "BLR", "Belarus": "BLR",
    "KP": "PRK", "North Korea": "PRK",
    "LY": "LBY", "Libya": "LBY",
    "PS": "PSE", "Palestine": "PSE",
    "HK": "HKG", "Hong Kong": "HKG",
}


@dataclass
class WorldBankIndicator:
    """Single indicator value for a country."""
    country_code: str
    indicator_code: str
    value: Optional[float]
    year: str
    fetched_at: datetime


@dataclass
class WorldBankCountrySnapshot:
    """Economic snapshot for risk scoring."""
    country_code: str
    inflation_annual_pct: Optional[float] = None
    gdp_growth_annual_pct: Optional[float] = None
    unemployment_pct: Optional[float] = None
    quality: float = 0.0
    fetched_at: Optional[datetime] = None


class WorldBankClient:
    """Client for World Bank Indicators API v2. Free, no auth."""

    def __init__(self, timeout: float = REQUEST_TIMEOUT, cache_ttl: timedelta = CACHE_TTL):
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}
        self._cache_ttl = cache_ttl

    @staticmethod
    def country_to_wb_code(country_iso2_or_name: str) -> str:
        """Map ISO2 or country name to World Bank 3-letter code."""
        key = (country_iso2_or_name or "").strip()
        if not key:
            return ""
        return COUNTRY_TO_WB.get(key, key[:3].upper() if len(key) >= 3 else key.upper())

    def _cache_key(self, country: str, indicator: str) -> str:
        return f"wb:{country}:{indicator}"

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

    async def get_indicator(
        self,
        country_iso2_or_wb: str,
        indicator_code: str,
        date_range: str = "2020:2026",
    ) -> List[WorldBankIndicator]:
        """Fetch one indicator for one country. Returns list of year-value pairs."""
        wb_code = self.country_to_wb_code(country_iso2_or_wb)
        if not wb_code:
            return []
        cache_key = self._cache_key(wb_code, indicator_code)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        url = f"{WORLDBANK_API_URL}/country/{wb_code}/indicator/{indicator_code}"
        params = {"format": "json", "date": date_range, "per_page": 20}

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.get(url, params=params)
                    if resp.status_code != 200:
                        logger.warning("World Bank API HTTP %s for %s %s", resp.status_code, wb_code, indicator_code)
                        return []
                    data = resp.json()
                    out = self._parse_indicator_response(data, wb_code, indicator_code)
                    self._set_cached(cache_key, out)
                    return out
            except Exception as e:
                logger.warning("World Bank API error (attempt %s): %s", attempt + 1, e)
        return []

    def _parse_indicator_response(
        self,
        data: Any,
        country_code: str,
        indicator_code: str,
    ) -> List[WorldBankIndicator]:
        """Parse API response: [[metadata], [{"indicator":..., "country":..., "value":..., "date":...}]]."""
        out: List[WorldBankIndicator] = []
        if not isinstance(data, list) or len(data) < 2:
            return out
        rows = data[1]
        if not isinstance(rows, list):
            return out
        now = datetime.utcnow()
        for row in rows:
            if not isinstance(row, dict):
                continue
            val = row.get("value")
            year = str(row.get("date", ""))
            if year and (val is not None or row.get("value") is not None):
                try:
                    fval = float(val) if val is not None else None
                except (TypeError, ValueError):
                    fval = None
                out.append(WorldBankIndicator(
                    country_code=country_code,
                    indicator_code=indicator_code,
                    value=fval,
                    year=year,
                    fetched_at=now,
                ))
        return out

    async def get_country_snapshot(
        self,
        country_iso2_or_name: str,
    ) -> WorldBankCountrySnapshot:
        """
        Get inflation, GDP growth, and unemployment for a country.
        Uses latest available year per indicator. Quality = share of indicators present.
        """
        wb_code = self.country_to_wb_code(country_iso2_or_name)
        if not wb_code:
            return WorldBankCountrySnapshot(country_code=country_iso2_or_name or "", quality=0.0)

        infl = await self.get_indicator(wb_code, IND_INFLATION)
        gdp = await self.get_indicator(wb_code, IND_GDP_GROWTH)
        unem = await self.get_indicator(wb_code, IND_UNEMPLOYMENT)

        def latest_value(items: List[WorldBankIndicator]) -> Optional[float]:
            if not items:
                return None
            valid = [i for i in items if i.value is not None]
            if not valid:
                return None
            valid.sort(key=lambda x: x.year, reverse=True)
            return valid[0].value

        inflation = latest_value(infl)
        gdp_growth = latest_value(gdp)
        unemployment = latest_value(unem)
        n = sum(1 for v in (inflation, gdp_growth, unemployment) if v is not None)
        quality = n / 3.0 if n else 0.0

        return WorldBankCountrySnapshot(
            country_code=wb_code,
            inflation_annual_pct=inflation,
            gdp_growth_annual_pct=gdp_growth,
            unemployment_pct=unemployment,
            quality=quality,
            fetched_at=datetime.utcnow(),
        )

    def clear_cache(self) -> None:
        self._cache.clear()


worldbank_client = WorldBankClient()
