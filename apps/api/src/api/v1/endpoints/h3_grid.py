"""H3 Hexagonal Grid API endpoints.

Provides spatial risk aggregation and heatmap data using H3 hexagonal grid.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from src.services.h3_spatial import h3_spatial_service, XRiskVector
from src.services.timescale_service import timescale_service

logger = logging.getLogger(__name__)
router = APIRouter()


class AssignRiskRequest(BaseModel):
    """Assign risk to a location."""
    lat: float
    lng: float
    resolution: int = Field(5, ge=3, le=9)
    p_agi: float = Field(0.0, ge=0, le=1)
    p_bio: float = Field(0.0, ge=0, le=1)
    p_nuclear: float = Field(0.0, ge=0, le=1)
    p_climate: float = Field(0.0, ge=0, le=1)
    p_financial: float = Field(0.0, ge=0, le=1)
    population: int = 0
    asset_count: int = 0


@router.get("/hexgrid")
async def get_hexgrid(
    resolution: int = Query(5, ge=3, le=9, description="H3 resolution (3=global, 5=country, 7=city, 9=asset)"),
    min_lat: Optional[float] = Query(None, description="South bound"),
    min_lng: Optional[float] = Query(None, description="West bound"),
    max_lat: Optional[float] = Query(None, description="North bound"),
    max_lng: Optional[float] = Query(None, description="East bound"),
):
    """
    Get H3 hexagonal grid with risk data.

    Returns hex cells with risk vectors, colors, and boundaries for globe rendering.
    Use resolution 3 for global overview, 5 for country, 7 for city, 9 for asset-level.
    """
    bounds = None
    if all(v is not None for v in [min_lat, min_lng, max_lat, max_lng]):
        bounds = (min_lat, min_lng, max_lat, max_lng)

    cells = h3_spatial_service.get_hexgrid(resolution=resolution, bounds=bounds)

    # Auto-seed from cities if empty
    if not cells and not bounds:
        _seed_from_cities(resolution)
        cells = h3_spatial_service.get_hexgrid(resolution=resolution, bounds=bounds)

    return {
        "resolution": resolution,
        "cell_count": len(cells),
        "cells": cells,
        "stats": h3_spatial_service.get_stats(),
    }


@router.post("/hexgrid/assign")
async def assign_risk(request: AssignRiskRequest):
    """Assign a risk vector to the H3 cell containing the given coordinates."""
    vec = XRiskVector(
        p_agi=request.p_agi,
        p_bio=request.p_bio,
        p_nuclear=request.p_nuclear,
        p_climate=request.p_climate,
        p_financial=request.p_financial,
    )
    vec.compute_total()
    cell = h3_spatial_service.assign_risk(
        lat=request.lat,
        lng=request.lng,
        risk_vector=vec,
        resolution=request.resolution,
        population=request.population,
        asset_count=request.asset_count,
    )
    # Record snapshot for time-series (TimescaleDB when enabled)
    await timescale_service.record_snapshot_async(
        h3_cell=cell.h3_index,
        risk_score=cell.risk_score,
        risk_level=cell.risk_level or "medium",
        p_agi=vec.p_agi,
        p_bio=vec.p_bio,
        p_nuclear=vec.p_nuclear,
        p_climate=vec.p_climate,
        p_financial=vec.p_financial,
        source_module="h3_assign",
    )
    return {"status": "assigned", "cell": cell.to_dict()}


@router.post("/hexgrid/seed")
async def seed_hexgrid(resolution: int = Query(5, ge=3, le=9)):
    """Seed hex grid from the platform cities database."""
    count = _seed_from_cities(resolution)
    return {"status": "seeded", "cells_created": count, "resolution": resolution}


@router.post("/hexgrid/aggregate")
async def aggregate_hexgrid(
    from_resolution: int = Query(7, ge=4, le=9),
    to_resolution: int = Query(5, ge=3, le=8),
):
    """Aggregate fine-resolution cells to coarser resolution."""
    cells = h3_spatial_service.aggregate_up(from_resolution, to_resolution)
    return {
        "status": "aggregated",
        "from_resolution": from_resolution,
        "to_resolution": to_resolution,
        "cells_created": len(cells),
    }


@router.get("/hexgrid/cell/{h3_index}")
async def get_cell(h3_index: str):
    """Get a single H3 cell by index."""
    cell = h3_spatial_service.get_cell(h3_index)
    if not cell:
        return {"error": "Cell not found", "h3_index": h3_index}
    return {"cell": cell.to_dict()}


@router.get("/hexgrid/stats")
async def get_stats():
    """Get H3 grid statistics."""
    return h3_spatial_service.get_stats()


@router.get("/timeline/{h3_index}")
async def get_timeline(
    h3_index: str,
    from_time: Optional[str] = Query(None, description="ISO datetime start"),
    to_time: Optional[str] = Query(None, description="ISO datetime end"),
    bucket_hours: int = Query(24, ge=1, le=720),
):
    """Get risk timeline for a specific H3 cell (from TimescaleDB when enabled)."""
    from datetime import datetime as dt
    ft = dt.fromisoformat(from_time) if from_time else None
    tt = dt.fromisoformat(to_time) if to_time else None
    points = await timescale_service.get_timeline_async(h3_index, ft, tt, bucket_hours)
    return {
        "h3_index": h3_index,
        "points": [p.to_dict() for p in points],
        "count": len(points),
    }


@router.get("/risk-at-time")
async def get_risk_at_time(
    timestamp: str = Query(..., description="ISO datetime to query"),
    tolerance_hours: int = Query(1, ge=1, le=24),
):
    """Get all cell risk states at a specific point in time (from TimescaleDB when enabled)."""
    from datetime import datetime as dt
    from src.services.h3_spatial import _risk_color, h3_spatial_service

    ts = dt.fromisoformat(timestamp.replace("Z", "+00:00") if "Z" in timestamp else timestamp)
    cells = await timescale_service.get_risk_at_time_async(ts, tolerance_hours)
    # Enrich with boundary and color for globe viz
    enriched = []
    for c in cells:
        h3_idx = c.get("h3_cell", "")
        boundary = h3_spatial_service.get_boundary_for_index(h3_idx) if h3_idx else None
        risk = c.get("risk_score", 0)
        enriched.append({
            **c,
            "h3_index": h3_idx,
            "boundary": boundary,
            "color": _risk_color(risk),
        })
    return {"timestamp": timestamp, "cells": enriched, "count": len(enriched)}


def _seed_from_cities(resolution: int) -> int:
    """Seed from cities database."""
    try:
        from src.data.cities import get_all_cities
        cities_data = get_all_cities()
        city_dicts = [
            {
                "lat": c.lat,
                "lng": c.lng,
                "known_risks": c.known_risks or {},
                "population": 100_000,
                "assets_count": c.assets_count,
                "exposure": c.exposure,
            }
            for c in cities_data
        ]
        return h3_spatial_service.seed_from_cities(city_dicts, resolution)
    except Exception as e:
        logger.warning(f"Could not seed from cities: {e}")
        return 0
