"""
Scenario DSL v2 - Schemas and validators for risk scenarios.

This module provides the core DSL for defining regulatory stress scenarios,
market shocks, and calculation workflows.
"""

from libs.dsl_schema.schema import (
    ScenarioDSL,
    ScenarioMetadata,
    MarketShock,
    RegulatoryRule,
    CalculationStep,
    PortfolioReference,
)

__all__ = [
    "ScenarioDSL",
    "ScenarioMetadata",
    "MarketShock",
    "RegulatoryRule",
    "CalculationStep",
    "PortfolioReference",
]

__version__ = "1.0.0"

