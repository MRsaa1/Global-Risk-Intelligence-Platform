"""Unit tests for DFM adapters."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.data_federation.adapters.base import AdapterResult, Region, TimeRange
from src.data_federation.adapters.registry import get_adapter, list_adapters


def test_list_adapters() -> None:
    adapters = list_adapters()
    assert isinstance(adapters, list)
    names = {a["name"] for a in adapters}
    for n in ("usgs", "weather", "noaa", "fema", "cmip6", "nim"):
        assert n in names, f"adapter {n} missing"
    for a in adapters:
        assert "name" in a and "description" in a and "params" in a


def test_get_adapter() -> None:
    for n in ("usgs", "weather", "noaa", "fema", "cmip6", "nim"):
        ad = get_adapter(n)
        assert ad is not None
        assert ad.name() == n
    assert get_adapter("nonexistent") is None


def test_region_center() -> None:
    r = Region(lat=40.0, lon=-74.0, radius_km=500)
    assert r.center == (40.0, -74.0)
    r2 = Region(bbox=(-10.0, -20.0, 10.0, 20.0))
    assert r2.center == (0.0, 0.0)


@pytest.mark.asyncio
async def test_usgs_adapter_fetch() -> None:
    ad = get_adapter("usgs")
    assert ad is not None
    mock_client = AsyncMock()
    mock_client.get_recent_earthquakes.return_value = [
        {"id": "x", "magnitude": 4.5, "place": "Test", "time": None, "depth": 10, "coordinates": [-74, 40], "type": "earthquake", "tsunami": False},
    ]
    with patch.object(ad, "_get_client", return_value=mock_client):
        region = Region(lat=40.7, lon=-74.0, radius_km=300)
        out = await ad.fetch(region, None, days=30)
    assert isinstance(out, AdapterResult)
    assert out.source == "USGS Earthquake Catalog"
    assert "earthquakes" in out.data
    assert out.data["count"] == 1
    mock_client.get_recent_earthquakes.assert_called_once()
    call = mock_client.get_recent_earthquakes.call_args
    assert call.kwargs["lat"] == 40.7 and call.kwargs["lng"] == -74.0
    assert call.kwargs["radius_km"] == 300
    assert call.kwargs["days"] == 30


@pytest.mark.asyncio
async def test_weather_adapter_fetch() -> None:
    ad = get_adapter("weather")
    assert ad is not None
    mock_client = MagicMock()
    mock_client.get_current_weather = AsyncMock(return_value={"temp": 15, "humidity": 60, "rain_1h": 0})
    mock_client.get_flood_risk = AsyncMock(return_value={"flood_risk": 0.2, "source": "OpenWeather API", "details": "x", "current_weather": None})
    with patch.object(ad, "_get_client", return_value=mock_client):
        region = Region(lat=40.7, lon=-74.0)
        out = await ad.fetch(region)
    assert isinstance(out, AdapterResult)
    assert "flood_risk" in out.data
    assert "current_weather" in out.data
    mock_client.get_current_weather.assert_called_once()
    mock_client.get_flood_risk.assert_called_once()


@pytest.mark.asyncio
async def test_nim_adapter_fetch() -> None:
    import numpy as np
    from datetime import datetime

    ad = get_adapter("nim")
    assert ad is not None
    mock_svc = MagicMock()
    zero = np.zeros((721, 1440))

    class FakeF:
        time = datetime.utcnow()
        lead_hours = 0
        temperature_2m = zero
        wind_u_10m = zero
        wind_v_10m = zero
        precipitation = zero

    mock_svc.fourcastnet_forecast = AsyncMock(return_value=[FakeF(), FakeF()])
    with patch.object(ad, "_get_service", return_value=mock_svc):
        region = Region(lat=40.0, lon=-74.0)
        out = await ad.fetch(region, None, simulation_length=2)
    assert isinstance(out, AdapterResult)
    assert out.source == "FourCastNet NIM"
    assert "forecasts" in out.data
    assert len(out.data["forecasts"]) == 2
    assert out.data.get("available") is True
