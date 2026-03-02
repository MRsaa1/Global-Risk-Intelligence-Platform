"""Tests for PARS Protocol v1.0."""
from conftest import get_client

client = get_client()


class TestPARSEndpoints:
    def test_pars_status(self):
        r = client.get("/api/v1/pars/status")
        assert r.status_code == 200
        data = r.json()
        assert data["protocol"] == "PARS"
        assert data["version"] == "1.0"
        assert data["import_available"] is True
        assert data["validation_available"] is True

    def test_get_schema(self):
        r = client.get("/api/v1/pars/schema")
        assert r.status_code == 200
        schema = r.json()
        assert schema["title"] == "PARS Asset v1.0"
        assert "asset" in schema.get("properties", {})

    def test_export_assets(self):
        r = client.get("/api/v1/pars/export/assets?limit=10")
        assert r.status_code == 200
        data = r.json()
        assert data["pars_version"] == "1.0"
        assert "items" in data

    def test_validate_valid_document(self):
        doc = {
            "pars_version": "1.0",
            "asset": {
                "identity": {"pars_id": "PARS-EU-DE-TEST01"},
                "name": "Test Building",
            },
        }
        r = client.post("/api/v1/pars/validate", json=doc)
        assert r.status_code == 200
        assert r.json()["valid"] is True

    def test_validate_invalid_document(self):
        doc = {"no_asset": True}
        r = client.post("/api/v1/pars/validate", json=doc)
        assert r.status_code == 200
        assert r.json()["valid"] is False
        assert len(r.json()["errors"]) > 0

    def test_import_assets(self):
        items = [
            {
                "pars_version": "1.0",
                "asset": {
                    "identity": {"pars_id": "PARS-EU-DE-IMPORT01", "asset_type": "building"},
                    "name": "Imported Building",
                    "physical": {
                        "geometry": {"type": "Point", "coordinates": [13.405, 52.52]},
                        "condition": {"year_built": 2010},
                    },
                },
            }
        ]
        r = client.post("/api/v1/pars/import", json={"items": items})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "completed"
        assert data["imported"] + data["skipped"] + data["updated"] == 1


class TestPARSValidation:
    def test_missing_pars_id(self):
        from src.api.v1.endpoints.pars import _validate_pars_document
        errors = _validate_pars_document({"asset": {"identity": {}}})
        assert any("pars_id" in e for e in errors)

    def test_valid_document(self):
        from src.api.v1.endpoints.pars import _validate_pars_document
        errors = _validate_pars_document({
            "pars_version": "1.0",
            "asset": {"identity": {"pars_id": "PARS-EU-DE-X1"}},
        })
        assert len(errors) == 0
