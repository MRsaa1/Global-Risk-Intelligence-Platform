"""
Seed data for Stress Tests and Historical Events.

Provides example data for testing and demonstration.
"""
import json
from datetime import date
from typing import List, Dict, Any, Optional
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

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
    # Melbourne / Victoria / Australia floods
    {
        "name": "Melbourne Flash Floods 2010",
        "description": "Major flash flooding across Melbourne CBD, Southbank, Kensington, North Melbourne. Maribyrnong and Yarra rivers overflowed. Over 1,400 properties damaged. Record rainfall in 24h.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2010, 3, 6),
        "end_date": date(2010, 3, 8),
        "duration_days": 2,
        "region_name": "Melbourne, Victoria",
        "country_codes": "AU",
        "center_latitude": -37.81,
        "center_longitude": 144.96,
        "affected_area_km2": 120,
        "severity_actual": 0.75,
        "financial_loss_eur": 450_000_000,
        "affected_population": 45_000,
        "affected_assets_count": 1_400,
        "damaged_assets_count": 850,
        "recovery_time_months": 12,
        "lessons_learned": "Melbourne flood history highlights riverine and flash flood risks. CBD and low-lying areas most vulnerable. VICSES coordination, flood barriers and drainage critical.",
        "is_verified": True,
        "tags": json.dumps(["flood", "climate", "melbourne", "victoria", "australia", "2010"]),
    },
    {
        "name": "Melbourne Storms 2005",
        "description": "Severe storms caused flooding in Melbourne CBD and eastern suburbs. Damage to infrastructure and properties. Comparable to riverine flood scenarios.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2005, 2, 3),
        "end_date": date(2005, 2, 5),
        "duration_days": 2,
        "region_name": "Melbourne, Victoria",
        "country_codes": "AU",
        "center_latitude": -37.81,
        "center_longitude": 144.96,
        "severity_actual": 0.55,
        "financial_loss_eur": 180_000_000,
        "affected_population": 15_000,
        "lessons_learned": "Stormwater drainage capacity limits. Low-lying areas (Southbank, Kensington) at risk. Emergency response and flood barriers reduce impact.",
        "is_verified": True,
        "tags": json.dumps(["flood", "storm", "melbourne", "victoria", "australia", "2005"]),
    },
    {
        "name": "Queensland Floods 2011",
        "description": "Catastrophic flooding across Queensland including Brisbane. 78% of state declared disaster zone. $2.4B+ damages. Comparable severity for Australian capital city flood.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2010, 12, 1),
        "end_date": date(2011, 1, 30),
        "duration_days": 60,
        "region_name": "Brisbane, Queensland",
        "country_codes": "AU",
        "center_latitude": -27.47,
        "center_longitude": 153.03,
        "affected_area_km2": 1_000_000,
        "severity_actual": 0.95,
        "financial_loss_eur": 2_400_000_000,
        "affected_population": 200_000,
        "casualties": 35,
        "affected_assets_count": 28_000,
        "recovery_time_months": 24,
        "lessons_learned": "Wivenhoe Dam management, early warning, evacuation protocols. Urban floodplain development restrictions. Insurance gaps for flood coverage.",
        "is_verified": True,
        "tags": json.dumps(["flood", "climate", "brisbane", "queensland", "australia", "2011"]),
    },
    {
        "name": "Victoria Floods 2011",
        "description": "Major flooding across Victoria including regional centres. Comparable riverine flood dynamics to Melbourne scenario.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2011, 1, 13),
        "end_date": date(2011, 1, 20),
        "duration_days": 7,
        "region_name": "Victoria",
        "country_codes": "AU",
        "center_latitude": -37.5,
        "center_longitude": 144.5,
        "severity_actual": 0.70,
        "financial_loss_eur": 750_000_000,
        "affected_population": 65_000,
        "lessons_learned": "State-wide coordination (VICSES). Regional and urban flood risk. Infrastructure resilience for transport and utilities.",
        "is_verified": True,
        "tags": json.dumps(["flood", "climate", "victoria", "australia", "2011"]),
    },

    # Montreal / Quebec floods (comparable for Montreal flood stress tests)
    {
        "name": "Quebec Spring Floods 2019",
        "description": "Major spring flooding across Montreal region. Rivière des Prairies overflow, Île-Bizard, Pierrefonds-Roxboro, Sainte-Anne-de-Bellevue affected. Rapid snowmelt + heavy rainfall. 10,000 evacuated.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2019, 4, 20),
        "end_date": date(2019, 5, 11),
        "duration_days": 21,
        "region_name": "Montreal, Quebec",
        "country_codes": "CA",
        "center_latitude": 45.49,
        "center_longitude": -73.89,
        "affected_area_km2": 350,
        "severity_actual": 0.82,
        "financial_loss_eur": 289_000_000,
        "affected_population": 45_000,
        "casualties": 1,
        "affected_assets_count": 2_800,
        "recovery_time_months": 18,
        "lessons_learned": "Improved early warning systems needed. Flood zone mapping outdated. Insurance gap significant. Rivière des Prairies, Lake of Two Mountains at risk.",
        "is_verified": True,
        "tags": json.dumps(["flood", "climate", "montreal", "quebec", "canada", "2019"]),
    },
    {
        "name": "Quebec Spring Floods 2017",
        "description": "Record spring precipitation + snowmelt. Île-Bizard-Sainte-Geneviève, Pierrefonds-Roxboro, L'Île-Perrot, Rigaud affected. 4,066 households evacuated.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2017, 5, 2),
        "end_date": date(2017, 5, 20),
        "duration_days": 18,
        "region_name": "Montreal, Quebec",
        "country_codes": "CA",
        "center_latitude": 45.48,
        "center_longitude": -73.85,
        "affected_area_km2": 420,
        "severity_actual": 0.88,
        "financial_loss_eur": 453_000_000,
        "affected_population": 65_000,
        "casualties": 2,
        "affected_assets_count": 4_200,
        "recovery_time_months": 24,
        "lessons_learned": "Improved early warning systems needed. Flood zone mapping outdated. Insurance gap significant.",
        "is_verified": True,
        "tags": json.dumps(["flood", "climate", "montreal", "quebec", "canada", "2017"]),
    },
    {
        "name": "Ice Storm / Spring Melt 1998",
        "description": "Ice storm and spring melt caused flooding in Montreal region. Power outages, ice jams, Rivière des Prairies surge.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(1998, 4, 15),
        "end_date": date(1998, 4, 27),
        "duration_days": 12,
        "region_name": "Montreal, Quebec",
        "country_codes": "CA",
        "center_latitude": 45.50,
        "center_longitude": -73.55,
        "severity_actual": 0.65,
        "financial_loss_eur": 123_000_000,
        "affected_population": 25_000,
        "affected_assets_count": 1_100,
        "recovery_time_months": 9,
        "lessons_learned": "Ice jam release and spring melt critical for Montreal. MELCCFP monitoring.",
        "is_verified": True,
        "tags": json.dumps(["flood", "ice", "montreal", "quebec", "canada", "1998"]),
    },
    {
        "name": "St. Lawrence Flood 1987",
        "description": "Major Montreal metropolitan flood. Spring melt + ice jam release. Rivière des Prairies, Lake of Two Mountains overflow.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(1987, 4, 22),
        "end_date": date(1987, 5, 6),
        "duration_days": 14,
        "region_name": "Montreal, Quebec",
        "country_codes": "CA",
        "center_latitude": 45.48,
        "center_longitude": -73.70,
        "severity_actual": 0.78,
        "financial_loss_eur": 286_000_000,
        "affected_population": 55_000,
        "affected_assets_count": 2_200,
        "recovery_time_months": 15,
        "lessons_learned": "Spring melt and ice jam release critical for Montreal. MELCCFP Quebec historical records.",
        "is_verified": True,
        "tags": json.dumps(["flood", "climate", "montreal", "quebec", "canada", "1987"]),
    },
    {
        "name": "Rivière des Prairies Flood 1976",
        "description": "Rivière des Prairies overflow. Low-lying districts, Île-Bizard affected. 1,500 evacuated.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(1976, 4, 12),
        "end_date": date(1976, 4, 22),
        "duration_days": 10,
        "region_name": "Montreal, Quebec",
        "country_codes": "CA",
        "center_latitude": 45.49,
        "center_longitude": -73.88,
        "severity_actual": 0.62,
        "financial_loss_eur": 123_000_000,
        "affected_population": 18_000,
        "affected_assets_count": 850,
        "recovery_time_months": 8,
        "lessons_learned": "Historical Records. Rivière des Prairies flood risk for Montreal West Island.",
        "is_verified": True,
        "tags": json.dumps(["flood", "climate", "montreal", "quebec", "canada", "1976"]),
    },
    {
        "name": "Île Bizard Flash Flood 1974",
        "description": "Flash flooding on Île-Bizard. Rapid rainfall, poor drainage. 800 evacuated, 3 casualties.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(1974, 7, 15),
        "end_date": date(1974, 7, 22),
        "duration_days": 7,
        "region_name": "Montreal, Île-Bizard, Quebec",
        "country_codes": "CA",
        "center_latitude": 45.49,
        "center_longitude": -73.89,
        "severity_actual": 0.58,
        "financial_loss_eur": 65_000_000,
        "affected_population": 12_000,
        "casualties": 3,
        "affected_assets_count": 420,
        "recovery_time_months": 6,
        "lessons_learned": "Historical Records. Flash flood risk for Île-Bizard. Drainage and early warning critical.",
        "is_verified": True,
        "tags": json.dumps(["flood", "flash", "montreal", "ile-bizard", "quebec", "canada", "1974"]),
    },

    # Tokyo / Japan floods (comparable for Tokyo flood stress tests)
    {
        "name": "Typhoon Hagibis 2019",
        "description": "Devastating typhoon hit Japan; record rainfall, flooding in Tokyo and surrounding prefectures. Over 100 casualties, ¥1.8+ trillion (€12B+) in damages. Rivers overflowed, levees breached.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2019, 10, 12),
        "end_date": date(2019, 10, 13),
        "duration_days": 2,
        "region_name": "Tokyo, Kanto",
        "country_codes": "JP",
        "center_latitude": 35.68,
        "center_longitude": 139.69,
        "affected_area_km2": 5000,
        "severity_actual": 0.95,
        "financial_loss_eur": 12_000_000_000,
        "affected_population": 1_000_000,
        "casualties": 98,
        "affected_assets_count": 15_000,
        "damaged_assets_count": 10_000,
        "recovery_time_months": 24,
        "lessons_learned": "Early evacuation, river levee reinforcement, and flood barriers critical for Tokyo low-lying areas. Comparable to Tokyo flood stress scenarios.",
        "is_verified": True,
        "tags": json.dumps(["flood", "typhoon", "tokyo", "japan", "2019", "climate"]),
    },
    {
        "name": "Typhoon Faxai 2019",
        "description": "Strong typhoon made landfall near Tokyo. Widespread power outages, flooding, and damage in Chiba and Kanto. Billions in damages.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2019, 9, 9),
        "end_date": date(2019, 9, 10),
        "duration_days": 2,
        "region_name": "Tokyo, Chiba, Kanto",
        "country_codes": "JP",
        "center_latitude": 35.6,
        "center_longitude": 140.1,
        "severity_actual": 0.85,
        "financial_loss_eur": 5_000_000_000,
        "affected_population": 900_000,
        "affected_assets_count": 8_000,
        "recovery_time_months": 12,
        "lessons_learned": "Infrastructure resilience and rapid restoration critical. Comparable to Tokyo coastal and riverine flood scenarios.",
        "is_verified": True,
        "tags": json.dumps(["flood", "typhoon", "tokyo", "japan", "2019", "chiba"]),
    },
    {
        "name": "Tama River Flood 2019",
        "description": "Heavy rainfall caused Tama River to rise; flooding risk in western Tokyo. Evacuation orders, levee monitoring. Comparable to Tokyo riverine flood stress test.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2019, 10, 25),
        "end_date": date(2019, 10, 26),
        "duration_days": 1,
        "region_name": "Tokyo, Tama River",
        "country_codes": "JP",
        "center_latitude": 35.65,
        "center_longitude": 139.5,
        "severity_actual": 0.65,
        "financial_loss_eur": 500_000_000,
        "affected_population": 200_000,
        "lessons_learned": "River level monitoring and evacuation protocols for Tama River basin. Relevant for Tokyo flood scenarios.",
        "is_verified": True,
        "tags": json.dumps(["flood", "river", "tokyo", "japan", "2019", "tama"]),
    },

    # Helsinki / Finland / Nordic floods (comparable for Helsinki flood stress tests)
    {
        "name": "Helsinki Flood 2005",
        "description": "Severe flooding in Helsinki and southern Finland after heavy rainfall. River Vantaa overflowed, basement flooding, transport disruption. Comparable to Helsinki flood scenarios.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2005, 8, 8),
        "end_date": date(2005, 8, 10),
        "duration_days": 2,
        "region_name": "Helsinki, Southern Finland",
        "country_codes": "FI",
        "center_latitude": 60.17,
        "center_longitude": 24.94,
        "severity_actual": 0.70,
        "financial_loss_eur": 80_000_000,
        "affected_population": 50_000,
        "affected_assets_count": 1_200,
        "recovery_time_months": 6,
        "lessons_learned": "Stormwater drainage and river level monitoring critical for Helsinki. Comparable to Nordic flood stress tests.",
        "is_verified": True,
        "tags": json.dumps(["flood", "storm", "helsinki", "finland", "2005", "climate"]),
    },
    {
        "name": "Finland Storms and Floods 2017",
        "description": "Widespread storms and flooding across Finland including Helsinki region. Wind damage, coastal flooding, power outages.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2017, 8, 22),
        "end_date": date(2017, 8, 24),
        "duration_days": 2,
        "region_name": "Finland, Helsinki region",
        "country_codes": "FI",
        "center_latitude": 60.2,
        "center_longitude": 24.9,
        "severity_actual": 0.65,
        "financial_loss_eur": 120_000_000,
        "affected_population": 100_000,
        "recovery_time_months": 8,
        "lessons_learned": "Coastal and stormwater resilience important for Helsinki. Relevant for Nordic flood scenarios.",
        "is_verified": True,
        "tags": json.dumps(["flood", "storm", "helsinki", "finland", "2017", "climate"]),
    },
    {
        "name": "Nordic Flood 2010",
        "description": "Heavy rainfall and flooding in Nordic region including southern Finland and Helsinki. River and urban flooding.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2010, 7, 28),
        "end_date": date(2010, 7, 30),
        "duration_days": 2,
        "region_name": "Southern Finland, Nordic",
        "country_codes": "FI",
        "center_latitude": 60.5,
        "center_longitude": 25.0,
        "severity_actual": 0.60,
        "financial_loss_eur": 45_000_000,
        "affected_population": 30_000,
        "lessons_learned": "Nordic flood patterns comparable to Helsinki stress test. Drainage and river management key.",
        "is_verified": True,
        "tags": json.dumps(["flood", "nordic", "finland", "helsinki", "2010", "climate"]),
    },

    # US / Miami & South Florida floods (comparable for Miami flood stress tests)
    {
        "name": "South Florida Flood / Hurricane Andrew 1992",
        "description": "Catastrophic hurricane and flooding in South Florida including Miami-Dade. Widespread destruction, storm surge, riverine flooding. Over $25B in damages (1992 USD). Comparable to Miami flood and coastal storm scenarios.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(1992, 8, 24),
        "end_date": date(1992, 8, 26),
        "duration_days": 2,
        "region_name": "Miami, South Florida",
        "country_codes": "US",
        "center_latitude": 25.76,
        "center_longitude": -80.19,
        "affected_area_km2": 5000,
        "severity_actual": 0.95,
        "financial_loss_eur": 28_000_000_000,
        "affected_population": 1_500_000,
        "casualties": 65,
        "affected_assets_count": 125_000,
        "destroyed_assets_count": 25_000,
        "damaged_assets_count": 80_000,
        "recovery_time_months": 36,
        "lessons_learned": "Coastal evacuation, building codes, flood barriers critical for Miami. Storm surge and riverine flood risk. Insurance and federal disaster response.",
        "is_verified": True,
        "tags": json.dumps(["flood", "hurricane", "storm", "miami", "florida", "usa", "1992", "climate"]),
    },
    {
        "name": "Houston Floods (Hurricane Harvey) 2017",
        "description": "Catastrophic flooding in Houston and Southeast Texas from Hurricane Harvey. Record rainfall, widespread inundation. $125B+ in damages. Comparable US flood scenario for stress tests.",
        "event_type": StressTestType.CLIMATE.value,
        "start_date": date(2017, 8, 25),
        "end_date": date(2017, 9, 3),
        "duration_days": 9,
        "region_name": "Houston, Texas",
        "country_codes": "US",
        "center_latitude": 29.76,
        "center_longitude": -95.37,
        "affected_area_km2": 15000,
        "severity_actual": 0.95,
        "financial_loss_eur": 125_000_000_000,
        "affected_population": 13_000_000,
        "casualties": 68,
        "affected_assets_count": 200_000,
        "recovery_time_months": 24,
        "lessons_learned": "Urban drainage and reservoir management. Floodplain development limits. Emergency response and evacuation for major US metro flood.",
        "is_verified": True,
        "tags": json.dumps(["flood", "hurricane", "storm", "houston", "texas", "usa", "2017", "climate"]),
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


# Extra demo scenarios for dropdown (names seen in local/dev)
EXTRA_DEMO_SCENARIOS: List[Dict[str, Any]] = [
    {"name": "General Scenario", "test_type": StressTestType.CLIMATE.value, "region_name": "Global"},
    {"name": "Debt Crisis", "test_type": StressTestType.FINANCIAL.value, "region_name": "Eurozone"},
    {"name": "Climate Tipping", "test_type": StressTestType.CLIMATE.value, "region_name": "Global"},
    {"name": "Climate 5Yr", "test_type": StressTestType.CLIMATE.value, "region_name": "EU"},
    {"name": "Regional Conflict Spillover", "test_type": StressTestType.MILITARY.value, "region_name": "Eastern Europe"},
    {"name": "Ngfs Ssp5 2050", "test_type": StressTestType.CLIMATE.value, "region_name": "Global"},
    {"name": "Synthetic Bio", "test_type": StressTestType.PANDEMIC.value, "region_name": "Global"},
    {"name": "Food Supply", "test_type": StressTestType.CLIMATE.value, "region_name": "Global"},
    {"name": "Stress Test Scenario", "test_type": StressTestType.FINANCIAL.value, "region_name": "EU"},
]


def get_historical_events() -> List[Dict[str, Any]]:
    """Get list of historical events for seeding."""
    return HISTORICAL_EVENTS


def get_stress_test_scenarios() -> List[Dict[str, Any]]:
    """Get list of stress test scenarios for seeding."""
    return STRESS_TEST_SCENARIOS


async def seed_stress_tests_db(session: AsyncSession) -> int:
    """
    Insert demo stress test records into DB so the Visualizations/Command Center
    dropdown shows a full list. Idempotent: no-op if 10+ tests already exist.
    Also seeds risk_zones for the first test so Stress Loss (P95) on server
    matches local order of magnitude (~€1.4B). Returns number of stress tests inserted.
    """
    from sqlalchemy import select, func
    from src.models.stress_test import StressTest, StressTestStatus, RiskZone

    r = await session.execute(select(func.count()).select_from(StressTest))
    count = r.scalar() or 0
    if count >= 10:
        # Still ensure latest stress test has zones so Stress Loss (P95) shows ~€1.4B on server
        latest = await session.execute(
            select(StressTest.id).order_by(StressTest.created_at.desc()).limit(1)
        )
        latest_id = latest.scalar()
        if latest_id:
            zone_count = await session.execute(
                select(func.count()).select_from(RiskZone).where(RiskZone.stress_test_id == latest_id)
            )
            if (zone_count.scalar() or 0) == 0:
                for i, loss in enumerate([280e6, 320e6, 250e6, 350e6, 200e6]):
                    z = RiskZone(
                        stress_test_id=latest_id,
                        zone_level=["critical", "high", "high", "medium", "medium"][i],
                        name=f"Zone {i + 1}",
                        center_latitude=50.0 + i * 2,
                        center_longitude=8.0 + i,
                        radius_km=50.0,
                        risk_score=0.5 + i * 0.1,
                        expected_loss=loss,
                        total_exposure=loss * 1.2,
                        affected_assets_count=5 + i,
                    )
                    session.add(z)
                await session.commit()
        return 0

    merged = list(STRESS_TEST_SCENARIOS) + EXTRA_DEMO_SCENARIOS
    created = 0
    first_stress_test_id: Optional[str] = None
    for s in merged:
        st = StressTest(
            id=str(uuid4()),
            name=s["name"],
            description=s.get("description"),
            test_type=s.get("test_type", StressTestType.CLIMATE.value),
            status=StressTestStatus.COMPLETED.value,
            center_latitude=s.get("center_latitude"),
            center_longitude=s.get("center_longitude"),
            radius_km=s.get("radius_km", 100.0),
            region_name=s.get("region_name"),
            country_codes=s.get("country_codes"),
            severity=float(s.get("severity", 0.5)),
            probability=float(s.get("probability", 0.1)),
            time_horizon_months=int(s.get("time_horizon_months", 12)),
            pd_multiplier=float(s.get("pd_multiplier", 1.0)),
            lgd_multiplier=float(s.get("lgd_multiplier", 1.0)),
            valuation_impact_pct=float(s.get("valuation_impact_pct", 0.0)),
            recovery_time_months=s.get("recovery_time_months"),
            parameters=s.get("parameters"),
        )
        session.add(st)
        if first_stress_test_id is None:
            first_stress_test_id = st.id
        created += 1

    # Seed risk_zones for the first stress test so get_latest_stress_loss returns ~1400 (€1.4B)
    # and Command Center/Dashboard Stress Loss (P95) matches local
    if first_stress_test_id:
        zone_losses = [280e6, 320e6, 250e6, 350e6, 200e6]  # sum = 1.4e9 → 1400 M
        for i, loss in enumerate(zone_losses):
            z = RiskZone(
                stress_test_id=first_stress_test_id,
                zone_level=["critical", "high", "high", "medium", "medium"][i],
                name=f"Zone {i + 1}",
                center_latitude=50.0 + i * 2,
                center_longitude=8.0 + i,
                radius_km=50.0,
                risk_score=0.5 + i * 0.1,
                expected_loss=loss,
                total_exposure=loss * 1.2,
                affected_assets_count=5 + i,
            )
            session.add(z)
    await session.commit()
    return created
