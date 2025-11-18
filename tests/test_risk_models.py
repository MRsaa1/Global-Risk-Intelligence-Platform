"""Tests for risk models."""

import pytest

from libs.risk_models import PDModel, LGDModel, EADModel


class TestPDModel:
    """Tests for PDModel."""

    def test_predict_with_rating(self):
        """Test PD prediction with rating."""
        model = PDModel(model_id="test_pd", model_version="1.0")

        entity_data = {"rating": "BBB"}
        result = model.predict(entity_data, time_horizon=12)

        assert "pd" in result
        assert 0.0 <= result["pd"] <= 1.0
        assert result["model_id"] == "test_pd"

    def test_predict_batch(self):
        """Test batch PD prediction."""
        model = PDModel(model_id="test_pd")

        entities = [
            {"rating": "AAA"},
            {"rating": "BBB"},
            {"rating": "CCC"},
        ]

        results = model.predict_batch(entities)

        assert len(results) == 3
        assert all("pd" in r for r in results)


class TestLGDModel:
    """Tests for LGDModel."""

    def test_predict_without_collateral(self):
        """Test LGD prediction without collateral."""
        model = LGDModel(model_id="test_lgd")

        exposure_data = {
            "asset_class": "corporate",
            "seniority": "senior",
        }

        result = model.predict(exposure_data)

        assert "lgd" in result
        assert 0.0 <= result["lgd"] <= 1.0
        assert "recovery_rate" in result

    def test_predict_with_collateral(self):
        """Test LGD prediction with collateral."""
        model = LGDModel(model_id="test_lgd")

        exposure_data = {
            "asset_class": "corporate",
            "seniority": "senior",
            "exposure_amount": 1000000.0,
        }

        collateral_data = {
            "collateral_value": 500000.0,
            "haircut": 0.1,
        }

        result = model.predict(exposure_data, collateral_data)

        assert result["lgd"] < result["base_lgd"]  # Should be reduced by collateral


class TestEADModel:
    """Tests for EADModel."""

    def test_predict_loan(self):
        """Test EAD prediction for loan."""
        model = EADModel(model_id="test_ead")

        exposure_data = {
            "current_exposure": 1000000.0,
            "outstanding_balance": 1000000.0,
        }

        result = model.predict(exposure_data, product_type="loan")

        assert "ead" in result
        assert result["ead"] == 1000000.0

    def test_predict_commitment(self):
        """Test EAD prediction for commitment."""
        model = EADModel(model_id="test_ead")

        exposure_data = {
            "drawn_amount": 500000.0,
            "undrawn_amount": 500000.0,
        }

        result = model.predict(exposure_data, product_type="commitment")

        assert "ead" in result
        assert result["ead"] > exposure_data["drawn_amount"]

