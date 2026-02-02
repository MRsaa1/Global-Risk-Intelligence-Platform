"""
High-Fidelity Loader: read pre-computed WRF/ADCIRC scenario JSON from storage.

Used by GET /api/v1/climate/high-fidelity/flood and .../wind to serve
the same response shape as flood-forecast and wind-forecast (Cesium/UE5 compatible).
"""
import json
from pathlib import Path
from typing import Any, List, Optional

from src.core.config import get_settings
from src.schemas.high_fidelity import (
    HighFidelityFloodPayload,
    HighFidelityWindPayload,
    HighFidelityScenarioMetadata,
)


def _local_path(scenario_id: str, filename: str) -> Path:
    settings = get_settings()
    base = settings.high_fidelity_storage_path
    if not base:
        base = str(Path(__file__).resolve().parents[2] / "data" / "high_fidelity")
    return Path(base) / scenario_id / filename


def _read_local(scenario_id: str, filename: str) -> Optional[dict]:
    path = _local_path(scenario_id, filename)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _read_s3(scenario_id: str, filename: str) -> Optional[dict]:
    settings = get_settings()
    bucket = settings.high_fidelity_s3_bucket
    if not bucket:
        return None
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        return None
    key = f"high-fidelity/{scenario_id}/{filename}"
    try:
        client = boto3.client("s3")
        obj = client.get_object(Bucket=bucket, Key=key)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except (ClientError, Exception):
        return None


def load_flood(scenario_id: str) -> Optional[dict]:
    """
    Load flood.json for scenario_id from local path or S3.
    Returns a dict compatible with FloodForecastResponse (latitude, longitude, days, daily,
    max_flood_depth_m, max_risk_level, polygon, source) for API response.
    """
    settings = get_settings()
    raw = _read_s3(scenario_id, "flood.json") if settings.high_fidelity_s3_bucket else None
    if raw is None:
        raw = _read_local(scenario_id, "flood.json")
    if raw is None:
        return None
    try:
        payload = HighFidelityFloodPayload(**raw)
        # Strip extra fields for API response (same shape as FloodForecastResponse)
        return {
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "days": payload.days,
            "daily": [{"date": d.date, "precipitation_mm": d.precipitation_mm, "flood_depth_m": d.flood_depth_m, "risk_level": d.risk_level} for d in payload.daily],
            "max_flood_depth_m": payload.max_flood_depth_m,
            "max_risk_level": payload.max_risk_level,
            "polygon": payload.polygon,
            "source": payload.source,
        }
    except Exception:
        return None


def load_wind(scenario_id: str) -> Optional[dict]:
    """
    Load wind.json for scenario_id from local path or S3.
    Returns a dict compatible with WindForecastResponse.
    """
    settings = get_settings()
    raw = _read_s3(scenario_id, "wind.json") if settings.high_fidelity_s3_bucket else None
    if raw is None:
        raw = _read_local(scenario_id, "wind.json")
    if raw is None:
        return None
    try:
        payload = HighFidelityWindPayload(**raw)
        return {
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "days": payload.days,
            "daily": [{"date": d.date, "wind_speed_kmh": d.wind_speed_kmh, "category": d.category, "category_label": d.category_label} for d in payload.daily],
            "max_wind_kmh": payload.max_wind_kmh,
            "max_category": payload.max_category,
            "max_category_label": payload.max_category_label,
            "polygon": payload.polygon,
            "source": payload.source,
        }
    except Exception:
        return None


def load_metadata(scenario_id: str) -> Optional[dict]:
    """Load metadata.json for scenario_id."""
    settings = get_settings()
    raw = _read_s3(scenario_id, "metadata.json") if settings.high_fidelity_s3_bucket else None
    if raw is None:
        raw = _read_local(scenario_id, "metadata.json")
    if raw is None:
        return None
    try:
        meta = HighFidelityScenarioMetadata(**raw)
        return meta.model_dump()
    except Exception:
        return None


def load_export_rows(scenario_id: str) -> Optional[List[dict]]:
    """
    Build table rows for export (CSV/JSON): scenario summary + daily rows from flood + metadata.
    Each row: scenario_id, model, run_time, latitude, longitude, max_depth_m, risk_level,
    date (for daily), polygon_vertex_count, bbox, resolution.
    Returns None if scenario not found.
    """
    flood_data = load_flood(scenario_id)
    meta_data = load_metadata(scenario_id)
    if flood_data is None:
        return None
    rows: list[dict] = []
    meta = meta_data or {}
    # Summary row
    rows.append({
        "scenario_id": scenario_id,
        "model": meta.get("model", ""),
        "run_time": meta.get("run_time", ""),
        "latitude": flood_data.get("latitude"),
        "longitude": flood_data.get("longitude"),
        "max_depth_m": flood_data.get("max_flood_depth_m"),
        "risk_level": flood_data.get("max_risk_level"),
        "date": "",
        "polygon_vertex_count": len(flood_data["polygon"]) if flood_data.get("polygon") else 0,
        "bbox_min_lon": meta.get("bbox", [None, None, None, None])[0] if len(meta.get("bbox") or []) >= 4 else None,
        "bbox_min_lat": meta.get("bbox", [None, None, None, None])[1] if len(meta.get("bbox") or []) >= 4 else None,
        "bbox_max_lon": meta.get("bbox", [None, None, None, None])[2] if len(meta.get("bbox") or []) >= 4 else None,
        "bbox_max_lat": meta.get("bbox", [None, None, None, None])[3] if len(meta.get("bbox") or []) >= 4 else None,
        "resolution": meta.get("resolution"),
    })
    # Daily rows from flood
    for day in flood_data.get("daily") or []:
        rows.append({
            "scenario_id": scenario_id,
            "model": meta.get("model", ""),
            "run_time": meta.get("run_time", ""),
            "latitude": flood_data.get("latitude"),
            "longitude": flood_data.get("longitude"),
            "max_depth_m": day.get("flood_depth_m"),
            "risk_level": day.get("risk_level", ""),
            "date": day.get("date", ""),
            "polygon_vertex_count": len(flood_data["polygon"]) if flood_data.get("polygon") else 0,
            "bbox_min_lon": meta.get("bbox", [None, None, None, None])[0] if len(meta.get("bbox") or []) >= 4 else None,
            "bbox_min_lat": meta.get("bbox", [None, None, None, None])[1] if len(meta.get("bbox") or []) >= 4 else None,
            "bbox_max_lon": meta.get("bbox", [None, None, None, None])[2] if len(meta.get("bbox") or []) >= 4 else None,
            "bbox_max_lat": meta.get("bbox", [None, None, None, None])[3] if len(meta.get("bbox") or []) >= 4 else None,
            "resolution": meta.get("resolution"),
        })
    return rows


def list_scenarios() -> list[str]:
    """
    List available scenario_ids from local storage (directory names under base path).
    S3 listing not implemented here; API can use a fixed list or separate config.
    """
    settings = get_settings()
    base = settings.high_fidelity_storage_path
    if not base:
        base = str(Path(__file__).resolve().parents[2] / "data" / "high_fidelity")
    path = Path(base)
    if not path.is_dir():
        return []
    return [d.name for d in path.iterdir() if d.is_dir() and (d / "flood.json").exists()]
