"""End-to-end integration tests."""

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
from libs.reg_rules.engine import RulesEngine


@pytest.mark.integration
class TestEndToEnd:
    """End-to-end integration tests."""

    def test_full_scenario_execution(self):
        """Test full scenario execution flow."""
        # Create scenario
        metadata = ScenarioMetadata(
            scenario_id="integration_test",
            name="Integration Test Scenario",
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
            ),
            RegulatoryRule(
                framework=RegulatoryFramework.LCR,
                jurisdiction=Jurisdiction.US_FED,
            ),
        ]

        calculation_steps = [
            CalculationStep(
                step_id="basel_calc",
                step_type="regulatory_calculation",
                inputs=[],
                rule=regulatory_rules[0],
            ),
            CalculationStep(
                step_id="lcr_calc",
                step_type="regulatory_calculation",
                inputs=[],
                rule=regulatory_rules[1],
            ),
        ]

        scenario = ScenarioDSL(
            metadata=metadata,
            portfolio=portfolio,
            market_shocks=market_shocks,
            regulatory_rules=regulatory_rules,
            calculation_steps=calculation_steps,
            outputs=["basel_calc", "lcr_calc"],
        )

        # Execute
        engine = DistributedCalculationEngine(backend="ray", cache_enabled=False)
        results = engine.execute(scenario, "test_portfolio")

        # Verify results
        assert results["status"] == "success"
        assert "outputs" in results
        assert "basel_calc" in results["outputs"]
        assert "lcr_calc" in results["outputs"]

    def test_scenario_with_dependencies(self):
        """Test scenario with calculation step dependencies."""
        metadata = ScenarioMetadata(scenario_id="deps_test", name="Dependencies Test")

        portfolio = PortfolioReference(
            portfolio_id="test", as_of_date=datetime.utcnow()
        )

        calculation_steps = [
            CalculationStep(step_id="step1", step_type="type1", inputs=[]),
            CalculationStep(step_id="step2", step_type="type2", inputs=["step1"]),
            CalculationStep(step_id="step3", step_type="type3", inputs=["step2"]),
        ]

        scenario = ScenarioDSL(
            metadata=metadata,
            portfolio=portfolio,
            calculation_steps=calculation_steps,
            outputs=["step3"],
        )

        engine = DistributedCalculationEngine(backend="ray", cache_enabled=False)
        results = engine.execute(scenario, "test")

        assert results["status"] == "success"
        assert "step3" in results["outputs"]

