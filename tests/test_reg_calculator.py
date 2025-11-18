"""Tests for reg-calculator."""

import pytest
from datetime import datetime

from libs.dsl_schema import ScenarioDSL, ScenarioMetadata, MarketShock, RegulatoryRule
from libs.dsl_schema.schema import (
    Jurisdiction,
    RegulatoryFramework,
    ShockType,
    PortfolioReference,
    CalculationStep,
)
from apps.reg_calculator.engine import DistributedCalculationEngine


class TestDistributedCalculationEngine:
    """Tests for DistributedCalculationEngine."""

    @pytest.fixture
    def scenario(self):
        """Create a test scenario."""
        metadata = ScenarioMetadata(
            scenario_id="test_scenario",
            name="Test Scenario",
        )

        portfolio = PortfolioReference(
            portfolio_id="test_portfolio",
            as_of_date=datetime.utcnow(),
        )

        market_shocks = [
            MarketShock(
                type=ShockType.INTEREST_RATE,
                asset_class="usd_rates",
                shock_value=0.025,
                shock_type="absolute",
            )
        ]

        regulatory_rules = [
            RegulatoryRule(
                framework=RegulatoryFramework.BASEL_IV,
                jurisdiction=Jurisdiction.US_FED,
            )
        ]

        calculation_steps = [
            CalculationStep(
                step_id="basel_calc",
                step_type="regulatory_calculation",
                inputs=[],
                rule=regulatory_rules[0],
            )
        ]

        return ScenarioDSL(
            metadata=metadata,
            portfolio=portfolio,
            market_shocks=market_shocks,
            regulatory_rules=regulatory_rules,
            calculation_steps=calculation_steps,
            outputs=["basel_calc"],
        )

    def test_execute_scenario(self, scenario):
        """Test executing a scenario."""
        engine = DistributedCalculationEngine(backend="ray", cache_enabled=False)

        result = engine.execute(scenario, "test_portfolio")

        assert result["status"] == "success"
        assert "outputs" in result

    def test_cache_key_computation(self, scenario):
        """Test cache key computation."""
        engine = DistributedCalculationEngine(backend="ray", cache_enabled=True)

        cache_key = engine._compute_cache_key(scenario, "test_portfolio")

        assert isinstance(cache_key, str)
        assert len(cache_key) == 64  # SHA256 hex length

    def test_topological_sort(self, scenario):
        """Test topological sorting of calculation steps."""
        engine = DistributedCalculationEngine(backend="ray")

        # Create steps with dependencies
        steps = [
            CalculationStep(step_id="step1", step_type="type1", inputs=[]),
            CalculationStep(step_id="step2", step_type="type2", inputs=["step1"]),
            CalculationStep(step_id="step3", step_type="type3", inputs=["step2"]),
        ]

        sorted_steps = engine._topological_sort(steps)

        assert sorted_steps == ["step1", "step2", "step3"]

