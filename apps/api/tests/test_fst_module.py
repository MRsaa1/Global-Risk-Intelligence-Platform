"""Tests for FST (Financial System Stress Test Engine) module."""
from conftest import get_client

client = get_client()


class TestFSTEndpoints:
    def test_fst_status(self):
        r = client.get("/api/v1/fst/status")
        assert r.status_code == 200
        data = r.json()
        assert data["module"] == "fst"
        assert data["status"] == "operational"
        assert data["scenarios_count"] >= 11

    def test_list_scenarios(self):
        r = client.get("/api/v1/fst/scenarios")
        assert r.status_code == 200
        scenarios = r.json()
        assert len(scenarios) >= 11
        assert any(s["id"] == "eba_2024_adverse" for s in scenarios)
        assert any(s["id"] == "fed_ccar_severely_adverse" for s in scenarios)

    def test_list_scenarios_by_category(self):
        r = client.get("/api/v1/fst/scenarios?category=ccar")
        assert r.status_code == 200
        scenarios = r.json()
        assert all(s["category"] == "ccar" for s in scenarios)

    def test_run_scenario(self):
        r = client.post("/api/v1/fst/scenarios/run", json={
            "scenario_id": "eba_2024_adverse",
            "regulatory_format": "ecb",
        })
        assert r.status_code == 200
        data = r.json()
        assert "fst_run_id" in data
        assert "report" in data

    def test_batch_run(self):
        r = client.post("/api/v1/fst/scenarios/batch", json={
            "scenario_ids": ["eba_2024_adverse", "eba_2024_baseline"],
        })
        assert r.status_code == 200
        assert r.json()["count"] == 2

    def test_interbank_contagion(self):
        r = client.post("/api/v1/fst/interbank-contagion", json={
            "n_banks": 10,
            "default_probability": 0.05,
            "n_mc": 100,
        })
        assert r.status_code == 200
        data = r.json()
        assert "avg_defaults" in data
        assert "probability_systemic" in data

    def test_lcr_stress(self):
        r = client.post("/api/v1/fst/liquidity/lcr", json={
            "hqla_usd": 50e9,
            "net_outflows_30d_usd": 45e9,
        })
        assert r.status_code == 200
        data = r.json()
        assert "lcr_baseline_pct" in data
        assert "lcr_stressed_pct" in data

    def test_nsfr_stress(self):
        r = client.post("/api/v1/fst/liquidity/nsfr", json={})
        assert r.status_code == 200
        assert "nsfr_stressed_pct" in r.json()

    def test_capital_impact(self):
        r = client.post("/api/v1/fst/capital-impact", json={
            "cet1_capital_usd": 30e9,
            "rwa_usd": 300e9,
            "scenario_loss_usd": 10e9,
        })
        assert r.status_code == 200
        data = r.json()
        assert "cet1_ratio_stressed_pct" in data
        assert "breaches_minimum" in data


class TestFSTService:
    def test_interbank_contagion_logic(self):
        from src.modules.fst.service import FSTService
        svc = FSTService.__new__(FSTService)
        result = svc.simulate_interbank_contagion(n_banks=5, n_mc=50)
        assert result["n_banks"] == 5
        assert result["avg_defaults"] >= 0

    def test_lcr_computation(self):
        from src.modules.fst.service import FSTService
        svc = FSTService.__new__(FSTService)
        result = svc.compute_lcr_stress(hqla_usd=100e9, net_outflows_30d_usd=80e9)
        assert result["lcr_baseline_pct"] > 100
        assert result["compliant"] in (True, False)
