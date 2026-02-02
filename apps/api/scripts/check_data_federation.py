#!/usr/bin/env python3
"""Smoke check for Data Federation API. No pytest required.

Run from apps/api: python scripts/check_data_federation.py
Exits 0 if all checks pass, 1 otherwise.
"""
from __future__ import annotations

import os
import sys

os.environ.setdefault("USE_SQLITE", "true")

def main() -> int:
    from fastapi.testclient import TestClient
    from src.main import app

    client = TestClient(app)
    base = "/api/v1/data-federation"

    # GET /adapters
    r = client.get(f"{base}/adapters")
    if r.status_code != 200:
        print(f"FAIL GET {base}/adapters: {r.status_code} {r.text[:200]}")
        return 1
    data = r.json()
    if "adapters" not in data or not isinstance(data["adapters"], list):
        print(f"FAIL GET {base}/adapters: missing adapters list")
        return 1
    names = {a["name"] for a in data["adapters"]}
    for n in ("usgs", "weather", "nim"):
        if n not in names:
            print(f"FAIL GET {base}/adapters: adapter {n} missing")
            return 1
    print("OK GET /adapters")

    # GET /pipelines
    r = client.get(f"{base}/pipelines")
    if r.status_code != 200:
        print(f"FAIL GET {base}/pipelines: {r.status_code} {r.text[:200]}")
        return 1
    data = r.json()
    if "pipelines" not in data or not isinstance(data["pipelines"], list):
        print(f"FAIL GET {base}/pipelines: missing pipelines list")
        return 1
    ids = {p["id"] for p in data["pipelines"]}
    for i in ("geodata_risk", "climate_stress", "weather_forecast"):
        if i not in ids:
            print(f"FAIL GET {base}/pipelines: pipeline {i} missing")
            return 1
    print("OK GET /pipelines")

    # POST /pipelines/weather_forecast/run (lightweight, may use mocks if NIM unavailable)
    r = client.post(
        f"{base}/pipelines/weather_forecast/run",
        json={"region": {"lat": 40.0, "lon": -74.0, "radius_km": 500}},
    )
    if r.status_code != 200:
        print(f"FAIL POST {base}/pipelines/weather_forecast/run: {r.status_code} {r.text[:300]}")
        return 1
    data = r.json()
    if data.get("pipeline_id") != "weather_forecast" or "artifacts" not in data:
        print(f"FAIL POST weather_forecast/run: unexpected shape {list(data.keys())}")
        return 1
    if "forecast" not in data["artifacts"]:
        print("FAIL POST weather_forecast/run: missing artifacts.forecast")
        return 1
    print("OK POST /pipelines/weather_forecast/run")

    print("Data Federation smoke check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
