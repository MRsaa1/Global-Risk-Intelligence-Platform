"""
UE5 Endpoint -- Bundled data endpoints optimized for Unreal Engine 5.

Provides:
  GET  /ue5/scenario-bundle      -- all data in one call
  GET  /ue5/building-damage-grid -- per-building damage for mesh instancing
  WS   /ue5/ws/stream            -- real-time WebSocket push
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import asyncio
import logging
import math
import random
import json
from datetime import datetime

from src.data.cities import get_all_cities

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CITY_COORDS: Dict[str, tuple] = {
    "newyork":  (40.7128, -74.0060),
    "tokyo":    (35.6762, 139.6503),
    "london":   (51.5074, -0.1278),
    "miami":    (25.7617, -80.1918),
    "shanghai": (31.2304, 121.4737),
}

_INFRA_TYPES = ["power_grid", "water", "hospital", "airport", "school", "bridge", "telecom"]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    rlat1, rlng1, rlat2, rlng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = rlat2 - rlat1
    dlng = rlng2 - rlng1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(min(1.0, math.sqrt(a)))


def _generate_flood(lat: float, lng: float, scenario_id: str) -> dict:
    random.seed(hash(f"flood-{lat}-{lng}-{scenario_id}") % (2**31))
    depth = round(random.uniform(0.5, 6.0), 1)
    risk = "critical" if depth > 3 else "high" if depth > 1 else "elevated" if depth > 0.5 else "normal"
    return {
        "max_flood_depth_m": depth,
        "risk_level": risk,
        "extent_radius_km": round(random.uniform(1.0, 5.0), 1),
        "center": {"latitude": lat, "longitude": lng},
    }


def _generate_wind(lat: float, lng: float, scenario_id: str) -> dict:
    random.seed(hash(f"wind-{lat}-{lng}-{scenario_id}") % (2**31))
    speed = round(random.uniform(60, 280), 0)
    cat = 0
    if speed >= 252: cat = 5
    elif speed >= 209: cat = 4
    elif speed >= 178: cat = 3
    elif speed >= 154: cat = 2
    elif speed >= 119: cat = 1
    return {
        "max_wind_kmh": speed,
        "category": cat,
        "direction_degrees": round(random.uniform(0, 360), 1),
        "turbulence_intensity": round(random.uniform(0.1, 0.9), 2),
    }


def _generate_buildings(lat: float, lng: float, radius_km: float, scenario_id: str) -> list:
    random.seed(hash(f"bldg-{lat}-{lng}-{scenario_id}") % (2**31))
    buildings: list = []
    count = min(500, max(50, int(radius_km * 100)))
    for i in range(count):
        d_lat = random.uniform(-radius_km / 111.0, radius_km / 111.0)
        d_lng = random.uniform(-radius_km / 111.0, radius_km / 111.0)
        b_lat = lat + d_lat
        b_lng = lng + d_lng
        dist = _haversine_km(lat, lng, b_lat, b_lng)
        if dist > radius_km:
            continue
        proximity = 1.0 - (dist / radius_km)
        base_damage = proximity * random.uniform(0.3, 1.0)
        damage_ratio = round(min(1.0, max(0.0, base_damage)), 3)
        flood_depth = round(damage_ratio * random.uniform(0, 6), 2)
        buildings.append({
            "building_id": f"BLD-{scenario_id[:6]}-{i:04d}",
            "latitude": round(b_lat, 6),
            "longitude": round(b_lng, 6),
            "floors": random.randint(1, 50),
            "damage_ratio": damage_ratio,
            "flood_depth_m": flood_depth,
            "structural_integrity": round(1.0 - damage_ratio, 3),
        })
    return buildings


def _generate_infrastructure(city_id: str, lat: float, lng: float) -> list:
    random.seed(hash(f"infra-{city_id}") % (2**31))
    items: list = []
    for i in range(20):
        itype = random.choice(_INFRA_TYPES)
        d_lat = random.uniform(-0.05, 0.05)
        d_lng = random.uniform(-0.05, 0.05)
        integrity = round(random.uniform(0.2, 1.0), 2)
        item_id = f"INFRA-{city_id[:3].upper()}-{i:03d}"
        deps: list = []
        if i > 0:
            deps = [f"INFRA-{city_id[:3].upper()}-{random.randint(0, i-1):03d}"]
        items.append({
            "id": item_id,
            "name": f"{itype.replace('_', ' ').title()} #{i+1}",
            "type": itype,
            "location": {"latitude": round(lat + d_lat, 6), "longitude": round(lng + d_lng, 6)},
            "structural_integrity": integrity,
            "depends_on": deps,
        })
    return items


def _generate_metro_flood(lat: float, lng: float) -> list:
    random.seed(hash(f"metro-{lat}-{lng}") % (2**31))
    stations: list = []
    names = [
        "Central Station", "North Terminal", "South Hub", "East Gate",
        "West End", "Downtown Express", "University", "Airport Link",
        "Harbor Point", "Tech Park", "Financial District", "Old Town",
    ]
    for name in names:
        d_lat = random.uniform(-0.03, 0.03)
        d_lng = random.uniform(-0.03, 0.03)
        depth = round(random.uniform(0, 3), 1)
        stations.append({
            "name": name,
            "location": {"latitude": round(lat + d_lat, 6), "longitude": round(lng + d_lng, 6)},
            "flood_depth_m": depth,
            "is_flooded": depth > 0.3,
        })
    return stations


def _generate_stress_zones(lat: float, lng: float, scenario_id: str) -> list:
    random.seed(hash(f"zones-{lat}-{lng}-{scenario_id}") % (2**31))
    severities = ["critical", "high", "medium", "low"]
    zones: list = []
    for i in range(8):
        sev = severities[i % len(severities)]
        risk_score = {"critical": 0.9, "high": 0.7, "medium": 0.5, "low": 0.3}[sev]
        offset_lat = random.uniform(-0.04, 0.04)
        offset_lng = random.uniform(-0.04, 0.04)
        center_lat = lat + offset_lat
        center_lng = lng + offset_lng
        polygon: list = []
        radius = random.uniform(0.005, 0.02)
        for j in range(6):
            angle = math.radians(j * 60 + random.uniform(-10, 10))
            polygon.append([
                round(center_lng + radius * math.cos(angle), 6),
                round(center_lat + radius * math.sin(angle), 6),
            ])
        polygon.append(polygon[0])
        zones.append({
            "zone_id": f"ZONE-{scenario_id[:4]}-{i:02d}",
            "name": f"Risk Zone {sev.title()} #{i+1}",
            "severity": sev,
            "risk_score": round(risk_score + random.uniform(-0.1, 0.1), 2),
            "exposure_billions": round(random.uniform(0.5, 50.0), 1),
            "estimated_damage_usd": round(random.uniform(1e6, 5e9), 0),
            "polygon": polygon,
        })
    return zones


# ---------------------------------------------------------------------------
# GET /ue5/scenario-bundle
# ---------------------------------------------------------------------------

@router.get("/ue5/scenario-bundle", response_model=None)
async def get_scenario_bundle(
    city_id: str = Query("newyork", description="City ID: newyork, tokyo, london, miami, shanghai"),
    scenario_id: str = Query("default", description="Scenario ID"),
) -> Dict[str, Any]:
    """
    Single JSON with ALL data UE5 needs for a city+scenario.
    Avoids 8+ separate HTTP calls from UE5.
    """
    coords = _CITY_COORDS.get(city_id.lower(), (40.7128, -74.0060))
    lat, lng = coords

    flood = _generate_flood(lat, lng, scenario_id)
    wind = _generate_wind(lat, lng, scenario_id)
    zones = _generate_stress_zones(lat, lng, scenario_id)
    infrastructure = _generate_infrastructure(city_id, lat, lng)
    metro = _generate_metro_flood(lat, lng)
    buildings = _generate_buildings(lat, lng, 2.0, scenario_id)

    active_incidents: list = []
    try:
        from src.api.v1.endpoints.climate import (
            _fetch_earthquake_incidents,
            _fetch_fire_incidents,
            _fetch_weather_alert_incidents,
        )
        results = await asyncio.gather(
            _fetch_earthquake_incidents(),
            _fetch_fire_incidents(),
            _fetch_weather_alert_incidents(),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, list):
                active_incidents.extend(result)
    except Exception as e:
        logger.warning("scenario-bundle: active incidents fetch failed: %s", e)

    return {
        "city_id": city_id,
        "scenario_id": scenario_id,
        "flood": flood,
        "wind": wind,
        "zones": zones,
        "active_incidents": active_incidents,
        "infrastructure": infrastructure,
        "metro_flood_points": metro,
        "buildings": buildings,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /ue5/building-damage-grid
# ---------------------------------------------------------------------------

@router.get("/ue5/building-damage-grid", response_model=None)
async def get_building_damage_grid(
    lat: float = Query(..., description="Center latitude"),
    lng: float = Query(..., description="Center longitude"),
    radius_km: float = Query(2.0, description="Radius in km (max 10)"),
    scenario_id: str = Query("default", description="Scenario ID"),
) -> Dict[str, Any]:
    """
    Per-building damage data optimized for UE5 mesh instancing.
    Returns batches of 100-500 buildings.
    """
    radius_km = min(10.0, max(0.1, radius_km))
    buildings = _generate_buildings(lat, lng, radius_km, scenario_id)
    return {
        "center": {"latitude": lat, "longitude": lng},
        "radius_km": radius_km,
        "scenario_id": scenario_id,
        "count": len(buildings),
        "buildings": buildings,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# WebSocket /ue5/ws/stream
# ---------------------------------------------------------------------------

@router.websocket("/ue5/ws/stream")
async def ue5_websocket_stream(websocket: WebSocket):
    """
    Push real-time updates to UE5.

    Client sends: {"subscribe": ["flood", "wind", "incidents", "zones"]}
    Server pushes: {"type": "flood", "data": {...}} every 60s
    """
    await websocket.accept()
    logger.info("UE5 WebSocket client connected")

    subscriptions: set = set()
    city_id = "newyork"
    scenario_id = "default"

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                msg = json.loads(raw)

                if "subscribe" in msg:
                    subscriptions = set(msg["subscribe"])
                    await websocket.send_json({
                        "type": "subscribed",
                        "channels": list(subscriptions),
                    })

                if "city_id" in msg:
                    city_id = msg["city_id"]
                if "scenario_id" in msg:
                    scenario_id = msg["scenario_id"]

            except asyncio.TimeoutError:
                pass

            coords = _CITY_COORDS.get(city_id, (40.7128, -74.0060))
            lat, lng = coords

            if "flood" in subscriptions:
                await websocket.send_json({
                    "type": "flood",
                    "data": _generate_flood(lat, lng, scenario_id),
                    "timestamp": datetime.utcnow().isoformat(),
                })

            if "wind" in subscriptions:
                await websocket.send_json({
                    "type": "wind",
                    "data": _generate_wind(lat, lng, scenario_id),
                    "timestamp": datetime.utcnow().isoformat(),
                })

            if "incidents" in subscriptions:
                incidents: list = []
                try:
                    from src.api.v1.endpoints.climate import _fetch_earthquake_incidents
                    eq = await _fetch_earthquake_incidents()
                    if isinstance(eq, list):
                        incidents.extend(eq[:10])
                except Exception:
                    pass
                await websocket.send_json({
                    "type": "incidents",
                    "data": {"features": incidents},
                    "timestamp": datetime.utcnow().isoformat(),
                })

            if "zones" in subscriptions:
                await websocket.send_json({
                    "type": "zones",
                    "data": _generate_stress_zones(lat, lng, scenario_id),
                    "timestamp": datetime.utcnow().isoformat(),
                })

            await asyncio.sleep(60)

    except WebSocketDisconnect:
        logger.info("UE5 WebSocket client disconnected")
    except Exception as e:
        logger.error("UE5 WebSocket error: %s", e)
        try:
            await websocket.close(code=1011, reason=str(e)[:120])
        except Exception:
            pass
