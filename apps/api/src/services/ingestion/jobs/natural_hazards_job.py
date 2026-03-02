"""
Natural hazards ingestion job: USGS earthquakes, NASA FIRMS fires, NWS alerts.

Schedule: USGS 5 min, NASA FIRMS 5 min, NWS 2 min.
Pipeline runs this as a single combined job every 5 min (NWS cached 2 min client-side).
Extracts affected_city_ids from event coordinates for risk recalculation.
"""
import asyncio
from typing import Any, Dict, List, Set

from src.services.ingestion.pipeline import run_ingestion_job
from src.services.ingestion.location_resolver import lat_lng_to_nearby_city_ids
from src.services.external.usgs_client import usgs_client
from src.services.external.nasa_firms_client import NASAFIRMSClient
from src.services.external.nws_alerts_client import NWSAlertsClient
from src.core.config import settings

# Module-level clients
_nasa_firms: NASAFIRMSClient | None = None
_nws_alerts: NWSAlertsClient | None = None


def _get_nasa_firms() -> NASAFIRMSClient:
    global _nasa_firms
    if _nasa_firms is None:
        _nasa_firms = NASAFIRMSClient(map_key=getattr(settings, "firms_map_key", "") or None)
    return _nasa_firms


def _get_nws_alerts() -> NWSAlertsClient:
    global _nws_alerts
    if _nws_alerts is None:
        _nws_alerts = NWSAlertsClient()
    return _nws_alerts


async def _fetch_natural_hazards() -> Dict[str, Any]:
    """Fetch USGS, NASA FIRMS, NWS in parallel. Returns data + summary + affected_city_ids for pipeline."""
    usgs_task = usgs_client.get_earthquake_zones_global(days=7, min_magnitude=4.0)
    firms_task = _get_nasa_firms().get_active_fires(days=1, min_confidence=80, limit=500)
    nws_task = _get_nws_alerts().get_active_alerts(severity="Severe,Extreme", limit=50)

    earthquakes, fires, alerts = await asyncio.gather(usgs_task, firms_task, nws_task)

    affected: Set[str] = set()
    risk_types: List[str] = []

    # USGS: lat/lng -> nearby city_ids (seismic)
    if earthquakes:
        for q in (earthquakes or [])[:50]:
            lat = q.get("lat")
            lng = q.get("lng")
            if lat is not None and lng is not None:
                for cid in lat_lng_to_nearby_city_ids(float(lat), float(lng), radius_km=200.0, max_cities=15):
                    affected.add(cid)
        risk_types.append("seismic")

    # NASA FIRMS: lat/lng -> nearby city_ids (fire)
    if fires:
        for f in (fires or [])[:80]:
            lat = f.get("latitude") or f.get("lat")
            lng = f.get("longitude") or f.get("lng")
            if lat is not None and lng is not None:
                for cid in lat_lng_to_nearby_city_ids(float(lat), float(lng), radius_km=120.0, max_cities=10):
                    affected.add(cid)
        risk_types.append("fire")

    # NWS: alerts often have geometry/coordinates; if not we skip (no simple region->city map without geo)
    if alerts:
        for a in (alerts or [])[:30]:
            # Some NWS APIs return coordinates in geometry or bbox; avoid indexing empty list
            geo = a.get("geometry") if isinstance(a.get("geometry"), dict) else {}
            coords = geo.get("coordinates") if isinstance(geo.get("coordinates"), list) else None
            if coords and len(coords) >= 2:
                lat, lng = coords[1], coords[0]
            else:
                lat, lng = a.get("lat"), a.get("lng")
            if lat is not None and lng is not None:
                for cid in lat_lng_to_nearby_city_ids(float(lat), float(lng), radius_km=150.0, max_cities=10):
                    affected.add(cid)
        risk_types.append("climate")

    affected_list = list(affected)[:200]  # cap for recalc
    dominant_risk_type = risk_types[0] if risk_types else "climate"

    # Serialize for snapshot (datetime -> iso)
    def _serialize(obj: Any) -> Any:
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        if isinstance(obj, list):
            return [_serialize(x) for x in obj]
        if isinstance(obj, dict):
            return {k: _serialize(v) for k, v in obj.items()}
        return obj

    data = {
        "earthquakes": _serialize(earthquakes or []),
        "fires": _serialize(fires or []),
        "alerts": _serialize(alerts or []),
    }
    summary = {
        "earthquakes_count": len(earthquakes) if earthquakes else 0,
        "fires_count": len(fires) if fires else 0,
        "alerts_count": len(alerts) if alerts else 0,
        "affected_cities": len(affected_list),
        "risk_type": dominant_risk_type,
    }
    return {
        "data": data,
        "affected_city_ids": affected_list if affected_list else None,
        "summary": summary,
        "channel": "natural_hazards",
        "risk_type": dominant_risk_type,
    }


async def run_natural_hazards_job() -> Dict[str, Any]:
    """Run natural hazards ingestion and return pipeline result."""
    return await run_ingestion_job(
        source_id="natural_hazards",
        fetch_fn=_fetch_natural_hazards,
        channel="natural_hazards",
    )
