"""
Comparable Historical Events - Smart matching for stress test reports.

Returns ONLY historically comparable events: same event type (flood->flood) and
geographic relevance (same city, country, or similar region).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, List, Optional

# Event type keywords: event_id -> match tags/event_type
FLOOD_KW = ("flood", "sea_level", "sea-level", "tsunami", "storm", "hurricane", "ngfs", "ssp", "coastal")
SEISMIC_KW = ("seismic", "earthquake", "quake", "tsunami")
FIRE_KW = ("fire", "wildfire", "heatwave", "drought")
FINANCIAL_KW = ("financial", "credit", "liquidity", "market", "basel", "debt")
GEOPOLITICAL_KW = ("geopolitical", "conflict", "sanctions", "war", "military")
PANDEMIC_KW = ("pandemic", "covid", "virus", "outbreak", "health")

# City/region to country (used so comparable events show for any city when seed/DB has events in that country)
CITY_TO_COUNTRY: dict[str, str] = {
    "melbourne": "AU",
    "sydney": "AU",
    "brisbane": "AU",
    "perth": "AU",
    "adelaide": "AU",
    "victoria": "AU",
    "queensland": "AU",
    "australia": "AU",
    "new york": "US",
    "los angeles": "US",
    "chicago": "US",
    "san francisco": "US",
    "houston": "US",
    "miami": "US",
    "dallas": "US",
    "atlanta": "US",
    "phoenix": "US",
    "florida": "US",
    "munich": "DE",
    "berlin": "DE",
    "frankfurt": "DE",
    "hamburg": "DE",
    "cologne": "DE",
    "germany": "DE",
    "london": "GB",
    "birmingham": "GB",
    "united kingdom": "GB",
    "paris": "FR",
    "lyon": "FR",
    "marseille": "FR",
    "france": "FR",
    "tokyo": "JP",
    "osaka": "JP",
    "japan": "JP",
    "hong kong": "HK",
    "singapore": "SG",
    "helsinki": "FI",
    "finland": "FI",
    "stockholm": "SE",
    "sweden": "SE",
    "oslo": "NO",
    "norway": "NO",
    "copenhagen": "DK",
    "denmark": "DK",
    "amsterdam": "NL",
    "rotterdam": "NL",
    "netherlands": "NL",
    "rome": "IT",
    "milan": "IT",
    "italy": "IT",
    "madrid": "ES",
    "barcelona": "ES",
    "spain": "ES",
    "warsaw": "PL",
    "poland": "PL",
    "vienna": "AT",
    "austria": "AT",
    "zurich": "CH",
    "switzerland": "CH",
    "brussels": "BE",
    "belgium": "BE",
    "dublin": "IE",
    "ireland": "IE",
    "lisbon": "PT",
    "portugal": "PT",
    "moscow": "RU",
    "russia": "RU",
    "beijing": "CN",
    "shanghai": "CN",
    "china": "CN",
    "mumbai": "IN",
    "delhi": "IN",
    "india": "IN",
    "seoul": "KR",
    "korea": "KR",
    "mexico city": "MX",
    "mexico": "MX",
    "sao paulo": "BR",
    "rio": "BR",
    "brazil": "BR",
    "toronto": "CA",
    "vancouver": "CA",
    "canada": "CA",
}


@dataclass
class ComparableEvent:
    id: str
    name: str
    description: Optional[str]
    event_type: str
    year: Optional[int]
    region_name: Optional[str]
    country_codes: Optional[str]
    severity_actual: Optional[float]
    financial_loss_eur: Optional[float]
    affected_population: Optional[int]
    lessons_learned: Optional[str]
    duration_days: Optional[int]
    recovery_time_months: Optional[int]
    tags: List[str]
    similarity_reason: str  # Why this event is comparable


def _event_category(event_id: str) -> Optional[tuple[str, List[str]]]:
    """Return (category, tag_matches) for event_id. e.g. ('flood', ['flood','storm'])."""
    e = (event_id or "").lower()
    if any(k in e for k in FLOOD_KW):
        return ("flood", ["flood", "storm", "tsunami", "climate"])
    if any(k in e for k in SEISMIC_KW):
        return ("seismic", ["earthquake", "seismic", "tsunami", "climate"])
    if any(k in e for k in FIRE_KW):
        return ("fire", ["fire", "wildfire", "climate"])
    if any(k in e for k in FINANCIAL_KW):
        return ("financial", ["financial", "crisis", "banking"])
    if any(k in e for k in GEOPOLITICAL_KW):
        return ("geopolitical", ["geopolitical", "conflict", "military"])
    if any(k in e for k in PANDEMIC_KW):
        return ("pandemic", ["pandemic", "covid", "health"])
    return ("climate", ["climate"])  # default


def _normalize(s: str) -> str:
    return (s or "").lower().strip().replace(" ", "").replace("-", "")


def _city_primary_key(city_name: str) -> str:
    """Primary city key for country lookup: 'Helsinki, Finland' -> 'helsinki', 'Tokyo' -> 'tokyo'."""
    city_norm = _normalize(city_name)
    if not city_norm:
        return ""
    if "," in city_norm:
        return city_norm.split(",")[0].strip()
    return city_norm


def _geo_matches(city_name: str, region: Optional[str], country: Optional[str]) -> bool:
    """Check if event region/country matches our city."""
    city_norm = _normalize(city_name)
    primary = _city_primary_key(city_name)
    if not primary and not city_norm:
        return True
    region_lower = (region or "").lower()
    country_upper = (country or "").upper()

    # Same country: use primary so "Helsinki, Finland" -> helsinki -> FI
    expected_country = CITY_TO_COUNTRY.get(primary) or CITY_TO_COUNTRY.get(city_norm)
    if expected_country and country_upper == expected_country:
        return True
    # Normalize country_upper for multi-code (e.g. "FI" in "FI,SE")
    country_codes = re.split(r"[\s,;]+", country_upper) if country_upper else []
    if expected_country and expected_country in country_codes:
        return True
    # By country: match by primary or full normalized name (so "Helsinki, Finland" matches FI)
    city_tokens = {primary, city_norm} if primary else {city_norm}
    if country_upper == "AU" and city_tokens & {"melbourne", "sydney", "brisbane", "victoria", "queensland", "australia"}:
        return True
    if country_upper == "DE" and city_tokens & {"munich", "berlin", "germany", "frankfurt", "hamburg", "cologne"}:
        return True
    if country_upper == "FI" and city_tokens & {"helsinki", "finland"}:
        return True
    if country_upper == "SE" and city_tokens & {"stockholm", "sweden"}:
        return True
    if country_upper == "NO" and city_tokens & {"oslo", "norway"}:
        return True
    if country_upper == "DK" and city_tokens & {"copenhagen", "denmark"}:
        return True
    if country_upper == "NL" and city_tokens & {"amsterdam", "rotterdam", "netherlands"}:
        return True
    if country_upper == "FR" and city_tokens & {"paris", "lyon", "marseille", "france"}:
        return True
    if country_upper == "GB" and city_tokens & {"london", "birmingham", "united kingdom"}:
        return True
    if country_upper == "JP" and city_tokens & {"tokyo", "osaka", "japan"}:
        return True
    if country_upper == "US" and city_tokens & {"new york", "chicago", "los angeles", "san francisco", "houston", "miami", "dallas", "atlanta", "phoenix", "florida"}:
        return True

    # Region contains city name
    check = primary or city_norm
    if check and check in region_lower.replace(" ", ""):
        return True
    if region_lower and check and (check in region_lower or region_lower in check):
        return True
    if ("melbourne" in city_norm or (primary and "melbourne" in primary)) and ("melbourne" in region_lower or "victoria" in region_lower or "australia" in region_lower):
        return True
    if ("victoria" in city_norm or (primary and "victoria" in primary)) and ("victoria" in region_lower or "melbourne" in region_lower or "australia" in region_lower):
        return True
    if ("australia" in city_norm or (primary and "australia" in primary)) and ("australia" in region_lower or "melbourne" in region_lower or "brisbane" in region_lower or "victoria" in region_lower or "queensland" in region_lower):
        return True
    if ("helsinki" in city_norm or "finland" in city_norm or (primary and ("helsinki" in primary or "finland" in primary))) and ("helsinki" in region_lower or "finland" in region_lower or "nordic" in region_lower):
        return True

    return False


def _tags_match(tags_str: Optional[str], match_tags: List[str]) -> bool:
    if not tags_str or not match_tags:
        return True
    try:
        tags = json.loads(tags_str) if isinstance(tags_str, str) and tags_str.startswith("[") else []
    except Exception:
        tags = re.findall(r'[\w]+', (tags_str or "").lower())
    tag_set = {t.lower() for t in tags} if isinstance(tags, list) else set()
    if isinstance(tags_str, str) and not tags_str.startswith("["):
        tag_set = {t.strip('"') for t in re.findall(r'"([^"]+)"', tags_str)}
        tag_set |= {t.strip() for t in tags_str.lower().replace('"', "").replace("[", "").replace("]", "").split(",")}
    return any(mt.lower() in tag_set or mt.lower() in (tags_str or "").lower() for mt in match_tags)


def _similarity_reason(
    evt_region: Optional[str],
    evt_country: Optional[str],
    city_name: str,
    category: str,
) -> str:
    city_norm = _normalize(city_name)
    primary = _city_primary_key(city_name)
    city_tokens = {primary, city_norm} if primary else {city_norm}
    parts = []
    check = primary or city_norm
    if evt_region and check and (check in _normalize(evt_region) or "melbourne" in city_norm and "victoria" in (evt_region or "").lower()):
        parts.append(f"Same region ({evt_region})")
    country_codes = (evt_country or "").upper().split(",")[0].strip()
    if country_codes == "AU" and city_tokens & {"melbourne", "victoria", "australia", "sydney", "brisbane"}:
        parts.append("Australia")
    if country_codes == "FI" and city_tokens & {"helsinki", "finland"}:
        parts.append("Finland / Nordic")
    if country_codes == "JP" and city_tokens & {"tokyo", "osaka", "japan"}:
        parts.append("Japan")
    if category == "flood":
        parts.append("Comparable flood event")
    elif category == "seismic":
        parts.append("Comparable seismic event")
    elif category == "financial":
        parts.append("Comparable financial stress")
    elif category == "pandemic":
        parts.append("Comparable pandemic")
    return "; ".join(parts) if parts else "Similar event type and region"


def filter_comparable(
    events: List[Any],
    event_id: str,
    city_name: str,
    limit: int = 5,
) -> List[dict]:
    """
    Filter events to only comparable: same event type + geographic relevance.

    events: list of HistoricalEvent or dict with name, event_type, region_name, country_codes, tags, etc.
    """
    cat = _event_category(event_id)
    if not cat:
        return []
    category, match_tags = cat

    result: List[dict] = []
    for e in events:
        if hasattr(e, "__dict__"):
            d = {
                "id": getattr(e, "id", None),
                "name": getattr(e, "name", ""),
                "description": getattr(e, "description", None),
                "event_type": getattr(e, "event_type", ""),
                "region_name": getattr(e, "region_name", None),
                "country_codes": getattr(e, "country_codes", None),
                "severity_actual": getattr(e, "severity_actual", None),
                "financial_loss_eur": getattr(e, "financial_loss_eur", None),
                "affected_population": getattr(e, "affected_population", None),
                "lessons_learned": getattr(e, "lessons_learned", None),
                "duration_days": getattr(e, "duration_days", None),
                "recovery_time_months": getattr(e, "recovery_time_months", None),
                "tags": getattr(e, "tags", None),
                "start_date": getattr(e, "start_date", None),
            }
        else:
            d = dict(e) if isinstance(e, dict) else {}

        evt_type = (d.get("event_type") or "").lower()
        tags_raw = d.get("tags")
        region = d.get("region_name")
        country = d.get("country_codes")

        # Event type match: flood -> climate+flood tags, financial->financial, etc.
        type_ok = False
        if category == "flood":
            type_ok = evt_type == "climate" and _tags_match(tags_raw, ["flood", "storm", "tsunami"])
        elif category == "seismic":
            type_ok = _tags_match(tags_raw, ["earthquake", "seismic", "tsunami"]) or "seismic" in evt_type
        elif category == "financial":
            type_ok = evt_type == "financial"
        elif category == "pandemic":
            type_ok = evt_type == "pandemic"
        elif category == "geopolitical":
            type_ok = evt_type in ("military", "geopolitical")
        else:
            type_ok = _tags_match(tags_raw, match_tags)

        if not type_ok:
            continue

        # Geographic relevance
        if not _geo_matches(city_name, region, country):
            continue

        start = d.get("start_date")
        year = start.year if hasattr(start, "year") else None
        if isinstance(start, str) and len(start) >= 4:
            try:
                year = int(start[:4])
            except Exception:
                pass

        sim_reason = _similarity_reason(region, country, city_name, category)
        evt_id = d.get("id") or ""
        if not evt_id and d.get("name"):
            evt_id = re.sub(r"[^a-z0-9]+", "_", (d.get("name") or "").lower()).strip("_")[:50]
        out = {
            "id": evt_id,
            "name": d.get("name", "Unknown"),
            "description": d.get("description"),
            "event_type": d.get("event_type"),
            "year": year,
            "region_name": region,
            "country_codes": country,
            "severity_actual": d.get("severity_actual"),
            "financial_loss_eur": d.get("financial_loss_eur"),
            "affected_population": d.get("affected_population"),
            "lessons_learned": d.get("lessons_learned"),
            "duration_days": d.get("duration_days"),
            "recovery_time_months": d.get("recovery_time_months"),
            "similarity_reason": sim_reason,
        }
        result.append(out)
        if len(result) >= limit:
            break

    return result
