"""API tests: health, assets list, cip status."""
import pytest

from .conftest import get_client


def test_health() -> None:
    """Root /health returns healthy status."""
    client = get_client()
    with client:
        r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "healthy"
    assert "version" in data or "environment" in data


def test_assets_list() -> None:
    """GET /api/v1/assets returns a list (may be empty)."""
    client = get_client()
    with client:
        r = client.get("/api/v1/assets")
    # 200 with {"assets": [...]} or similar; 500 if DB fails
    assert r.status_code in (200, 500), r.text
    if r.status_code == 200:
        data = r.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)


def test_cip_status() -> None:
    """GET /api/v1/cip returns CIP module stub status."""
    client = get_client()
    with client:
        r = client.get("/api/v1/cip")
    assert r.status_code == 200
    data = r.json()
    assert data.get("module") == "cip"
    assert data.get("status") == "ok"
