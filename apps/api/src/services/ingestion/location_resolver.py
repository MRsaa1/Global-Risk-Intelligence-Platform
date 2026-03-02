"""
Location resolver for ingestion pipeline.

Maps countries (ISO2) and coordinates to platform city IDs so ingestion jobs
can return affected_city_ids for risk recalculation.
"""
import math
from typing import List, Set

from src.data.cities import get_all_cities

# Country name (as in CITIES_DATABASE) -> ISO2. Must stay in sync with risk_signal_aggregator.
COUNTRY_NAME_TO_ISO2: dict[str, str] = {
    "USA": "US", "United States": "US", "US": "US",
    "Canada": "CA", "UK": "GB", "United Kingdom": "GB", "GB": "GB",
    "Ukraine": "UA", "Russia": "RU", "Germany": "DE", "France": "FR",
    "China": "CN", "Japan": "JP", "India": "IN", "Brazil": "BR", "Mexico": "MX",
    "Argentina": "AR", "South Korea": "KR", "Australia": "AU", "Italy": "IT",
    "Spain": "ES", "Netherlands": "NL", "Switzerland": "CH", "Poland": "PL",
    "Turkey": "TR", "Saudi Arabia": "SA", "UAE": "AE", "Singapore": "SG",
    "Taiwan": "TW", "Thailand": "TH", "Indonesia": "ID", "Philippines": "PH",
    "Vietnam": "VN", "Bangladesh": "BD", "Pakistan": "PK", "South Africa": "ZA",
    "Egypt": "EG", "Nigeria": "NG", "Iran": "IR", "Israel": "IL", "Belgium": "BE",
    "Austria": "AT", "Sweden": "SE", "Norway": "NO", "Finland": "FI",
    "Denmark": "DK", "Ireland": "IE", "Greece": "GR", "Portugal": "PT",
    "Lebanon": "LB", "Colombia": "CO", "Chile": "CL", "Venezuela": "VE",
    "Syria": "SY", "Yemen": "YE", "Sudan": "SD", "Afghanistan": "AF",
    "Belarus": "BY", "North Korea": "KP", "Libya": "LY", "Palestine": "PS",
    "Hong Kong": "HK", "Iraq": "IQ", "Jordan": "JO", "Kuwait": "KW",
    "Qatar": "QA", "Bahrain": "BH", "Oman": "OM", "Malaysia": "MY",
}

# Lazy-built: ISO2 -> list of city_ids
_iso2_to_city_ids: dict[str, List[str]] | None = None


def _build_iso2_to_city_ids() -> dict[str, List[str]]:
    global _iso2_to_city_ids
    if _iso2_to_city_ids is not None:
        return _iso2_to_city_ids
    result: dict[str, List[str]] = {}
    for city in get_all_cities():
        iso2 = COUNTRY_NAME_TO_ISO2.get(city.country) or (
            city.country[:2].upper() if len(city.country) >= 2 else ""
        )
        if iso2:
            result.setdefault(iso2, []).append(city.id)
    _iso2_to_city_ids = result
    return result


def country_iso2_to_city_ids(iso2: str) -> List[str]:
    """Return list of platform city IDs for the given country (ISO 3166-1 alpha-2)."""
    if not iso2 or len(iso2) < 2:
        return []
    key = iso2.upper()[:2]
    return _build_iso2_to_city_ids().get(key, [])


def country_name_to_city_ids(country_name: str) -> List[str]:
    """Return list of platform city IDs for the given country name (e.g. from cities DB)."""
    iso2 = COUNTRY_NAME_TO_ISO2.get((country_name or "").strip())
    if not iso2:
        return []
    return country_iso2_to_city_ids(iso2)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth radius km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def lat_lng_to_nearby_city_ids(
    lat: float,
    lng: float,
    radius_km: float = 150.0,
    max_cities: int = 20,
) -> List[str]:
    """Return platform city IDs within radius_km of (lat, lng), closest first."""
    if radius_km <= 0:
        return []
    cities = get_all_cities()
    with_dist = [
        (c.id, _haversine_km(lat, lng, c.lat, c.lng))
        for c in cities
    ]
    within = [(cid, d) for cid, d in with_dist if d <= radius_km]
    within.sort(key=lambda x: x[1])
    return [cid for cid, _ in within[:max_cities]]


# Keywords in article title/text -> ISO2 for threat_intelligence extraction
COUNTRY_MENTION_TO_ISO2: dict[str, str] = {
    "iran": "IR", "tehran": "IR",
    "israel": "IL", "tel aviv": "IL", "telaviv": "IL", "gaza": "PS", "palestine": "PS",
    "usa": "US", "united states": "US", "u.s.": "US", "america": "US",
    "ukraine": "UA", "kyiv": "UA", "kiev": "UA", "kharkiv": "UA", "odesa": "UA",
    "russia": "RU", "moscow": "RU",
    "china": "CN", "taiwan": "TW", "taipei": "TW",
    "syria": "SY", "damascus": "SY", "aleppo": "SY",
    "yemen": "YE", "sanaa": "YE",
    "lebanon": "LB", "beirut": "LB",
    "iraq": "IQ", "baghdad": "IQ",
    "afghanistan": "AF", "kabul": "AF",
    "north korea": "KP", "pyongyang": "KP",
    "sudan": "SD", "khartoum": "SD",
    "libya": "LY", "tripoli": "LY",
    "venezuela": "VE", "caracas": "VE",
    "belarus": "BY", "minsk": "BY",
    "saudi": "SA", "uae": "AE", "dubai": "AE",
    "egypt": "EG", "cairo": "EG",
    "turkey": "TR", "istanbul": "TR",
    "india": "IN", "pakistan": "PK", "bangladesh": "BD",
    "indonesia": "ID", "jakarta": "ID",
    "philippines": "PH", "manila": "PH",
    "mexico": "MX", "brazil": "BR", "colombia": "CO",
    "france": "FR", "germany": "DE", "uk": "GB", "italy": "IT", "spain": "ES",
}


def extract_affected_city_ids_from_text(text: str, max_cities: int = 150) -> List[str]:
    """
    Extract affected platform city IDs from article/text by matching country/region keywords.
    Used by threat_intelligence job to drive risk recalculation.
    """
    if not text:
        return []
    text_lower = text.lower()
    seen_iso2: Set[str] = set()
    for keyword, iso2 in COUNTRY_MENTION_TO_ISO2.items():
        if keyword in text_lower:
            seen_iso2.add(iso2)
    city_ids: List[str] = []
    for iso2 in seen_iso2:
        city_ids.extend(country_iso2_to_city_ids(iso2))
    # Deduplicate preserving order
    seen: Set[str] = set()
    out: List[str] = []
    for cid in city_ids:
        if cid not in seen and len(out) < max_cities:
            seen.add(cid)
            out.append(cid)
    return out
