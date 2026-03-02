"""Digital Twin endpoints - Layer 1: Living Digital Twins."""
import json
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.storage import storage
from src.core.database import get_db
from src.models.asset import Asset
from src.models.digital_twin import DigitalTwin, TwinState, TwinTimeline
from src.services.climate_service import ClimateScenario, ClimateService

router = APIRouter()


class DigitalTwinResponse(BaseModel):
    """Digital Twin response schema."""
    id: UUID
    asset_id: UUID
    state: TwinState
    
    # Geometry
    geometry_type: Optional[str]
    geometry_path: Optional[str]
    
    # Physical State
    structural_integrity: Optional[float]
    condition_score: Optional[float]
    remaining_useful_life_years: Optional[float]
    
    # Exposures
    climate_exposures: Optional[dict]
    infrastructure_dependencies: Optional[dict]
    
    # Financial
    financial_metrics: Optional[dict]
    
    # Futures
    future_scenarios: Optional[dict]

    @field_validator(
        "climate_exposures",
        "infrastructure_dependencies",
        "financial_metrics",
        "future_scenarios",
        mode="before",
    )
    @classmethod
    def _parse_json_text(cls, v):
        # Models store these as TEXT (JSON as text). Accept dict or JSON string.
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return None
    
    class Config:
        from_attributes = True


class TimelineEventResponse(BaseModel):
    """Timeline event response schema."""
    id: UUID
    event_type: str
    event_date: str
    event_title: str
    event_description: Optional[str]
    data: Optional[dict]
    source: Optional[str]

    @field_validator("data", mode="before")
    @classmethod
    def _parse_event_data(cls, v):
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return None
    
    class Config:
        from_attributes = True


class TimelineEventCreate(BaseModel):
    """Create timeline event."""
    event_type: str
    event_date: str
    event_title: str
    event_description: Optional[str] = None
    data: Optional[dict] = None
    source: Optional[str] = None


@router.get("/{asset_id}", response_model=DigitalTwinResponse)
async def get_digital_twin(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the Digital Twin for an asset.
    
    Returns the complete Living Digital Twin including:
    - Current physical state
    - Climate exposures
    - Infrastructure dependencies
    - Financial metrics
    - Simulated future scenarios
    """
    result = await db.execute(select(DigitalTwin).where(DigitalTwin.asset_id == str(asset_id)))
    twin = result.scalar_one_or_none()
    
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")
    
    return twin


@router.get("/{asset_id}/geometry-url")
async def get_twin_geometry_url(
    asset_id: UUID,
    expires_hours: int = 2,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a URL/pointer to the twin geometry for rendering.

    - For web GLB stored in object storage: returns a presigned URL
    - For USD/Nucleus paths: returns the raw path (to be opened in Omniverse)
    - When twin exists but has no geometry file: returns 200 with url=null (no 404)
    """
    result = await db.execute(select(DigitalTwin).where(DigitalTwin.asset_id == str(asset_id)))
    twin = result.scalar_one_or_none()
    if not twin or not twin.geometry_path:
        return {"type": None, "url": None, "path": None}

    gtype = (twin.geometry_type or "").lower()
    path = str(twin.geometry_path)

    # Stale paths (old Kenney set no longer in public/) — return fallback so frontend gets a valid GLB
    _KNOWN_MISSING = (
        "facility-a.glb", "facility-b.glb", "facility-c.glb",
        "skyscraper-a.glb", "skyscraper-b.glb", "skyscraper-c.glb", "skyscraper-d.glb",
        "industrial-a.glb", "residential-a.glb",
    )
    if any(path.endswith(p) for p in _KNOWN_MISSING):
        path = "/models/buildings/beautiful_city.glb"
        gtype = "glb"

    # External GLB URL (e.g. demo or CDN)
    if path.startswith(("http://", "https://")):
        return {"type": "glb", "url": path, "path": path}

    # Relative web path (e.g. /models/buildings/skyscraper-a.glb served from frontend public/)
    if path.startswith("/") and gtype in ("glb", "gltf", ""):
        return {"type": "glb", "url": path, "path": path}

    # bucket/object form (MinIO)
    if "/" in path and not path.startswith(("http://", "https://", "omniverse://")) and gtype in ("glb", "gltf", ""):
        if not storage.is_available:
            raise HTTPException(status_code=503, detail="Object storage unavailable")
        bucket, object_name = path.split("/", 1)
        url = storage.get_presigned_url(bucket, object_name, expires_hours=expires_hours)
        return {"type": "glb", "url": url, "bucket": bucket, "object": object_name}

    # USD/Nucleus path
    return {"type": gtype or "usd", "path": path}


@router.get("/{asset_id}/timeline", response_model=list[TimelineEventResponse])
async def get_twin_timeline(
    asset_id: UUID,
    event_type: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the timeline history of a Digital Twin.
    
    The timeline contains the complete history:
    - genesis (construction)
    - renovations
    - inspections
    - incidents
    - sensor readings
    - valuations
    """
    # First get the twin
    result = await db.execute(select(DigitalTwin).where(DigitalTwin.asset_id == str(asset_id)))
    twin = result.scalar_one_or_none()
    
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")
    
    # Get timeline events
    query = select(TwinTimeline).where(TwinTimeline.digital_twin_id == twin.id)
    
    if event_type:
        query = query.where(TwinTimeline.event_type == event_type)
    
    query = query.order_by(TwinTimeline.event_date.desc()).limit(limit)
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    return events


@router.post("/{asset_id}/timeline", response_model=TimelineEventResponse, status_code=201)
async def add_timeline_event(
    asset_id: UUID,
    event: TimelineEventCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Add an event to the Digital Twin timeline.
    
    Event types:
    - genesis: Asset creation/construction
    - renovation: Major renovation or upgrade
    - inspection: Physical inspection
    - incident: Damage, issue, or incident
    - sensor: Automated sensor reading
    - valuation: Financial valuation update
    """
    from datetime import datetime
    from src.services.geo_data import geo_data_service
    from src.services.risk_stream_bus import mark_city_dirty
    from src.data.cities import get_all_cities
    
    # Get the twin
    result = await db.execute(select(DigitalTwin).where(DigitalTwin.asset_id == str(asset_id)))
    twin = result.scalar_one_or_none()
    
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")
    
    # Parse date
    try:
        event_date = datetime.fromisoformat(event.event_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")

    # If this is a sensor reading, update current sensor snapshot + derive risk.
    if (event.event_type or "").lower() == "sensor" and event.data is not None:
        now = datetime.now(timezone.utc)
        try:
            twin.sensor_data = json.dumps(event.data)
        except Exception:
            twin.sensor_data = None
        twin.sensor_updated_at = now

        # Optionally sync derived state fields
        si = event.data.get("structural_integrity")
        cs = event.data.get("condition_score")
        try:
            if si is not None:
                twin.structural_integrity = float(si)
        except Exception:
            pass
        try:
            if cs is not None:
                twin.condition_score = float(cs)
        except Exception:
            pass

        # Derive an asset physical risk score (0..100) from sensor snapshot.
        # Convention: structural_integrity/condition_score are 0..100 (higher is better).
        derived_physical_risk: float | None = None
        try:
            if si is not None:
                derived_physical_risk = max(0.0, min(100.0, 100.0 - float(si)))
            elif cs is not None:
                derived_physical_risk = max(0.0, min(100.0, 100.0 - float(cs)))
        except Exception:
            derived_physical_risk = None

        if derived_physical_risk is not None:
            asset_res = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
            asset = asset_res.scalar_one_or_none()
            if asset:
                asset.physical_risk_score = float(derived_physical_risk)
                # Nudge streaming so the globe updates this city quickly.
                if asset.city:
                    target = "".join(ch for ch in str(asset.city).lower() if ch.isalnum())
                    resolved: str | None = None
                    for c in get_all_cities():
                        cid = "".join(ch for ch in str(c.id).lower() if ch.isalnum())
                        cname = "".join(ch for ch in str(c.name).lower() if ch.isalnum())
                        cname2 = "".join(ch for ch in str(c.name).replace(" City", "").lower() if ch.isalnum())
                        if target in {cid, cname, cname2} or cid in target or cname in target or cname2 in target:
                            resolved = c.id
                            break
                    # Fallback: nearest city by coordinates (if asset has lat/lon)
                    if not resolved and asset.latitude is not None and asset.longitude is not None:
                        best: tuple[float, str] | None = None
                        for c in get_all_cities():
                            # rough distance in degrees (good enough for nearest-city selection)
                            dlat = float(asset.latitude) - float(c.lat)
                            dlng = float(asset.longitude) - float(c.lng)
                            d2 = dlat * dlat + dlng * dlng
                            if best is None or d2 < best[0]:
                                best = (d2, c.id)
                        if best:
                            resolved = best[1]
                    if resolved:
                        await mark_city_dirty(resolved)

        # Ensure subsequent /geodata/* calls reflect the new sensor-driven risk quickly.
        geo_data_service.invalidate_cache()
    
    timeline_event = TwinTimeline(
        digital_twin_id=twin.id,
        event_type=event.event_type,
        event_date=event_date,
        event_title=event.event_title,
        event_description=event.event_description,
        data=json.dumps(event.data) if event.data is not None else None,
        source=event.source,
    )
    
    db.add(timeline_event)
    await db.commit()
    await db.refresh(timeline_event)
    
    return timeline_event


@router.post("/{asset_id}/sync")
async def sync_digital_twin(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger synchronization of the Digital Twin.
    
    This will:
    1. Fetch latest sensor data
    2. Update climate exposures
    3. Recalculate risk scores
    4. Update financial metrics
    """
    result = await db.execute(select(DigitalTwin).where(DigitalTwin.asset_id == str(asset_id)))
    twin = result.scalar_one_or_none()
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")

    asset_res = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
    asset = asset_res.scalar_one_or_none()
    lat = (asset.latitude if asset and asset.latitude is not None else 52.52)
    lon = (asset.longitude if asset and asset.longitude is not None else 13.405)

    climate_svc = ClimateService()
    assessment = await climate_svc.get_climate_assessment(lat, lon, ClimateScenario.SSP245, 2050)
    exposures = _map_assessment_to_exposures(assessment)
    twin.climate_exposures = json.dumps({
        "exposures": exposures,
        "composite_score": assessment.composite_score,
        "data_sources": assessment.data_sources or ["CMIP6", "FEMA", "Copernicus"],
        "scenario": "ssp245",
        "time_horizon": 2050,
    })
    twin.climate_exposures_updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "status": "synced",
        "asset_id": str(asset_id),
        "twin_id": str(twin.id),
    }


def _exposures_fallback(asset_id: str, scenario: str, time_horizon: int) -> dict:
    """Fallback sample when ClimateService fails."""
    return {
        "asset_id": asset_id,
        "scenario": scenario,
        "time_horizon": time_horizon,
        "exposures": {
            "flood": {"score": 45, "return_period_100yr_depth_m": 1.2, "annual_probability": 0.01},
            "heat_stress": {"score": 62, "cooling_degree_days_increase": 450, "extreme_heat_days_per_year": 35},
            "wind": {"score": 28, "max_gust_100yr_ms": 42},
            "wildfire": {"score": 15, "probability": 0.002},
            "sea_level_rise": {"score": 8, "exposure_m": 0.3},
        },
        "composite_score": 52,
        "data_sources": ["CMIP6", "FEMA NFHL", "Copernicus"],
    }


def _map_assessment_to_exposures(a) -> dict:
    """Map ClimateRiskAssessment to exposures JSON."""
    flood = a.flood
    f = {"score": flood.score if flood else 0, "return_period_100yr_depth_m": (flood.intensity if flood else 1.2), "annual_probability": (flood.probability if flood else 0.01)}

    heat = a.heat_stress
    hs = {"score": heat.score if heat else 0, "cooling_degree_days_increase": (heat.intensity if heat else 450), "extreme_heat_days_per_year": 35}

    wind = a.wind
    w = {"score": wind.score if wind else 0, "max_gust_100yr_ms": (wind.intensity if wind else 42)}

    wf = a.wildfire
    wf_dict = {"score": wf.score if wf else 0, "probability": (wf.probability if wf else 0.002)}

    slr = a.sea_level_rise
    slr_dict = {"score": slr.score if slr else 0, "exposure_m": (slr.intensity if slr else 0.3)}

    return {
        "flood": f,
        "heat_stress": hs,
        "wind": w,
        "wildfire": wf_dict,
        "sea_level_rise": slr_dict,
    }


@router.get("/{asset_id}/exposures")
async def get_climate_exposures(
    asset_id: UUID,
    scenario: str = "ssp245",
    time_horizon: int = 2050,
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed climate exposures for an asset.
    
    Scenarios:
    - ssp126: Sustainability (low emissions)
    - ssp245: Middle of the road
    - ssp585: Fossil-fueled development (high emissions)
    
    Returns exposure scores for:
    - Flood risk
    - Heat stress
    - Wind/storm risk
    - Wildfire risk
    - Sea level rise
    """
    twin_res = await db.execute(select(DigitalTwin).where(DigitalTwin.asset_id == str(asset_id)))
    twin = twin_res.scalar_one_or_none()
    if not twin:
        raise HTTPException(status_code=404, detail="Digital Twin not found")

    asset_res = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
    asset = asset_res.scalar_one_or_none()
    lat = (asset.latitude if asset and asset.latitude is not None else 52.52)
    lon = (asset.longitude if asset and asset.longitude is not None else 13.405)

    scenario_map = {"ssp126": ClimateScenario.SSP126, "ssp245": ClimateScenario.SSP245, "ssp370": ClimateScenario.SSP370, "ssp585": ClimateScenario.SSP585}
    cs_enum = scenario_map.get(scenario.lower(), ClimateScenario.SSP245)

    try:
        climate_svc = ClimateService()
        assessment = await climate_svc.get_climate_assessment(lat, lon, cs_enum, time_horizon)
        exposures = _map_assessment_to_exposures(assessment)
        return {
            "asset_id": str(asset_id),
            "scenario": scenario,
            "time_horizon": time_horizon,
            "exposures": exposures,
            "composite_score": assessment.composite_score,
            "data_sources": assessment.data_sources or ["CMIP6", "FEMA", "Copernicus"],
        }
    except Exception:
        return _exposures_fallback(str(asset_id), scenario, time_horizon)


# ---------------------------------------------------------------------------
# Regime sync
# ---------------------------------------------------------------------------

@router.post("/sync-regime")
async def sync_regime(
    regime: str = "auto",
    vix: Optional[float] = None,
    inflation: Optional[float] = None,
    gdp_growth: Optional[float] = None,
    credit_spread: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Bulk-update all Digital Twins to a market regime.

    Pass regime=bull|late_cycle|crisis|stagflation to set explicitly,
    or regime=auto with optional indicator params to auto-detect.
    """
    from src.services.regime_engine import resolve_regime

    resolved = resolve_regime(
        regime,
        {"vix": vix, "inflation": inflation, "gdp_growth": gdp_growth, "credit_spread": credit_spread}
        if any(v is not None for v in [vix, inflation, gdp_growth, credit_spread])
        else None,
    )

    from src.services.regime_twin_sync import sync_twins_to_regime
    count = await sync_twins_to_regime(db, resolved.value)
    return {
        "status": "ok",
        "regime": resolved.value,
        "twins_updated": count,
    }


@router.get("/{twin_id}/regime-context")
async def get_regime_context(
    twin_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return the current regime context for a Digital Twin."""
    from src.services.regime_twin_sync import get_twin_regime_context
    ctx = await get_twin_regime_context(db, twin_id)
    if ctx is None:
        return {"regime_context": None, "message": "No regime context set. Call POST /twins/sync-regime first."}
    return {"regime_context": ctx}
