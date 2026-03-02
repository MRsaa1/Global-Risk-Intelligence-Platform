"""
Risk Signal Aggregator.

Gathers signals from GDELT, World Bank, IMF, OFAC, Open-Meteo per country/city,
applies EWMA smoothing (alpha=0.3), quality scoring, and exposes normalized
s_raw, s_smooth, q_quality for each factor for use by CityRiskCalculator.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional

from .external.gdelt_client import gdelt_client
from .external.worldbank_client import worldbank_client
from .external.imf_client import imf_client
from .external.ofac_client import ofac_client
from .external.open_meteo_client import open_meteo_client

logger = logging.getLogger(__name__)

EWMA_ALPHA = 0.3

# Country name (from cities) -> ISO2 for OFAC/IMF/DOC queries
COUNTRY_NAME_TO_ISO2: Dict[str, str] = {
    "USA": "US", "United States": "US", "US": "US",
    "Canada": "CA", "UK": "GB", "United Kingdom": "GB", "GB": "GB",
    "Ukraine": "UA", "Russia": "RU", "Germany": "DE", "France": "FR",
    "China": "CN", "Japan": "JP", "India": "IN", "Brazil": "BR", "Mexico": "MX",
    "Argentina": "AR", "South Korea": "KR", "Australia": "AU", "Italy": "IT",
    "Spain": "ES", "Netherlands": "NL", "Switzerland": "CH", "Poland": "PL",
    "Turkey": "TR", "Saudi Arabia": "SA", "UAE": "AE", "United Arab Emirates": "AE", "Qatar": "QA", "Singapore": "SG",
    "Taiwan": "TW", "Thailand": "TH", "Indonesia": "ID", "Philippines": "PH",
    "Vietnam": "VN", "Bangladesh": "BD", "Pakistan": "PK", "South Africa": "ZA",
    "Egypt": "EG", "Nigeria": "NG", "Iran": "IR", "Israel": "IL", "Belgium": "BE",
    "Austria": "AT", "Sweden": "SE", "Norway": "NO", "Finland": "FI",
    "Denmark": "DK", "Ireland": "IE", "Greece": "GR", "Portugal": "PT",
    "Lebanon": "LB", "Colombia": "CO", "Chile": "CL", "Venezuela": "VE",
    "Syria": "SY", "Yemen": "YE", "Sudan": "SD", "Afghanistan": "AF",
    "Belarus": "BY", "North Korea": "KP", "Libya": "LY", "Palestine": "PS",
    "Hong Kong": "HK",
}


@dataclass
class FactorSignal:
    """Single factor signal with raw, smoothed, and quality."""
    factor: str
    s_raw: float
    s_smooth: float
    q_quality: float
    source: str = ""
    fetched_at: Optional[datetime] = None


@dataclass
class LocationSignals:
    """All risk signals for a location (city or country)."""
    location_id: str
    country_iso2: str
    signals: Dict[str, FactorSignal] = field(default_factory=dict)
    fetched_at: Optional[datetime] = None


def _country_to_iso2(country_name: str) -> str:
    key = (country_name or "").strip()
    return COUNTRY_NAME_TO_ISO2.get(key, key[:2].upper() if len(key) >= 2 else "")


class RiskSignalAggregator:
    """
    Aggregates risk signals from external APIs per location.
    EWMA state is kept in memory (keyed by location_id).
    """

    def __init__(self, ewma_alpha: float = EWMA_ALPHA):
        self.ewma_alpha = ewma_alpha
        self._ewma_state: Dict[str, Dict[str, float]] = {}  # location_id -> factor -> s_smooth_prev

    def _get_ewma(self, location_id: str, factor: str, s_raw: float, q: float) -> float:
        """Return smoothed value; update state."""
        key = f"{location_id}:{factor}"
        if location_id not in self._ewma_state:
            self._ewma_state[location_id] = {}
        prev = self._ewma_state[location_id].get(factor)
        if prev is None:
            smoothed = s_raw
        else:
            smoothed = self.ewma_alpha * s_raw + (1.0 - self.ewma_alpha) * prev
        self._ewma_state[location_id][factor] = smoothed
        return smoothed

    async def get_signals_for_city(
        self,
        city_id: str,
        city_name: str,
        country: str,
        lat: float,
        lng: float,
        use_gdelt: bool = True,
        use_economic: bool = True,
        use_sanctions: bool = True,
        use_weather: bool = True,
    ) -> LocationSignals:
        """
        Gather conflict, political, logistics, infrastructure (GDELT),
        economic (World Bank + IMF), sanctions (OFAC+UN), and flood (Open-Meteo) signals.
        """
        iso2 = _country_to_iso2(country)
        region_name = city_name or country
        signals: Dict[str, FactorSignal] = {}
        now = datetime.utcnow()

        if use_gdelt:
            try:
                conflict = await gdelt_client.get_conflict_signals_for_region(region_name, iso2, days=7)
                c_raw = _gdelt_signals_to_risk(conflict)
                q = conflict.get("quality", 0.0)
                s_smooth = self._get_ewma(city_id, "conflict", c_raw, q)
                signals["conflict"] = FactorSignal("conflict", c_raw, s_smooth, q, "GDELT DOC", now)
            except Exception as e:
                logger.debug("GDELT conflict for %s: %s", city_id, e)
            try:
                political = await gdelt_client.get_political_signals_for_region(region_name, days=7)
                p_raw = _gdelt_signals_to_risk(political)
                q = political.get("quality", 0.0)
                s_smooth = self._get_ewma(city_id, "political", p_raw, q)
                signals["political"] = FactorSignal("political", p_raw, s_smooth, q, "GDELT DOC", now)
            except Exception as e:
                logger.debug("GDELT political for %s: %s", city_id, e)
            try:
                logistics = await gdelt_client.get_logistics_signals_for_region(region_name, days=7)
                l_raw = _gdelt_signals_to_risk(logistics)
                q = logistics.get("quality", 0.0)
                s_smooth = self._get_ewma(city_id, "logistics", l_raw, q)
                signals["logistics"] = FactorSignal("logistics", l_raw, s_smooth, q, "GDELT DOC", now)
            except Exception as e:
                logger.debug("GDELT logistics for %s: %s", city_id, e)
            try:
                infra = await gdelt_client.get_infrastructure_signals_for_region(region_name, days=7)
                i_raw = _gdelt_signals_to_risk(infra)
                q = infra.get("quality", 0.0)
                s_smooth = self._get_ewma(city_id, "infrastructure", i_raw, q)
                signals["infrastructure"] = FactorSignal("infrastructure", i_raw, s_smooth, q, "GDELT DOC", now)
            except Exception as e:
                logger.debug("GDELT infrastructure for %s: %s", city_id, e)

        if use_economic and iso2:
            try:
                wb = await worldbank_client.get_country_snapshot(iso2)
                e_raw = _economic_snapshot_to_risk(wb)
                q = wb.quality
                s_smooth = self._get_ewma(city_id, "economic", e_raw, q)
                signals["economic"] = FactorSignal("economic", e_raw, s_smooth, q, "World Bank", now)
            except Exception as e:
                logger.debug("World Bank for %s: %s", city_id, e)

        if use_sanctions and iso2:
            try:
                san = await ofac_client.get_country_snapshot(iso2)
                s_raw = san.sanctions_score
                q = 1.0 if san.fetched_at else 0.0
                s_smooth = self._get_ewma(city_id, "sanctions", s_raw, q)
                signals["sanctions"] = FactorSignal("sanctions", s_raw, s_smooth, q, "OFAC+UN", now)
            except Exception as e:
                logger.debug("OFAC for %s: %s", city_id, e)

        if use_weather:
            try:
                flood = await open_meteo_client.get_flood_risk_signal(lat, lng)
                f_raw = flood.get("flood_risk", 0.0)
                q = flood.get("quality", 0.0)
                s_smooth = self._get_ewma(city_id, "flood_external", f_raw, q)
                signals["flood_external"] = FactorSignal("flood_external", f_raw, s_smooth, q, "Open-Meteo", now)
            except Exception as e:
                logger.debug("Open-Meteo for %s: %s", city_id, e)

        return LocationSignals(
            location_id=city_id,
            country_iso2=iso2,
            signals=signals,
            fetched_at=now,
        )

    def clear_ewma_state(self) -> None:
        self._ewma_state.clear()


def _gdelt_signals_to_risk(signals: Dict[str, Any]) -> float:
    """
    Map GDELT article count + tone to 0..1 risk.
    More articles + more negative tone -> higher risk.
    """
    count = signals.get("article_count", 0) or 0
    avg_tone = signals.get("avg_tone", 0.0) or 0.0
    if count == 0:
        return 0.0
    import math
    log_count = math.log1p(count)
    tone_factor = 0.5 - (avg_tone / 20.0)  # tone -10..+10 -> higher when negative
    tone_factor = max(0.0, min(1.0, tone_factor))
    raw = min(1.0, (log_count / 4.0) * 0.6 + tone_factor * 0.4)
    return round(raw, 4)


def _economic_snapshot_to_risk(snapshot: Any) -> float:
    """
    Map World Bank inflation, GDP growth, unemployment to 0..1 risk.
    High inflation, negative GDP growth, high unemployment -> higher risk.
    Returns 0.5 (neutral) when no data is available.
    """
    infl = getattr(snapshot, "inflation_annual_pct", None)
    gdp = getattr(snapshot, "gdp_growth_annual_pct", None)
    unem = getattr(snapshot, "unemployment_pct", None)
    risk = 0.0
    n = 0
    if infl is not None:
        risk += min(1.0, max(0.0, (infl + 5) / 50.0))  # -5% to 45% -> 0..1
        n += 1
    if gdp is not None:
        risk += min(1.0, max(0.0, (5 - gdp) / 10.0))  # 5% to -5% growth -> 0..1
        n += 1
    if unem is not None:
        risk += min(1.0, unem / 25.0)
        n += 1
    if n == 0:
        return 0.5
    return round(risk / n, 4)


risk_signal_aggregator = RiskSignalAggregator()
