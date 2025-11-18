"""Tests for DSL schema."""

import pytest
from datetime import datetime

from libs.dsl_schema import ScenarioDSL, ScenarioMetadata, MarketShock, RegulatoryRule
from libs.dsl_schema.schema import Jurisdiction, RegulatoryFramework, ShockType, PortfolioReference


class TestScenarioDSL:
    """Tests for ScenarioDSL."""

    def test_create_scenario(self):
        """Test creating a basic scenario."""
        metadata = ScenarioMetadata(
            scenario_id="test_scenario",
            name="Test Scenario",
            description="A test scenario",
        )

        portfolio = PortfolioReference(
            portfolio_id="test_portfolio",
            as_of_date=datetime.utcnow(),
        )

        scenario = ScenarioDSL(
            metadata=metadata,
            portfolio=portfolio,
            market_shocks=[],
            regulatory_rules=[],
            calculation_steps=[],
            outputs=[],
        )

        assert scenario.metadata.scenario_id == "test_scenario"
        assert scenario.portfolio.portfolio_id == "test_portfolio"

    def test_market_shock_validation(self):
        """Test market shock validation."""
        shock = MarketShock(
            type=ShockType.INTEREST_RATE,
            asset_class="usd_rates",
            shock_value=0.025,
            shock_type="absolute",
        )

        assert shock.type == ShockType.INTEREST_RATE
        assert shock.shock_value == 0.025

    def test_regulatory_rule(self):
        """Test regulatory rule creation."""
        rule = RegulatoryRule(
            framework=RegulatoryFramework.BASEL_IV,
            jurisdiction=Jurisdiction.US_FED,
            rule_version="latest",
            parameters={"min_cet1_ratio": 0.045},
        )

        assert rule.framework == RegulatoryFramework.BASEL_IV
        assert rule.jurisdiction == Jurisdiction.US_FED
        assert rule.enabled is True

    def test_scenario_validation(self):
        """Test scenario validation."""
        metadata = ScenarioMetadata(scenario_id="test", name="Test")
        portfolio = PortfolioReference(
            portfolio_id="test", as_of_date=datetime.utcnow()
        )

        scenario = ScenarioDSL(
            metadata=metadata,
            portfolio=portfolio,
            calculation_steps=[],
            outputs=["step1"],
        )

        errors = scenario.validate()
        assert len(errors) > 0  # Should have error for non-existent output

