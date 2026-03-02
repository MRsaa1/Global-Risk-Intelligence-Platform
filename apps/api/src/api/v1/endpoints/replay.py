"""Scenario Replay API endpoints."""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services.scenario_replay import replay_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _cascade_frames_to_mp4(frames_data: List[Dict[str, Any]], fps: float = 3.0) -> Optional[bytes]:
    """
    Render cascade animation frames to MP4 bytes.
    Uses numpy for frame arrays and imageio for encoding (optional deps: imageio, imageio-ffmpeg).
    """
    try:
        import numpy as np
        import imageio.v3 as iio
    except ImportError:
        return None
    if not frames_data:
        return None
    h, w = 480, 640
    arrays = []
    for i, f in enumerate(frames_data):
        risk = float(f.get("risk_level", 0.5))
        r = int(40 + risk * 200)
        g = int(30 + (1 - risk) * 80)
        b = int(40)
        arr = np.zeros((h, w, 3), dtype=np.uint8)
        arr[:, :, 0] = min(255, r)
        arr[:, :, 1] = min(255, g)
        arr[:, :, 2] = min(255, b)
        progress = (i + 1) / max(1, len(frames_data))
        band_h = int(h * progress)
        if band_h > 0:
            arr[:band_h, :, :] = np.clip(arr[:band_h, :, :] * 0.7, 0, 255).astype(np.uint8)
        arrays.append(arr)
    try:
        return iio.imwrite("<bytes>", arrays, extension=".mp4", fps=fps)
    except Exception:
        return None


class RecordDecisionRequest(BaseModel):
    """Record a decision for replay."""
    decision_id: str
    source_module: str
    object_type: str
    object_id: str
    input_snapshot: dict = {}
    verdict_snapshot: dict = {}
    risk_score: float = 0.5
    agent_scores: dict = {}


@router.post("/decision/{decision_id}")
async def replay_decision(decision_id: str):
    """Reconstruct Decision Object inputs and re-run simulation."""
    return replay_service.replay_decision(decision_id)


@router.get("/time-travel")
async def time_travel(
    timestamp: str = Query(..., description="ISO datetime to travel to"),
    tolerance_hours: int = Query(1, ge=1, le=24),
):
    """Get the risk state at a specific point in time."""
    ts = datetime.fromisoformat(timestamp)
    return replay_service.time_travel(ts, tolerance_hours)


@router.get("/cascade-animation/{decision_id}")
async def cascade_animation(
    decision_id: str,
    frames: int = Query(30, ge=5, le=120),
    duration_s: float = Query(10.0, ge=1, le=60),
):
    """Generate cascade animation frames for stakeholder communication export."""
    return replay_service.generate_cascade_animation(decision_id, frames, duration_s)


@router.get("/cascade-animation/{decision_id}/mp4")
async def cascade_animation_mp4(
    decision_id: str,
    frames: int = Query(30, ge=5, le=120),
    duration_s: float = Query(10.0, ge=1, le=60),
    fps: float = Query(3.0, ge=1, le=10),
):
    """
    Export cascade animation as MP4 video (Phase D).
    Pipeline: cascade scenario → frames → encode MP4. Requires optional deps: imageio, imageio-ffmpeg.
    """
    frames_data = replay_service.generate_cascade_animation(decision_id, frames, duration_s)
    mp4_bytes = _cascade_frames_to_mp4(frames_data, fps=fps)
    if mp4_bytes is None:
        return JSONResponse(
            status_code=503,
            content={
                "detail": "MP4 export unavailable. Install optional deps: pip install imageio imageio-ffmpeg",
                "frames_count": len(frames_data),
            },
        )
    return Response(
        content=mp4_bytes,
        media_type="video/mp4",
        headers={"Content-Disposition": "attachment; filename=cascade-animation.mp4"},
    )


@router.get("/cascade-animation/{decision_id}/czml")
async def cascade_animation_czml(
    decision_id: str,
    frames: int = Query(30, ge=5, le=120),
    duration_s: float = Query(10.0, ge=1, le=60),
    center_lon: float = Query(-74.006, description="Longitude of cascade center"),
    center_lat: float = Query(40.7128, description="Latitude of cascade center"),
):
    """
    Return cascade animation as CZML for Cesium globe.
    Load in Cesium with: viewer.dataSources.add(Cesium.CzmlDataSource.load(url))
    """
    czml = replay_service.generate_cascade_czml(
        decision_id, total_frames=frames, duration_s=duration_s,
        center_lon=center_lon, center_lat=center_lat,
    )
    return JSONResponse(content=czml, media_type="application/json")


@router.post("/record")
async def record_decision(request: RecordDecisionRequest):
    """Record a decision snapshot for future replay."""
    snap = replay_service.record_decision(
        decision_id=request.decision_id,
        source_module=request.source_module,
        object_type=request.object_type,
        object_id=request.object_id,
        input_snapshot=request.input_snapshot,
        verdict_snapshot=request.verdict_snapshot,
        risk_score=request.risk_score,
        agent_scores=request.agent_scores,
    )
    return {"status": "recorded", "snapshot": snap.to_dict()}


@router.get("/history")
async def decision_history(
    source_module: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    """Get decision history for replay listing."""
    return replay_service.get_decision_history(source_module=source_module, limit=limit)


@router.get("/stats")
async def replay_stats():
    """Get replay service statistics."""
    return replay_service.get_stats()


@router.get("/time-travel-db")
async def time_travel_from_db(
    date: str = Query(..., description="ISO date (YYYY-MM-DD) to travel to"),
    db: AsyncSession = Depends(get_db),
):
    """
    Time-travel using real DB data (risk_posture_snapshots, stress tests).
    Returns snapshot, active stress tests, and comparison to current state.
    """
    return await replay_service.time_travel_from_db(date, db)
