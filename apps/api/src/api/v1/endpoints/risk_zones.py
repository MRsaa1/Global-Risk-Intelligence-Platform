"""
Risk Zones Dependencies API

Provides endpoints for:
- Zone dependencies analysis
- Causal relationships
- Cascade effects
- Real-time updates via ANALYST agent
- Hidden concentration metrics (Herfindahl by supplier/region/technology)
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services.concentration_service import get_concentration_for_assets

router = APIRouter()


# ==================== SCHEMAS ====================

class ZoneDependency(BaseModel):
    """Dependency between two risk zones."""
    zone1_id: str
    zone1_name: str
    zone2_id: str
    zone2_name: str
    dependency_type: str  # "direct", "indirect", "causal"
    criticality: float  # 0.0-1.0
    mechanism: str  # Description of how they're connected
    category: str  # "military", "infrastructure", "economic", "migration", "global"


class CausalChain(BaseModel):
    """Causal chain between zones."""
    root_cause: str
    chain: List[dict]  # [{zone_id, zone_name, step, description}]
    final_effect: str
    criticality: float


class Consequence(BaseModel):
    """Consequence of risk zone escalation."""
    type: str  # "economic", "humanitarian", "infrastructure", "geopolitical", "environmental"
    severity: float  # 0.0-1.0
    description: str
    affected_regions: List[str]
    timeline: str  # "immediate", "short_term", "medium_term", "long_term"
    mitigation_priority: float  # 0.0-1.0


class ZoneAnalysis(BaseModel):
    """Complete analysis for a zone."""
    zone_id: str
    zone_name: str
    root_causes: List[str]
    dependencies: List[ZoneDependency]
    causal_chains: List[CausalChain]
    cascade_potential: float  # 0.0-1.0
    consequences: List[Consequence]  # Analysis of potential consequences


class DependenciesResponse(BaseModel):
    """Response with all zone dependencies."""
    last_updated: datetime
    revision: int
    zones: List[dict]  # Zone info
    dependencies: List[ZoneDependency]
    causal_chains: List[CausalChain]
    clusters: List[dict]  # Clustered zones by root cause


# ==================== DATA ====================

# This module currently uses in-memory data.
# `last_updated` / `revision` allow the UI to confirm that refresh/update actions applied.
_RISK_ZONES_LAST_UPDATED: datetime = datetime.utcnow()
_RISK_ZONES_REVISION: int = 1

# Zone coordinates - ALL risk zones (not just critical)
# Includes zones from all risk levels: critical (>0.8), high (0.6-0.8), medium (0.4-0.6), low (<0.4)
ZONE_COORDINATES = {
    # Critical zones (>0.8)
    'kyiv': {'lat': 50.4501, 'lng': 30.5234, 'risk': 0.95, 'name': 'Kyiv'},
    'kharkiv': {'lat': 49.9935, 'lng': 36.2304, 'risk': 0.92, 'name': 'Kharkiv'},
    'odesa': {'lat': 46.4825, 'lng': 30.7233, 'risk': 0.85, 'name': 'Odesa'},
    'donetskluhansk': {'lat': 48.0159, 'lng': 37.8028, 'risk': 0.98, 'name': 'Donetsk-Luhansk'},
    'telaviv': {'lat': 32.0853, 'lng': 34.7818, 'risk': 0.88, 'name': 'Tel Aviv'},
    'gaza': {'lat': 31.5017, 'lng': 34.4668, 'risk': 0.99, 'name': 'Gaza City'},
    'damascus': {'lat': 33.5138, 'lng': 36.2765, 'risk': 0.98, 'name': 'Damascus'},
    'aleppo': {'lat': 36.2021, 'lng': 37.1343, 'risk': 0.98, 'name': 'Aleppo'},
    'caracas': {'lat': 10.4806, 'lng': -66.9036, 'risk': 0.95, 'name': 'Caracas'},
    'sanaa': {'lat': 15.3694, 'lng': 44.1910, 'risk': 0.98, 'name': 'Sanaa'},
    'khartoum': {'lat': 15.5007, 'lng': 32.5599, 'risk': 0.95, 'name': 'Khartoum'},
    'tripoli': {'lat': 32.8872, 'lng': 13.1913, 'risk': 0.88, 'name': 'Tripoli'},
    'kabul': {'lat': 34.5553, 'lng': 69.2075, 'risk': 0.95, 'name': 'Kabul'},
    'pyongyang': {'lat': 39.0392, 'lng': 125.7625, 'risk': 0.95, 'name': 'Pyongyang'},
    'taipei': {'lat': 25.0330, 'lng': 121.5654, 'risk': 0.83, 'name': 'Taipei'},
    # High risk zones (0.6-0.8)
    'tehran': {'lat': 35.6892, 'lng': 51.3890, 'risk': 0.82, 'name': 'Tehran'},
    'dhaka': {'lat': 23.8103, 'lng': 90.4125, 'risk': 0.88, 'name': 'Dhaka'},
    'jakarta': {'lat': -6.2088, 'lng': 106.8456, 'risk': 0.82, 'name': 'Jakarta'},
    'miami': {'lat': 25.7617, 'lng': -80.1918, 'risk': 0.78, 'name': 'Miami'},
    'lagos': {'lat': 6.5244, 'lng': 3.3792, 'risk': 0.78, 'name': 'Lagos'},
    'manila': {'lat': 14.5995, 'lng': 120.9842, 'risk': 0.75, 'name': 'Manila'},
    'karachi': {'lat': 24.8607, 'lng': 67.0011, 'risk': 0.75, 'name': 'Karachi'},
    'bangkok': {'lat': 13.7563, 'lng': 100.5018, 'risk': 0.72, 'name': 'Bangkok'},
    'istanbul': {'lat': 41.0082, 'lng': 28.9784, 'risk': 0.72, 'name': 'Istanbul'},
    'cairo': {'lat': 30.0444, 'lng': 31.2357, 'risk': 0.68, 'name': 'Cairo'},
    'madrid': {'lat': 40.4168, 'lng': -3.7038, 'risk': 0.65, 'name': 'Madrid'},
    'warsaw': {'lat': 52.2297, 'lng': 21.0122, 'risk': 0.55, 'name': 'Warsaw'},
    # Medium risk zones (0.4-0.6)
    'paris': {'lat': 48.8566, 'lng': 2.3522, 'risk': 0.65, 'name': 'Paris'},
    'london': {'lat': 51.5074, 'lng': -0.1278, 'risk': 0.58, 'name': 'London'},
    'berlin': {'lat': 52.5200, 'lng': 13.4050, 'risk': 0.42, 'name': 'Berlin'},
    'frankfurt': {'lat': 50.1109, 'lng': 8.6821, 'risk': 0.45, 'name': 'Frankfurt'},
    'tokyo': {'lat': 35.6762, 'lng': 139.6503, 'risk': 0.55, 'name': 'Tokyo'},
    'seoul': {'lat': 37.5665, 'lng': 126.9780, 'risk': 0.72, 'name': 'Seoul'},
    'singapore': {'lat': 1.3521, 'lng': 103.8198, 'risk': 0.48, 'name': 'Singapore'},
    'sydney': {'lat': -33.8688, 'lng': 151.2093, 'risk': 0.52, 'name': 'Sydney'},
    'newyork': {'lat': 40.7128, 'lng': -74.0060, 'risk': 0.75, 'name': 'New York'},
    'losangeles': {'lat': 34.0522, 'lng': -118.2437, 'risk': 0.72, 'name': 'Los Angeles'},
    'chicago': {'lat': 41.8781, 'lng': -87.6298, 'risk': 0.75, 'name': 'Chicago'},
    'sanfrancisco': {'lat': 37.7749, 'lng': -122.4194, 'risk': 0.88, 'name': 'San Francisco'},
    'boston': {'lat': 42.3601, 'lng': -71.0589, 'risk': 0.62, 'name': 'Boston'},
    'toronto': {'lat': 43.6532, 'lng': -79.3832, 'risk': 0.55, 'name': 'Toronto'},
    'mumbai': {'lat': 19.0760, 'lng': 72.8777, 'risk': 0.78, 'name': 'Mumbai'},
    'delhi': {'lat': 28.6139, 'lng': 77.2090, 'risk': 0.78, 'name': 'Delhi'},
    'shanghai': {'lat': 31.2304, 'lng': 121.4737, 'risk': 0.65, 'name': 'Shanghai'},
    'beijing': {'lat': 39.9042, 'lng': 116.4074, 'risk': 0.78, 'name': 'Beijing'},
    'hongkong': {'lat': 22.3193, 'lng': 114.1694, 'risk': 0.72, 'name': 'Hong Kong'},
    'dubai': {'lat': 25.2048, 'lng': 55.2708, 'risk': 0.72, 'name': 'Dubai'},
    'riyadh': {'lat': 24.7136, 'lng': 46.6753, 'risk': 0.55, 'name': 'Riyadh'},
    'amsterdam': {'lat': 52.3676, 'lng': 4.9041, 'risk': 0.62, 'name': 'Amsterdam'},
    'zurich': {'lat': 47.3769, 'lng': 8.5417, 'risk': 0.45, 'name': 'Zurich'},
    'stockholm': {'lat': 59.3293, 'lng': 18.0686, 'risk': 0.48, 'name': 'Stockholm'},
    'oslo': {'lat': 59.9139, 'lng': 10.7522, 'risk': 0.45, 'name': 'Oslo'},
    'copenhagen': {'lat': 55.6761, 'lng': 12.5683, 'risk': 0.48, 'name': 'Copenhagen'},
    'vienna': {'lat': 48.2082, 'lng': 16.3738, 'risk': 0.52, 'name': 'Vienna'},
    'rome': {'lat': 41.9028, 'lng': 12.4964, 'risk': 0.58, 'name': 'Rome'},
    'milan': {'lat': 45.4642, 'lng': 9.1900, 'risk': 0.62, 'name': 'Milan'},
    'barcelona': {'lat': 41.3851, 'lng': 2.1734, 'risk': 0.62, 'name': 'Barcelona'},
    'brussels': {'lat': 50.8503, 'lng': 4.3517, 'risk': 0.55, 'name': 'Brussels'},
    'dublin': {'lat': 53.3498, 'lng': -6.2603, 'risk': 0.52, 'name': 'Dublin'},
    'lisbon': {'lat': 38.7223, 'lng': -9.1393, 'risk': 0.55, 'name': 'Lisbon'},
    'athens': {'lat': 37.9838, 'lng': 23.7275, 'risk': 0.62, 'name': 'Athens'},
    'helsinki': {'lat': 60.1699, 'lng': 24.9384, 'risk': 0.52, 'name': 'Helsinki'},
    'geneva': {'lat': 46.2044, 'lng': 6.1432, 'risk': 0.42, 'name': 'Geneva'},
    'washington': {'lat': 38.9072, 'lng': -77.0369, 'risk': 0.48, 'name': 'Washington DC'},
    'denver': {'lat': 39.7392, 'lng': -104.9903, 'risk': 0.45, 'name': 'Denver'},
    'seattle': {'lat': 47.6062, 'lng': -122.3321, 'risk': 0.58, 'name': 'Seattle'},
    'vancouver': {'lat': 49.2827, 'lng': -123.1207, 'risk': 0.52, 'name': 'Vancouver'},
    'montreal': {'lat': 45.5017, 'lng': -73.5673, 'risk': 0.55, 'name': 'Montreal'},
    'saopaulo': {'lat': -23.5505, 'lng': -46.6333, 'risk': 0.72, 'name': 'São Paulo'},
    'riodejaneiro': {'lat': -22.9068, 'lng': -43.1729, 'risk': 0.68, 'name': 'Rio de Janeiro'},
    'mexicocity': {'lat': 19.4326, 'lng': -99.1332, 'risk': 0.72, 'name': 'Mexico City'},
    'johannesburg': {'lat': -26.2041, 'lng': 28.0473, 'risk': 0.65, 'name': 'Johannesburg'},
    'capetown': {'lat': -33.9249, 'lng': 18.4241, 'risk': 0.58, 'name': 'Cape Town'},
    'hochiminh': {'lat': 10.8231, 'lng': 106.6297, 'risk': 0.72, 'name': 'Ho Chi Minh City'},
    'hanoi': {'lat': 21.0285, 'lng': 105.8542, 'risk': 0.68, 'name': 'Hanoi'},
    'cologne': {'lat': 50.9375, 'lng': 6.9603, 'risk': 0.72, 'name': 'Cologne'},
    'dusseldorf': {'lat': 51.2277, 'lng': 6.7735, 'risk': 0.68, 'name': 'Düsseldorf'},
    'lyon': {'lat': 45.7640, 'lng': 4.8357, 'risk': 0.58, 'name': 'Lyon'},
    'marseille': {'lat': 43.2965, 'lng': 5.3698, 'risk': 0.62, 'name': 'Marseille'},
    'rotterdam': {'lat': 51.9244, 'lng': 4.4777, 'risk': 0.68, 'name': 'Rotterdam'},
    'minsk': {'lat': 53.9006, 'lng': 27.5590, 'risk': 0.82, 'name': 'Minsk'},
    # Additional zones referenced in dependencies
    'beirut': {'lat': 33.8938, 'lng': 35.5018, 'risk': 0.75, 'name': 'Beirut'},
    'kolkata': {'lat': 22.5726, 'lng': 88.3639, 'risk': 0.68, 'name': 'Kolkata'},
    'seoul': {'lat': 37.5665, 'lng': 126.9780, 'risk': 0.72, 'name': 'Seoul'},
}

# Dependencies data - ALL zones (not just critical)
# Includes dependencies between zones at all risk levels
DEPENDENCIES = [
    # Ukrainian cluster (Critical)
    {'zone1': 'kyiv', 'zone2': 'kharkiv', 'type': 'direct', 'criticality': 0.95, 'mechanism': 'Shared front line, unified energy grid', 'category': 'military'},
    {'zone1': 'kyiv', 'zone2': 'odesa', 'type': 'direct', 'criticality': 0.90, 'mechanism': 'Energy networks, transportation corridors', 'category': 'infrastructure'},
    {'zone1': 'kyiv', 'zone2': 'donetskluhansk', 'type': 'direct', 'criticality': 0.95, 'mechanism': 'Territorial control, military operations', 'category': 'military'},
    {'zone1': 'kharkiv', 'zone2': 'odesa', 'type': 'direct', 'criticality': 0.85, 'mechanism': 'Energy networks, transportation', 'category': 'infrastructure'},
    {'zone1': 'kyiv', 'zone2': 'warsaw', 'type': 'indirect', 'criticality': 0.65, 'mechanism': 'Refugee flows, energy supply routes', 'category': 'migration'},
    {'zone1': 'kyiv', 'zone2': 'berlin', 'type': 'indirect', 'criticality': 0.60, 'mechanism': 'Energy markets, financial systems', 'category': 'economic'},
    
    # Middle East cluster (Critical)
    {'zone1': 'telaviv', 'zone2': 'gaza', 'type': 'direct', 'criticality': 0.98, 'mechanism': 'Direct military conflict, territorial dispute', 'category': 'military'},
    {'zone1': 'telaviv', 'zone2': 'damascus', 'type': 'indirect', 'criticality': 0.75, 'mechanism': 'Regional instability, proxy conflicts', 'category': 'geopolitical'},
    {'zone1': 'telaviv', 'zone2': 'aleppo', 'type': 'indirect', 'criticality': 0.70, 'mechanism': 'Regional conflict spillover', 'category': 'geopolitical'},
    {'zone1': 'damascus', 'zone2': 'aleppo', 'type': 'direct', 'criticality': 0.95, 'mechanism': 'Internal conflict, shared infrastructure', 'category': 'military'},
    {'zone1': 'telaviv', 'zone2': 'beirut', 'type': 'indirect', 'criticality': 0.68, 'mechanism': 'Regional tensions, energy routes', 'category': 'geopolitical'},
    
    # Regional conflicts (Critical)
    {'zone1': 'sanaa', 'zone2': 'khartoum', 'type': 'indirect', 'criticality': 0.70, 'mechanism': 'Migration flows, energy routes (Red Sea)', 'category': 'migration'},
    {'zone1': 'khartoum', 'zone2': 'tripoli', 'type': 'indirect', 'criticality': 0.75, 'mechanism': 'Migration routes, Mediterranean transit', 'category': 'migration'},
    {'zone1': 'sanaa', 'zone2': 'dubai', 'type': 'indirect', 'criticality': 0.65, 'mechanism': 'Shipping routes, energy markets', 'category': 'global'},
    {'zone1': 'kabul', 'zone2': 'tehran', 'type': 'indirect', 'criticality': 0.72, 'mechanism': 'Regional instability, trade routes', 'category': 'geopolitical'},
    
    # Global connections (Critical to High/Medium)
    {'zone1': 'taipei', 'zone2': 'kyiv', 'type': 'indirect', 'criticality': 0.80, 'mechanism': 'Trade routes, global supply chains (50% container traffic)', 'category': 'global'},
    {'zone1': 'taipei', 'zone2': 'newyork', 'type': 'indirect', 'criticality': 0.75, 'mechanism': 'Semiconductor supply chains, financial markets', 'category': 'global'},
    {'zone1': 'taipei', 'zone2': 'tokyo', 'type': 'indirect', 'criticality': 0.70, 'mechanism': 'Regional trade, technology supply chains', 'category': 'global'},
    {'zone1': 'caracas', 'zone2': 'kyiv', 'type': 'indirect', 'criticality': 0.75, 'mechanism': 'Energy markets, global oil prices', 'category': 'global'},
    {'zone1': 'caracas', 'zone2': 'newyork', 'type': 'indirect', 'criticality': 0.70, 'mechanism': 'Financial markets, sanctions impact', 'category': 'economic'},
    {'zone1': 'pyongyang', 'zone2': 'kyiv', 'type': 'indirect', 'criticality': 0.70, 'mechanism': 'Financial systems, sanctions networks', 'category': 'global'},
    {'zone1': 'pyongyang', 'zone2': 'beijing', 'type': 'indirect', 'criticality': 0.75, 'mechanism': 'Regional stability, trade relationships', 'category': 'geopolitical'},
    
    # High risk zone dependencies
    {'zone1': 'tehran', 'zone2': 'damascus', 'type': 'indirect', 'criticality': 0.78, 'mechanism': 'Regional proxy support, energy routes', 'category': 'geopolitical'},
    {'zone1': 'tehran', 'zone2': 'telaviv', 'type': 'indirect', 'criticality': 0.82, 'mechanism': 'Geopolitical tensions, nuclear concerns', 'category': 'geopolitical'},
    {'zone1': 'dhaka', 'zone2': 'kolkata', 'type': 'indirect', 'criticality': 0.65, 'mechanism': 'Climate migration, shared river systems', 'category': 'migration'},
    {'zone1': 'jakarta', 'zone2': 'singapore', 'type': 'indirect', 'criticality': 0.70, 'mechanism': 'Trade routes, financial hubs', 'category': 'economic'},
    {'zone1': 'miami', 'zone2': 'caracas', 'type': 'indirect', 'criticality': 0.68, 'mechanism': 'Migration flows, financial connections', 'category': 'migration'},
    
    # Medium risk zone dependencies
    {'zone1': 'newyork', 'zone2': 'london', 'type': 'direct', 'criticality': 0.85, 'mechanism': 'Financial markets, global banking systems', 'category': 'economic'},
    {'zone1': 'newyork', 'zone2': 'tokyo', 'type': 'indirect', 'criticality': 0.75, 'mechanism': 'Financial markets, trade relationships', 'category': 'economic'},
    {'zone1': 'london', 'zone2': 'frankfurt', 'type': 'direct', 'criticality': 0.80, 'mechanism': 'Financial markets, EU-UK trade', 'category': 'economic'},
    {'zone1': 'frankfurt', 'zone2': 'paris', 'type': 'direct', 'criticality': 0.75, 'mechanism': 'EU financial systems, energy markets', 'category': 'economic'},
    {'zone1': 'tokyo', 'zone2': 'seoul', 'type': 'indirect', 'criticality': 0.70, 'mechanism': 'Regional trade, technology supply chains', 'category': 'economic'},
    {'zone1': 'singapore', 'zone2': 'hongkong', 'type': 'direct', 'criticality': 0.78, 'mechanism': 'Financial hubs, trade routes', 'category': 'economic'},
    {'zone1': 'shanghai', 'zone2': 'hongkong', 'type': 'direct', 'criticality': 0.82, 'mechanism': 'Financial systems, trade integration', 'category': 'economic'},
    {'zone1': 'beijing', 'zone2': 'shanghai', 'type': 'direct', 'criticality': 0.80, 'mechanism': 'Political-economic integration', 'category': 'economic'},
    
    # Infrastructure dependencies
    {'zone1': 'sanfrancisco', 'zone2': 'tokyo', 'type': 'indirect', 'criticality': 0.75, 'mechanism': 'Technology supply chains, financial markets', 'category': 'global'},
    {'zone1': 'sanfrancisco', 'zone2': 'taipei', 'type': 'indirect', 'criticality': 0.80, 'mechanism': 'Semiconductor supply chains', 'category': 'global'},
    {'zone1': 'dubai', 'zone2': 'singapore', 'type': 'indirect', 'criticality': 0.70, 'mechanism': 'Trade routes, financial hubs', 'category': 'economic'},
]

# Root causes - comprehensive analysis (from RISK_ZONES_CAUSAL_ANALYSIS.md)
ROOT_CAUSES = {
    'geopolitical_instability': {
        'zones': ['kyiv', 'kharkiv', 'odesa', 'donetskluhansk', 'telaviv', 'gaza', 'damascus', 'aleppo', 'taipei', 'pyongyang', 'tehran', 'minsk'],
        'description': 'Geopolitical Instability (Multipolar World)',
        'criticality': 0.95,
        'detailed_description': 'Collapse of bipolar system → Multipolar world → Regional conflicts. Great power competition (USA, China, Russia, Iran) creates proxy wars and territorial disputes.',
        'affected_count': 12,
        'cascade_potential': 0.92
    },
    'economic_instability': {
        'zones': ['caracas', 'pyongyang', 'tehran', 'minsk'],
        'description': 'Economic Instability (Sanctions, Hyperinflation)',
        'criticality': 0.90,
        'detailed_description': 'Global economic imbalances, sanctions, trade wars, currency crises, hyperinflation. Dependency on commodity resources creates vulnerability.',
        'affected_count': 4,
        'cascade_potential': 0.88
    },
    'regional_conflicts': {
        'zones': ['sanaa', 'khartoum', 'tripoli', 'kabul', 'damascus', 'aleppo', 'gaza'],
        'description': 'Regional Conflicts (Ethnic/Religious Tensions)',
        'criticality': 0.92,
        'detailed_description': 'Ethnic/religious contradictions, territorial disputes, external intervention, historical grievances. Creates migration flows and regional instability.',
        'affected_count': 7,
        'cascade_potential': 0.90
    },
    'infrastructure_dependency': {
        'zones': ['kyiv', 'kharkiv', 'odesa', 'donetskluhansk', 'telaviv', 'gaza', 'damascus', 'aleppo', 'taipei', 'newyork', 'london', 'frankfurt', 'tokyo', 'singapore'],
        'description': 'Infrastructure Dependency (Centralized Systems)',
        'criticality': 0.85,
        'detailed_description': 'Centralized energy grids, shared transportation corridors, dependency on critical infrastructure, lack of redundancy. Single points of failure create cascade risks.',
        'affected_count': 14,
        'cascade_potential': 0.87
    },
    'climate_change': {
        'zones': ['miami', 'dhaka', 'jakarta', 'lagos', 'manila', 'bangkok', 'hochiminh', 'cairo'],
        'description': 'Climate Change (Resource Stress)',
        'criticality': 0.78,
        'detailed_description': 'Climate change → Resource stress → Conflicts. Water conflicts, drought-induced migration, resource competition. Indirect effects on all zones through global systems.',
        'affected_count': 8,
        'cascade_potential': 0.75
    },
    'financial_system_interconnection': {
        'zones': ['newyork', 'london', 'frankfurt', 'tokyo', 'singapore', 'hongkong', 'shanghai', 'zurich'],
        'description': 'Financial System Interconnection',
        'criticality': 0.82,
        'detailed_description': 'Global financial markets interconnected. Crisis in one major financial hub → Contagion → Global economic impact → All zones affected.',
        'affected_count': 8,
        'cascade_potential': 0.85
    }
}


# ==================== ENDPOINTS ====================

@router.get("/dependencies", response_model=DependenciesResponse)
async def get_zone_dependencies():
    """
    Get all dependencies between risk zones.
    
    Returns:
    - List of zones with coordinates
    - Dependencies between zones
    - Causal chains
    - Clusters by root cause
    """
    # IMPORTANT:
    # Command Center uses live risk hotspots from /api/v1/geodata/hotspots.
    # To keep counts and dependency endpoints consistent (no "links to nowhere"),
    # this endpoint also derives zones from the same geodata service and builds
    # dependencies from the geodata correlation network.
    from src.services.geo_data import geo_data_service

    # Ensure cached risk scores are available (hotspots + network depend on it)
    await geo_data_service._ensure_risk_scores()

    hotspots_fc = geo_data_service.get_risk_hotspots_geojson(min_risk=0.0, max_risk=1.0, scenario=None)
    features = hotspots_fc.get("features") or []

    zones: list[dict] = []
    id_to_name: dict[str, str] = {}
    id_to_risk: dict[str, float] = {}
    id_to_factors: dict[str, dict] = {}

    for f in features:
        city_id = f.get("id") or f.get("properties", {}).get("id")
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if not city_id or len(coords) < 2:
            continue
        lng, lat = coords[0], coords[1]
        props = f.get("properties") or {}
        name = props.get("name") or str(city_id).replace("_", " ").title()
        risk = float(props.get("risk_score") or 0.0)
        zones.append({"id": str(city_id), "name": name, "lat": float(lat), "lng": float(lng), "risk": risk})
        id_to_name[str(city_id)] = name
        id_to_risk[str(city_id)] = risk
        id_to_factors[str(city_id)] = props.get("risk_factors") or {}

    network = geo_data_service.get_risk_network_json()
    edges = network.get("edges") or []

    # Keep the response light enough for UI & globe rendering
    edges_sorted = sorted(edges, key=lambda e: float(e.get("weight") or 0.0), reverse=True)
    edges_sorted = edges_sorted[:250]

    def _dep_type(weight: float) -> str:
        return "direct" if weight >= 0.65 else "indirect"

    dependencies: list[ZoneDependency] = []
    for e in edges_sorted:
        src = str(e.get("source") or "")
        tgt = str(e.get("target") or "")
        w = float(e.get("weight") or 0.0)
        if not src or not tgt:
            continue
        if src not in id_to_name or tgt not in id_to_name:
            # If either endpoint isn't in hotspots, skip to avoid "links to nowhere"
            continue

        dependencies.append(
            ZoneDependency(
                zone1_id=src,
                zone1_name=id_to_name[src],
                zone2_id=tgt,
                zone2_name=id_to_name[tgt],
                dependency_type=_dep_type(w),
                criticality=w,
                mechanism=f"Computed risk-factor correlation (weight={w:.2f})",
                category="systemic",
            )
        )

    # Build adjacency for simple causal chains
    adj: dict[str, list[tuple[str, float]]] = {}
    for d in dependencies:
        adj.setdefault(d.zone1_id, []).append((d.zone2_id, d.criticality))
        adj.setdefault(d.zone2_id, []).append((d.zone1_id, d.criticality))
    for k in list(adj.keys()):
        adj[k].sort(key=lambda t: t[1], reverse=True)

    causal_chains: list[CausalChain] = []
    top_zone_ids = sorted(id_to_risk.keys(), key=lambda z: id_to_risk.get(z, 0.0), reverse=True)[:5]
    for root in top_zone_ids:
        if root not in adj or not adj[root]:
            continue
        chain_steps: list[dict] = []
        visited = {root}
        current = root
        for step_idx in range(1, 4):
            chain_steps.append(
                {
                    "zone_id": current,
                    "zone_name": id_to_name.get(current, current),
                    "step": step_idx,
                    "description": "High-risk hotspot driving correlated pressure",
                }
            )
            nxt = None
            for cand, _w in adj.get(current, []):
                if cand not in visited:
                    nxt = cand
                    break
            if not nxt:
                break
            visited.add(nxt)
            current = nxt

        if len(chain_steps) >= 2:
            chain_weight = 0.0
            for i in range(len(chain_steps) - 1):
                a = chain_steps[i]["zone_id"]
                b = chain_steps[i + 1]["zone_id"]
                # find weight between a and b
                w = next((w for (cand, w) in adj.get(a, []) if cand == b), 0.0)
                chain_weight += w
            chain_weight = chain_weight / max(1, (len(chain_steps) - 1))

            causal_chains.append(
                CausalChain(
                    root_cause="Systemic correlation cascade",
                    chain=chain_steps,
                    final_effect="Risk amplification across correlated hotspots",
                    criticality=round(chain_weight, 2),
                )
            )

    # Root-cause clusters derived from dominant risk factor per city
    clusters_by_factor: dict[str, list[str]] = {}
    for city_id, factors in id_to_factors.items():
        # factors: {name: {value, source, details}}
        best_name = None
        best_val = -1.0
        for fname, fobj in (factors or {}).items():
            try:
                v = float((fobj or {}).get("value") or 0.0)
            except Exception:
                v = 0.0
            if v > best_val:
                best_val = v
                best_name = fname
        if not best_name:
            best_name = "systemic"
        clusters_by_factor.setdefault(best_name, []).append(city_id)

    # Degree map for cascade potential
    degrees = {z: len(adj.get(z, [])) for z in id_to_name.keys()}
    max_deg = max(degrees.values()) if degrees else 1

    clusters: list[dict] = []
    for factor_name, zone_ids in sorted(clusters_by_factor.items(), key=lambda kv: len(kv[1]), reverse=True)[:12]:
        risks = [id_to_risk.get(z, 0.0) for z in zone_ids]
        avg_risk = sum(risks) / max(1, len(risks))
        avg_deg = sum(degrees.get(z, 0) for z in zone_ids) / max(1, len(zone_ids))
        cascade_potential = min(1.0, avg_deg / max_deg) if max_deg else 0.0
        title = factor_name.replace("_", " ").title()
        clusters.append(
            {
                "root_cause": factor_name,
                "description": f"{title} cluster",
                "detailed_description": f"Zones where '{factor_name}' is the dominant risk driver based on CityRiskCalculator factors.",
                "criticality": round(avg_risk, 2),
                "affected_count": len(zone_ids),
                "cascade_potential": round(cascade_potential, 2),
                "zones": zone_ids,
            }
        )
    
    return DependenciesResponse(
        last_updated=_RISK_ZONES_LAST_UPDATED,
        revision=_RISK_ZONES_REVISION,
        zones=zones,
        dependencies=dependencies,
        causal_chains=causal_chains,
        clusters=clusters
    )


@router.post("/update-dependencies")
async def update_dependencies():
    """
    Trigger ANALYST agent to analyze and update zone dependencies.
    
    This endpoint uses ANALYST agent to:
    - Analyze current geopolitical situation
    - Discover new dependencies
    - Update causal chains
    - Refresh dependency data in real-time
    """
    global _RISK_ZONES_LAST_UPDATED, _RISK_ZONES_REVISION

    analysis_result: dict = {}
    analysis_error: str | None = None

    try:
        from src.layers.agents.analyst import analyst_agent
        # ANALYST analyzes current situation and (optionally) proposes updates.
        analysis_result = await analyst_agent.analyze_zone_dependencies()
    except Exception as e:
        # Do not hard-fail the endpoint; still update revision so UI can reflect the action.
        analysis_error = str(e)

    _RISK_ZONES_LAST_UPDATED = datetime.utcnow()
    _RISK_ZONES_REVISION += 1

    return {
        "message": "Dependencies update executed",
        "last_updated": _RISK_ZONES_LAST_UPDATED.isoformat(),
        "revision": _RISK_ZONES_REVISION,
        "new_dependencies_found": len(analysis_result.get("new_dependencies") or []),
        "updated_chains": len(analysis_result.get("updated_chains") or []),
        "analysis_error": analysis_error,
    }


@router.get("/analysis/{zone_id}", response_model=ZoneAnalysis)
async def get_zone_analysis(zone_id: str):
    """
    Get complete analysis for a specific zone.
    
    Includes:
    - Root causes
    - Dependencies
    - Causal chains
    - Cascade potential
    """
    from src.services.geo_data import geo_data_service

    await geo_data_service._ensure_risk_scores()
    hotspots_fc = geo_data_service.get_risk_hotspots_geojson(min_risk=0.0, max_risk=1.0, scenario=None)
    features = hotspots_fc.get("features") or []

    feature = next((f for f in features if str(f.get("id")) == zone_id), None)
    if not feature:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found in geodata hotspots")

    props = feature.get("properties") or {}
    zone_name = props.get("name") or zone_id.replace("_", " ").title()
    zone_risk = float(props.get("risk_score") or 0.0)

    # Root causes: top risk factors by value
    factors = props.get("risk_factors") or {}
    factor_pairs: list[tuple[str, float]] = []
    for fname, fobj in factors.items():
        try:
            factor_pairs.append((fname, float((fobj or {}).get("value") or 0.0)))
        except Exception:
            continue
    factor_pairs.sort(key=lambda p: p[1], reverse=True)
    root_causes = [f"{name.replace('_',' ').title()} ({val:.2f})" for name, val in factor_pairs[:4]]

    # Dependencies from correlation network (neighbors of this zone)
    network = geo_data_service.get_risk_network_json()
    edges = network.get("edges") or []
    nodes = {n.get("id"): n for n in (network.get("nodes") or []) if n.get("id")}
    neighbors: list[dict] = []
    for e in edges:
        s = str(e.get("source") or "")
        t = str(e.get("target") or "")
        w = float(e.get("weight") or 0.0)
        if s == zone_id and t:
            neighbors.append({"other": t, "weight": w})
        elif t == zone_id and s:
            neighbors.append({"other": s, "weight": w})
    neighbors.sort(key=lambda d: d["weight"], reverse=True)
    neighbors = neighbors[:12]

    def _dep_type(weight: float) -> str:
        return "direct" if weight >= 0.65 else "indirect"

    zone_dependencies: list[ZoneDependency] = []
    for n in neighbors:
        other = n["other"]
        w = float(n["weight"])
        other_name = (nodes.get(other) or {}).get("name") or other.replace("_", " ").title()
        zone_dependencies.append(
            ZoneDependency(
                zone1_id=zone_id,
                zone1_name=zone_name,
                zone2_id=other,
                zone2_name=other_name,
                dependency_type=_dep_type(w),
                criticality=round(w, 2),
                mechanism=f"Computed risk-factor correlation (weight={w:.2f})",
                category="systemic",
            )
        )

    cascade_potential = min(1.0, sum(float(n["weight"]) for n in neighbors) / 3.0) if neighbors else 0.0

    # Simple causal chain: zone -> strongest neighbor -> neighbor's strongest other
    causal_chains: list[CausalChain] = []
    if neighbors:
        first = neighbors[0]["other"]
        # find strongest neighbor of 'first' excluding zone_id
        second_candidates: list[tuple[str, float]] = []
        for e in edges:
            s = str(e.get("source") or "")
            t = str(e.get("target") or "")
            w = float(e.get("weight") or 0.0)
            if s == first and t and t != zone_id:
                second_candidates.append((t, w))
            elif t == first and s and s != zone_id:
                second_candidates.append((s, w))
        second_candidates.sort(key=lambda p: p[1], reverse=True)
        second = second_candidates[0][0] if second_candidates else None

        chain_steps = [
            {"zone_id": zone_id, "zone_name": zone_name, "step": 1, "description": "Primary hotspot risk pressure"},
            {"zone_id": first, "zone_name": (nodes.get(first) or {}).get("name") or first.replace("_", " ").title(), "step": 2, "description": "Correlated spillover"},
        ]
        if second:
            chain_steps.append(
                {
                    "zone_id": second,
                    "zone_name": (nodes.get(second) or {}).get("name") or second.replace("_", " ").title(),
                    "step": 3,
                    "description": "Second-order propagation",
                }
            )

        causal_chains.append(
            CausalChain(
                root_cause="Systemic correlation cascade",
                chain=chain_steps,
                final_effect="Risk propagation across correlated hotspots",
                criticality=round(float(neighbors[0]["weight"]), 2),
            )
        )

    # Consequences driven by risk severity
    consequences: list[Consequence] = []
    if zone_risk > 0.9:
        consequences.extend(
            [
                Consequence(
                    type="humanitarian",
                    severity=0.90,
                    description="High likelihood of acute disruption and displacement pressures (scenario-dependent).",
                    affected_regions=[zone_name],
                    timeline="immediate",
                    mitigation_priority=1.0,
                ),
                Consequence(
                    type="economic",
                    severity=0.85,
                    description="Elevated probability of market stress and supply-chain disruption via correlated hubs.",
                    affected_regions=[zone_name],
                    timeline="short_term",
                    mitigation_priority=0.9,
                ),
            ]
        )
    if zone_risk > 0.8:
        consequences.extend(
            [
                Consequence(
                    type="infrastructure",
                    severity=0.75,
                    description="Increased risk of infrastructure strain and service interruption (energy, transport, logistics).",
                    affected_regions=[zone_name],
                    timeline="short_term",
                    mitigation_priority=0.85,
                ),
                Consequence(
                    type="geopolitical",
                    severity=0.70,
                    description="Higher probability of policy and geopolitical spillovers impacting regional stability.",
                    affected_regions=[zone_name],
                    timeline="medium_term",
                    mitigation_priority=0.8,
                ),
            ]
        )
    if cascade_potential > 0.6:
        consequences.append(
            Consequence(
                type="cascade",
                severity=round(cascade_potential, 2),
                description=f"High cascade potential via {len(zone_dependencies)} correlated connections.",
                affected_regions=[d.zone2_name for d in zone_dependencies[:5]],
                timeline="short_term",
                mitigation_priority=0.9,
            )
        )

    return ZoneAnalysis(
        zone_id=zone_id,
        zone_name=zone_name,
        root_causes=root_causes,
        dependencies=zone_dependencies,
        causal_chains=causal_chains,
        cascade_potential=round(float(cascade_potential), 2),
        consequences=consequences,
    )


@router.get("/concentration")
async def get_concentration(
    asset_ids: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Hidden concentration metrics for portfolio or selected assets.

    Returns Herfindahl index and single-source/single-region/single-technology flags
    from SCSS suppliers and supply routes. Use in risk reports and Command Center.
    """
    ids = [x.strip() for x in (asset_ids or "").split(",") if x.strip()] or None
    result = await get_concentration_for_assets(asset_ids=ids, db_session=db)
    return result
