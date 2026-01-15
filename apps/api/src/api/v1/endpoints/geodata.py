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
"""
from fastapi import APIRouter, Query
from typing import Optional

from src.services.geo_data import geo_data_service

router = APIRouter()


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
    # Ensure risk scores are calculated
    await geo_data_service._ensure_risk_scores(force_recalculate=recalculate)
    
    return geo_data_service.get_risk_hotspots_geojson(
        min_risk=min_risk,
        max_risk=max_risk,
        scenario=scenario,
    )


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
    await geo_data_service._ensure_risk_scores()
    return geo_data_service.get_portfolio_summary()


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
    await geo_data_service._ensure_risk_scores()
    return geo_data_service.get_climate_risk_overlay(
        scenario=scenario,
        time_horizon=time_horizon,
    )


@router.get("/cities")
async def get_all_cities():
    """
    Get list of all available cities with basic info.
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
                "seismic_zone": c.seismic_zone.value,
                "climate_zone": c.climate_zone.value,
            }
            for c in cities
        ],
        "total": len(cities),
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
