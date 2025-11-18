"""Tests for regulatory rules."""

import pytest

from libs.reg_rules import RulesEngine
from libs.reg_rules.rules import BaselIVRule, LCRRule
from libs.dsl_schema.schema import Jurisdiction, RegulatoryFramework, RegulatoryRule


class TestRulesEngine:
    """Tests for RulesEngine."""

    def test_get_rule(self):
        """Test getting a rule."""
        engine = RulesEngine()
        rule = engine.get_rule(
            RegulatoryFramework.BASEL_IV,
            Jurisdiction.US_FED,
        )

        assert isinstance(rule, BaselIVRule)
        assert rule.framework == RegulatoryFramework.BASEL_IV

    def test_execute_rule(self):
        """Test executing a rule."""
        engine = RulesEngine()
        rule_config = RegulatoryRule(
            framework=RegulatoryFramework.BASEL_IV,
            jurisdiction=Jurisdiction.US_FED,
        )

        portfolio_data = {
            "risk_weighted_assets": 1000000.0,
            "common_equity_tier1": 50000.0,
        }

        result = engine.execute_rule(rule_config, portfolio_data)

        assert result["status"] == "success"
        assert "cet1_ratio" in result
        assert result["cet1_ratio"] == 0.05

    def test_execute_lcr_rule(self):
        """Test executing LCR rule."""
        engine = RulesEngine()
        rule_config = RegulatoryRule(
            framework=RegulatoryFramework.LCR,
            jurisdiction=Jurisdiction.US_FED,
        )

        portfolio_data = {
            "high_quality_liquid_assets": 200000.0,
            "net_cash_outflows_30d": 150000.0,
        }

        result = engine.execute_rule(rule_config, portfolio_data)

        assert result["status"] == "success"
        assert "lcr" in result
        assert result["lcr"] > 1.0

    def test_missing_fields(self):
        """Test rule execution with missing fields."""
        engine = RulesEngine()
        rule_config = RegulatoryRule(
            framework=RegulatoryFramework.BASEL_IV,
            jurisdiction=Jurisdiction.US_FED,
        )

        portfolio_data = {}  # Missing required fields

        result = engine.execute_rule(rule_config, portfolio_data)

        assert result["status"] == "error"
        assert "Missing required fields" in result["error"]

