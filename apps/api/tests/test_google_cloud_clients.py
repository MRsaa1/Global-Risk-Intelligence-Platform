"""Tests for Google Cloud client services (mock/fallback mode)."""


class TestEarthEngineClient:
    def test_get_climate_data(self):
        from src.services.external.google_earth_engine_client import earth_engine_client
        data = earth_engine_client.get_climate_data(40.7128, -74.0060, "2025-01-01", "2025-12-31")
        assert data["lat"] == 40.7128
        assert "temperature" in data
        assert "ndvi" in data

    def test_get_flood_risk(self):
        from src.services.external.google_earth_engine_client import earth_engine_client
        data = earth_engine_client.get_flood_risk(40.7128, -74.0060)
        assert 0 <= data["flood_risk_score"] <= 1.0
        assert data["source"] in ("google_earth_engine", "modeled_estimate")

    def test_get_elevation(self):
        from src.services.external.google_earth_engine_client import earth_engine_client
        data = earth_engine_client.get_elevation(40.7128, -74.0060)
        assert data["elevation_m"] is not None

    def test_get_land_use(self):
        from src.services.external.google_earth_engine_client import earth_engine_client
        data = earth_engine_client.get_land_use(40.7128, -74.0060)
        assert "primary_class" in data


class TestERA5Client:
    def test_get_reanalysis(self):
        from src.services.external.era5_client import era5_client
        data = era5_client.get_reanalysis(40.7128, -74.0060, "2025-01-01", "2025-01-31")
        assert "temperature_2m" in data
        assert "precipitation" in data
        assert data["lat"] == 40.7128


class TestBigQueryClient:
    def test_sync_results(self):
        from src.services.external.bigquery_client import bigquery_client
        result = bigquery_client.sync_stress_test_results([
            {"id": "test-1", "scenario": "flood", "losses_usd": 1e9}
        ])
        assert result["status"] in ("synced", "mock_synced")
        assert result["rows_synced"] == 1

    def test_run_query(self):
        from src.services.external.bigquery_client import bigquery_client
        result = bigquery_client.run_query("SELECT 1")
        assert "rows" in result


class TestVertexAIClient:
    def test_predict_pd_lgd(self):
        from src.services.external.vertex_ai_client import vertex_ai_client
        features = {"asset_value": 1e7, "age": 30, "region": "EU"}
        result = vertex_ai_client.predict_pd_lgd(features)
        assert 0 <= result["pd"] <= 1
        assert 0 <= result["lgd"] <= 1

    def test_detect_anomalies(self):
        from src.services.external.vertex_ai_client import vertex_ai_client
        records = [
            {"value": 100, "ts": "2025-01-01"},
            {"value": 105, "ts": "2025-01-02"},
            {"value": 999, "ts": "2025-01-03"},
        ]
        result = vertex_ai_client.detect_anomalies(records)
        assert "anomalies" in result
