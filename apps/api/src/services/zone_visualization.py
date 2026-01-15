"""
Zone Visualization Strategy Service.

Determines how risk zones should be visualized on the Digital Twin map
based on event type and characteristics.

Visualization Types:
1. CYLINDER - Default 3D cylinder for point-based risks
2. CONTOUR - Outlined area for spread-based risks (pandemic, flood)
3. INFRASTRUCTURE - Highlighted critical infrastructure points
4. FINANCIAL_CENTERS - Highlighted financial hubs and systemic banks
5. POPULATION_DENSITY - Heat overlay for pandemic/medical events
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)


class VisualizationType(str, Enum):
    """How to render the risk zone on the map."""
    CYLINDER = "cylinder"              # Default 3D cylinder
    CONTOUR = "contour"                # Outlined area (for spread events)
    INFRASTRUCTURE = "infrastructure"  # Critical infrastructure points
    FINANCIAL = "financial"            # Financial centers/banks
    POPULATION = "population"          # Population density overlay
    MILITARY = "military"              # Military/conflict targets


class EventCategory(str, Enum):
    """Category of risk event."""
    PANDEMIC = "pandemic"
    MEDICAL = "medical"
    MILITARY = "military"
    WAR = "war"
    FINANCIAL = "financial"
    CLIMATE = "climate"
    SEISMIC = "seismic"
    FLOOD = "flood"
    HURRICANE = "hurricane"
    CYBER = "cyber"
    POLITICAL = "political"
    INFRASTRUCTURE = "infrastructure"
    DEFAULT = "default"


@dataclass
class ZoneVisualization:
    """Visualization configuration for a risk zone."""
    visualization_type: VisualizationType
    color: str  # Hex color
    opacity: float  # 0.0 - 1.0
    outline: bool  # Whether to show outline
    outline_color: str
    outline_width: float
    height: float  # For 3D elements (meters)
    radius: float  # Radius in meters
    pulse: bool  # Animated pulse effect
    label: str  # Label to show
    icon: Optional[str] = None  # Icon identifier
    sub_zones: List[Dict] = field(default_factory=list)  # Sub-elements to highlight


@dataclass
class InfrastructureTarget:
    """Critical infrastructure target for visualization."""
    id: str
    name: str
    type: str  # power_grid, water, telecom, transport, hospital, etc.
    lat: float
    lng: float
    criticality: float  # 0.0 - 1.0
    status: str  # operational, damaged, destroyed


@dataclass
class FinancialCenter:
    """Financial center for visualization."""
    id: str
    name: str
    type: str  # central_bank, stock_exchange, systemic_bank, etc.
    lat: float
    lng: float
    exposure: float  # Billions USD
    systemic_importance: float  # 0.0 - 1.0


# ============================================================================
# EVENT TYPE TO VISUALIZATION MAPPING
# ============================================================================

EVENT_VISUALIZATION_CONFIG: Dict[EventCategory, Dict] = {
    EventCategory.PANDEMIC: {
        "visualization_type": VisualizationType.CONTOUR,
        "color": "#9b59b6",  # Purple
        "opacity": 0.25,
        "outline": True,
        "outline_color": "#8e44ad",
        "outline_width": 3.0,
        "height": 0,  # Flat on ground
        "radius_multiplier": 3.0,  # Larger area
        "pulse": True,
        "show_population_density": True,
        "highlight_targets": ["hospital", "airport", "stadium", "transit_hub"],
        "description": "Pandemic spread zone with population density overlay",
    },
    EventCategory.MEDICAL: {
        "visualization_type": VisualizationType.POPULATION,
        "color": "#e74c3c",  # Red
        "opacity": 0.30,
        "outline": True,
        "outline_color": "#c0392b",
        "outline_width": 2.0,
        "height": 0,
        "radius_multiplier": 2.0,
        "pulse": True,
        "show_population_density": True,
        "highlight_targets": ["hospital", "clinic", "pharmacy"],
        "description": "Medical emergency with healthcare facility overlay",
    },
    EventCategory.WAR: {
        "visualization_type": VisualizationType.INFRASTRUCTURE,
        "color": "#e74c3c",  # Red
        "opacity": 0.40,
        "outline": True,
        "outline_color": "#c0392b",
        "outline_width": 4.0,
        "height": 50000,  # Tall cylinder
        "radius_multiplier": 1.5,
        "pulse": True,
        "show_infrastructure": True,
        "highlight_targets": ["power_grid", "water", "telecom", "government", "military"],
        "description": "Active conflict zone with critical infrastructure targets",
    },
    EventCategory.MILITARY: {
        "visualization_type": VisualizationType.MILITARY,
        "color": "#c0392b",  # Dark red
        "opacity": 0.50,
        "outline": True,
        "outline_color": "#a93226",
        "outline_width": 4.0,
        "height": 80000,
        "radius_multiplier": 1.2,
        "pulse": True,
        "show_infrastructure": True,
        "highlight_targets": ["military", "government", "power_grid", "airport"],
        "description": "Military target zone with strategic infrastructure",
    },
    EventCategory.FINANCIAL: {
        "visualization_type": VisualizationType.FINANCIAL,
        "color": "#f39c12",  # Orange/Gold
        "opacity": 0.35,
        "outline": True,
        "outline_color": "#d68910",
        "outline_width": 3.0,
        "height": 100000,  # Tall for financial centers
        "radius_multiplier": 1.0,
        "pulse": False,
        "show_financial_centers": True,
        "highlight_targets": ["central_bank", "stock_exchange", "systemic_bank", "financial_district"],
        "description": "Financial impact zone with systemic institutions",
    },
    EventCategory.SEISMIC: {
        "visualization_type": VisualizationType.CONTOUR,
        "color": "#8b4513",  # Brown
        "opacity": 0.30,
        "outline": True,
        "outline_color": "#654321",
        "outline_width": 3.0,
        "height": 0,
        "radius_multiplier": 4.0,  # Large affected area
        "pulse": False,
        "show_fault_lines": True,
        "highlight_targets": ["hospital", "power_grid", "bridge", "dam"],
        "description": "Seismic impact zone with vulnerable infrastructure",
    },
    EventCategory.FLOOD: {
        "visualization_type": VisualizationType.CONTOUR,
        "color": "#3498db",  # Blue
        "opacity": 0.35,
        "outline": True,
        "outline_color": "#2980b9",
        "outline_width": 3.0,
        "height": 0,  # Flat on ground
        "radius_multiplier": 3.5,
        "pulse": False,
        "show_elevation": True,
        "highlight_targets": ["dam", "levee", "power_grid", "water_treatment"],
        "description": "Flood zone with elevation contours and vulnerable areas",
    },
    EventCategory.HURRICANE: {
        "visualization_type": VisualizationType.CONTOUR,
        "color": "#1abc9c",  # Teal
        "opacity": 0.30,
        "outline": True,
        "outline_color": "#16a085",
        "outline_width": 4.0,
        "height": 0,
        "radius_multiplier": 5.0,  # Very large
        "pulse": True,
        "show_track": True,
        "highlight_targets": ["airport", "port", "power_grid", "hospital"],
        "description": "Hurricane impact zone with projected track",
    },
    EventCategory.CLIMATE: {
        "visualization_type": VisualizationType.CONTOUR,
        "color": "#27ae60",  # Green
        "opacity": 0.25,
        "outline": True,
        "outline_color": "#1e8449",
        "outline_width": 2.0,
        "height": 0,
        "radius_multiplier": 4.0,
        "pulse": False,
        "highlight_targets": ["coastal", "agricultural", "water_source"],
        "description": "Climate impact zone with environmental overlay",
    },
    EventCategory.CYBER: {
        "visualization_type": VisualizationType.INFRASTRUCTURE,
        "color": "#9b59b6",  # Purple
        "opacity": 0.40,
        "outline": True,
        "outline_color": "#8e44ad",
        "outline_width": 2.0,
        "height": 60000,
        "radius_multiplier": 1.0,
        "pulse": True,
        "highlight_targets": ["data_center", "power_grid", "telecom", "financial"],
        "description": "Cyber attack zone with digital infrastructure targets",
    },
    EventCategory.POLITICAL: {
        "visualization_type": VisualizationType.CYLINDER,
        "color": "#e67e22",  # Orange
        "opacity": 0.40,
        "outline": True,
        "outline_color": "#d35400",
        "outline_width": 2.0,
        "height": 70000,
        "radius_multiplier": 1.2,
        "pulse": False,
        "highlight_targets": ["government", "embassy", "financial_district"],
        "description": "Political instability zone with government targets",
    },
    EventCategory.DEFAULT: {
        "visualization_type": VisualizationType.CYLINDER,
        "color": "#e74c3c",  # Red
        "opacity": 0.35,
        "outline": False,
        "outline_color": "#c0392b",
        "outline_width": 2.0,
        "height": 50000,
        "radius_multiplier": 1.0,
        "pulse": False,
        "highlight_targets": [],
        "description": "Standard risk zone",
    },
}


# ============================================================================
# INFRASTRUCTURE DATABASE (Sample data)
# ============================================================================

CRITICAL_INFRASTRUCTURE: Dict[str, List[InfrastructureTarget]] = {
    "kyiv": [
        InfrastructureTarget("kyiv_power_1", "Kyiv Power Grid Central", "power_grid", 50.4501, 30.5234, 0.95, "damaged"),
        InfrastructureTarget("kyiv_water_1", "Kyiv Water Treatment", "water", 50.4601, 30.5134, 0.90, "operational"),
        InfrastructureTarget("kyiv_telecom_1", "Kyiv Telecom Hub", "telecom", 50.4401, 30.5334, 0.85, "operational"),
        InfrastructureTarget("kyiv_gov_1", "Government District", "government", 50.4521, 30.5254, 0.98, "operational"),
        InfrastructureTarget("kyiv_airport", "Boryspil Airport", "airport", 50.3450, 30.8947, 0.80, "damaged"),
    ],
    "kharkiv": [
        InfrastructureTarget("kharkiv_power_1", "Kharkiv Power Station", "power_grid", 49.9935, 36.2304, 0.92, "damaged"),
        InfrastructureTarget("kharkiv_metro", "Kharkiv Metro", "transport", 49.9900, 36.2400, 0.75, "operational"),
    ],
    "newyork": [
        InfrastructureTarget("nyc_power", "Con Edison Grid", "power_grid", 40.7128, -74.0060, 0.90, "operational"),
        InfrastructureTarget("nyc_water", "NYC Water System", "water", 40.7200, -74.0100, 0.85, "operational"),
        InfrastructureTarget("nyc_jfk", "JFK Airport", "airport", 40.6413, -73.7781, 0.80, "operational"),
        InfrastructureTarget("nyc_hospital", "NYC Health + Hospitals", "hospital", 40.7380, -73.9750, 0.95, "operational"),
    ],
    "tokyo": [
        InfrastructureTarget("tokyo_power", "TEPCO Grid", "power_grid", 35.6762, 139.6503, 0.92, "operational"),
        InfrastructureTarget("tokyo_metro", "Tokyo Metro", "transport", 35.6800, 139.6600, 0.88, "operational"),
        InfrastructureTarget("tokyo_hospital", "Tokyo Medical Center", "hospital", 35.6900, 139.6700, 0.90, "operational"),
    ],
}


FINANCIAL_CENTERS: Dict[str, List[FinancialCenter]] = {
    "newyork": [
        FinancialCenter("nyse", "New York Stock Exchange", "stock_exchange", 40.7069, -74.0113, 45.0, 0.98),
        FinancialCenter("fed_ny", "Federal Reserve Bank NY", "central_bank", 40.7082, -74.0084, 0.0, 0.99),
        FinancialCenter("jpmorgan", "JPMorgan Chase HQ", "systemic_bank", 40.7557, -73.9758, 3.2, 0.95),
        FinancialCenter("goldman", "Goldman Sachs HQ", "systemic_bank", 40.7145, -74.0134, 1.8, 0.92),
    ],
    "london": [
        FinancialCenter("lse", "London Stock Exchange", "stock_exchange", 51.5155, -0.0922, 38.0, 0.96),
        FinancialCenter("boe", "Bank of England", "central_bank", 51.5142, -0.0885, 0.0, 0.99),
        FinancialCenter("hsbc", "HSBC HQ", "systemic_bank", 51.5045, -0.0195, 2.8, 0.93),
    ],
    "frankfurt": [
        FinancialCenter("ecb", "European Central Bank", "central_bank", 50.1109, 8.7015, 0.0, 0.99),
        FinancialCenter("deutsche_boerse", "Deutsche Börse", "stock_exchange", 50.1109, 8.6821, 22.0, 0.94),
        FinancialCenter("deutsche_bank", "Deutsche Bank HQ", "systemic_bank", 50.1117, 8.6705, 1.5, 0.90),
    ],
    "tokyo": [
        FinancialCenter("tse", "Tokyo Stock Exchange", "stock_exchange", 35.6815, 139.7740, 42.0, 0.97),
        FinancialCenter("boj", "Bank of Japan", "central_bank", 35.6856, 139.7690, 0.0, 0.99),
        FinancialCenter("mitsubishi", "Mitsubishi UFJ", "systemic_bank", 35.6762, 139.7680, 2.5, 0.92),
    ],
    "hongkong": [
        FinancialCenter("hkex", "Hong Kong Stock Exchange", "stock_exchange", 22.2855, 114.1577, 35.0, 0.95),
        FinancialCenter("hkma", "Hong Kong Monetary Authority", "central_bank", 22.2793, 114.1628, 0.0, 0.97),
    ],
    "singapore": [
        FinancialCenter("sgx", "Singapore Exchange", "stock_exchange", 1.2789, 103.8536, 28.0, 0.94),
        FinancialCenter("mas", "Monetary Authority of Singapore", "central_bank", 1.2800, 103.8500, 0.0, 0.98),
    ],
    "zurich": [
        FinancialCenter("six", "SIX Swiss Exchange", "stock_exchange", 47.3769, 8.5417, 18.0, 0.93),
        FinancialCenter("snb", "Swiss National Bank", "central_bank", 47.3769, 8.5400, 0.0, 0.99),
        FinancialCenter("ubs", "UBS HQ", "systemic_bank", 47.3769, 8.5450, 2.0, 0.94),
        FinancialCenter("credit_suisse", "Credit Suisse (UBS)", "systemic_bank", 47.3750, 8.5380, 1.2, 0.88),
    ],
}


class ZoneVisualizationService:
    """Service for determining zone visualization based on event type."""
    
    @staticmethod
    def categorize_event(event_type: str, event_name: str = "") -> EventCategory:
        """Determine event category from event type and name."""
        event_lower = event_type.lower() + " " + event_name.lower()
        
        # Check for specific keywords
        if any(w in event_lower for w in ["pandemic", "virus", "covid", "epidemic", "outbreak"]):
            return EventCategory.PANDEMIC
        if any(w in event_lower for w in ["medical", "health", "hospital", "disease"]):
            return EventCategory.MEDICAL
        if any(w in event_lower for w in ["war", "invasion", "conflict", "shelling", "attack", "military"]):
            return EventCategory.WAR
        if any(w in event_lower for w in ["military", "missile", "bomb", "strike"]):
            return EventCategory.MILITARY
        if any(w in event_lower for w in ["financial", "credit", "bank", "market", "stock", "economic"]):
            return EventCategory.FINANCIAL
        if any(w in event_lower for w in ["earthquake", "seismic", "quake", "tremor"]):
            return EventCategory.SEISMIC
        if any(w in event_lower for w in ["flood", "tsunami", "storm surge"]):
            return EventCategory.FLOOD
        if any(w in event_lower for w in ["hurricane", "typhoon", "cyclone", "storm"]):
            return EventCategory.HURRICANE
        if any(w in event_lower for w in ["climate", "warming", "drought", "heat"]):
            return EventCategory.CLIMATE
        if any(w in event_lower for w in ["cyber", "hack", "ransomware", "digital"]):
            return EventCategory.CYBER
        if any(w in event_lower for w in ["political", "coup", "protest", "revolution"]):
            return EventCategory.POLITICAL
        
        return EventCategory.DEFAULT
    
    @staticmethod
    def get_visualization_config(category: EventCategory) -> Dict:
        """Get visualization configuration for event category."""
        return EVENT_VISUALIZATION_CONFIG.get(category, EVENT_VISUALIZATION_CONFIG[EventCategory.DEFAULT])
    
    @staticmethod
    def get_infrastructure_targets(city_id: str) -> List[Dict]:
        """Get critical infrastructure targets for a city."""
        targets = CRITICAL_INFRASTRUCTURE.get(city_id.lower(), [])
        return [
            {
                "id": t.id,
                "name": t.name,
                "type": t.type,
                "coordinates": [t.lng, t.lat],
                "criticality": t.criticality,
                "status": t.status,
            }
            for t in targets
        ]
    
    @staticmethod
    def get_financial_centers(city_id: str) -> List[Dict]:
        """Get financial centers for a city."""
        centers = FINANCIAL_CENTERS.get(city_id.lower(), [])
        return [
            {
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "coordinates": [c.lng, c.lat],
                "exposure": c.exposure,
                "systemic_importance": c.systemic_importance,
            }
            for c in centers
        ]
    
    def build_zone_visualization(
        self,
        city_id: str,
        city_name: str,
        lat: float,
        lng: float,
        risk_score: float,
        event_type: str,
        event_name: str = "",
        severity: float = 0.5,
    ) -> Dict[str, Any]:
        """
        Build complete zone visualization configuration.
        
        Returns a dict that the frontend can use to render the zone appropriately.
        """
        category = self.categorize_event(event_type, event_name)
        config = self.get_visualization_config(category)
        
        # Calculate base radius based on risk and severity
        base_radius = 200000 + risk_score * 300000  # 200km - 500km
        adjusted_radius = base_radius * config.get("radius_multiplier", 1.0)
        
        # Build response
        result = {
            "city_id": city_id,
            "city_name": city_name,
            "coordinates": [lng, lat],
            "risk_score": round(risk_score, 2),
            "event_category": category.value,
            "event_type": event_type,
            
            # Visualization config
            "visualization": {
                "type": config["visualization_type"].value,
                "color": config["color"],
                "opacity": config["opacity"] * (0.5 + severity * 0.5),  # Adjust by severity
                "outline": config["outline"],
                "outline_color": config["outline_color"],
                "outline_width": config["outline_width"],
                "height": config["height"] * severity,  # Scale height by severity
                "radius": adjusted_radius,
                "pulse": config["pulse"],
            },
            
            "description": config["description"],
        }
        
        # Add sub-elements based on category
        if category in [EventCategory.WAR, EventCategory.MILITARY, EventCategory.CYBER]:
            result["infrastructure_targets"] = self.get_infrastructure_targets(city_id)
        
        if category == EventCategory.FINANCIAL:
            result["financial_centers"] = self.get_financial_centers(city_id)
        
        if category in [EventCategory.PANDEMIC, EventCategory.MEDICAL]:
            result["show_population_density"] = True
            result["highlight_types"] = config.get("highlight_targets", [])
        
        if category in [EventCategory.FLOOD, EventCategory.SEISMIC, EventCategory.HURRICANE]:
            result["show_contour"] = True
            result["affected_area_km2"] = round((adjusted_radius / 1000) ** 2 * 3.14, 0)
        
        return result


# Global instance
zone_visualization_service = ZoneVisualizationService()
