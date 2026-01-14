"""
Seed data for Stress Tests and Historical Events.

Provides example data for testing and demonstration.
"""
import json
from datetime import date
from typing import List, Dict, Any

from src.models.stress_test import StressTestType


# =============================================================================
# HISTORICAL EVENTS - Real-world events for calibration
# =============================================================================

HISTORICAL_EVENTS: List[Dict[str, Any]] = [
    # Climate Events
    {
        "name": "Germany Floods 2021",
        "description": "Catastrophic flooding in Rhineland-Palatinate and North Rhine-Westphalia. Over 180 casualties, €30+ billion in damages.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2021, 7, 14),
        "end_date": date(2021, 7, 25),
        "duration_days": 11,
        "region_name": "Rhineland-Palatinate, North Rhine-Westphalia",
        "country_codes": "DE",
        "center_latitude": 50.7,
        "center_longitude": 7.0,
        "affected_area_km2": 15000,
        "severity_actual": 0.95,
        "financial_loss_eur": 33_000_000_000,
        "insurance_claims_eur": 8_200_000_000,
        "affected_population": 180_000,
        "casualties": 184,
        "displaced_people": 42_000,
        "affected_assets_count": 12_500,
        "destroyed_assets_count": 850,
        "damaged_assets_count": 8_200,
        "recovery_time_months": 36,
        "reconstruction_cost_eur": 28_000_000_000,
        "pd_multiplier_observed": 2.5,
        "lgd_multiplier_observed": 1.8,
        "valuation_impact_pct_observed": -35.0,
        "cascade_effects": json.dumps([
            "Transport infrastructure destruction",
            "Power grid disruption",
            "Water supply contamination",
            "Manufacturing shutdown",
        ]),
        "affected_sectors": json.dumps([
            "real_estate", "infrastructure", "energy", "manufacturing", "agriculture"
        ]),
        "impact_developers": json.dumps({
            "summary": "Massive project delays, damage to construction sites",
            "financial_impact_eur": 2_500_000_000,
            "projects_delayed": 45,
            "projects_cancelled": 8,
        }),
        "impact_insurers": json.dumps({
            "summary": "Record claims payouts, increased reserves",
            "claims_paid_eur": 8_200_000_000,
            "claims_count": 180_000,
            "reinsurance_triggered": True,
        }),
        "impact_military": json.dumps({
            "summary": "Civil support operations mobilized",
            "personnel_deployed": 15_000,
            "operations_cost_eur": 150_000_000,
        }),
        "sources": json.dumps([
            "Bundesanstalt für Finanzdienstleistungsaufsicht",
            "German Insurance Association (GDV)",
            "Copernicus Emergency Management Service",
        ]),
        "lessons_learned": "Need for improved early warning systems and flood protection infrastructure.",
        "is_verified": True,
        "tags": json.dumps(["flood", "climate", "germany", "2021", "catastrophe"]),
    },
    
    # Pandemic
    {
        "name": "COVID-19 Pandemic 2020",
        "description": "Global coronavirus pandemic. Lockdowns, business closures, global economic downturn.",
        "event_type": StressTestType.PANDEMIC.value,
        "start_date": date(2020, 1, 1),
        "end_date": date(2022, 12, 31),
        "duration_days": 1095,
        "region_name": "Global",
        "country_codes": "GLOBAL",
        "severity_actual": 0.90,
        "financial_loss_eur": 4_500_000_000_000,
        "affected_population": 8_000_000_000,
        "casualties": 6_900_000,
        "recovery_time_months": 48,
        "pd_multiplier_observed": 3.0,
        "lgd_multiplier_observed": 1.5,
        "valuation_impact_pct_observed": -25.0,
        "cascade_effects": json.dumps([
            "Global lockdowns",
            "Supply chain disruptions",
            "Mass unemployment",
            "Tourism and hospitality crisis",
        ]),
        "affected_sectors": json.dumps([
            "tourism", "hospitality", "retail", "aviation", "entertainment"
        ]),
        "impact_developers": json.dumps({
            "summary": "Construction halts, project plan revisions",
            "construction_delays_pct": 65,
        }),
        "impact_insurers": json.dumps({
            "summary": "Surge in life and health claims",
            "business_interruption_disputes": True,
        }),
        "sources": json.dumps(["WHO", "IMF", "World Bank"]),
        "lessons_learned": "Critical need for business continuity planning and supply chain diversification.",
        "is_verified": True,
        "tags": json.dumps(["pandemic", "covid19", "global", "2020", "lockdown"]),
    },
    
    # Financial Crisis
    {
        "name": "Global Financial Crisis 2008",
        "description": "Global financial crisis triggered by Lehman Brothers collapse. Bank failures, recession.",
        "event_type": StressTestType.FINANCIAL.value,
        "start_date": date(2008, 9, 15),
        "end_date": date(2009, 6, 30),
        "duration_days": 289,
        "region_name": "Global",
        "country_codes": "GLOBAL",
        "severity_actual": 0.98,
        "financial_loss_eur": 2_800_000_000_000,
        "recovery_time_months": 72,
        "pd_multiplier_observed": 5.0,
        "lgd_multiplier_observed": 2.5,
        "valuation_impact_pct_observed": -50.0,
        "cascade_effects": json.dumps([
            "Bank collapses",
            "Credit freeze",
            "Real estate market crash",
            "Mass layoffs",
        ]),
        "affected_sectors": json.dumps([
            "banking", "real_estate", "automotive", "manufacturing"
        ]),
        "impact_banks": json.dumps({
            "summary": "Mass failures, government bailouts required",
            "banks_failed_count": 465,
            "bailout_cost_eur": 700_000_000_000,
        }),
        "impact_developers": json.dumps({
            "summary": "Market collapse, project freeze",
            "valuation_drop_pct": 45,
            "projects_cancelled_pct": 35,
        }),
        "sources": json.dumps(["FDIC", "Federal Reserve", "ECB"]),
        "lessons_learned": "Need for systemically important institution regulation and stress testing.",
        "is_verified": True,
        "tags": json.dumps(["financial", "crisis", "2008", "lehman", "banking"]),
    },
    
    # Military/Political
    {
        "name": "Crimea Annexation 2014",
        "description": "Russian annexation of Crimea. Sanctions, geopolitical instability, migration.",
        "event_type": StressTestType.MILITARY.value,
        "start_date": date(2014, 2, 20),
        "end_date": date(2014, 3, 21),
        "duration_days": 29,
        "region_name": "Crimea, Ukraine",
        "country_codes": "UA,RU",
        "center_latitude": 45.0,
        "center_longitude": 34.0,
        "severity_actual": 0.85,
        "displaced_people": 50_000,
        "recovery_time_months": None,
        "pd_multiplier_observed": 4.0,
        "lgd_multiplier_observed": 2.0,
        "valuation_impact_pct_observed": -60.0,
        "cascade_effects": json.dumps([
            "International sanctions",
            "Asset freezes",
            "Economic ties severed",
            "Population displacement",
        ]),
        "impact_developers": json.dumps({
            "summary": "Complete project freeze, investor withdrawal",
            "projects_frozen_pct": 100,
        }),
        "impact_insurers": json.dumps({
            "summary": "Regional coverage withdrawn",
            "coverage_withdrawn": True,
        }),
        "impact_military": json.dumps({
            "summary": "Redeployment, border security",
        }),
        "sources": json.dumps(["UN", "OSCE", "Reuters"]),
        "lessons_learned": "Critical to account for geopolitical risks in portfolio management.",
        "is_verified": True,
        "tags": json.dumps(["military", "political", "crimea", "2014", "sanctions"]),
    },
    
    # Protests
    {
        "name": "Hong Kong Protests 2019",
        "description": "Mass protests against extradition bill. Political instability.",
        "event_type": StressTestType.PROTEST.value,
        "start_date": date(2019, 3, 15),
        "end_date": date(2020, 6, 30),
        "duration_days": 473,
        "region_name": "Hong Kong",
        "country_codes": "HK",
        "center_latitude": 22.3,
        "center_longitude": 114.2,
        "severity_actual": 0.70,
        "affected_population": 7_500_000,
        "recovery_time_months": 24,
        "valuation_impact_pct_observed": -20.0,
        "cascade_effects": json.dumps([
            "Tourism decline",
            "Capital flight",
            "Business closures",
            "Political uncertainty",
        ]),
        "affected_sectors": json.dumps([
            "tourism", "retail", "real_estate", "finance"
        ]),
        "sources": json.dumps(["Reuters", "Bloomberg", "SCMP"]),
        "lessons_learned": "Political risks can escalate rapidly.",
        "is_verified": True,
        "tags": json.dumps(["protest", "hongkong", "2019", "political"]),
    },
]


# =============================================================================
# STRESS TEST SCENARIOS - Pre-defined stress test templates
# =============================================================================

STRESS_TEST_SCENARIOS: List[Dict[str, Any]] = [
    # Climate Scenarios
    {
        "name": "Rhine Valley Flood",
        "description": "Catastrophic flood scenario in the Rhine River valley. Based on 2021 event.",
        "test_type": StressTestType.CLIMATE.value,
        "center_latitude": 50.7,
        "center_longitude": 7.0,
        "radius_km": 150,
        "region_name": "Rhineland-Palatinate, North Rhine-Westphalia",
        "country_codes": "DE",
        "severity": 0.85,
        "probability": 0.05,
        "time_horizon_months": 12,
        "pd_multiplier": 2.5,
        "lgd_multiplier": 1.8,
        "valuation_impact_pct": -35.0,
        "recovery_time_months": 36,
        "parameters": json.dumps({
            "flood_level_m": 8.5,
            "duration_days": 14,
            "affected_infrastructure": ["roads", "bridges", "power_grid"],
        }),
    },
    {
        "name": "North Sea Level Rise",
        "description": "Long-term scenario of 0.5m sea level rise by 2050.",
        "test_type": StressTestType.CLIMATE.value,
        "center_latitude": 53.5,
        "center_longitude": 5.0,
        "radius_km": 500,
        "region_name": "North Sea Coast",
        "country_codes": "NL,DE,DK,BE",
        "severity": 0.60,
        "probability": 0.70,
        "time_horizon_months": 300,
        "pd_multiplier": 1.5,
        "lgd_multiplier": 1.3,
        "valuation_impact_pct": -15.0,
        "recovery_time_months": None,
        "parameters": json.dumps({
            "sea_level_rise_m": 0.5,
            "scenario": "SSP2-4.5",
        }),
    },
    
    # Financial Scenarios
    {
        "name": "Eurozone Liquidity Crisis",
        "description": "Systemic liquidity crisis in EU banking sector.",
        "test_type": StressTestType.FINANCIAL.value,
        "region_name": "Eurozone",
        "country_codes": "EU",
        "severity": 0.90,
        "probability": 0.03,
        "time_horizon_months": 24,
        "pd_multiplier": 4.0,
        "lgd_multiplier": 2.0,
        "valuation_impact_pct": -40.0,
        "recovery_time_months": 60,
        "parameters": json.dumps({
            "credit_spread_bps": 500,
            "interbank_freeze": True,
            "ecb_intervention": True,
        }),
    },
    
    # Military Scenarios
    {
        "name": "Eastern Europe Escalation",
        "description": "Military conflict escalation scenario in Eastern Europe.",
        "test_type": StressTestType.MILITARY.value,
        "center_latitude": 50.0,
        "center_longitude": 30.0,
        "radius_km": 1000,
        "region_name": "Eastern Europe",
        "country_codes": "UA,PL,RO,MD",
        "severity": 0.95,
        "probability": 0.15,
        "time_horizon_months": 12,
        "pd_multiplier": 5.0,
        "lgd_multiplier": 3.0,
        "valuation_impact_pct": -70.0,
        "recovery_time_months": 120,
        "parameters": json.dumps({
            "sanctions_level": "maximum",
            "energy_disruption": True,
            "refugee_flow": 5_000_000,
        }),
    },
    
    # Pandemic Scenarios
    {
        "name": "Pandemic Variant X",
        "description": "New pandemic scenario with high transmissibility.",
        "test_type": StressTestType.PANDEMIC.value,
        "region_name": "Global",
        "country_codes": "GLOBAL",
        "severity": 0.80,
        "probability": 0.10,
        "time_horizon_months": 24,
        "pd_multiplier": 2.5,
        "lgd_multiplier": 1.5,
        "valuation_impact_pct": -20.0,
        "recovery_time_months": 36,
        "parameters": json.dumps({
            "r0": 5.0,
            "hospitalization_rate": 0.08,
            "lockdown_probability": 0.60,
        }),
    },
    
    # Regulatory Scenarios
    {
        "name": "Basel IV Full Implementation",
        "description": "Full Basel IV requirements implementation scenario.",
        "test_type": StressTestType.REGULATORY.value,
        "region_name": "European Union",
        "country_codes": "EU",
        "severity": 0.50,
        "probability": 0.95,
        "time_horizon_months": 36,
        "pd_multiplier": 1.0,
        "lgd_multiplier": 1.0,
        "valuation_impact_pct": -5.0,
        "parameters": json.dumps({
            "capital_increase_required_pct": 15,
            "output_floor_pct": 72.5,
        }),
    },
    
    # Protest Scenarios
    {
        "name": "Urban Civil Unrest",
        "description": "Mass civil unrest scenario in major urban center.",
        "test_type": StressTestType.PROTEST.value,
        "severity": 0.60,
        "probability": 0.20,
        "time_horizon_months": 6,
        "pd_multiplier": 1.5,
        "lgd_multiplier": 1.2,
        "valuation_impact_pct": -15.0,
        "recovery_time_months": 12,
        "parameters": json.dumps({
            "duration_weeks": 8,
            "property_damage_probability": 0.30,
        }),
    },
]


def get_historical_events() -> List[Dict[str, Any]]:
    """Get list of historical events for seeding."""
    return HISTORICAL_EVENTS


def get_stress_test_scenarios() -> List[Dict[str, Any]]:
    """Get list of stress test scenarios for seeding."""
    return STRESS_TEST_SCENARIOS
