from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
import asyncio
import logging
import math
import random
from datetime import datetime, timedelta

from src.data.cities import get_all_cities, get_haven_for_location, composite_risk_score
from src.services.external.usgs_client import usgs_client
from src.services.external.nasa_firms_client import nasa_firms_client
from src.services.external.nws_alerts_client import nws_alerts_client

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Data Models ---

class GeoPoint(BaseModel):
    latitude: float
    longitude: float

class FloodForecastResponse(BaseModel):
    center: GeoPoint
    max_flood_depth_m: float
    risk_level: str  # "normal", "elevated", "high", "critical"
    extent_radius_km: float
    valid_time: str

class WindForecastResponse(BaseModel):
    max_wind_kmh: float
    category: int  # 0-5 (Saffir-Simpson)
    direction_degrees: float
    turbulence_intensity: float
    valid_time: str

class MetroFloodPoint(BaseModel):
    name: str
    location: GeoPoint
    flood_depth_m: float
    is_flooded: bool

class HighFidelityScenario(BaseModel):
    id: str
    name: str
    model: str  # "wrf" or "adcirc"
    description: str

class HighFidelityFloodResponse(BaseModel):
    scenario_id: str
    max_flood_depth_m: float
    risk_level: str
    polygon_points: List[GeoPoint]  # Simplified polygon for extent
    valid_time: str

class HighFidelityWindResponse(BaseModel):
    scenario_id: str
    wind_speed_kmh: float
    category: int
    direction_degrees: float
    valid_time: str

class ScenarioMetadata(BaseModel):
    scenario_id: str
    model: str
    run_time: str
    bbox: List[float]  # [min_lat, min_lon, max_lat, max_lon]
    resolution_m: float


class ClimateHavenResponse(BaseModel):
    """Recommended climate haven for a location (e.g. by 2040)."""
    city_id: str
    name: str
    country: str
    latitude: float
    longitude: float
    composite_score: float  # 0-1, lower = safer
    reason: str

# --- Routes ---

@router.get("/flood-forecast")
async def get_flood_forecast(
    latitude: float = Query(..., description="Target latitude"),
    longitude: float = Query(..., description="Target longitude"),
    days: int = Query(7, description="Forecast duration in days"),
    include_polygon: bool = Query(True, description="Return polygon for Cesium globe viz"),
):
    """
    Get mocked flood forecast for a specific location.
    Returns polygon and max_flood_depth_m for Cesium when include_polygon=true.
    """
    # Mock data logic: slightly deterministic based on coords
    base_depth = (abs(latitude) + abs(longitude)) % 5.0

    risk_level = "normal"
    if base_depth > 0.5: risk_level = "elevated"
    if base_depth > 2.0: risk_level = "high"
    if base_depth > 4.0: risk_level = "critical"

    out: Dict[str, Any] = {
        "center": {"latitude": latitude, "longitude": longitude},
        "max_flood_depth_m": round(base_depth, 2),
        "risk_level": risk_level,
        "extent_radius_km": 5.0,
        "valid_time": datetime.now().isoformat(),
    }
    if include_polygon:
        out["polygon"] = _circle_polygon(longitude, latitude, 0.08)
    return out

@router.get("/wind-forecast")
async def get_wind_forecast(
    latitude: float = Query(..., description="Target latitude"),
    longitude: float = Query(..., description="Target longitude"),
    days: int = Query(7, description="Forecast duration in days"),
    include_polygon: bool = Query(True, description="Return polygon for Cesium globe viz"),
):
    """
    Get mocked wind forecast for a specific location.
    Returns polygon and max_category for Cesium when include_polygon=true.
    """
    # Mock data
    base_wind = ((abs(latitude) * abs(longitude)) % 250)

    category = 0
    if base_wind > 119: category = 1
    if base_wind > 154: category = 2
    if base_wind > 178: category = 3
    if base_wind > 209: category = 4
    if base_wind > 252: category = 5

    out: Dict[str, Any] = {
        "max_wind_kmh": round(base_wind, 1),
        "category": category,
        "max_category": category,
        "direction_degrees": random.uniform(0, 360),
        "turbulence_intensity": random.uniform(0.1, 1.0),
        "valid_time": datetime.now().isoformat(),
    }
    if include_polygon:
        out["polygon"] = _circle_polygon(longitude, latitude, 0.08)
    return out

@router.get("/indicators")
async def get_climate_indicators(
    latitude: float = Query(..., description="Target latitude"),
    longitude: float = Query(..., description="Target longitude"),
) -> Any:
    """
    Climate risk indicators for a location (ClimateWidget).
    Returns flood_risk, heat_stress, storm_risk, drought_risk; deterministic from coords when no external API.
    """
    base = (abs(latitude) + abs(longitude)) % 1.0
    indicators = [
        {"name": "flood_risk", "value": round(0.2 + base * 0.5, 3), "unit": "index", "threshold": 0.6, "risk_level": "normal" if base < 0.5 else "elevated"},
        {"name": "heat_stress", "value": round(0.15 + (1 - base) * 0.4, 3), "unit": "index", "threshold": 0.5, "risk_level": "normal" if base > 0.4 else "elevated"},
        {"name": "storm_risk", "value": round(0.1 + base * 0.6, 3), "unit": "index", "threshold": 0.55, "risk_level": "normal"},
        {"name": "drought_risk", "value": round(base * 0.4, 3), "unit": "index", "threshold": 0.5, "risk_level": "low" if base < 0.6 else "medium"},
    ]
    overall = "normal" if base < 0.5 else ("elevated" if base < 0.75 else "high")
    return {
        "latitude": latitude,
        "longitude": longitude,
        "indicators": indicators,
        "overall_risk": overall,
    }


@router.get("/haven", response_model=ClimateHavenResponse)
async def get_climate_haven(
    lat: float = Query(..., description="Your latitude"),
    lon: float = Query(..., description="Your longitude"),
):
    """
    Climate Haven Finder: for your location, return a recommended haven (city with lowest composite risk).
    Same country preferred; else global minimum. Use in Digital Twin or settings as "Your climate haven by 2040".
    """
    haven, reason = get_haven_for_location(lat, lon)
    if not haven:
        raise HTTPException(status_code=404, detail=reason)
    score = round(composite_risk_score(haven), 3)
    return ClimateHavenResponse(
        city_id=haven.id,
        name=haven.name,
        country=haven.country,
        latitude=haven.lat,
        longitude=haven.lng,
        composite_score=score,
        reason=reason,
    )


@router.get("/forecast")
async def get_climate_forecast(
    latitude: float = Query(..., description="Target latitude"),
    longitude: float = Query(..., description="Target longitude"),
    days: int = Query(3, ge=1, le=14),
) -> Any:
    """
    Weather forecast for a location (ClimateWidget). Deterministic mock when no Open-Meteo/external API.
    """
    now = datetime.utcnow()
    base = (abs(latitude) + abs(longitude)) % 1.0
    data = []
    for d in range(days):
        for h in [0, 6, 12, 18]:
            ts = now + timedelta(days=d, hours=h)
            data.append({
                "timestamp": ts.isoformat() + "Z",
                "temperature_c": round(10 + 15 * (1 - base) + (d + h / 24) * 2, 1),
                "precipitation_mm": round(max(0, (base * 10 - d) * 1.5), 1),
                "wind_speed_ms": round(3 + base * 8 + (d % 2) * 2, 1),
                "humidity_percent": round(50 + base * 30 + d * 2, 0),
            })
    return {"data": data}


@router.get("/metro-flood", response_model=List[MetroFloodPoint])
async def get_metro_flood(
    latitude: float = Query(..., description="Center latitude"),
    longitude: float = Query(..., description="Center longitude"),
    radius_km: float = Query(15.0, description="Search radius")
):
    """
    Get flooding status for metro/subway entrances near the location.
    """
    # Returns 3 mocked metro stations
    stations = []
    for i in range(3):
        is_flooded = random.choice([True, False])
        depth = random.uniform(0.5, 3.0) if is_flooded else 0.0
        
        stations.append(MetroFloodPoint(
            name=f"Metro Station {chr(65+i)}",
            location=GeoPoint(
                latitude=latitude + random.uniform(-0.02, 0.02),
                longitude=longitude + random.uniform(-0.02, 0.02)
            ),
            flood_depth_m=round(depth, 2),
            is_flooded=is_flooded
        ))
    return stations

# --- High Fidelity Endpoints ---

SCENARIOS = {
    "wrf_nyc_202501": HighFidelityScenario(id="wrf_nyc_202501", name="NYC Storm 2025", model="wrf", description="Category 3 hurricane hitting NYC"),
    "adcirc_galveston_202501": HighFidelityScenario(id="adcirc_galveston_202501", name="Galveston Surge", model="adcirc", description="Severe storm surge event"),
}

@router.get("/high-fidelity/scenarios", response_model=List[HighFidelityScenario])
async def list_scenarios():
    """List available pre-computed high-fidelity scenarios."""
    return list(SCENARIOS.values())

@router.get("/high-fidelity/flood", response_model=HighFidelityFloodResponse)
async def get_hires_flood(scenario_id: str):
    if scenario_id not in SCENARIOS:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Mock data for scenario
    return HighFidelityFloodResponse(
        scenario_id=scenario_id,
        max_flood_depth_m=3.5 if "nyc" in scenario_id else 5.2,
        risk_level="critical",
        polygon_points=[
            GeoPoint(latitude=40.70, longitude=-74.02),
            GeoPoint(latitude=40.72, longitude=-74.02),
            GeoPoint(latitude=40.72, longitude=-74.00),
            GeoPoint(latitude=40.70, longitude=-74.00),
        ],
        valid_time=datetime.now().isoformat()
    )

@router.get("/high-fidelity/wind", response_model=HighFidelityWindResponse)
async def get_hires_wind(scenario_id: str):
    if scenario_id not in SCENARIOS:
        raise HTTPException(status_code=404, detail="Scenario not found")
        
    return HighFidelityWindResponse(
        scenario_id=scenario_id,
        wind_speed_kmh=180.0,
        category=3,
        direction_degrees=45.0,
        valid_time=datetime.now().isoformat()
    )

@router.get("/high-fidelity/metadata", response_model=ScenarioMetadata)
async def get_hires_metadata(scenario_id: str):
    if scenario_id not in SCENARIOS:
        raise HTTPException(status_code=404, detail="Scenario not found")
        
    return ScenarioMetadata(
        scenario_id=scenario_id,
        model=SCENARIOS[scenario_id].model,
        run_time=datetime.now().isoformat(),
        bbox=[40.6, -74.1, 40.9, -73.9],
        resolution_m=10.0
    )


def _circle_polygon(lon: float, lat: float, radius_deg: float, num_points: int = 12) -> List[List[float]]:
    """Return polygon as [[lon, lat], ...] approximating a circle (for earthquake impact zone)."""
    points: List[List[float]] = []
    for i in range(num_points + 1):
        angle = 2 * math.pi * i / num_points
        # Approximate: delta_lon ~ radius/cos(lat), delta_lat ~ radius
        dlat = radius_deg * math.cos(angle)
        dlon = radius_deg * math.sin(angle) / max(0.01, math.cos(math.radians(lat)))
        points.append([lon + dlon, lat + dlat])
    return points


def _buffer_radius_deg() -> float:
    """Radius for climate layer polygons on globe (~5–10 km)."""
    return 0.08


# --- Climate layers for CesiumGlobe (heat, heavy rain, drought, UV) ---

@router.get("/heat-forecast")
async def get_heat_forecast(
    latitude: float = Query(..., description="Target latitude"),
    longitude: float = Query(..., description="Target longitude"),
    days: int = Query(7, ge=1, le=14),
    include_polygon: bool = Query(True, description="Return polygon for globe viz"),
) -> Any:
    """
    Heat stress forecast for a location. Returns polygon and max_risk_level for Cesium globe layer.
    Mock when no external API; can be wired to climate_anomalies_service.get_heat_forecast.
    """
    base = (abs(latitude) + abs(longitude)) % 1.0
    risk_level = "normal"
    if base > 0.7:
        risk_level = "extreme"
    elif base > 0.5:
        risk_level = "high"
    elif base > 0.3:
        risk_level = "elevated"
    polygon = _circle_polygon(longitude, latitude, _buffer_radius_deg()) if include_polygon else None
    return {"polygon": polygon, "max_risk_level": risk_level}


@router.get("/heavy-rain-forecast")
async def get_heavy_rain_forecast(
    latitude: float = Query(..., description="Target latitude"),
    longitude: float = Query(..., description="Target longitude"),
    days: int = Query(7, ge=1, le=14),
    include_polygon: bool = Query(True, description="Return polygon for globe viz"),
) -> Any:
    """
    Heavy rain forecast for a location. Returns polygon and max_risk_level for Cesium globe layer.
    """
    base = (abs(latitude) * 0.7 + abs(longitude) * 0.3) % 1.0
    risk_level = "normal"
    if base > 0.7:
        risk_level = "extreme"
    elif base > 0.5:
        risk_level = "high"
    elif base > 0.3:
        risk_level = "elevated"
    polygon = _circle_polygon(longitude, latitude, _buffer_radius_deg()) if include_polygon else None
    return {"polygon": polygon, "max_risk_level": risk_level}


@router.get("/drought-forecast")
async def get_drought_forecast(
    latitude: float = Query(..., description="Target latitude"),
    longitude: float = Query(..., description="Target longitude"),
    include_polygon: bool = Query(True, description="Return polygon for globe viz"),
) -> Any:
    """
    Drought risk for a location. Returns polygon and drought_risk for Cesium globe layer.
    """
    base = (abs(latitude) + abs(longitude) * 0.5) % 1.0
    drought_risk = "normal"
    if base > 0.6:
        drought_risk = "extreme"
    elif base > 0.4:
        drought_risk = "high"
    elif base > 0.2:
        drought_risk = "elevated"
    polygon = _circle_polygon(longitude, latitude, _buffer_radius_deg()) if include_polygon else None
    return {"polygon": polygon, "drought_risk": drought_risk}


@router.get("/uv-forecast")
async def get_uv_forecast(
    latitude: float = Query(..., description="Target latitude"),
    longitude: float = Query(..., description="Target longitude"),
    days: int = Query(7, ge=1, le=14),
    include_polygon: bool = Query(True, description="Return polygon for globe viz"),
) -> Any:
    """
    UV index forecast for a location. Returns polygon and max_risk_level for Cesium globe layer.
    """
    base = (abs(latitude) * 0.4 + abs(longitude) * 0.6) % 1.0
    risk_level = "normal"
    if base > 0.7:
        risk_level = "extreme"
    elif base > 0.5:
        risk_level = "high"
    elif base > 0.3:
        risk_level = "elevated"
    polygon = _circle_polygon(longitude, latitude, _buffer_radius_deg()) if include_polygon else None
    return {"polygon": polygon, "max_risk_level": risk_level}


@router.get("/earthquake-zones")
async def get_earthquake_zones(
    days: int = Query(365, ge=1, le=3650),
    min_magnitude: float = Query(5.0, ge=0, le=10),
) -> Any:
    """
    Earthquake zones M5+ from USGS for globe visualization.
    Returns list with polygon (impact zone) per event so Cesium can render 3D zones.
    """
    raw = await usgs_client.get_earthquake_zones_global(days=days, min_magnitude=min_magnitude)
    earthquakes: List[Dict[str, Any]] = []
    for eq in raw:
        mag = eq.get("magnitude") or 5.0
        lat = eq.get("lat") or 0.0
        lng = eq.get("lng") or 0.0
        radius_deg = 0.15 + (mag - 5) * 0.25
        radius_deg = min(2.0, max(0.2, radius_deg))
        polygon = _circle_polygon(lng, lat, radius_deg)
        earthquakes.append({
            "id": eq.get("id") or "",
            "lat": lat,
            "lng": lng,
            "magnitude": mag,
            "place": eq.get("place") or "Unknown",
            "polygon": polygon,
        })
    return {"earthquakes": earthquakes}


# ---------------------------------------------------------------------------
# Active Incidents — real-time aggregated layer (USGS + FIRMS + NWS)
# ---------------------------------------------------------------------------

# In-memory cache for the assembled GeoJSON (avoids re-fetching every request)
_active_incidents_cache: Dict[str, Any] = {}
_active_incidents_cache_ts: Optional[datetime] = None
_ACTIVE_INCIDENTS_TTL = timedelta(seconds=60)

# Severity -> fraction of exposure at risk (probable damage factor)
_SEVERITY_DAMAGE_FACTOR = {"minor": 0.01, "moderate": 0.05, "severe": 0.15, "extreme": 0.35}
# Incident type -> radius_km for "zone of influence" (used for impact calculation)
_INCIDENT_RADIUS_KM = {"earthquake": 250, "fire": 100, "weather_alert": 150}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two points (WGS84)."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _point_from_geometry(geom: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    """Get (lat, lng) from Point or centroid of first ring of Polygon."""
    if geom.get("type") == "Point":
        coords = geom.get("coordinates", [])
        if len(coords) >= 2:
            return (float(coords[1]), float(coords[0]))
        return None
    if geom.get("type") == "Polygon":
        rings = geom.get("coordinates", [])
        if not rings or not rings[0]:
            return None
        ring = rings[0]
        n = len(ring)
        if n < 3:
            return None
        lon = sum(p[0] for p in ring) / n
        lat = sum(p[1] for p in ring) / n
        return (lat, lon)
    return None


def _enrich_incident_impact(
    feature: Dict[str, Any],
    cities: List[Any],
) -> None:
    """Mutate feature properties: add infrastructure_impact, estimated_damage_usd, exposure_b, cities_in_zone, affected_region, affected_city_names."""
    geom = feature.get("geometry") or {}
    props = feature.setdefault("properties", {})
    incident_type = (props.get("type") or "earthquake").lower()
    severity = (props.get("severity") or "moderate").lower()
    radius_km = _INCIDENT_RADIUS_KM.get(incident_type, 80)
    factor = _SEVERITY_DAMAGE_FACTOR.get(severity, 0.05)

    point = _point_from_geometry(geom)
    if point is None:
        props["infrastructure_impact"] = "No location (geometry missing)"
        props["estimated_damage_usd"] = 0
        props["exposure_b"] = 0.0
        props["cities_in_zone"] = 0
        props["affected_region"] = "—"
        props["affected_city_names"] = []
        return

    lat, lng = point
    in_zone: List[Tuple[Any, float]] = []
    for city in cities:
        d = _haversine_km(lat, lng, city.lat, city.lng)
        if d <= radius_km:
            in_zone.append((city, d))

    if not in_zone:
        props["infrastructure_impact"] = f"0 cities in zone (radius {radius_km} km)"
        props["estimated_damage_usd"] = 0
        props["exposure_b"] = 0.0
        props["cities_in_zone"] = 0
        props["affected_region"] = "—"
        props["affected_city_names"] = []
        return

    exposure_b = sum(c.exposure for c, _ in in_zone)
    damage_usd = exposure_b * 1e9 * factor
    n = len(in_zone)
    city_names = [c.name for c, _ in in_zone]
    countries = sorted(set(c.country for c, _ in in_zone))
    # Region string: "Country: City1, City2" or "Country1, Country2: City1, City2"
    region_part = ", ".join(countries)
    cities_part = ", ".join(city_names[:5]) + ("..." if len(city_names) > 5 else "")
    affected_region = f"{region_part}: {cities_part}" if city_names else region_part

    props["infrastructure_impact"] = f"{n} city(ies), {exposure_b:.1f} B USD exposure"
    props["estimated_damage_usd"] = round(damage_usd, 0)
    props["exposure_b"] = round(exposure_b, 2)
    props["cities_in_zone"] = n
    props["affected_region"] = affected_region
    props["affected_city_names"] = city_names


def _severity_from_magnitude(mag: float) -> str:
    """Map earthquake magnitude to unified severity."""
    if mag >= 7.0:
        return "extreme"
    if mag >= 5.5:
        return "severe"
    if mag >= 4.0:
        return "moderate"
    return "minor"


async def _fetch_earthquake_incidents() -> List[Dict[str, Any]]:
    """Fetch recent earthquakes (last 24h, M2.5+) and convert to GeoJSON features."""
    try:
        raw = await usgs_client.get_earthquake_zones_global(days=1, min_magnitude=2.5)
    except Exception as e:
        logger.warning("Active incidents: USGS fetch failed: %s", e)
        return []

    features: List[Dict[str, Any]] = []
    for eq in raw:
        lat = eq.get("lat")
        lng = eq.get("lng")
        mag = eq.get("magnitude") or 0
        if lat is None or lng is None:
            continue
        ts = eq.get("time")
        updated_at = ts.isoformat() if isinstance(ts, datetime) else datetime.utcnow().isoformat()

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "type": "earthquake",
                "severity": _severity_from_magnitude(mag),
                "title": f"M{mag:.1f} — {eq.get('place', 'Unknown')}",
                "magnitude": mag,
                "updated_at": updated_at,
            },
        })
    return features


async def _fetch_fire_incidents() -> List[Dict[str, Any]]:
    """Fetch active fires from FIRMS and convert to GeoJSON features."""
    try:
        fires = await nasa_firms_client.get_active_fires(days=1, min_confidence=80, limit=500)
    except Exception as e:
        logger.warning("Active incidents: FIRMS fetch failed: %s", e)
        return []

    features: List[Dict[str, Any]] = []
    for f in fires:
        lat = f.get("lat")
        lng = f.get("lng")
        if lat is None or lng is None:
            continue

        brightness = f.get("brightness", 0)
        severity = "extreme" if brightness > 400 else "severe" if brightness > 350 else "moderate"

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "type": "fire",
                "severity": severity,
                "title": "Active Fire",
                "confidence": f.get("confidence", 0),
                "brightness": brightness,
                "updated_at": f.get("acq_date", datetime.utcnow().strftime("%Y-%m-%d")),
            },
        })
    return features


async def _fetch_weather_alert_incidents() -> List[Dict[str, Any]]:
    """Fetch NWS active alerts and convert to GeoJSON features."""
    try:
        alerts = await nws_alerts_client.get_active_alerts(severity="Severe,Extreme", limit=50)
    except Exception as e:
        logger.warning("Active incidents: NWS fetch failed: %s", e)
        return []

    features: List[Dict[str, Any]] = []
    for a in alerts:
        geometry = a.get("geometry")
        if geometry is None:
            continue

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "type": "weather_alert",
                "severity": a.get("severity", "severe"),
                "title": a.get("headline") or a.get("event", "Weather Alert"),
                "event": a.get("event", ""),
                "updated_at": a.get("effective", datetime.utcnow().isoformat()),
                "expires": a.get("expires", ""),
            },
        })
    return features


@router.get("/active-incidents")
async def get_active_incidents(
    types: Optional[str] = Query(
        None,
        description="Comma-separated incident types to include: earthquake,fire,weather_alert. Default: all.",
    ),
) -> Any:
    """
    Real-time active incidents aggregated from USGS, NASA FIRMS, and NWS.

    Returns GeoJSON FeatureCollection with unified properties:
    - type: earthquake | fire | weather_alert
    - severity: minor | moderate | severe | extreme
    - title: human-readable description
    - updated_at: ISO timestamp

    Cached for 60 seconds to protect external APIs.
    """
    global _active_incidents_cache, _active_incidents_cache_ts

    # Parse requested types
    requested_types = {"earthquake", "fire", "weather_alert"}
    if types:
        requested_types = {t.strip().lower() for t in types.split(",") if t.strip()}

    # Check cache (cache stores the full set; filtering is cheap)
    now = datetime.utcnow()
    if (
        _active_incidents_cache_ts
        and now - _active_incidents_cache_ts < _ACTIVE_INCIDENTS_TTL
        and _active_incidents_cache
    ):
        features = _active_incidents_cache.get("features", [])
        if requested_types != {"earthquake", "fire", "weather_alert"}:
            features = [f for f in features if f.get("properties", {}).get("type") in requested_types]
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "cached": True,
                "updated_at": _active_incidents_cache_ts.isoformat(),
                "count": len(features),
            },
        }

    # Fetch all three sources concurrently
    tasks = []
    tasks.append(_fetch_earthquake_incidents())
    tasks.append(_fetch_fire_incidents())
    tasks.append(_fetch_weather_alert_incidents())

    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_features: List[Dict[str, Any]] = []
    source_names = ["earthquake", "fire", "weather_alert"]
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.warning("Active incidents: %s source failed: %s", source_names[i], result)
            continue
        if isinstance(result, list):
            all_features.extend(result)

    # Enrich each feature with infrastructure impact and estimated damage (cities in zone)
    try:
        cities = get_all_cities()
        for f in all_features:
            _enrich_incident_impact(f, cities)
    except Exception as e:
        logger.warning("Active incidents: impact enrichment failed: %s", e)
    # Ensure every feature has impact fields (fallback if enrichment was skipped)
    for f in all_features:
        p = f.setdefault("properties", {})
        if "infrastructure_impact" not in p:
            p["infrastructure_impact"] = "0 cities in zone"
        if "estimated_damage_usd" not in p:
            p["estimated_damage_usd"] = 0
        if "exposure_b" not in p:
            p["exposure_b"] = 0.0
        if "cities_in_zone" not in p:
            p["cities_in_zone"] = 0
        if "affected_region" not in p:
            p["affected_region"] = "—"
        if "affected_city_names" not in p:
            p["affected_city_names"] = []

    # Cache the full result
    _active_incidents_cache = {"features": all_features}
    _active_incidents_cache_ts = now

    # Filter by requested types
    if requested_types != {"earthquake", "fire", "weather_alert"}:
        all_features = [f for f in all_features if f.get("properties", {}).get("type") in requested_types]

    return {
        "type": "FeatureCollection",
        "features": all_features,
        "metadata": {
            "cached": False,
            "updated_at": now.isoformat(),
            "count": len(all_features),
        },
    }
