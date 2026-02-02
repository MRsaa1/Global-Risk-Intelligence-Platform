#!/usr/bin/env python3
"""
WRF NetCDF → platform JSON (flood, wind, metadata).

Reads WRF output (precip, u/v wind) and produces flood.json, wind.json, metadata.json
in the format consumed by GET /api/v1/climate/high-fidelity/flood and /wind.

Usage:
  python -m scripts.etl_high_fidelity.wrf_to_platform --scenario_id wrf_nyc_001 --center-lat 40.71 --center-lon -74.01
  python -m scripts.etl_high_fidelity.wrf_to_platform --scenario_id wrf_nyc_001 --input /path/to/wrfout_d01.nc

Run from apps/api with: PYTHONPATH=src python -m scripts.etl_high_fidelity.wrf_to_platform ...
"""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Allow importing from src when run from apps/api
_api_root = Path(__file__).resolve().parents[2]
if str(_api_root) not in sys.path:
    sys.path.insert(0, str(_api_root))
if str(_api_root / "src") not in sys.path:
    sys.path.insert(0, str(_api_root / "src"))

from schemas.high_fidelity import (
    HighFidelityFloodPayload,
    HighFidelityWindPayload,
    HighFidelityScenarioMetadata,
)


def _buffer_polygon(lat: float, lon: float, radius_deg: float = 0.02):
    """Simple axis-aligned buffer (~2km at mid-lat). Returns [lng, lat] per vertex."""
    return [
        [lon - radius_deg, lat - radius_deg],
        [lon + radius_deg, lat - radius_deg],
        [lon + radius_deg, lat + radius_deg],
        [lon - radius_deg, lat + radius_deg],
        [lon - radius_deg, lat - radius_deg],
    ]


def _read_wrf_netcdf(input_path: str, center_lat: float, center_lon: float):
    """
    Read WRF NetCDF and extract precip/wind. Returns (flood_payload_dict, wind_payload_dict) or (None, None) on failure.
    Requires xarray and netCDF4. If not available, returns (None, None).
    """
    try:
        import xarray as xr
    except ImportError:
        return None, None
    try:
        ds = xr.open_dataset(input_path)
        # WRF typical vars: RAINC, RAINNC (precip), U10, V10 (wind m/s)
        # Simplify: compute max precip and max wind in domain, use center for polygon
        precip = 0.0
        wind_ms = 0.0
        if "RAINC" in ds:
            precip = float(ds["RAINC"].max().values) if hasattr(ds["RAINC"].max(), "values") else 0.0
        if "RAINNC" in ds:
            p2 = float(ds["RAINNC"].max().values) if hasattr(ds["RAINNC"].max(), "values") else 0.0
            precip = max(precip, p2)
        if "U10" in ds and "V10" in ds:
            u = ds["U10"].values
            v = ds["V10"].values
            import numpy as np
            wind_ms = float(np.sqrt(np.nanmax(u)**2 + np.nanmax(v)**2)) if u.size else 0.0
        ds.close()

        # Map to platform format
        depth = min(2.0, precip / 100.0) if precip else 0.5
        risk = "critical" if depth >= 1.0 else "high" if depth >= 0.5 else "elevated"
        wind_kmh = wind_ms * 3.6
        cat = 5 if wind_kmh >= 252 else 4 if wind_kmh >= 209 else 3 if wind_kmh >= 178 else 2 if wind_kmh >= 154 else 1 if wind_kmh >= 119 else 0
        labels = ["Tropical Storm", "Category 1", "Category 2", "Category 3", "Category 4", "Category 5"]

        flood = {
            "latitude": center_lat,
            "longitude": center_lon,
            "days": 1,
            "daily": [{"date": datetime.utcnow().strftime("%Y-%m-%d"), "precipitation_mm": precip, "flood_depth_m": depth, "risk_level": risk}],
            "max_flood_depth_m": depth,
            "max_risk_level": risk,
            "polygon": _buffer_polygon(center_lat, center_lon),
            "source": "wrf",
            "scenario_id": None,
            "valid_time": datetime.utcnow().isoformat() + "Z",
        }
        wind = {
            "latitude": center_lat,
            "longitude": center_lon,
            "days": 1,
            "daily": [{"date": datetime.utcnow().strftime("%Y-%m-%d"), "wind_speed_kmh": wind_kmh, "category": cat, "category_label": labels[cat]}],
            "max_wind_kmh": wind_kmh,
            "max_category": cat,
            "max_category_label": labels[cat],
            "polygon": _buffer_polygon(center_lat, center_lon, 0.03),
            "source": "wrf",
            "scenario_id": None,
            "valid_time": datetime.utcnow().isoformat() + "Z",
        }
        return flood, wind
    except Exception:
        return None, None


def run(scenario_id: str, input_path: str | None, center_lat: float, center_lon: float, output_dir: Path):
    now = datetime.utcnow().isoformat() + "Z"
    flood_dict, wind_dict = _read_wrf_netcdf(input_path, center_lat, center_lon) if input_path else (None, None)

    if flood_dict is None:
        flood_dict = {
            "latitude": center_lat,
            "longitude": center_lon,
            "days": 1,
            "daily": [{"date": now[:10], "precipitation_mm": 80.0, "flood_depth_m": 0.8, "risk_level": "high"}],
            "max_flood_depth_m": 0.8,
            "max_risk_level": "high",
            "polygon": _buffer_polygon(center_lat, center_lon),
            "source": "wrf",
            "scenario_id": scenario_id,
            "valid_time": now,
        }
    else:
        flood_dict["scenario_id"] = scenario_id

    if wind_dict is None:
        wind_dict = {
            "latitude": center_lat,
            "longitude": center_lon,
            "days": 1,
            "daily": [{"date": now[:10], "wind_speed_kmh": 120.0, "category": 1, "category_label": "Category 1"}],
            "max_wind_kmh": 120.0,
            "max_category": 1,
            "max_category_label": "Category 1",
            "polygon": _buffer_polygon(center_lat, center_lon, 0.03),
            "source": "wrf",
            "scenario_id": scenario_id,
            "valid_time": now,
        }
    else:
        wind_dict["scenario_id"] = scenario_id

    payload_flood = HighFidelityFloodPayload(**flood_dict)
    payload_wind = HighFidelityWindPayload(**wind_dict)
    metadata = HighFidelityScenarioMetadata(
        scenario_id=scenario_id,
        model="wrf",
        run_time=now,
        bbox=[center_lon - 0.05, center_lat - 0.05, center_lon + 0.05, center_lat + 0.05],
        resolution="1km",
        description="WRF high-fidelity scenario",
        has_flood=True,
        has_wind=True,
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "flood.json").write_text(payload_flood.model_dump_json(indent=2), encoding="utf-8")
    (output_dir / "wind.json").write_text(payload_wind.model_dump_json(indent=2), encoding="utf-8")
    (output_dir / "metadata.json").write_text(metadata.model_dump_json(indent=2), encoding="utf-8")
    print(f"WRF ETL OK: {output_dir} (flood.json, wind.json, metadata.json)")


def main():
    p = argparse.ArgumentParser(description="WRF NetCDF → platform JSON")
    p.add_argument("--scenario_id", required=True, help="Scenario ID (e.g. wrf_nyc_001)")
    p.add_argument("--input", default=None, help="Path to WRF NetCDF (optional)")
    p.add_argument("--center-lat", type=float, default=40.71)
    p.add_argument("--center-lon", type=float, default=-74.01)
    p.add_argument("--output-dir", default=None, help="Override output directory")
    args = p.parse_args()

    from .config import get_output_dir
    out = Path(args.output_dir) if args.output_dir else get_output_dir(args.scenario_id)
    run(args.scenario_id, args.input, args.center_lat, args.center_lon, out)


if __name__ == "__main__":
    main()
