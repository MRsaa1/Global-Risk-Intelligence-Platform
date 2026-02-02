"""Unit tests for DFM pipelines."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.data_federation.pipelines import get_pipeline, list_pipelines, run_pipeline
from src.data_federation.pipelines.base import PipelineContext, PipelineResult
from src.data_federation.adapters.base import Region


def test_list_pipelines() -> None:
    pipelines = list_pipelines()
    assert isinstance(pipelines, list)
    ids = {p["id"] for p in pipelines}
    assert "geodata_risk" in ids
    assert "climate_stress" in ids
    assert "weather_forecast" in ids
    for p in pipelines:
        assert "id" in p and "name" in p and "description" in p


def test_get_pipeline() -> None:
    assert get_pipeline("geodata_risk") is not None
    assert get_pipeline("climate_stress") is not None
    assert get_pipeline("weather_forecast") is not None
    assert get_pipeline("nonexistent") is None


@pytest.mark.asyncio
async def test_geodata_risk_pipeline_run() -> None:
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

    with (
        patch("src.services.geo_data.geo_data_service", geo_svc),
        patch("src.data_federation.pipelines.geodata_risk.get_adapter", return_value=MagicMock(
            fetch=AsyncMock(return_value=MagicMock(data={}, meta={}, source="")),
        )),
    ):
        ctx = PipelineContext(
            region=Region(lat=40.7, lon=-74.0, radius_km=500),
            scenario=None,
            options={"min_risk": 0.0, "max_risk": 1.0},
        )
        result = await run_pipeline("geodata_risk", ctx)

    assert result is not None
    assert result.pipeline_id == "geodata_risk"
    assert "hotspots" in result.artifacts
    assert "network" in result.artifacts
    assert result.artifacts["hotspots"] == fake_hotspots
    assert result.artifacts["network"] == fake_network
    geo_svc._ensure_risk_scores.assert_called_once()
    geo_svc.get_risk_hotspots_geojson.assert_called_once()
    geo_svc.get_risk_network_json.assert_called_once()


@pytest.mark.asyncio
async def test_weather_forecast_pipeline_run() -> None:
    mock_nim = MagicMock()
    mock_nim.fetch = AsyncMock(return_value=MagicMock(
        data={"available": True, "forecasts": [{"lead_hours": 0, "temperature_k": 288}], "latitude": 40, "longitude": -74},
        meta={},
        source="nim",
    ))
    with patch("src.data_federation.pipelines.weather_forecast.get_adapter", return_value=mock_nim):
        ctx = PipelineContext(region=Region(lat=40.0, lon=-74.0))
        result = await run_pipeline("weather_forecast", ctx)

    assert result is not None
    assert result.pipeline_id == "weather_forecast"
    assert "forecast" in result.artifacts
    assert result.artifacts["forecast"]["available"] is True
    assert len(result.artifacts["forecast"]["forecasts"]) >= 1
    assert result.meta.get("source") == "fourcastnet-nim"


@pytest.mark.asyncio
async def test_climate_stress_pipeline_run() -> None:
    fake_overlay = {
        "scenario": "ssp245",
        "time_horizon": 2050,
        "hotspots": [],
        "summary": {},
        "metadata": {},
    }
    geo_svc = MagicMock()
    geo_svc._ensure_risk_scores = AsyncMock()
    geo_svc.get_climate_risk_overlay = MagicMock(return_value=fake_overlay)
    mock_adapter = MagicMock(fetch=AsyncMock(return_value=MagicMock(data={}, meta={}, source="")))

    with (
        patch("src.services.geo_data.geo_data_service", geo_svc),
        patch("src.data_federation.pipelines.climate_stress.get_adapter", return_value=mock_adapter),
    ):
        ctx = PipelineContext(
            region=Region(lat=40.0, lon=-74.0),
            scenario="ssp245",
            options={"scenario": "ssp245", "time_horizon": 2050},
        )
        result = await run_pipeline("climate_stress", ctx)

    assert result is not None
    assert result.pipeline_id == "climate_stress"
    assert "overlay" in result.artifacts
    assert result.artifacts["overlay"]["scenario"] == "ssp245"
    geo_svc.get_climate_risk_overlay.assert_called_once_with(scenario="ssp245", time_horizon=2050)
