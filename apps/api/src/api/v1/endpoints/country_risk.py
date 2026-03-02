"""
Country Risk API - Aggregated country-level risk analytics.

Provides:
- Country risk scores (aggregated from city-level data)
- City list with risk scores for a country
- Country-level hazard breakdown
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from src.data.cities import get_all_cities, CityData, get_cities_by_country_code
from src.services.city_risk_calculator import get_city_risk_calculator
from src.core.provenance_response import make_risk_response_provenance

logger = logging.getLogger(__name__)

router = APIRouter()

# Hysteresis for country risk_level: avoid flicker critical↔high when composite is near threshold.
_COUNTRY_RISK_LEVEL_PREV: Dict[str, str] = {}
_COUNTRY_COMPOSITE_PREV: Dict[str, float] = {}
_COUNTRY_HYSTERESIS = {"critical_exit": 0.75, "high_exit": 0.55, "medium_exit": 0.35}

# Map ISO 3166-1 alpha-2 codes to country names used in cities database
ISO_TO_COUNTRY_NAME: Dict[str, List[str]] = {
    "US": ["USA"],
    "CA": ["Canada"],
    "MX": ["Mexico"],
    "BR": ["Brazil"],
    "AR": ["Argentina"],
    "CL": ["Chile"],
    "CO": ["Colombia"],
    "GB": ["UK"],
    "FR": ["France"],
    "DE": ["Germany"],
    "IT": ["Italy"],
    "ES": ["Spain"],
    "PT": ["Portugal"],
    "NL": ["Netherlands"],
    "BE": ["Belgium"],
    "CH": ["Switzerland"],
    "AT": ["Austria"],
    "SE": ["Sweden"],
    "NO": ["Norway"],
    "DK": ["Denmark"],
    "FI": ["Finland"],
    "PL": ["Poland"],
    "CZ": ["Czech Republic"],
    "GR": ["Greece"],
    "TR": ["Turkey"],
    "RU": ["Russia"],
    "UA": ["Ukraine"],
    "JP": ["Japan"],
    "CN": ["China"],
    "KR": ["South Korea"],
    "TW": ["Taiwan"],
    "IN": ["India"],
    "ID": ["Indonesia"],
    "TH": ["Thailand"],
    "VN": ["Vietnam"],
    "PH": ["Philippines"],
    "MY": ["Malaysia"],
    "SG": ["Singapore"],
    "BD": ["Bangladesh"],
    "PK": ["Pakistan"],
    "AU": ["Australia"],
    "NZ": ["New Zealand"],
    "ZA": ["South Africa"],
    "NG": ["Nigeria"],
    "KE": ["Kenya"],
    "EG": ["Egypt"],
    "MA": ["Morocco"],
    "AE": ["UAE"],
    "SA": ["Saudi Arabia"],
    "IL": ["Israel"],
    "HK": ["Hong Kong"],
    "IE": ["Ireland"],
    "LY": ["Libya"],
    "PT": ["Portugal"],
    "NZ": ["New Zealand"],
    "MA": ["Morocco"],
    "KE": ["Kenya"],
    "CZ": ["Czech Republic"],
    "HU": ["Hungary"],
    "RO": ["Romania"],
    "MY": ["Malaysia"],
    "PE": ["Peru"],
}

# Reverse mapping: country name -> ISO code
COUNTRY_NAME_TO_ISO: Dict[str, str] = {}
for iso, names in ISO_TO_COUNTRY_NAME.items():
    for n in names:
        COUNTRY_NAME_TO_ISO[n.lower()] = iso


def _get_cities_for_country(country_code: str) -> List[CityData]:
    """Get all cities in the database for a given ISO country code."""
    cities = get_cities_by_country_code(country_code)
    if cities:
        return cities
    # Fallback: match by country name for legacy codes
    names = ISO_TO_COUNTRY_NAME.get(country_code.upper(), [country_code])
    all_cities = get_all_cities()
    return [c for c in all_cities if c.country in names]


@router.get("/{country_code}")
async def get_country_risk(country_code: str):
    """
    Get aggregated risk data for a country.

    Returns composite risk score, per-hazard breakdown, top cities,
    financial exposure, and population at risk.
    """
    code = country_code.upper()
    cities = _get_cities_for_country(code)

    if not cities:
        # Unknown: do not fake risk; expose quality flag
        return {
            "country_code": code,
            "country_name": code,
            "cities_count": 0,
            "risk_known": False,
            "composite_risk": None,
            "risk_level": "unknown",
            "hazards": {},
            "top_cities": [],
            "total_exposure_b": 0,
            **make_risk_response_provenance(data_sources=["city_risk_calculator"], confidence=0.0),
        }

    # Calculate risk scores for each city
    city_risks = []
    for city in cities:
        try:
            score = await get_city_risk_calculator().calculate_risk(city.id)
            city_risks.append({
                "city": city,
                "score": score,
            })
        except Exception as e:
            logger.warning(f"Failed to calculate risk for {city.id}: {e}")
            # Do not substitute 0.5: use known_risks average only if available, else unknown
            if city.known_risks:
                avg_risk = sum(city.known_risks.values()) / len(city.known_risks)
                score_known = True
            else:
                avg_risk = None  # unknown; exclude from composite or expose flag
                score_known = False
            city_risks.append({
                "city": city,
                "score": type("FallbackScore", (), {
                    "risk_score": avg_risk if avg_risk is not None else 0.0,
                    "risk_factors": {},
                    "exposure": city.exposure,
                })(),
                "score_known": score_known,
            })
            continue
    for cr in city_risks:
        if "score_known" not in cr:
            cr["score_known"] = True

    # Aggregate (only over cities with known score; do not use 0.5 for unknown)
    total_exposure = sum(c["city"].exposure for c in city_risks)
    known_list = [c for c in city_risks if c.get("score_known", True)]
    if not known_list:
        return {
            "country_code": code,
            "country_name": cities[0].country if cities else code,
            "cities_count": len(cities),
            "risk_known": False,
            "composite_risk": None,
            "risk_level": "unknown",
            "hazards": {},
            "top_cities": [],
            "total_exposure_b": round(total_exposure, 1),
            "population_at_risk_estimate": len(cities) * 2_000_000,
            **make_risk_response_provenance(data_sources=["city_risk_calculator"], confidence=0.0),
        }
    risk_scores = [c["score"].risk_score for c in known_list]
    total_exposure_known = sum(c["city"].exposure for c in known_list)
    if total_exposure_known > 0:
        composite = sum(
            c["score"].risk_score * c["city"].exposure
            for c in known_list
        ) / total_exposure_known
    else:
        composite = sum(risk_scores) / len(risk_scores)

    # Per-hazard aggregation (over known scores only)
    hazard_types = ["seismic", "flood", "hurricane", "political", "economic", "infrastructure", "historical"]
    hazards = {}
    for h in hazard_types:
        values = []
        for cr in known_list:
            factors = getattr(cr["score"], "risk_factors", {})
            if isinstance(factors, dict) and h in factors:
                val = factors[h]
                values.append(val.value if hasattr(val, "value") else val)
            elif cr["city"].known_risks and h in cr["city"].known_risks:
                values.append(cr["city"].known_risks[h])
        if values:
            hazards[h] = round(sum(values) / len(values), 3)

    # Risk level with hysteresis (avoid flicker between critical and high on server)
    def _raw_level(comp: float) -> str:
        if comp >= 0.75:
            return "critical"
        if comp >= 0.55:
            return "high"
        if comp >= 0.35:
            return "medium"
        return "low"

    prev_level = _COUNTRY_RISK_LEVEL_PREV.get(code)
    raw_level = _raw_level(composite)
    if prev_level == "critical" and composite >= _COUNTRY_HYSTERESIS["critical_exit"]:
        risk_level = "critical"
    elif prev_level == "high" and composite >= _COUNTRY_HYSTERESIS["high_exit"]:
        risk_level = "critical" if composite >= 0.75 else "high"
    elif prev_level == "medium" and composite >= _COUNTRY_HYSTERESIS["medium_exit"]:
        risk_level = raw_level
    else:
        risk_level = raw_level
    _COUNTRY_RISK_LEVEL_PREV[code] = risk_level
    _COUNTRY_COMPOSITE_PREV[code] = composite

    # Top cities by risk (only known scores)
    sorted_cities = sorted(known_list, key=lambda c: c["score"].risk_score, reverse=True)
    top_cities = [
        {
            "id": c["city"].id,
            "name": c["city"].name,
            "lat": c["city"].lat,
            "lng": c["city"].lng,
            "risk_score": round(c["score"].risk_score, 3),
            "exposure_b": round(c["city"].exposure, 1),
        }
        for c in sorted_cities[:20]
    ]

    country_name = cities[0].country if cities else code

    return {
        "country_code": code,
        "country_name": country_name,
        "cities_count": len(cities),
        "risk_known": True,
        "composite_risk": round(composite, 3),
        "risk_level": risk_level,
        "hazards": hazards,
        "top_cities": top_cities,
        "total_exposure_b": round(total_exposure, 1),
        "population_at_risk_estimate": len(cities) * 2_000_000,  # Rough estimate
        **make_risk_response_provenance(
            data_sources=["city_risk_calculator", "geo_data"],
            confidence=0.8 if len(known_list) >= len(city_risks) * 0.8 else 0.6,
        ),
    }


@router.get("/{country_code}/cities")
async def get_country_cities(
    country_code: str,
    min_risk: float = Query(0.0, ge=0, le=1),
    max_risk: float = Query(1.0, ge=0, le=1),
):
    """
    Get all cities in a country with their risk scores.

    Returns list of cities with coordinates, risk scores, and exposure.
    Used for placing city markers on the Country Mode map.
    """
    code = country_code.upper()
    cities = _get_cities_for_country(code)

    results = []
    for city in cities:
        try:
            score = await get_city_risk_calculator().calculate_risk(city.id)
            risk_val = score.risk_score
            risk_known = True
        except Exception:
            if city.known_risks:
                risk_val = sum(city.known_risks.values()) / len(city.known_risks)
                risk_known = True
            else:
                risk_val = None  # unknown; do not substitute 0.5
                risk_known = False
        if risk_val is None:
            continue  # skip cities with unknown risk from list, or include with risk_known: false
        if min_risk <= risk_val <= max_risk:
            results.append({
                "id": city.id,
                "name": city.name,
                "lat": city.lat,
                "lng": city.lng,
                "risk_score": round(risk_val, 3),
                "exposure_b": round(city.exposure, 1),
                "country": city.country,
                "risk_level": (
                    "critical" if risk_val >= 0.75 else
                    "high" if risk_val >= 0.55 else
                    "medium" if risk_val >= 0.35 else
                    "low"
                ),
            })

    results.sort(key=lambda c: c["risk_score"], reverse=True)
    return {"cities": results, "count": len(results)}


@router.get("/")
async def list_countries():
    """
    List all countries that have cities in the database.

    Returns country names with ISO codes and city counts.
    """
    all_cities = get_all_cities()

    # Group by country
    by_country: Dict[str, List[CityData]] = {}
    for city in all_cities:
        by_country.setdefault(city.country, []).append(city)

    countries = []
    for country_name, cities in sorted(by_country.items()):
        iso = COUNTRY_NAME_TO_ISO.get(country_name.lower(), "")
        total_exposure = sum(c.exposure for c in cities)
        countries.append({
            "country_name": country_name,
            "country_code": iso,
            "cities_count": len(cities),
            "total_exposure_b": round(total_exposure, 1),
        })

    return {"countries": countries}
