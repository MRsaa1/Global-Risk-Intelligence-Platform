"""
Cities Database with Known Risk Factors.

This module contains a comprehensive database of 70+ cities with:
- Geographic coordinates
- Known risk factors (seismic, flood, hurricane, political, etc.)
- Base exposure and economic data
- Regional classifications

Risk factors are based on publicly available data:
- Seismic: Pacific Ring of Fire, Alpine-Himalayan Belt, etc.
- Flood: Coastal cities, river deltas, monsoon regions
- Hurricane/Typhoon: Atlantic basin, Pacific basin
- Political: Based on regional stability indicators
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum


class SeismicZone(str, Enum):
    """Seismic hazard zones."""
    PACIFIC_RING = "pacific_ring"  # Highest seismic risk
    ALPINE_HIMALAYAN = "alpine_himalayan"  # High seismic risk
    MID_ATLANTIC = "mid_atlantic"  # Moderate
    STABLE = "stable"  # Low seismic risk


class ClimateZone(str, Enum):
    """Climate hazard zones."""
    TROPICAL_CYCLONE = "tropical_cyclone"  # Hurricane/Typhoon prone
    MONSOON = "monsoon"  # Flood prone
    COASTAL_FLOOD = "coastal_flood"  # Sea level rise risk
    TEMPERATE = "temperate"  # Moderate risk
    ARID = "arid"  # Drought risk
    CONTINENTAL = "continental"  # Extreme temperature risk


class PoliticalRegion(str, Enum):
    """Political stability regions."""
    OECD_STABLE = "oecd_stable"  # Very low political risk
    OECD_MODERATE = "oecd_moderate"  # Low political risk
    EMERGING_STABLE = "emerging_stable"  # Moderate risk
    EMERGING_VOLATILE = "emerging_volatile"  # High risk
    CONFLICT_ZONE = "conflict_zone"  # Very high risk


@dataclass
class CityData:
    """City data with risk factors."""
    id: str
    name: str
    country: str
    lat: float
    lng: float
    
    # Economic data
    exposure: float = 0.0  # Billions USD
    assets_count: int = 0
    gdp_contribution: float = 0.0  # Percentage of country GDP
    
    # Risk zones
    seismic_zone: SeismicZone = SeismicZone.STABLE
    climate_zone: ClimateZone = ClimateZone.TEMPERATE
    political_region: PoliticalRegion = PoliticalRegion.OECD_STABLE
    
    # Known risk factors (0.0 - 1.0)
    known_risks: Dict[str, float] = field(default_factory=dict)
    
    # Historical events
    major_events: List[str] = field(default_factory=list)


# Seismic risk by zone
SEISMIC_BASE_RISK = {
    SeismicZone.PACIFIC_RING: 0.85,
    SeismicZone.ALPINE_HIMALAYAN: 0.70,
    SeismicZone.MID_ATLANTIC: 0.40,
    SeismicZone.STABLE: 0.15,
}

# Flood/Hurricane risk by climate zone
CLIMATE_BASE_RISK = {
    ClimateZone.TROPICAL_CYCLONE: 0.80,
    ClimateZone.MONSOON: 0.75,
    ClimateZone.COASTAL_FLOOD: 0.65,
    ClimateZone.TEMPERATE: 0.35,
    ClimateZone.ARID: 0.25,
    ClimateZone.CONTINENTAL: 0.30,
}

# Political risk by region
POLITICAL_BASE_RISK = {
    PoliticalRegion.OECD_STABLE: 0.10,
    PoliticalRegion.OECD_MODERATE: 0.25,
    PoliticalRegion.EMERGING_STABLE: 0.40,
    PoliticalRegion.EMERGING_VOLATILE: 0.65,
    PoliticalRegion.CONFLICT_ZONE: 0.90,
}


# ============================================================================
# CITIES DATABASE - 72 Cities with Known Risk Factors
# ============================================================================

CITIES_DATABASE: Dict[str, CityData] = {
    # ==================== NORTH AMERICA ====================
    "newyork": CityData(
        id="newyork", name="New York City", country="USA",
        lat=40.7128, lng=-74.0060, exposure=52.3, assets_count=1834,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.COASTAL_FLOOD,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.65, "hurricane": 0.55, "infrastructure": 0.40},
        major_events=["Hurricane Sandy 2012", "9/11 2001"]
    ),
    "losangeles": CityData(
        id="losangeles", name="Los Angeles", country="USA",
        lat=34.0522, lng=-118.2437, exposure=42.1, assets_count=1245,
        seismic_zone=SeismicZone.PACIFIC_RING,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"earthquake": 0.85, "wildfire": 0.70, "drought": 0.55},
        major_events=["Northridge Earthquake 1994", "LA Wildfires 2020"]
    ),
    "sanfrancisco": CityData(
        id="sanfrancisco", name="San Francisco", country="USA",
        lat=37.7749, lng=-122.4194, exposure=48.5, assets_count=978,
        seismic_zone=SeismicZone.PACIFIC_RING,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"earthquake": 0.92, "wildfire": 0.45, "sea_level": 0.50},
        major_events=["1906 Earthquake", "Loma Prieta 1989"]
    ),
    "chicago": CityData(
        id="chicago", name="Chicago", country="USA",
        lat=41.8781, lng=-87.6298, exposure=25.4, assets_count=856,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.45, "winter_storm": 0.55, "infrastructure": 0.35},
        major_events=["Great Chicago Fire 1871", "1967 Blizzard"]
    ),
    "miami": CityData(
        id="miami", name="Miami", country="USA",
        lat=25.7617, lng=-80.1918, exposure=32.5, assets_count=756,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"hurricane": 0.90, "flood": 0.85, "sea_level": 0.80},
        major_events=["Hurricane Andrew 1992", "Hurricane Irma 2017"]
    ),
    "houston": CityData(
        id="houston", name="Houston", country="USA",
        lat=29.7604, lng=-95.3698, exposure=28.5, assets_count=678,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"hurricane": 0.80, "flood": 0.85, "industrial": 0.50},
        major_events=["Hurricane Harvey 2017", "Tropical Storm Allison 2001"]
    ),
    "boston": CityData(
        id="boston", name="Boston", country="USA",
        lat=42.3601, lng=-71.0589, exposure=31.2, assets_count=756,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.COASTAL_FLOOD,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.55, "hurricane": 0.40, "winter_storm": 0.50},
        major_events=["Blizzard of 1978", "Boston Molasses Disaster 1919"]
    ),
    "washington": CityData(
        id="washington", name="Washington DC", country="USA",
        lat=38.9072, lng=-77.0369, exposure=42.1, assets_count=678,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.45, "hurricane": 0.35, "cyber": 0.60},
        major_events=["Hurricane Isabel 2003", "Derecho 2012"]
    ),
    "denver": CityData(
        id="denver", name="Denver", country="USA",
        lat=39.7392, lng=-104.9903, exposure=18.9, assets_count=423,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"wildfire": 0.55, "winter_storm": 0.50, "drought": 0.45},
        major_events=["Marshall Fire 2021", "2003 Blizzard"]
    ),
    "seattle": CityData(
        id="seattle", name="Seattle", country="USA",
        lat=47.6062, lng=-122.3321, exposure=28.5, assets_count=534,
        seismic_zone=SeismicZone.PACIFIC_RING,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"earthquake": 0.75, "volcano": 0.40, "flood": 0.35},
        major_events=["Nisqually Earthquake 2001"]
    ),
    "vancouver": CityData(
        id="vancouver", name="Vancouver", country="Canada",
        lat=49.2827, lng=-123.1207, exposure=22.5, assets_count=456,
        seismic_zone=SeismicZone.PACIFIC_RING,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"earthquake": 0.70, "flood": 0.55, "wildfire": 0.40},
        major_events=["2021 BC Floods"]
    ),
    "toronto": CityData(
        id="toronto", name="Toronto", country="Canada",
        lat=43.6532, lng=-79.3832, exposure=32.5, assets_count=678,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.45, "ice_storm": 0.50, "infrastructure": 0.30},
        major_events=["2013 Ice Storm", "2018 Floods"]
    ),
    "montreal": CityData(
        id="montreal", name="Montreal", country="Canada",
        lat=45.5017, lng=-73.5673, exposure=22.4, assets_count=512,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.50, "ice_storm": 0.55, "cold": 0.40},
        major_events=["1998 Ice Storm", "2017 Floods"]
    ),
    "mexicocity": CityData(
        id="mexicocity", name="Mexico City", country="Mexico",
        lat=19.4326, lng=-99.1332, exposure=32.5, assets_count=567,
        seismic_zone=SeismicZone.PACIFIC_RING,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"earthquake": 0.90, "subsidence": 0.75, "air_quality": 0.60},
        major_events=["1985 Earthquake", "2017 Earthquake"]
    ),
    
    # ==================== ASIA ====================
    "tokyo": CityData(
        id="tokyo", name="Tokyo", country="Japan",
        lat=35.6762, lng=139.6503, exposure=45.2, assets_count=1247,
        seismic_zone=SeismicZone.PACIFIC_RING,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"earthquake": 0.95, "typhoon": 0.75, "flood": 0.60, "tsunami": 0.70},
        major_events=["1923 Great Kanto Earthquake", "2011 Tohoku Earthquake"]
    ),
    "shanghai": CityData(
        id="shanghai", name="Shanghai", country="China",
        lat=31.2304, lng=121.4737, exposure=55.8, assets_count=1456,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.MONSOON,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"typhoon": 0.70, "flood": 0.75, "subsidence": 0.55},
        major_events=["Typhoon Lekima 2019"]
    ),
    "beijing": CityData(
        id="beijing", name="Beijing", country="China",
        lat=39.9042, lng=116.4074, exposure=48.2, assets_count=1234,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"earthquake": 0.55, "air_quality": 0.70, "water_stress": 0.65},
        major_events=["1976 Tangshan Earthquake (nearby)"]
    ),
    "hongkong": CityData(
        id="hongkong", name="Hong Kong", country="China",
        lat=22.3193, lng=114.1694, exposure=42.5, assets_count=876,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"typhoon": 0.80, "flood": 0.65, "political": 0.55},
        major_events=["Typhoon Mangkhut 2018", "2019 Protests"]
    ),
    "singapore": CityData(
        id="singapore", name="Singapore", country="Singapore",
        lat=1.3521, lng=103.8198, exposure=38.9, assets_count=567,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.50, "sea_level": 0.60, "heat": 0.55},
        major_events=["2010 Floods"]
    ),
    "seoul": CityData(
        id="seoul", name="Seoul", country="South Korea",
        lat=37.5665, lng=126.9780, exposure=38.5, assets_count=987,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.MONSOON,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.55, "typhoon": 0.45, "geopolitical": 0.60},
        major_events=["2022 Seoul Floods"]
    ),
    "taipei": CityData(
        id="taipei", name="Taipei", country="Taiwan",
        lat=25.0330, lng=121.5654, exposure=28.9, assets_count=678,
        seismic_zone=SeismicZone.PACIFIC_RING,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"earthquake": 0.85, "typhoon": 0.80, "geopolitical": 0.75},
        major_events=["1999 Chi-Chi Earthquake", "Typhoon Morakot 2009"]
    ),
    "mumbai": CityData(
        id="mumbai", name="Mumbai", country="India",
        lat=19.0760, lng=72.8777, exposure=28.4, assets_count=876,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.MONSOON,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"flood": 0.90, "monsoon": 0.85, "infrastructure": 0.70},
        major_events=["2005 Mumbai Floods", "2017 Floods"]
    ),
    "delhi": CityData(
        id="delhi", name="Delhi", country="India",
        lat=28.6139, lng=77.2090, exposure=22.8, assets_count=756,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.MONSOON,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"earthquake": 0.60, "air_quality": 0.90, "flood": 0.55},
        major_events=["2021 Delhi Floods"]
    ),
    "bangkok": CityData(
        id="bangkok", name="Bangkok", country="Thailand",
        lat=13.7563, lng=100.5018, exposure=28.5, assets_count=567,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.MONSOON,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"flood": 0.85, "subsidence": 0.70, "political": 0.50},
        major_events=["2011 Thailand Floods"]
    ),
    "jakarta": CityData(
        id="jakarta", name="Jakarta", country="Indonesia",
        lat=-6.2088, lng=106.8456, exposure=32.5, assets_count=678,
        seismic_zone=SeismicZone.PACIFIC_RING,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"flood": 0.90, "subsidence": 0.85, "earthquake": 0.65},
        major_events=["2020 Jakarta Floods", "2004 Tsunami (region)"]
    ),
    "manila": CityData(
        id="manila", name="Manila", country="Philippines",
        lat=14.5995, lng=120.9842, exposure=22.5, assets_count=456,
        seismic_zone=SeismicZone.PACIFIC_RING,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"typhoon": 0.90, "flood": 0.85, "earthquake": 0.70},
        major_events=["Typhoon Ondoy 2009", "Typhoon Haiyan 2013"]
    ),
    "hochiminh": CityData(
        id="hochiminh", name="Ho Chi Minh City", country="Vietnam",
        lat=10.8231, lng=106.6297, exposure=18.5, assets_count=345,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.MONSOON,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"flood": 0.80, "sea_level": 0.75, "typhoon": 0.55},
        major_events=["2020 Floods"]
    ),
    "hanoi": CityData(
        id="hanoi", name="Hanoi", country="Vietnam",
        lat=21.0285, lng=105.8542, exposure=15.8, assets_count=289,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.MONSOON,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"flood": 0.70, "typhoon": 0.50, "infrastructure": 0.45},
        major_events=["2008 Floods"]
    ),
    "dhaka": CityData(
        id="dhaka", name="Dhaka", country="Bangladesh",
        lat=23.8103, lng=90.4125, exposure=12.5, assets_count=234,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.MONSOON,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"flood": 0.95, "cyclone": 0.80, "infrastructure": 0.75},
        major_events=["1998 Floods", "2020 Floods"]
    ),
    "karachi": CityData(
        id="karachi", name="Karachi", country="Pakistan",
        lat=24.8607, lng=67.0011, exposure=18.5, assets_count=345,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"flood": 0.65, "heat": 0.75, "political": 0.70},
        major_events=["2020 Floods", "2015 Heat Wave"]
    ),
    
    # ==================== EUROPE ====================
    "london": CityData(
        id="london", name="London", country="UK",
        lat=51.5074, lng=-0.1278, exposure=38.5, assets_count=1234,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.55, "cyber": 0.50, "terror": 0.45},
        major_events=["2007 Floods", "2017 Terror Attack"]
    ),
    "paris": CityData(
        id="paris", name="Paris", country="France",
        lat=48.8566, lng=2.3522, exposure=28.4, assets_count=987,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.50, "heat": 0.55, "civil_unrest": 0.45},
        major_events=["2016 Seine Floods", "2019 Yellow Vest Protests"]
    ),
    "frankfurt": CityData(
        id="frankfurt", name="Frankfurt", country="Germany",
        lat=50.1109, lng=8.6821, exposure=35.2, assets_count=756,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.45, "cyber": 0.50, "financial": 0.55},
        major_events=["2021 Rhine Floods (region)"]
    ),
    "berlin": CityData(
        id="berlin", name="Berlin", country="Germany",
        lat=52.5200, lng=13.4050, exposure=22.8, assets_count=567,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"cyber": 0.45, "infrastructure": 0.40, "energy": 0.50},
        major_events=[]
    ),
    "munich": CityData(
        id="munich", name="Munich", country="Germany",
        lat=48.1351, lng=11.5820, exposure=18.5, assets_count=456,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.50, "hail": 0.45, "earthquake": 0.25},
        major_events=["2013 Floods"]
    ),
    "cologne": CityData(
        id="cologne", name="Cologne", country="Germany",
        lat=50.9375, lng=6.9603, exposure=22.5, assets_count=389,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.70, "infrastructure": 0.40},
        major_events=["2021 Rhine Floods"]
    ),
    "dusseldorf": CityData(
        id="dusseldorf", name="Dusseldorf", country="Germany",
        lat=51.2277, lng=6.7735, exposure=18.5, assets_count=312,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.65, "infrastructure": 0.35},
        major_events=["2021 Rhine Floods"]
    ),
    "amsterdam": CityData(
        id="amsterdam", name="Amsterdam", country="Netherlands",
        lat=52.3676, lng=4.9041, exposure=28.5, assets_count=567,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.COASTAL_FLOOD,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.70, "sea_level": 0.75, "subsidence": 0.50},
        major_events=["1953 North Sea Flood"]
    ),
    "rotterdam": CityData(
        id="rotterdam", name="Rotterdam", country="Netherlands",
        lat=51.9244, lng=4.4777, exposure=22.8, assets_count=456,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.COASTAL_FLOOD,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.75, "sea_level": 0.80, "port_disruption": 0.55},
        major_events=["1953 North Sea Flood"]
    ),
    "zurich": CityData(
        id="zurich", name="Zurich", country="Switzerland",
        lat=47.3769, lng=8.5417, exposure=42.5, assets_count=567,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.35, "earthquake": 0.30, "financial": 0.40},
        major_events=[]
    ),
    "geneva": CityData(
        id="geneva", name="Geneva", country="Switzerland",
        lat=46.2044, lng=6.1432, exposure=35.8, assets_count=456,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.30, "earthquake": 0.25, "financial": 0.35},
        major_events=[]
    ),
    "rome": CityData(
        id="rome", name="Rome", country="Italy",
        lat=41.9028, lng=12.4964, exposure=22.5, assets_count=456,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_MODERATE,
        known_risks={"earthquake": 0.55, "flood": 0.45, "infrastructure": 0.50},
        major_events=["2016 Central Italy Earthquake (region)"]
    ),
    "milan": CityData(
        id="milan", name="Milan", country="Italy",
        lat=45.4642, lng=9.1900, exposure=32.5, assets_count=567,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_MODERATE,
        known_risks={"earthquake": 0.40, "flood": 0.50, "air_quality": 0.55},
        major_events=["2014 Floods"]
    ),
    "madrid": CityData(
        id="madrid", name="Madrid", country="Spain",
        lat=40.4168, lng=-3.7038, exposure=25.8, assets_count=567,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"drought": 0.55, "heat": 0.60, "political": 0.35},
        major_events=["2022 Heat Wave"]
    ),
    "barcelona": CityData(
        id="barcelona", name="Barcelona", country="Spain",
        lat=41.3851, lng=2.1734, exposure=22.5, assets_count=456,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_MODERATE,
        known_risks={"flood": 0.55, "drought": 0.50, "political": 0.45},
        major_events=["2019 Floods"]
    ),
    "lisbon": CityData(
        id="lisbon", name="Lisbon", country="Portugal",
        lat=38.7223, lng=-9.1393, exposure=18.5, assets_count=345,
        seismic_zone=SeismicZone.MID_ATLANTIC,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"earthquake": 0.65, "tsunami": 0.50, "wildfire": 0.55},
        major_events=["1755 Earthquake"]
    ),
    "lyon": CityData(
        id="lyon", name="Lyon", country="France",
        lat=45.7640, lng=4.8357, exposure=18.5, assets_count=312,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.55, "heat": 0.50},
        major_events=["2003 Heat Wave"]
    ),
    "marseille": CityData(
        id="marseille", name="Marseille", country="France",
        lat=43.2965, lng=5.3698, exposure=15.8, assets_count=289,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.60, "wildfire": 0.55, "wind": 0.50},
        major_events=["2020 Flash Floods"]
    ),
    "brussels": CityData(
        id="brussels", name="Brussels", country="Belgium",
        lat=50.8503, lng=4.3517, exposure=28.5, assets_count=456,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.50, "terror": 0.50, "cyber": 0.45},
        major_events=["2016 Terror Attack", "2021 Floods"]
    ),
    "vienna": CityData(
        id="vienna", name="Vienna", country="Austria",
        lat=48.2082, lng=16.3738, exposure=22.5, assets_count=389,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.45, "earthquake": 0.30, "heat": 0.45},
        major_events=["2013 Danube Floods"]
    ),
    "stockholm": CityData(
        id="stockholm", name="Stockholm", country="Sweden",
        lat=59.3293, lng=18.0686, exposure=25.8, assets_count=389,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"cyber": 0.45, "cold": 0.40, "infrastructure": 0.30},
        major_events=[]
    ),
    "oslo": CityData(
        id="oslo", name="Oslo", country="Norway",
        lat=59.9139, lng=10.7522, exposure=22.5, assets_count=312,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"landslide": 0.45, "cold": 0.40, "cyber": 0.35},
        major_events=[]
    ),
    "helsinki": CityData(
        id="helsinki", name="Helsinki", country="Finland",
        lat=60.1699, lng=24.9384, exposure=18.5, assets_count=278,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"cold": 0.45, "cyber": 0.40, "geopolitical": 0.40},
        major_events=[]
    ),
    "copenhagen": CityData(
        id="copenhagen", name="Copenhagen", country="Denmark",
        lat=55.6761, lng=12.5683, exposure=22.5, assets_count=345,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.COASTAL_FLOOD,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.55, "sea_level": 0.50, "wind": 0.45},
        major_events=["2011 Cloudburst"]
    ),
    "dublin": CityData(
        id="dublin", name="Dublin", country="Ireland",
        lat=53.3498, lng=-6.2603, exposure=28.5, assets_count=456,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.50, "wind": 0.55, "financial": 0.45},
        major_events=["2020 Floods"]
    ),
    "athens": CityData(
        id="athens", name="Athens", country="Greece",
        lat=37.9838, lng=23.7275, exposure=15.8, assets_count=289,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_MODERATE,
        known_risks={"earthquake": 0.70, "wildfire": 0.65, "heat": 0.60},
        major_events=["1999 Athens Earthquake", "2021 Wildfires"]
    ),
    "warsaw": CityData(
        id="warsaw", name="Warsaw", country="Poland",
        lat=52.2297, lng=21.0122, exposure=18.5, assets_count=345,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"flood": 0.45, "cold": 0.50, "geopolitical": 0.45},
        major_events=["2010 Floods"]
    ),
    "moscow": CityData(
        id="moscow", name="Moscow", country="Russia",
        lat=55.7558, lng=37.6173, exposure=35.2, assets_count=678,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"cold": 0.50, "political": 0.75, "cyber": 0.60},
        major_events=["2010 Heat Wave", "Sanctions 2022"]
    ),
    "kyiv": CityData(
        id="kyiv", name="Kyiv", country="Ukraine",
        lat=50.4501, lng=30.5234, exposure=12.5, assets_count=234,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.95, "infrastructure": 0.85, "energy": 0.80},
        major_events=["2022 Russian Invasion"]
    ),
    "istanbul": CityData(
        id="istanbul", name="Istanbul", country="Turkey",
        lat=41.0082, lng=28.9784, exposure=28.5, assets_count=567,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"earthquake": 0.90, "flood": 0.50, "political": 0.55},
        major_events=["1999 Izmit Earthquake", "Expected Major Quake"]
    ),
    
    # ==================== MIDDLE EAST & AFRICA ====================
    "dubai": CityData(
        id="dubai", name="Dubai", country="UAE",
        lat=25.2048, lng=55.2708, exposure=32.5, assets_count=567,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"heat": 0.75, "sand_storm": 0.55, "water_stress": 0.70},
        major_events=["2024 Floods"]
    ),
    "telaviv": CityData(
        id="telaviv", name="Tel Aviv", country="Israel",
        lat=32.0853, lng=34.7818, exposure=35.2, assets_count=567,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.85, "earthquake": 0.55, "cyber": 0.50},
        major_events=["2023 Gaza Conflict", "Multiple Conflicts"]
    ),
    "cairo": CityData(
        id="cairo", name="Cairo", country="Egypt",
        lat=30.0444, lng=31.2357, exposure=18.5, assets_count=345,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"earthquake": 0.50, "heat": 0.70, "political": 0.55},
        major_events=["1992 Earthquake", "2011 Revolution"]
    ),
    "tehran": CityData(
        id="tehran", name="Tehran", country="Iran",
        lat=35.6892, lng=51.3890, exposure=22.8, assets_count=389,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"earthquake": 0.90, "air_quality": 0.75, "political": 0.80},
        major_events=["2017 Earthquake", "Sanctions"]
    ),
    "lagos": CityData(
        id="lagos", name="Lagos", country="Nigeria",
        lat=6.5244, lng=3.3792, exposure=15.8, assets_count=289,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"flood": 0.85, "infrastructure": 0.80, "political": 0.65},
        major_events=["Annual Floods"]
    ),
    "johannesburg": CityData(
        id="johannesburg", name="Johannesburg", country="South Africa",
        lat=-26.2041, lng=28.0473, exposure=22.5, assets_count=389,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"crime": 0.70, "infrastructure": 0.60, "energy": 0.75},
        major_events=["Load Shedding Crisis 2023"]
    ),
    "capetown": CityData(
        id="capetown", name="Cape Town", country="South Africa",
        lat=-33.9249, lng=18.4241, exposure=18.5, assets_count=312,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"drought": 0.80, "wildfire": 0.65, "infrastructure": 0.55},
        major_events=["2018 Water Crisis", "2021 Wildfires"]
    ),
    
    # ==================== SOUTH AMERICA ====================
    "saopaulo": CityData(
        id="saopaulo", name="Sao Paulo", country="Brazil",
        lat=-23.5505, lng=-46.6333, exposure=38.5, assets_count=678,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"flood": 0.70, "drought": 0.60, "infrastructure": 0.55},
        major_events=["2014 Water Crisis", "Annual Floods"]
    ),
    "riodejaneiro": CityData(
        id="riodejaneiro", name="Rio de Janeiro", country="Brazil",
        lat=-22.9068, lng=-43.1729, exposure=28.5, assets_count=456,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.EMERGING_STABLE,
        known_risks={"flood": 0.75, "landslide": 0.70, "crime": 0.60},
        major_events=["2011 Landslides", "2022 Floods"]
    ),
    
    # ==================== OCEANIA ====================
    "sydney": CityData(
        id="sydney", name="Sydney", country="Australia",
        lat=-33.8688, lng=151.2093, exposure=38.7, assets_count=945,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"wildfire": 0.75, "flood": 0.55, "drought": 0.50},
        major_events=["2019-20 Bushfires", "2022 Floods"]
    ),
    "melbourne": CityData(
        id="melbourne", name="Melbourne", country="Australia",
        lat=-37.8136, lng=144.9631, exposure=28.5, assets_count=892,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.OECD_STABLE,
        known_risks={"wildfire": 0.60, "flood": 0.45, "earthquake": 0.30},
        major_events=["2009 Black Saturday", "2021 Earthquake"]
    ),
    
    # ==================== CONFLICT ZONES (2024-2025) ====================
    "damascus": CityData(
        id="damascus", name="Damascus", country="Syria",
        lat=33.5138, lng=36.2765, exposure=5.2, assets_count=89,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.95, "infrastructure": 0.90, "humanitarian": 0.95},
        major_events=["Syrian Civil War 2011-present", "2023 Earthquake"]
    ),
    "aleppo": CityData(
        id="aleppo", name="Aleppo", country="Syria",
        lat=36.2021, lng=37.1343, exposure=3.5, assets_count=45,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.98, "infrastructure": 0.95, "humanitarian": 0.95},
        major_events=["Battle of Aleppo 2012-2016", "2023 Earthquake"]
    ),
    "caracas": CityData(
        id="caracas", name="Caracas", country="Venezuela",
        lat=10.4806, lng=-66.9036, exposure=8.5, assets_count=156,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TROPICAL_CYCLONE,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"political": 0.92, "economic": 0.90, "infrastructure": 0.80, "crime": 0.85},
        major_events=["2019 Political Crisis", "2024 Election Crisis", "Hyperinflation"]
    ),
    "sanaa": CityData(
        id="sanaa", name="Sanaa", country="Yemen",
        lat=15.3694, lng=44.1910, exposure=2.5, assets_count=34,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.98, "humanitarian": 0.95, "infrastructure": 0.92},
        major_events=["Yemen Civil War 2014-present", "Houthi Conflict"]
    ),
    "khartoum": CityData(
        id="khartoum", name="Khartoum", country="Sudan",
        lat=15.5007, lng=32.5599, exposure=4.2, assets_count=67,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.95, "infrastructure": 0.88, "humanitarian": 0.90},
        major_events=["2023 Sudan Conflict", "Military Coup 2021"]
    ),
    "tripoli_libya": CityData(
        id="tripoli_libya", name="Tripoli", country="Libya",
        lat=32.8872, lng=13.1913, exposure=6.5, assets_count=98,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.85, "political": 0.88, "infrastructure": 0.75},
        major_events=["Libyan Civil War 2011-present", "2023 Floods"]
    ),
    "kabul": CityData(
        id="kabul", name="Kabul", country="Afghanistan",
        lat=34.5553, lng=69.2075, exposure=3.8, assets_count=56,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.90, "political": 0.95, "humanitarian": 0.88, "earthquake": 0.70},
        major_events=["Taliban Takeover 2021", "2022 Earthquake"]
    ),
    "minsk": CityData(
        id="minsk", name="Minsk", country="Belarus",
        lat=53.9006, lng=27.5590, exposure=12.5, assets_count=189,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.EMERGING_VOLATILE,
        known_risks={"political": 0.80, "sanctions": 0.75, "geopolitical": 0.85},
        major_events=["2020 Protests", "Sanctions 2022"]
    ),
    "pyongyang": CityData(
        id="pyongyang", name="Pyongyang", country="North Korea",
        lat=39.0392, lng=125.7625, exposure=0.5, assets_count=12,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"political": 0.95, "geopolitical": 0.90, "humanitarian": 0.80, "nuclear": 0.85},
        major_events=["Nuclear Tests", "Sanctions", "Isolation"]
    ),
    "donetskluhansk": CityData(
        id="donetskluhansk", name="Donetsk-Luhansk", country="Ukraine",
        lat=48.0159, lng=37.8028, exposure=5.2, assets_count=78,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.98, "infrastructure": 0.95, "humanitarian": 0.90},
        major_events=["War in Donbas 2014-present", "Russian Occupation 2022"]
    ),
    "kharkiv": CityData(
        id="kharkiv", name="Kharkiv", country="Ukraine",
        lat=49.9935, lng=36.2304, exposure=8.5, assets_count=145,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.CONTINENTAL,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.92, "infrastructure": 0.85, "shelling": 0.90},
        major_events=["2022 Russian Invasion", "Constant Shelling"]
    ),
    "odesa": CityData(
        id="odesa", name="Odesa", country="Ukraine",
        lat=46.4825, lng=30.7233, exposure=10.5, assets_count=178,
        seismic_zone=SeismicZone.STABLE,
        climate_zone=ClimateZone.TEMPERATE,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.85, "infrastructure": 0.75, "port_blockade": 0.80},
        major_events=["2022 Russian Invasion", "Port Attacks"]
    ),
    "gaza": CityData(
        id="gaza", name="Gaza City", country="Palestine",
        lat=31.5017, lng=34.4668, exposure=2.0, assets_count=23,
        seismic_zone=SeismicZone.ALPINE_HIMALAYAN,
        climate_zone=ClimateZone.ARID,
        political_region=PoliticalRegion.CONFLICT_ZONE,
        known_risks={"conflict": 0.99, "infrastructure": 0.98, "humanitarian": 0.99},
        major_events=["2023-2024 Gaza War", "Multiple Conflicts"]
    ),
}


def get_city(city_id: str) -> Optional[CityData]:
    """Get city data by ID."""
    return CITIES_DATABASE.get(city_id.lower())


def get_all_cities() -> List[CityData]:
    """Get all cities."""
    return list(CITIES_DATABASE.values())


def get_cities_by_risk_zone(zone: SeismicZone) -> List[CityData]:
    """Get cities in a specific seismic zone."""
    return [c for c in CITIES_DATABASE.values() if c.seismic_zone == zone]


def get_cities_by_climate(zone: ClimateZone) -> List[CityData]:
    """Get cities in a specific climate zone."""
    return [c for c in CITIES_DATABASE.values() if c.climate_zone == zone]


def get_cities_by_political_region(region: PoliticalRegion) -> List[CityData]:
    """Get cities in a specific political region."""
    return [c for c in CITIES_DATABASE.values() if c.political_region == region]
