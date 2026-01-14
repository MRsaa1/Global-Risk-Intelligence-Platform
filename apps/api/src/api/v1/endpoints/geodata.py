"""
Geo Data API Endpoints
=======================

Provides geographic data for client-side visualization:
- GeoJSON risk hotspots
- Risk network (nodes + edges)
- Heatmap grid data
- Portfolio summary

Principle: Server prepares data, client renders
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
):
    """
    Get risk hotspots as GeoJSON FeatureCollection.
    
    Optimized for CesiumJS / Deck.gl rendering.
    """
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
    return geo_data_service.get_portfolio_summary()


@router.get("/climate-risk")
async def get_climate_risk(
    scenario: str = Query("ssp245", description="Climate scenario (ssp126, ssp245, ssp370, ssp585)"),
    time_horizon: int = Query(2050, ge=2025, le=2100, description="Projection year"),
):
    """
    Get climate risk overlay data.
    
    Provides projected climate risk for each hotspot
    based on NVIDIA Earth-2 climate models.
    """
    return geo_data_service.get_climate_risk_overlay(
        scenario=scenario,
        time_horizon=time_horizon,
    )
