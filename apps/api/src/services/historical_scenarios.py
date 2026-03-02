"""
Historical Scenario Library
============================

7 historical and hypothetical crisis scenarios with concrete shock parameters.
Each scenario maps to a market regime and provides pre-filled stress test inputs.

Usage:
- GET /stress-tests/scenarios  -> list all
- POST /stress-tests/universal with historical_scenario_id -> auto-fill params
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


SCENARIOS: Dict[str, Dict[str, Any]] = {
    "gfc_2008": {
        "id": "gfc_2008",
        "name": "2008 Global Financial Crisis",
        "short_name": "2008 GFC",
        "year": 2008,
        "description": (
            "Collapse of Lehman Brothers triggered a global credit freeze. "
            "Equity markets fell ~38%, interbank lending froze, and credit spreads widened to 600+ bps."
        ),
        "regime": "crisis",
        "severity_override": 0.90,
        # Shock parameters
        "equity_shock": -0.38,
        "rate_change_bps": -300,
        "vix_level": 80,
        "correlation_override": 0.90,
        "pd_multiplier": 3.0,
        "lgd_multiplier": 1.5,
        "recovery_months": 18,
        "sector_impacts": {
            "financial": 1.0,
            "insurance": 0.85,
            "real_estate": 0.90,
            "enterprise": 0.60,
            "defense": 0.20,
        },
        "tags": ["financial", "credit", "systemic"],
    },
    "euro_crisis_2010": {
        "id": "euro_crisis_2010",
        "name": "2010 European Sovereign Debt Crisis",
        "short_name": "Euro Crisis",
        "year": 2010,
        "description": (
            "Greek debt restructuring, contagion to Portugal, Ireland, Spain. "
            "Sovereign spreads widened 400+ bps, bank PDs doubled."
        ),
        "regime": "crisis",
        "severity_override": 0.70,
        "equity_shock": -0.15,
        "rate_change_bps": -100,
        "vix_level": 45,
        "correlation_override": 0.75,
        "pd_multiplier": 2.0,
        "lgd_multiplier": 1.3,
        "recovery_months": 24,
        "sector_impacts": {
            "financial": 0.90,
            "insurance": 0.60,
            "real_estate": 0.40,
            "enterprise": 0.30,
            "defense": 0.10,
        },
        "tags": ["sovereign", "european", "contagion"],
    },
    "china_shock_2015": {
        "id": "china_shock_2015",
        "name": "2015 China Market Shock",
        "short_name": "China Shock",
        "year": 2015,
        "description": (
            "Surprise yuan devaluation, Shanghai Composite crash (-12%), "
            "EM currencies fell -20%, commodities dropped -30%."
        ),
        "regime": "late_cycle",
        "severity_override": 0.55,
        "equity_shock": -0.12,
        "rate_change_bps": -50,
        "vix_level": 40,
        "correlation_override": 0.65,
        "pd_multiplier": 1.5,
        "lgd_multiplier": 1.1,
        "recovery_months": 6,
        "sector_impacts": {
            "financial": 0.50,
            "insurance": 0.30,
            "real_estate": 0.35,
            "enterprise": 0.70,
            "defense": 0.10,
        },
        "tags": ["emerging_markets", "currency", "commodity"],
    },
    "covid_2020": {
        "id": "covid_2020",
        "name": "2020 COVID-19 Market Crash",
        "short_name": "COVID-19",
        "year": 2020,
        "description": (
            "Pandemic-driven sell-off: S&P 500 fell -34% in 23 trading days, "
            "VIX hit 82, oil went -65%. Fastest bear market in history, V-shaped recovery."
        ),
        "regime": "crisis",
        "severity_override": 0.85,
        "equity_shock": -0.34,
        "rate_change_bps": -150,
        "vix_level": 82,
        "correlation_override": 0.88,
        "pd_multiplier": 2.5,
        "lgd_multiplier": 1.4,
        "recovery_months": 6,
        "sector_impacts": {
            "financial": 0.70,
            "insurance": 0.80,
            "real_estate": 0.60,
            "enterprise": 0.90,
            "defense": 0.15,
        },
        "tags": ["pandemic", "supply_chain", "lockdown"],
    },
    "rate_shock_2022": {
        "id": "rate_shock_2022",
        "name": "2022 Rate Shock (Fed Tightening)",
        "short_name": "Rate Shock",
        "year": 2022,
        "description": (
            "Aggressive Fed rate hikes (+400 bps in a year), equity -25%, "
            "crypto -70%, bond portfolios suffered historic losses."
        ),
        "regime": "late_cycle",
        "severity_override": 0.65,
        "equity_shock": -0.25,
        "rate_change_bps": 400,
        "vix_level": 35,
        "correlation_override": 0.70,
        "pd_multiplier": 1.8,
        "lgd_multiplier": 1.2,
        "recovery_months": 12,
        "sector_impacts": {
            "financial": 0.80,
            "insurance": 0.50,
            "real_estate": 0.85,
            "enterprise": 0.40,
            "defense": 0.10,
        },
        "tags": ["rates", "monetary_policy", "duration"],
    },
    "energy_crisis_2022": {
        "id": "energy_crisis_2022",
        "name": "2022 European Energy Crisis",
        "short_name": "Energy Crisis",
        "year": 2022,
        "description": (
            "Russian gas cutoff: gas +300%, electricity +200%. "
            "Industrial PDs rose 1.8x, energy-intensive sectors forced shutdowns."
        ),
        "regime": "stagflation",
        "severity_override": 0.70,
        "equity_shock": -0.10,
        "rate_change_bps": 200,
        "vix_level": 30,
        "correlation_override": 0.60,
        "pd_multiplier": 1.8,
        "lgd_multiplier": 1.2,
        "recovery_months": 12,
        "sector_impacts": {
            "financial": 0.40,
            "insurance": 0.50,
            "real_estate": 0.30,
            "enterprise": 0.90,
            "defense": 0.50,
        },
        "tags": ["energy", "geopolitical", "supply_chain"],
    },
    "gfc_extreme": {
        "id": "gfc_extreme",
        "name": "Hypothetical: 2008 GFC x1.5",
        "short_name": "GFC x1.5",
        "year": None,
        "description": (
            "Amplified 2008 scenario for extreme tail testing. "
            "All shock parameters are 1.5x the original GFC — used as a regulatory boundary stress."
        ),
        "regime": "crisis",
        "severity_override": 0.98,
        "equity_shock": -0.57,
        "rate_change_bps": -450,
        "vix_level": 120,
        "correlation_override": 0.95,
        "pd_multiplier": 4.5,
        "lgd_multiplier": 1.8,
        "recovery_months": 30,
        "sector_impacts": {
            "financial": 1.0,
            "insurance": 0.95,
            "real_estate": 0.95,
            "enterprise": 0.80,
            "defense": 0.35,
        },
        "tags": ["hypothetical", "extreme", "tail_risk"],
    },
}


def list_scenarios() -> List[Dict[str, Any]]:
    """Return all scenarios (summary view for API listing)."""
    result = []
    for s in SCENARIOS.values():
        result.append({
            "id": s["id"],
            "name": s["name"],
            "short_name": s["short_name"],
            "year": s["year"],
            "description": s["description"],
            "regime": s["regime"],
            "severity_override": s["severity_override"],
            "tags": s["tags"],
        })
    return result


def get_scenario(scenario_id: str) -> Optional[Dict[str, Any]]:
    """Return full scenario by ID, or None if not found."""
    return SCENARIOS.get(scenario_id)
