"""
Geo Data API Endpoints
=======================

Provides geographic data for client-side visualization:
- GeoJSON risk hotspots with dynamic risk calculation
- Risk network (nodes + edges)
- Heatmap grid data
- Portfolio summary

Uses CityRiskCalculator for dynamic risk scoring based on:
- Seismic activity (USGS data)
- Flood/Hurricane risk (climate zones)
- Political stability
- Economic exposure
- Historical events

Principle: Server computes risk, client renders

When use_data_federation_pipelines is True, /hotspots and /climate-risk
delegate to DFM pipelines (geodata_risk, climate_stress).
"""
import logging
from fastapi import APIRouter, Query
from typing import Optional

from src.services.geo_data import geo_data_service
from src.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Fallback when service fails (e.g. server without USGS/weather or DFM)
FALLBACK_HOTSPOTS = {
    "type": "FeatureCollection",
    "features": [],
    "metadata": {"generated_at": "", "scenario": None, "total_exposure": 0, "hotspot_count": 0, "calculation_method": "fallback", "data_sources": []},
}
FALLBACK_SUMMARY = {"total_exposure": 0, "weighted_risk": 0, "total_expected_loss": 0, "at_risk_exposure": 0, "critical_exposure": 0, "hotspot_count": 0, "total_assets": 0}

from pydantic import BaseModel, Field


async def _run_geodata_risk_async(min_risk: float, max_risk: float, scenario: Optional[str], recalculate: bool):
    from src.data_federation.pipelines import run_pipeline
    from src.data_federation.pipelines.base import PipelineContext
    from src.data_federation.adapters.base import Region

    ctx = PipelineContext(
        region=Region(lat=0, lon=0, radius_km=20000),
        scenario=scenario,
        options={"min_risk": min_risk, "max_risk": max_risk, "recalculate": recalculate},
    )
    result = await run_pipeline("geodata_risk", ctx)
    if result and "hotspots" in result.artifacts:
        return result.artifacts["hotspots"]
    return None


async def _run_climate_stress_async(scenario: str, time_horizon: int):
    from src.data_federation.pipelines import run_pipeline
    from src.data_federation.pipelines.base import PipelineContext
    from src.data_federation.adapters.base import Region

    ctx = PipelineContext(
        region=Region(lat=0, lon=0, radius_km=20000),
        scenario=scenario,
        options={"scenario": scenario, "time_horizon": time_horizon},
    )
    result = await run_pipeline("climate_stress", ctx)
    if result and "overlay" in result.artifacts:
        return result.artifacts["overlay"]
    return None


@router.get("/hotspots")
async def get_risk_hotspots(
    min_risk: float = Query(0.0, ge=0.0, le=1.0, description="Minimum risk filter"),
    max_risk: float = Query(1.0, ge=0.0, le=1.0, description="Maximum risk filter"),
    scenario: Optional[str] = Query(None, description="Stress scenario to apply"),
    recalculate: bool = Query(False, description="Force recalculation of risk scores"),
):
    """
    Get risk hotspots as GeoJSON FeatureCollection.
    
    Dynamically calculates risk for 70+ cities using:
    - Seismic risk (USGS data + known seismic zones)
    - Flood/Hurricane risk (climate zones + weather data)
    - Political stability (regional indicators)
    - Economic exposure (portfolio data)
    - Historical volatility (major events)
    
    Optimized for CesiumJS / Deck.gl rendering.
    """
    try:
        if getattr(settings, "use_data_federation_pipelines", False):
            out = await _run_geodata_risk_async(min_risk, max_risk, scenario, recalculate)
            if out is not None:
                return out

        await geo_data_service._ensure_risk_scores(force_recalculate=recalculate)
        return geo_data_service.get_risk_hotspots_geojson(
            min_risk=min_risk,
            max_risk=max_risk,
            scenario=scenario,
        )
    except Exception as e:
        logger.warning("Geodata hotspots failed, returning fallback: %s", e)
        return FALLBACK_HOTSPOTS


@router.get("/network")
async def get_risk_network():
    """
    Get risk network as nodes + edges JSON.
    
    Optimized for force-directed graph rendering.
    """
    await geo_data_service._ensure_risk_scores()
    return geo_data_service.get_risk_network_json()


@router.get("/heatmap")
async def get_heatmap(
    resolution: int = Query(36, ge=18, le=180, description="Grid resolution"),
    variable: str = Query("risk", description="Variable to visualize"),
):
    """
    Get global heatmap as grid data.
    
    Optimized for WebGL heatmap rendering.
    """
    await geo_data_service._ensure_risk_scores()
    return geo_data_service.get_heatmap_grid(
        resolution=resolution,
        variable=variable,
    )


@router.get("/summary")
async def get_portfolio_summary():
    """
    Get aggregated portfolio metrics.
    
    Returns total exposure, risk, expected loss, etc.
    """
    try:
        await geo_data_service._ensure_risk_scores()
        return geo_data_service.get_portfolio_summary()
    except Exception as e:
        logger.warning("Geodata summary failed, returning fallback: %s", e)
        return FALLBACK_SUMMARY


@router.get("/city/{city_id}/risk")
async def get_city_risk(
    city_id: str,
    recalculate: bool = Query(False, description="Force recalculation"),
):
    """
    Get detailed risk assessment for a specific city.
    
    Returns:
    - Overall risk score
    - Individual risk factors (seismic, flood, political, etc.)
    - Data sources and confidence levels
    - Historical events
    """
    from src.services.city_risk_calculator import get_city_risk_calculator
    
    calculator = get_city_risk_calculator()
    score = await calculator.calculate_risk(city_id, force_recalculate=recalculate)
    
    if not score:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"City '{city_id}' not found")
    
    return calculator.to_geojson_feature(score)


@router.get("/climate-risk")
async def get_climate_risk(
    scenario: str = Query("ssp245", description="Climate scenario (ssp126, ssp245, ssp370, ssp585)"),
    time_horizon: int = Query(2050, ge=2025, le=2100, description="Projection year"),
):
    """
    Get climate risk overlay data.
    
    Provides projected climate risk for each hotspot
    based on climate models and risk calculator.
    """
    if getattr(settings, "use_data_federation_pipelines", False):
        out = await _run_climate_stress_async(scenario, time_horizon)
        if out is not None:
            return out

    await geo_data_service._ensure_risk_scores()
    return geo_data_service.get_climate_risk_overlay(
        scenario=scenario,
        time_horizon=time_horizon,
    )


def _camera_height_for_city(exposure: float) -> int:
    """Compute camera height (m) for 3D view: larger cities get higher default view."""
    if exposure >= 40:
        return 4500
    if exposure >= 30:
        return 4000
    if exposure >= 20:
        return 3500
    return 3000


def _risk_score_from_known_risks(known_risks: dict) -> float:
    """Derive overall risk score (0–1) from known_risks; used for Digital Twin display."""
    if not known_risks:
        return 0.5
    return min(1.0, max(0.0, sum(known_risks.values()) / len(known_risks)))


@router.get("/cities")
async def get_all_cities():
    """
    Get list of all available cities with basic info, exposure, risk score, and camera position for 3D view.
    """
    from src.data.cities import get_all_cities as get_cities

    cities = get_cities()
    return {
        "cities": [
            {
                "id": c.id,
                "name": c.name,
                "country": c.country,
                "coordinates": [c.lng, c.lat],
                "exposure": c.exposure,
                "risk_score": _risk_score_from_known_risks(c.known_risks),
                "seismic_zone": c.seismic_zone.value,
                "climate_zone": c.climate_zone.value,
                "camera_position": {
                    "lat": c.lat,
                    "lng": c.lng,
                    "height": _camera_height_for_city(c.exposure),
                    "heading": 60,
                    "pitch": -35,
                },
            }
            for c in cities
        ],
        "total": len(cities),
    }


class CityParametersUpdate(BaseModel):
    """Mutable parameters that influence city risk scoring."""
    exposure: Optional[float] = Field(default=None, description="Exposure (billions USD)")
    assets_count: Optional[int] = Field(default=None, ge=0, description="Number of assets in this city")
    known_risks: Optional[dict[str, float]] = Field(
        default=None,
        description="Override/merge known risk factors (0.0-1.0), e.g. {'flood':0.8,'political':0.6}",
    )


@router.post("/city/{city_id}/parameters")
async def update_city_parameters(city_id: str, payload: CityParametersUpdate):
    """
    Update city parameters used by CityRiskCalculator.

    This enables real-time behavior:
    when parameters change, the computed risk_score can shift and the city may
    move between risk zones (low/medium/high/critical) on the globe.
    """
    from fastapi import HTTPException
    from src.data.cities import get_city

    city = get_city(city_id)
    if not city:
        raise HTTPException(status_code=404, detail=f"City '{city_id}' not found")

    if payload.exposure is not None:
        city.exposure = float(payload.exposure)
    if payload.assets_count is not None:
        city.assets_count = int(payload.assets_count)
    if payload.known_risks is not None:
        # Merge provided keys into existing known_risks (clamped 0..1)
        city.known_risks = dict(city.known_risks or {})
        for k, v in payload.known_risks.items():
            try:
                fv = float(v)
            except Exception:
                continue
            city.known_risks[str(k)] = max(0.0, min(1.0, fv))

    # Make subsequent /geodata/* responses reflect updates immediately
    geo_data_service.invalidate_cache()

    # Nudge streaming so the globe updates this city quickly.
    try:
        from src.services.risk_stream_bus import mark_city_dirty
        await mark_city_dirty(city.id)
    except Exception:
        pass

    return {
        "status": "ok",
        "city_id": city.id,
        "exposure": city.exposure,
        "assets_count": city.assets_count,
        "known_risks": city.known_risks,
    }


@router.get("/zone-visualization/{city_id}")
async def get_zone_visualization(
    city_id: str,
    event_type: str = Query("default", description="Event type (war, pandemic, financial, seismic, flood, etc.)"),
    event_name: str = Query("", description="Specific event name for better categorization"),
    severity: float = Query(0.75, ge=0.0, le=1.0, description="Event severity"),
):
    """
    Get zone visualization configuration based on event type.
    
    Returns visualization settings for the Digital Twin map:
    - Visualization type (cylinder, contour, infrastructure, financial)
    - Colors and opacity
    - Radius and height
    - Sub-elements to highlight (infrastructure, financial centers)
    
    Event categories:
    - pandemic/medical: Contour + population density overlay
    - war/military: Cylinder + critical infrastructure targets
    - financial: Cylinder + financial centers and systemic banks
    - seismic/flood/hurricane: Contour + affected area estimation
    - cyber: Infrastructure targets
    - political: Government targets
    """
    from src.services.zone_visualization import zone_visualization_service
    from src.services.city_risk_calculator import get_city_risk_calculator
    from src.data.cities import get_city
    from fastapi import HTTPException
    
    city = get_city(city_id)
    if not city:
        raise HTTPException(status_code=404, detail=f"City '{city_id}' not found")
    
    # Get risk score
    calculator = get_city_risk_calculator()
    score = await calculator.calculate_risk(city_id)
    risk_score = score.risk_score if score else 0.5
    
    return zone_visualization_service.build_zone_visualization(
        city_id=city_id,
        city_name=city.name,
        lat=city.lat,
        lng=city.lng,
        risk_score=risk_score,
        event_type=event_type,
        event_name=event_name,
        severity=severity,
    )


@router.get("/infrastructure/{city_id}")
async def get_city_infrastructure(city_id: str):
    """
    Get critical infrastructure targets for a city.
    
    Returns power grids, water systems, telecom, airports, hospitals, etc.
    """
    from src.services.zone_visualization import zone_visualization_service
    
    targets = zone_visualization_service.get_infrastructure_targets(city_id)
    return {
        "city_id": city_id,
        "infrastructure": targets,
        "total": len(targets),
    }


@router.get("/financial-centers/{city_id}")
async def get_city_financial_centers(city_id: str):
    """
    Get financial centers for a city.
    
    Returns stock exchanges, central banks, systemic banks.
    """
    from src.services.zone_visualization import zone_visualization_service
    
    centers = zone_visualization_service.get_financial_centers(city_id)
    return {
        "city_id": city_id,
        "financial_centers": centers,
        "total": len(centers),
    }
