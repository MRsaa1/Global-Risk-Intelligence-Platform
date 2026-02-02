"""
Data Federation API: adapters, pipelines, run.

GET /adapters — list adapters
GET /pipelines — list pipelines
POST /pipelines/{pipeline_id}/run — run pipeline (body: region, scenario, time_range, options)
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.data_federation.adapters.registry import list_adapters
from src.data_federation.pipelines import run_pipeline, get_pipeline, list_pipelines
from src.data_federation.pipelines.base import PipelineContext
from src.data_federation.adapters.base import Region, TimeRange

router = APIRouter()


# ---------- Schemas ----------


class RegionSchema(BaseModel):
    """Region: center + radius or bbox."""

    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: float = Field(500.0, ge=1, le=20000)
    bbox: Optional[tuple[float, float, float, float]] = Field(
        None,
        description="min_lat, min_lon, max_lat, max_lon",
    )


class TimeRangeSchema(BaseModel):
    """Time range for pipeline."""

    start: Optional[str] = None  # ISO datetime
    end: Optional[str] = None
    days_back: Optional[int] = None


class PipelineRunRequest(BaseModel):
    """Request body for POST /pipelines/{id}/run."""

    region: RegionSchema = Field(default_factory=lambda: RegionSchema(lat=0, lon=0, radius_km=500))
    scenario: Optional[str] = None
    time_range: Optional[TimeRangeSchema] = None
    options: Optional[Dict[str, Any]] = None


# ---------- Endpoints ----------


@router.get("/status")
async def data_federation_status() -> Dict[str, Any]:
    """
    Return DFM status for UI: pipelines enabled, pipeline ids.
    """
    from src.core.config import settings
    pipelines_enabled = bool(getattr(settings, "use_data_federation_pipelines", False))
    return {
        "use_data_federation_pipelines": pipelines_enabled,
        "pipeline_ids": [p["id"] for p in list_pipelines()],
        "adapters_count": len(list_adapters()),
    }


@router.get("/adapters")
async def adapters_list() -> Dict[str, Any]:
    """List all DFM adapters (name, description, params)."""
    return {"adapters": list_adapters()}


@router.get("/pipelines")
async def pipelines_list() -> Dict[str, Any]:
    """List all pipelines (id, name, description)."""
    return {"pipelines": list_pipelines()}


@router.post("/pipelines/{pipeline_id}/run")
async def pipeline_run(
    pipeline_id: str,
    body: PipelineRunRequest,
) -> Dict[str, Any]:
    """
    Run a pipeline by id.

    Body: region (lat/lon + radius_km or bbox), scenario, time_range, options.
    Returns pipeline result artifacts + meta.
    """
    p = get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Pipeline '{pipeline_id}' not found")

    r = body.region
    if r.bbox:
        reg = Region(bbox=r.bbox)
    else:
        lat = r.lat if r.lat is not None else 0.0
        lon = r.lon if r.lon is not None else 0.0
        reg = Region(lat=lat, lon=lon, radius_km=r.radius_km)

    tr = None
    if body.time_range:
        def _parse_dt(s: Optional[str]) -> Optional[datetime]:
            if not s:
                return None
            try:
                return datetime.fromisoformat(s.replace("Z", "+00:00"))
            except Exception:
                return None

        tr = TimeRange(
            start=_parse_dt(body.time_range.start),
            end=_parse_dt(body.time_range.end),
            days_back=body.time_range.days_back,
        )

    ctx = PipelineContext(
        region=reg,
        scenario=body.scenario,
        time_range=tr,
        options=body.options or {},
    )
    result = await run_pipeline(pipeline_id, ctx)
    if result is None:
        raise HTTPException(status_code=500, detail="Pipeline run failed")

    return {
        "pipeline_id": result.pipeline_id,
        "artifacts": result.artifacts,
        "meta": result.meta,
    }
