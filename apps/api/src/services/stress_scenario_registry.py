"""
Stress Scenario Registry - Trust over quantity.

Regulatory: 8-12 regulator-recognized (NGFS, EBA, Fed, IMF).
Extended: 10-15 multi-risk, cascading, hybrid.
Unified schema: id, name, category, library, source, severity, severity_numeric,
  horizon, probability, risk_types, triggers, applicable_regulations, can_trigger_cascade.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


def _type_from_category(category: str) -> str:
    """Map category to type for typeZonesBase: Geopolitical->military, Civil Unrest->protest."""
    return {"Geopolitical": "military", "Civil Unrest": "protest"}.get(
        category, category.lower() if category else "climate"
    )


class StressScenario(BaseModel):
    """Unified stress scenario schema."""

    id: str = Field(..., description="Scenario identifier")
    name: str = Field(..., description="Display name")
    category: str = Field(..., description="Climate|Financial|Geopolitical|Pandemic|Political|Regulatory|Civil Unrest")
    library: str = Field(..., description="Regulatory|Extended")
    source: str = Field(..., description="NGFS, EBA, Fed, IMF, Internal, ...")
    severity: str = Field("High", description="Severe|High|Medium|Moderate")
    severity_numeric: float = Field(0.7, ge=0.0, le=1.0)
    horizon: int = Field(..., description="Target year (2050) or years (5)")
    probability: float = Field(0.1, ge=0.0, le=1.0)
    risk_types: List[str] = Field(default_factory=list)
    triggers: List[str] = Field(default_factory=list)
    applicable_regulations: List[str] = Field(default_factory=list)
    can_trigger_cascade: bool = Field(False)
    parameters: dict = Field(default_factory=dict)
    regulator: Optional[str] = Field(None, description="EBA/ECB, Federal Reserve, etc.")


# =============================================================================
# REGULATORY (8-12): only NGFS, EBA, Fed, IMF. Climate + Financial.
# =============================================================================

REGULATORY_SCENARIOS: List[StressScenario] = [
    # Climate (5)
    StressScenario(
        id="NGFS_SSP5_2050",
        name="NGFS SSP5-8.5 (2050)",
        category="Climate",
        library="Regulatory",
        source="NGFS",
        severity="Severe",
        severity_numeric=0.88,
        horizon=2050,
        probability=0.15,
        risk_types=["Physical", "Transition"],
        triggers=["flood", "sea_level_rise", "heat"],
        applicable_regulations=["TCFD", "NGFS"],
        can_trigger_cascade=True,
        parameters={"sea_level_rise_cm": 45, "flood_frequency_multiplier": 3.2, "pd_multiplier": 2.4},
    ),
    StressScenario(
        id="NGFS_SSP2_2040",
        name="NGFS SSP2-4.5 (Baseline)",
        category="Climate",
        library="Regulatory",
        source="NGFS",
        severity="Moderate",
        severity_numeric=0.55,
        horizon=2040,
        probability=0.7,
        risk_types=["Physical", "Transition"],
        triggers=["sea_level_rise", "heat"],
        applicable_regulations=["TCFD", "NGFS"],
        can_trigger_cascade=False,
        parameters={"sea_level_rise_cm": 22, "pd_multiplier": 1.5},
    ),
    StressScenario(
        id="Flood_Extreme_100y",
        name="Flood Extreme (100y→10y)",
        category="Climate",
        library="Regulatory",
        source="NGFS",
        severity="Severe",
        severity_numeric=0.85,
        horizon=2035,
        probability=0.08,
        risk_types=["Physical", "Financial"],
        triggers=["flood"],
        applicable_regulations=["TCFD", "NGFS"],
        can_trigger_cascade=True,
        parameters={"flood_frequency_multiplier": 3.0, "pd_multiplier": 2.2},
    ),
    StressScenario(
        id="Heat_Stress_Energy",
        name="Heat Stress & Energy Load",
        category="Climate",
        library="Regulatory",
        source="NGFS",
        severity="High",
        severity_numeric=0.65,
        horizon=2040,
        probability=0.4,
        risk_types=["Physical", "Operational"],
        triggers=["heat", "drought"],
        applicable_regulations=["TCFD", "NGFS"],
        can_trigger_cascade=True,
    ),
    StressScenario(
        id="Sea_Level_Coastal",
        name="Sea Level Rise – Coastal Assets",
        category="Climate",
        library="Regulatory",
        source="NGFS",
        severity="High",
        severity_numeric=0.7,
        horizon=2050,
        probability=0.6,
        risk_types=["Physical", "Financial"],
        triggers=["sea_level_rise"],
        applicable_regulations=["TCFD", "NGFS"],
        can_trigger_cascade=True,
        parameters={"sea_level_rise_cm": 35, "property_value_shock_pct": -25},
    ),
    # Climate optional 6th
    StressScenario(
        id="Wildfire_Insurance",
        name="Wildfire + Insurance Withdrawal",
        category="Climate",
        library="Regulatory",
        source="Internal",
        severity="High",
        severity_numeric=0.72,
        horizon=2035,
        probability=0.12,
        risk_types=["Physical", "Financial"],
        triggers=["wildfire"],
        applicable_regulations=["TCFD"],
        can_trigger_cascade=True,
    ),
    # Financial (5)
    StressScenario(
        id="EBA_Adverse",
        name="EBA Adverse Scenario",
        category="Financial",
        library="Regulatory",
        source="EBA",
        regulator="EBA/ECB",
        severity="Severe",
        severity_numeric=0.85,
        horizon=5,
        probability=0.05,
        risk_types=["Financial", "Credit"],
        triggers=["recession", "property_correction"],
        applicable_regulations=["EBA", "Basel", "TCFD"],
        can_trigger_cascade=True,
        parameters={"pd_multiplier": 2.2, "lgd_haircut_pct": 18, "property_value_shock_pct": -30},
    ),
    StressScenario(
        id="FED_Severely_Adverse_CRE",
        name="Fed Severely Adverse (CRE shock)",
        category="Financial",
        library="Regulatory",
        source="Fed",
        regulator="Federal Reserve",
        severity="Severe",
        severity_numeric=0.9,
        horizon=5,
        probability=0.03,
        risk_types=["Financial", "Real Estate"],
        triggers=["cre_collapse", "funding_stress"],
        applicable_regulations=["CCAR", "DFAST"],
        can_trigger_cascade=True,
        parameters={"pd_multiplier": 2.8, "lgd_haircut_pct": 22, "property_value_shock_pct": -40},
    ),
    StressScenario(
        id="Liquidity_Freeze",
        name="Liquidity Freeze / Funding Stress",
        category="Financial",
        library="Regulatory",
        source="EBA",
        regulator="EBA/ECB",
        severity="Severe",
        severity_numeric=0.88,
        horizon=5,
        probability=0.04,
        risk_types=["Financial", "Liquidity"],
        triggers=["interbank_freeze", "funding_stress"],
        applicable_regulations=["EBA", "Basel"],
        can_trigger_cascade=True,
        parameters={"pd_multiplier": 2.5, "lgd_haircut_pct": 20},
    ),
    StressScenario(
        id="Asset_Price_Collapse",
        name="Asset Price Collapse (−30–40%)",
        category="Financial",
        library="Regulatory",
        source="EBA",
        severity="Severe",
        severity_numeric=0.82,
        horizon=5,
        probability=0.06,
        risk_types=["Financial", "Market"],
        triggers=["equity_crash", "property_correction"],
        applicable_regulations=["EBA", "DFAST"],
        can_trigger_cascade=True,
        parameters={"valuation_impact_pct": -35, "pd_multiplier": 2.4},
    ),
    StressScenario(
        id="IMF_Systemic",
        name="IMF-style Systemic Crisis",
        category="Financial",
        library="Regulatory",
        source="IMF",
        regulator="IMF",
        severity="Severe",
        severity_numeric=0.92,
        horizon=5,
        probability=0.02,
        risk_types=["Financial", "Sovereign", "Systemic"],
        triggers=["bank_failure", "contagion", "sovereign_stress"],
        applicable_regulations=["BIS", "Basel"],
        can_trigger_cascade=True,
        parameters={"pd_multiplier": 3.0, "lgd_haircut_pct": 25},
    ),
]


def get_stress_scenario_library() -> List[dict]:
    """Return Regulatory library (8-12) with full schema and derived `type`."""
    out = []
    for s in REGULATORY_SCENARIOS:
        d = s.model_dump()
        d["type"] = _type_from_category(s.category)
        out.append(d)
    return out


# =============================================================================
# EXTENDED (10-15): Geopolitical, Pandemic, Political, Regulatory, Civil Unrest.
# No Climate/Financial blocks.
# =============================================================================

_CATEGORY_ORDER_EXTENDED = ["military", "pandemic", "political", "regulatory", "protest"]
_CATEGORY_LABELS_EXTENDED = {
    "military": "Geopolitical",
    "pandemic": "Pandemic",
    "political": "Political",
    "regulatory": "Regulatory",
    "protest": "Civil Unrest",
}
_CATEGORY_TO_TREE_ID = {
    "Geopolitical": "military",
    "Pandemic": "pandemic",
    "Political": "political",
    "Regulatory": "regulatory",
    "Civil Unrest": "protest",
}

EXTENDED_SCENARIOS: List[StressScenario] = [
    # Geopolitical (4)
    StressScenario(
        id="Sanctions_Escalation",
        name="Sanctions Escalation",
        category="Geopolitical",
        library="Extended",
        source="Internal",
        severity="Severe",
        severity_numeric=0.85,
        horizon=5,
        probability=0.1,
        risk_types=["Geopolitical", "Financial", "Operational"],
        triggers=["sanctions", "trade_restriction"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
    StressScenario(
        id="Trade_War_Supply_Chain",
        name="Trade War / Supply Chain Disruption",
        category="Geopolitical",
        library="Extended",
        source="Internal",
        severity="High",
        severity_numeric=0.78,
        horizon=5,
        probability=0.12,
        risk_types=["Geopolitical", "Operational", "Financial"],
        triggers=["tariffs", "supply_chain", "logistics"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
    StressScenario(
        id="Energy_Shock",
        name="Energy Shock (gas/oil cutoff)",
        category="Geopolitical",
        library="Extended",
        source="Internal",
        severity="Severe",
        severity_numeric=0.82,
        horizon=3,
        probability=0.08,
        risk_types=["Geopolitical", "Operational", "Financial"],
        triggers=["energy_cutoff", "price_spike"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
    StressScenario(
        id="Regional_Conflict_Spillover",
        name="Regional Conflict Spillover",
        category="Geopolitical",
        library="Extended",
        source="Internal",
        severity="Severe",
        severity_numeric=0.88,
        horizon=5,
        probability=0.06,
        risk_types=["Geopolitical", "Physical", "Financial"],
        triggers=["conflict", "refugee_flow", "sanctions"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
    # Pandemic (2)
    StressScenario(
        id="COVID19_Replay",
        name="COVID-19 Replay (calibrated)",
        category="Pandemic",
        library="Extended",
        source="Internal",
        severity="High",
        severity_numeric=0.8,
        horizon=3,
        probability=0.1,
        risk_types=["Operational", "Financial", "Health"],
        triggers=["pandemic", "lockdown", "supply_chain"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
    StressScenario(
        id="Pandemic_X",
        name="Pandemic X (high mortality, logistics)",
        category="Pandemic",
        library="Extended",
        source="Internal",
        severity="Severe",
        severity_numeric=0.85,
        horizon=5,
        probability=0.05,
        risk_types=["Operational", "Financial", "Health"],
        triggers=["pandemic", "logistics_collapse"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
    # Political (3)
    StressScenario(
        id="Sovereign_Debt_Crisis",
        name="Sovereign Debt Crisis",
        category="Political",
        library="Extended",
        source="Internal",
        severity="Severe",
        severity_numeric=0.88,
        horizon=5,
        probability=0.04,
        risk_types=["Sovereign", "Financial", "Credit"],
        triggers=["default", "spread_spike"],
        applicable_regulations=["BIS"],
        can_trigger_cascade=True,
    ),
    StressScenario(
        id="Currency_Devaluation",
        name="Currency Devaluation",
        category="Political",
        library="Extended",
        source="Internal",
        severity="High",
        severity_numeric=0.75,
        horizon=3,
        probability=0.08,
        risk_types=["Sovereign", "Financial", "Market"],
        triggers=["devaluation", "capital_flight"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
    StressScenario(
        id="Government_Default",
        name="Government Default / Restructuring",
        category="Political",
        library="Extended",
        source="Internal",
        severity="Severe",
        severity_numeric=0.9,
        horizon=5,
        probability=0.03,
        risk_types=["Sovereign", "Financial", "Credit"],
        triggers=["default", "restructuring", "haircut"],
        applicable_regulations=["BIS"],
        can_trigger_cascade=True,
    ),
    # Regulatory compliance (3)
    StressScenario(
        id="Sudden_Capital_Increase",
        name="Sudden Capital Requirement Increase",
        category="Regulatory",
        library="Extended",
        source="Internal",
        severity="High",
        severity_numeric=0.7,
        horizon=3,
        probability=0.15,
        risk_types=["Regulatory", "Financial"],
        triggers=["capital_requirement", "output_floor"],
        applicable_regulations=["Basel", "EBA"],
        can_trigger_cascade=False,
    ),
    StressScenario(
        id="Climate_Disclosure_Enforcement",
        name="Climate Disclosure Enforcement Shock",
        category="Regulatory",
        library="Extended",
        source="Internal",
        severity="Medium",
        severity_numeric=0.6,
        horizon=3,
        probability=0.25,
        risk_types=["Regulatory", "Climate", "Reputational"],
        triggers=["disclosure", "enforcement", "litigation"],
        applicable_regulations=["TCFD", "CSRD", "NGFS"],
        can_trigger_cascade=False,
    ),
    StressScenario(
        id="Resolution_Regime_Activation",
        name="Resolution Regime Activation",
        category="Regulatory",
        library="Extended",
        source="Internal",
        severity="Severe",
        severity_numeric=0.85,
        horizon=5,
        probability=0.02,
        risk_types=["Regulatory", "Financial", "Systemic"],
        triggers=["resolution", "bail-in", "contagion"],
        applicable_regulations=["BRRD", "SRM", "BIS"],
        can_trigger_cascade=True,
    ),
    # Civil Unrest (3)
    StressScenario(
        id="Urban_Riots_Asset_Damage",
        name="Urban Riots → Asset Damage",
        category="Civil Unrest",
        library="Extended",
        source="Internal",
        severity="High",
        severity_numeric=0.72,
        horizon=2,
        probability=0.12,
        risk_types=["Physical", "Operational", "Reputational"],
        triggers=["riots", "property_damage", "insurance_gap"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
    StressScenario(
        id="Infrastructure_Sabotage",
        name="Infrastructure Sabotage",
        category="Civil Unrest",
        library="Extended",
        source="Internal",
        severity="Severe",
        severity_numeric=0.8,
        horizon=3,
        probability=0.05,
        risk_types=["Physical", "Operational", "Cyber"],
        triggers=["sabotage", "critical_infrastructure", "cascading_failure"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
    StressScenario(
        id="Prolonged_Social_Instability",
        name="Prolonged Social Instability",
        category="Civil Unrest",
        library="Extended",
        source="Internal",
        severity="High",
        severity_numeric=0.68,
        horizon=5,
        probability=0.1,
        risk_types=["Operational", "Reputational", "Financial"],
        triggers=["unrest", "strike", "supply_chain"],
        applicable_regulations=[],
        can_trigger_cascade=True,
    ),
]


def get_extended_scenarios_tree() -> dict:
    """Return Extended scenarios (10-15) grouped by category, with full schema and `type`."""
    by_id: dict = {t: [] for t in _CATEGORY_ORDER_EXTENDED}
    for s in EXTENDED_SCENARIOS:
        tree_id = _CATEGORY_TO_TREE_ID.get(s.category)
        if not tree_id or tree_id not in by_id:
            continue
        d = s.model_dump()
        d["type"] = _type_from_category(s.category)
        by_id[tree_id].append(d)
    categories = [
        {"id": t, "label": _CATEGORY_LABELS_EXTENDED[t], "scenarios": by_id[t]}
        for t in _CATEGORY_ORDER_EXTENDED
        if by_id[t]
    ]
    return {"categories": categories}
