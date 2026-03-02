"""Tests for SRS (Sovereign Risk Shield) module."""
import pytest
from conftest import get_client

client = get_client()


class TestSRSEndpoints:
    """Test SRS API endpoints."""

    def test_srs_status(self):
        r = client.get("/api/v1/srs/status")
        assert r.status_code == 200
        data = r.json()
        assert data["module"] == "srs"
        assert data["status"] == "operational"
        assert "funds_count" in data

    def test_list_funds_empty(self):
        r = client.get("/api/v1/srs/funds")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_fund(self):
        r = client.post("/api/v1/srs/funds", json={
            "name": "Test Fund",
            "country_code": "NO",
            "total_assets_usd": 100e9,
            "currency": "NOK",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Test Fund"
        assert data["country_code"] == "NO"
        assert data["srs_id"].startswith("SRS-FUND-NO-")

    def test_list_deposits_empty(self):
        r = client.get("/api/v1/srs/deposits")
        assert r.status_code == 200

    def test_create_deposit(self):
        r = client.post("/api/v1/srs/deposits", json={
            "name": "North Sea Oil",
            "resource_type": "oil",
            "country_code": "NO",
            "estimated_value_usd": 500e9,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["resource_type"] == "oil"

    def test_scenario_types(self):
        r = client.get("/api/v1/srs/scenarios/types")
        assert r.status_code == 200
        types = r.json()["scenario_types"]
        assert len(types) >= 8
        ids = [t["id"] for t in types]
        assert "sovereign_solvency_stress" in ids
        assert "commodity_shock" in ids
        assert "sanctions" in ids

    def test_run_scenario(self):
        r = client.post("/api/v1/srs/scenarios/run", json={
            "scenario_type": "sovereign_solvency_stress",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "completed"
        assert "solvency_score" in data["result"]

    def test_batch_scenarios(self):
        r = client.post("/api/v1/srs/scenarios/batch", json={
            "scenario_types": ["sovereign_solvency_stress", "commodity_shock"],
        })
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 2

    def test_heatmap(self):
        r = client.get("/api/v1/srs/heatmap")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestSRSService:
    """Test SRS service logic."""

    def test_percentile_helper(self):
        from src.modules.srs.service import _percentile
        assert _percentile([1, 2, 3, 4, 5], 0.5) == 3
        assert _percentile([], 0.5) == 0.0
        assert _percentile([10], 0.95) == 10

    def test_commodity_volatility_defined(self):
        from src.modules.srs.service import COMMODITY_VOL
        assert "oil" in COMMODITY_VOL
        assert "gas" in COMMODITY_VOL
        assert all(0 < v < 1 for v in COMMODITY_VOL.values())
