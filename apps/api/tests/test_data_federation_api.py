"""Integration tests for Data Federation API (GET /adapters, /pipelines, POST /run)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from .conftest import get_client


def test_data_federation_adapters() -> None:
    """GET /api/v1/data-federation/adapters returns list of adapters."""
    client = get_client()
    with client:
        r = client.get("/api/v1/data-federation/adapters")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "adapters" in data
    assert isinstance(data["adapters"], list)
    names = {a["name"] for a in data["adapters"]}
    assert "usgs" in names
    assert "weather" in names
    assert "nim" in names


def test_data_federation_pipelines() -> None:
    """GET /api/v1/data-federation/pipelines returns list of pipelines."""
    client = get_client()
    with client:
        r = client.get("/api/v1/data-federation/pipelines")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "pipelines" in data
    assert isinstance(data["pipelines"], list)
    ids = {p["id"] for p in data["pipelines"]}
    assert "geodata_risk" in ids
    assert "climate_stress" in ids
    assert "weather_forecast" in ids


def test_data_federation_pipeline_run_404() -> None:
    """POST /api/v1/data-federation/pipelines/invalid/run returns 404."""
    client = get_client()
    with client:
        r = client.post(
            "/api/v1/data-federation/pipelines/invalid/run",
            json={"region": {"lat": 40, "lon": -74, "radius_km": 500}},
        )
    assert r.status_code == 404, r.text


def test_data_federation_pipeline_geodata_risk_run() -> None:
    """POST /api/v1/data-federation/pipelines/geodata_risk/run returns artifacts."""
    fake_hotspots = {
        "type": "FeatureCollection",
        "features": [],
        "metadata": {"generated_at": "2020-01-01T00:00:00", "hotspot_count": 0},
    }
    fake_network = {"nodes": [], "edges": [], "metadata": {}}
    geo_svc = MagicMock()
    geo_svc._ensure_risk_scores = AsyncMock()
    geo_svc.get_risk_hotspots_geojson = MagicMock(return_value=fake_hotspots)
    geo_svc.get_risk_network_json = MagicMock(return_value=fake_network)
    mock_fetch = AsyncMock(return_value=MagicMock(data={}, meta={}, source=""))

    with (
        patch("src.services.geo_data.geo_data_service", geo_svc),
        patch("src.data_federation.pipelines.geodata_risk.get_adapter", return_value=MagicMock(fetch=mock_fetch)),
    ):
        client = get_client()
        with client:
            r = client.post(
                "/api/v1/data-federation/pipelines/geodata_risk/run",
                json={
                    "region": {"lat": 40.7, "lon": -74.0, "radius_km": 500},
                    "scenario": None,
                    "options": {"min_risk": 0.0, "max_risk": 1.0},
                },
            )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("pipeline_id") == "geodata_risk"
    assert "artifacts" in data
    assert "hotspots" in data["artifacts"]
    assert "network" in data["artifacts"]
    assert data["artifacts"]["hotspots"]["type"] == "FeatureCollection"
    assert "metadata" in data["artifacts"]["hotspots"]
    assert "metadata" in data["artifacts"]["network"]
    assert "meta" in data


def test_data_federation_pipeline_weather_forecast_run() -> None:
    """POST /api/v1/data-federation/pipelines/weather_forecast/run returns forecast."""
    mock_nim = MagicMock()
    mock_nim.fetch = AsyncMock(return_value=MagicMock(
        data={
            "available": True,
            "forecasts": [{"lead_hours": 0, "temperature_k": 288}],
            "latitude": 40,
            "longitude": -74,
        },
        meta={},
        source="nim",
    ))
    with patch("src.data_federation.pipelines.weather_forecast.get_adapter", return_value=mock_nim):
        client = get_client()
        with client:
            r = client.post(
                "/api/v1/data-federation/pipelines/weather_forecast/run",
                json={"region": {"lat": 40.0, "lon": -74.0, "radius_km": 500}},
            )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("pipeline_id") == "weather_forecast"
    assert "artifacts" in data
    assert "forecast" in data["artifacts"]
    assert data["artifacts"]["forecast"].get("available") is True
    assert "forecasts" in data["artifacts"]["forecast"]
