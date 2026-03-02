"""
Tests for Risk Intelligence Engine (v2): hysteresis, aggregator helpers, calculator v2.

Backtest note: Full backtest on Ukraine 2022 / COVID 2020 / Argentina 2023 would require
historical API snapshots; these tests verify v2 path and hysteresis logic.
"""
import pytest
from unittest.mock import AsyncMock, patch

from src.services.city_risk_calculator import (
    apply_hysteresis,
    RISK_WEIGHTS_V2,
    HYSTERESIS,
    CityRiskCalculator,
)
from src.services.risk_signal_aggregator import (
    _gdelt_signals_to_risk,
    _economic_snapshot_to_risk,
    risk_signal_aggregator,
)


class TestApplyHysteresis:
    """Zone assignment with hysteresis to avoid flicker."""

    def test_enter_critical(self):
        assert apply_hysteresis(0.85, None) == "CRITICAL"
        assert apply_hysteresis(0.80, "HIGH") == "CRITICAL"

    def test_exit_critical_only_below_75(self):
        assert apply_hysteresis(0.76, "CRITICAL") == "CRITICAL"
        assert apply_hysteresis(0.74, "CRITICAL") == "HIGH"

    def test_enter_high(self):
        assert apply_hysteresis(0.65, None) == "HIGH"
        assert apply_hysteresis(0.60, "MEDIUM") == "HIGH"

    def test_exit_high_only_below_55(self):
        assert apply_hysteresis(0.56, "HIGH") == "HIGH"
        assert apply_hysteresis(0.54, "HIGH") == "MEDIUM"

    def test_medium_and_low(self):
        assert apply_hysteresis(0.45, None) == "MEDIUM"
        assert apply_hysteresis(0.35, None) == "LOW"
        # Hysteresis hold: score above medium_exit (0.35) keeps MEDIUM
        assert apply_hysteresis(0.36, "MEDIUM") == "MEDIUM"
        # Score below medium_exit (0.35) drops to LOW
        assert apply_hysteresis(0.34, "MEDIUM") == "LOW"
        assert apply_hysteresis(0.30, "MEDIUM") == "LOW"


class TestAggregatorHelpers:
    """Risk signal normalization from GDELT and World Bank."""

    def test_gdelt_signals_zero_articles(self):
        assert _gdelt_signals_to_risk({"article_count": 0}) == 0.0

    def test_gdelt_signals_positive_articles(self):
        r = _gdelt_signals_to_risk({"article_count": 10, "avg_tone": -5})
        assert 0 <= r <= 1.0

    def test_economic_snapshot_no_data(self):
        class Snapshot:
            inflation_annual_pct = None
            gdp_growth_annual_pct = None
            unemployment_pct = None
        assert _economic_snapshot_to_risk(Snapshot()) == 0.5

    def test_economic_snapshot_high_inflation(self):
        class Snapshot:
            inflation_annual_pct = 100.0
            gdp_growth_annual_pct = -5.0
            unemployment_pct = 15.0
        r = _economic_snapshot_to_risk(Snapshot())
        assert r >= 0.5 and r <= 1.0


class TestRiskWeightsV2:
    def test_weights_sum_to_one(self):
        assert abs(sum(RISK_WEIGHTS_V2.values()) - 1.0) < 1e-6

    def test_hysteresis_ordering(self):
        assert HYSTERESIS["critical_exit"] < HYSTERESIS["critical_enter"]
        assert HYSTERESIS["high_exit"] < HYSTERESIS["high_enter"]
        assert HYSTERESIS["medium_exit"] < HYSTERESIS["medium_enter"]


@pytest.mark.asyncio
async def test_calculator_v2_returns_valid_zone():
    """With v2 enabled, calculator returns CityRiskScore with zone in {LOW,MEDIUM,HIGH,CRITICAL}."""
    calc = CityRiskCalculator()
    # Use real aggregator (may hit network); short timeout in aggregator clients
    result = await calc.calculate_risk(
        "kyiv",
        force_recalculate=True,
        use_external_data=True,
        use_risk_model_v2=True,
    )
    if result is None:
        pytest.skip("Calculator v2 returned None (e.g. aggregator timeout)")
    assert result.risk_score >= 0.0 and result.risk_score <= 1.0
    assert result.zone in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert result.calculation_method == "weighted_average_v2"


@pytest.mark.asyncio
async def test_calculator_legacy_unchanged():
    """Legacy path (use_risk_model_v2=False) still works and has no zone field or LOW/MEDIUM/HIGH/CRITICAL."""
    calc = CityRiskCalculator()
    result = await calc.calculate_risk(
        "newyork",
        force_recalculate=True,
        use_external_data=False,
        use_risk_model_v2=False,
    )
    assert result is not None
    assert result.risk_score >= 0.0 and result.risk_score <= 1.0
    assert result.calculation_method == "weighted_average"
    # zone may be None in legacy
    assert getattr(result, "zone", None) is None or result.zone in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
