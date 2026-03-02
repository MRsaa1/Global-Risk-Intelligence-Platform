"""
Complete City Risk Taxonomy — 280 risk factors across 10 categories.

Each category contains subcategories, each with named risk factors.
Used by the Unified Stress Meta Report to score and display individual risks.
"""
from typing import Dict, List, Any

FULL_RISK_TAXONOMY: Dict[str, Dict[str, Any]] = {
    "climate": {
        "name": "Climate & Environmental",
        "subcategories": {
            "sea_level_coastal": {
                "label": "Sea Level & Coastal",
                "risks": [
                    "Sea level rise projection",
                    "Storm surge frequency",
                    "Coastal erosion rate",
                    "Tidal flooding events",
                    "Saltwater intrusion risk",
                    "Wetland loss rate",
                    "Seawall / levee adequacy",
                    "Coastal population exposure",
                ],
            },
            "temperature_heat": {
                "label": "Temperature & Heat",
                "risks": [
                    "Urban heat island intensity",
                    "Extreme heat days (>35 °C)",
                    "Heat-related mortality risk",
                    "Cooling infrastructure capacity",
                    "Heat stress economic impact",
                    "Growing season disruption",
                    "Permafrost thaw risk",
                ],
            },
            "air_quality": {
                "label": "Air Quality",
                "risks": [
                    "PM2.5 concentration",
                    "Ozone level exceedances",
                    "Industrial emission proximity",
                    "Wildfire smoke exposure",
                    "Indoor air quality index",
                    "Respiratory disease prevalence",
                    "Air quality monitoring coverage",
                    "Emission regulatory compliance",
                ],
            },
            "water_resources": {
                "label": "Water Resources",
                "risks": [
                    "Freshwater availability index",
                    "Groundwater depletion rate",
                    "Water treatment capacity",
                    "Drought vulnerability",
                    "Water quality compliance",
                    "Per-capita water consumption",
                ],
            },
            "extreme_weather": {
                "label": "Extreme Weather",
                "risks": [
                    "Hurricane / cyclone frequency",
                    "Tornado risk index",
                    "Hailstorm damage potential",
                    "Lightning strike density",
                    "Derecho / windstorm risk",
                    "Ice storm probability",
                    "Multi-hazard compound risk",
                ],
            },
            "precipitation": {
                "label": "Precipitation",
                "risks": [
                    "Flood return period shift",
                    "Heavy rainfall intensity",
                    "Flash flood susceptibility",
                    "Snowmelt flood risk",
                    "Urban drainage capacity",
                    "Precipitation variability index",
                ],
            },
        },
    },
    "infrastructure": {
        "name": "Infrastructure & Utilities",
        "subcategories": {
            "rail_subway": {
                "label": "Rail / Subway",
                "risks": [
                    "Track condition index",
                    "Signal system reliability",
                    "Bridge / tunnel structural grade",
                    "Station accessibility compliance",
                    "Ridership-to-capacity ratio",
                    "Electrification vulnerability",
                    "Derailment risk score",
                    "Emergency evacuation readiness",
                ],
            },
            "roads_bridges": {
                "label": "Roads / Bridges",
                "risks": [
                    "Pavement condition index",
                    "Bridge structural deficiency rate",
                    "Traffic congestion index",
                    "Pothole / maintenance backlog",
                    "Snow / ice response time",
                    "Road flood vulnerability",
                    "Intersection safety rating",
                    "Highway capacity utilization",
                    "Sidewalk ADA compliance",
                    "Construction zone disruption",
                ],
            },
            "water_infra": {
                "label": "Water",
                "risks": [
                    "Water main break rate",
                    "Treatment plant capacity utilization",
                    "Distribution system pressure",
                    "Lead service line exposure",
                    "Boil-water advisory frequency",
                    "Reservoir storage level",
                    "Water loss / leakage rate",
                    "Cross-connection contamination risk",
                ],
            },
            "wastewater": {
                "label": "Wastewater",
                "risks": [
                    "Sewer overflow frequency",
                    "Treatment capacity vs demand",
                    "Combined sewer risk",
                    "Effluent quality compliance",
                ],
            },
            "energy_grid": {
                "label": "Energy Grid",
                "risks": [
                    "Grid reliability (SAIDI)",
                    "Transformer age / condition",
                    "Renewable penetration ratio",
                    "Peak demand margin",
                    "Substation flood exposure",
                    "Transmission line vulnerability",
                    "Smart grid coverage",
                    "Backup generation capacity",
                ],
            },
        },
    },
    "socioeconomic": {
        "name": "Socio-Economic",
        "subcategories": {
            "housing": {
                "label": "Housing",
                "risks": [
                    "Housing affordability index",
                    "Homelessness rate",
                    "Rental vacancy rate",
                    "Public housing condition",
                    "Overcrowding rate",
                    "Eviction filing rate",
                    "Housing code violations",
                    "Construction permit activity",
                    "Mortgage default risk",
                ],
            },
            "income_wealth": {
                "label": "Income & Wealth",
                "risks": [
                    "Median household income trend",
                    "Poverty rate",
                    "Income inequality (Gini)",
                    "Food insecurity rate",
                    "Wealth gap by demographics",
                    "Cost of living index",
                    "Savings rate",
                    "Financial literacy score",
                ],
            },
            "employment": {
                "label": "Employment",
                "risks": [
                    "Unemployment rate",
                    "Labor force participation",
                    "Job vacancy rate",
                    "Wage growth vs inflation",
                    "Gig economy dependency",
                    "Sector diversification",
                ],
            },
            "education": {
                "label": "Education",
                "risks": [
                    "School performance index",
                    "Graduation rate",
                    "Teacher shortage",
                    "Education funding per pupil",
                    "Digital divide (student access)",
                    "Early childhood enrollment",
                    "Adult literacy rate",
                ],
            },
            "population": {
                "label": "Population",
                "risks": [
                    "Population growth rate",
                    "Aging population ratio",
                    "Migration net flow",
                    "Population density change",
                    "Dependency ratio",
                ],
            },
        },
    },
    "health": {
        "name": "Public Health & Safety",
        "subcategories": {
            "healthcare_access": {
                "label": "Healthcare Access",
                "risks": [
                    "Hospital bed capacity",
                    "ER wait time average",
                    "Primary care physician ratio",
                    "Health insurance coverage rate",
                    "Mental health provider access",
                    "Ambulance response time",
                    "Telehealth adoption",
                    "Healthcare cost burden",
                ],
            },
            "disease_illness": {
                "label": "Disease & Illness",
                "risks": [
                    "COVID-19 preparedness index",
                    "Influenza hospitalization rate",
                    "Vector-borne disease risk",
                    "Chronic disease prevalence",
                    "Vaccination coverage",
                    "Antimicrobial resistance",
                    "Water-borne disease risk",
                    "STI prevalence trend",
                    "Tuberculosis notification rate",
                    "Substance abuse rate",
                ],
            },
            "mental_health": {
                "label": "Mental Health",
                "risks": [
                    "Depression prevalence",
                    "Suicide rate trend",
                    "Mental health service capacity",
                    "Workplace stress index",
                    "Social isolation metric",
                ],
            },
            "crime_safety": {
                "label": "Crime & Safety",
                "risks": [
                    "Violent crime rate",
                    "Property crime rate",
                    "Gun violence index",
                    "Domestic violence reports",
                    "Hate crime frequency",
                    "Organized crime presence",
                    "Public safety perception",
                    "Police response time",
                    "Recidivism rate",
                ],
            },
        },
    },
    "financial": {
        "name": "Financial & Economic",
        "subcategories": {
            "municipal_finance": {
                "label": "Municipal Finance",
                "risks": [
                    "Bond rating outlook",
                    "Debt service ratio",
                    "Revenue diversification",
                    "Pension funding ratio",
                    "Tax base stability",
                    "Capital budget execution",
                    "Operating surplus / deficit",
                    "Cash reserve ratio",
                    "Intergovernmental revenue dependency",
                    "Credit default swap spread",
                ],
            },
            "real_estate": {
                "label": "Real Estate",
                "risks": [
                    "Commercial vacancy rate",
                    "Residential price-to-income",
                    "Office space absorption",
                    "Foreclosure rate",
                    "Property tax assessment trend",
                    "Development pipeline value",
                    "REIT performance index",
                    "Construction cost inflation",
                ],
            },
            "business_climate": {
                "label": "Business Climate",
                "risks": [
                    "Business formation rate",
                    "Bankruptcy filing rate",
                    "FDI inflow trend",
                    "Innovation / patent density",
                    "Small business survival rate",
                    "Regulatory burden index",
                ],
            },
            "tourism_convention": {
                "label": "Tourism & Convention",
                "risks": [
                    "Tourism revenue trend",
                    "Hotel occupancy rate",
                    "Convention booking pipeline",
                    "Destination competitiveness",
                ],
            },
        },
    },
    "technology": {
        "name": "Technology & Cyber",
        "subcategories": {
            "cybersecurity": {
                "label": "Cybersecurity",
                "risks": [
                    "Ransomware attack frequency",
                    "Data breach exposure",
                    "Critical infrastructure cyber risk",
                    "Phishing attack rate",
                    "DDoS attack frequency",
                    "Dark web threat intelligence",
                    "Patch management compliance",
                    "Identity theft rate",
                    "Insider threat score",
                    "IoT device vulnerability",
                    "Cloud security posture",
                    "Incident response time",
                ],
            },
            "digital_infrastructure": {
                "label": "Digital Infrastructure",
                "risks": [
                    "Broadband coverage rate",
                    "5G deployment progress",
                    "Data center capacity",
                    "Network latency index",
                    "Digital government services",
                    "Smart city sensor coverage",
                    "Fiber optic penetration",
                    "Cellular coverage gaps",
                ],
            },
            "ai_automation": {
                "label": "AI & Automation",
                "risks": [
                    "AI adoption readiness",
                    "Algorithmic bias risk",
                    "Automation job displacement",
                    "AI governance maturity",
                    "Deepfake / disinformation risk",
                ],
            },
        },
    },
    "political": {
        "name": "Political & Regulatory",
        "subcategories": {
            "governance": {
                "label": "Governance",
                "risks": [
                    "Government transparency index",
                    "Corruption perception",
                    "Democratic participation rate",
                    "Inter-agency coordination",
                    "Emergency management capacity",
                    "Regulatory enforcement effectiveness",
                    "Public trust in institutions",
                    "Data governance maturity",
                ],
            },
            "regulatory_compliance": {
                "label": "Regulatory Compliance",
                "risks": [
                    "Environmental regulation compliance",
                    "Labor law adherence",
                    "Financial regulation compliance",
                    "Data privacy (GDPR / CCPA)",
                    "Building code enforcement",
                    "Anti-money laundering compliance",
                ],
            },
            "political_stability": {
                "label": "Political Stability",
                "risks": [
                    "Political polarization index",
                    "Protest / unrest frequency",
                    "Government continuity risk",
                    "Geopolitical tension score",
                ],
            },
        },
    },
    "transport": {
        "name": "Transportation & Mobility",
        "subcategories": {
            "traffic_congestion": {
                "label": "Traffic & Congestion",
                "risks": [
                    "Average commute time",
                    "Vehicle miles traveled",
                    "Intersection level of service",
                    "Freight corridor congestion",
                    "Rush hour delay index",
                    "Traffic fatality rate",
                    "Connected vehicle adoption",
                    "Traffic management system maturity",
                ],
            },
            "transit": {
                "label": "Transit",
                "risks": [
                    "Transit ridership trend",
                    "On-time performance",
                    "Fleet condition index",
                    "Route coverage equity",
                    "Fare affordability",
                    "Last-mile connectivity",
                    "ADA accessibility compliance",
                    "Transit funding stability",
                ],
            },
            "active_transportation": {
                "label": "Active Transportation",
                "risks": [
                    "Bike lane network coverage",
                    "Pedestrian safety index",
                    "Micromobility adoption rate",
                ],
            },
            "parking": {
                "label": "Parking",
                "risks": [
                    "Parking utilization rate",
                    "Dynamic pricing coverage",
                    "EV charging infrastructure density",
                ],
            },
        },
    },
    "energy": {
        "name": "Energy & Resources",
        "subcategories": {
            "natural_gas": {
                "label": "Natural Gas",
                "risks": [
                    "Pipeline integrity index",
                    "Supply diversification",
                    "Storage capacity",
                    "Price volatility exposure",
                    "Methane leak detection",
                ],
            },
            "water_expanded": {
                "label": "Water expanded",
                "risks": [
                    "Industrial water reuse rate",
                    "Stormwater management capacity",
                    "Green infrastructure coverage",
                    "Water pricing sustainability",
                    "Desalination capacity",
                    "Aquifer recharge rate",
                ],
            },
            "waste_recycling": {
                "label": "Waste & Recycling",
                "risks": [
                    "Landfill remaining capacity",
                    "Recycling diversion rate",
                    "Hazardous waste compliance",
                    "E-waste collection rate",
                    "Food waste reduction",
                    "Composting participation",
                    "Illegal dumping incidents",
                    "Waste-to-energy capacity",
                ],
            },
            "circular_economy": {
                "label": "Circular Economy",
                "risks": [
                    "Material recovery rate",
                    "Product lifecycle assessment",
                    "Industrial symbiosis index",
                    "Sharing economy adoption",
                    "Extended producer responsibility",
                    "Sustainable procurement score",
                ],
            },
        },
    },
    "crosscutting": {
        "name": "Cross-cutting",
        "subcategories": {
            "cascading_failures": {
                "label": "Cascading Failures",
                "risks": [
                    "Interdependency vulnerability",
                    "Cascading failure probability",
                    "System-of-systems resilience",
                ],
            },
            "emerging_tech": {
                "label": "Emerging Tech",
                "risks": [
                    "Quantum computing readiness",
                    "Biotechnology risk",
                    "Space weather vulnerability",
                ],
            },
            "social_cohesion": {
                "label": "Social Cohesion",
                "risks": [
                    "Community trust index",
                    "Social capital measure",
                    "Civic engagement rate",
                ],
            },
            "legal_liability": {
                "label": "Legal & Liability",
                "risks": [
                    "Litigation exposure index",
                    "Environmental liability",
                    "Product liability risk",
                ],
            },
            "resilience": {
                "label": "Resilience",
                "risks": [
                    "Adaptive capacity score",
                    "Redundancy index",
                    "Recovery speed metric",
                ],
            },
        },
    },
}

# Scenario event_id keywords → which subcategories they boost (primary and secondary)
SCENARIO_SUBCATEGORY_BOOST: Dict[str, List[str]] = {
    "flood": ["sea_level_coastal", "precipitation", "water_infra", "wastewater", "roads_bridges"],
    "heat": ["temperature_heat", "energy_grid", "healthcare_access", "air_quality"],
    "sea_level": ["sea_level_coastal", "water_expanded", "roads_bridges"],
    "wind": ["extreme_weather", "energy_grid", "roads_bridges", "rail_subway"],
    "drought": ["water_resources", "precipitation", "natural_gas", "water_expanded"],
    "wildfire": ["air_quality", "extreme_weather", "healthcare_access", "housing"],
    "hurricane": ["extreme_weather", "sea_level_coastal", "energy_grid", "roads_bridges", "housing"],
    "monsoon": ["precipitation", "sea_level_coastal", "water_infra"],
    "arctic": ["temperature_heat", "energy_grid", "natural_gas"],
    "uv": ["air_quality", "healthcare_access", "disease_illness"],
    "elnino": ["extreme_weather", "precipitation", "water_resources", "temperature_heat"],
    "ngfs": ["temperature_heat", "sea_level_coastal", "energy_grid", "circular_economy"],
    "climate": ["temperature_heat", "sea_level_coastal", "extreme_weather", "precipitation"],
    "liquidity": ["municipal_finance", "real_estate", "business_climate", "tourism_convention"],
    "financial": ["municipal_finance", "real_estate", "business_climate"],
    "funding": ["municipal_finance", "income_wealth"],
    "covid": ["disease_illness", "healthcare_access", "mental_health", "employment", "tourism_convention"],
    "pandemic": ["disease_illness", "healthcare_access", "mental_health", "employment"],
    "health": ["healthcare_access", "disease_illness", "mental_health"],
    "conflict": ["political_stability", "governance", "crime_safety", "cascading_failures"],
    "geopolitical": ["political_stability", "governance", "business_climate"],
    "regional": ["political_stability", "governance"],
    "cyber": ["cybersecurity", "digital_infrastructure", "cascading_failures"],
    "tech": ["digital_infrastructure", "ai_automation", "cybersecurity"],
    "digital": ["digital_infrastructure", "cybersecurity"],
    "rail": ["rail_subway", "traffic_congestion", "transit"],
    "road": ["roads_bridges", "traffic_congestion"],
    "transport": ["traffic_congestion", "transit", "active_transportation"],
    "energy": ["energy_grid", "natural_gas", "waste_recycling"],
    "supply_chain": ["cascading_failures", "business_climate", "natural_gas"],
    "sanctions": ["political_stability", "business_climate", "municipal_finance"],
    "trade_war": ["business_climate", "municipal_finance", "tourism_convention"],
    "stress": ["municipal_finance", "real_estate", "cascading_failures"],
    "eba": ["municipal_finance", "real_estate", "regulatory_compliance"],
    "basel": ["regulatory_compliance", "municipal_finance", "financial"],
    "ai": ["ai_automation", "cybersecurity", "employment"],
    "quantum": ["emerging_tech", "cybersecurity"],
    "nuclear": ["emerging_tech", "cascading_failures", "healthcare_access"],
}

TREND_OPTIONS = ("rising", "stable", "declining")

# Cross-category impact propagation: primary_category -> {secondary_category: weight}
# Climate events cascade into infrastructure, health, financial, etc.
CROSS_CATEGORY_WEIGHTS: Dict[str, Dict[str, float]] = {
    "climate": {
        "infrastructure": 0.70,
        "health": 0.45,
        "financial": 0.55,
        "socioeconomic": 0.40,
        "transport": 0.50,
        "energy": 0.60,
        "technology": 0.20,
        "political": 0.15,
    },
    "infrastructure": {
        "transport": 0.65,
        "energy": 0.55,
        "health": 0.40,
        "socioeconomic": 0.35,
        "financial": 0.30,
        "technology": 0.25,
    },
    "financial": {
        "socioeconomic": 0.60,
        "infrastructure": 0.30,
        "political": 0.35,
        "health": 0.20,
        "technology": 0.15,
    },
    "health": {
        "socioeconomic": 0.55,
        "financial": 0.40,
        "political": 0.20,
        "infrastructure": 0.15,
    },
    "technology": {
        "infrastructure": 0.45,
        "financial": 0.35,
        "energy": 0.30,
        "political": 0.20,
    },
    "political": {
        "financial": 0.40,
        "socioeconomic": 0.35,
        "infrastructure": 0.20,
        "technology": 0.15,
    },
    "energy": {
        "infrastructure": 0.55,
        "transport": 0.45,
        "financial": 0.35,
        "health": 0.20,
        "climate": 0.15,
    },
    "transport": {
        "infrastructure": 0.50,
        "socioeconomic": 0.30,
        "financial": 0.25,
        "energy": 0.20,
    },
    "socioeconomic": {
        "health": 0.45,
        "financial": 0.35,
        "political": 0.30,
        "infrastructure": 0.15,
    },
    "crosscutting": {},
}

# Per-scenario severity defaults keyed by substring match (first match wins)
SCENARIO_DEFAULT_SEVERITY: Dict[str, float] = {
    "hurricane": 0.85,
    "flood_extreme": 0.85,
    "arctic_vortex": 0.80,
    "sea_level": 0.75,
    "wind_storm": 0.75,
    "wildfire_aus": 0.75,
    "flood_rhine": 0.72,
    "flood_asia": 0.78,
    "drought_conditions": 0.70,
    "drought": 0.68,
    "heat_stress": 0.65,
    "heatwave": 0.65,
    "metro_flood": 0.60,
    "heavy_rain": 0.62,
    "elnino": 0.70,
    "monsoon": 0.72,
    "uv_extreme": 0.55,
    "wildfire_canada": 0.70,
    "wildfire_insurance": 0.65,
    "liquidity": 0.88,
    "covid": 0.80,
    "pandemic": 0.80,
    "conflict": 0.88,
    "geopolitical": 0.82,
    "ngfs": 0.88,
    "cyber": 0.75,
    "supply_chain": 0.72,
    "sanctions": 0.78,
    "trade_war": 0.70,
    "eba": 0.82,
    "basel": 0.80,
    "nuclear": 0.90,
    "quantum": 0.60,
    "ai_disruption": 0.65,
}


def get_scenario_severity(event_id: str) -> float:
    """Return appropriate default severity for a scenario event_id."""
    eid = (event_id or "").lower().replace("-", "_")
    for keyword, severity in SCENARIO_DEFAULT_SEVERITY.items():
        if keyword in eid:
            return severity
    return 0.70


def get_taxonomy_total() -> int:
    """Return total count of risk factors in the taxonomy."""
    total = 0
    for cat in FULL_RISK_TAXONOMY.values():
        for sub in cat["subcategories"].values():
            total += len(sub["risks"])
    return total
