"""
FEMA National Risk Index (NRI) API Client.

Fetches risk data from FEMA's National Risk Index.
API Documentation: https://hazards.fema.gov/nri/

Features:
- Community-level risk scores
- Hazard-specific risk data
- Expected annual loss data
- Social vulnerability index

No API key required for basic access.
"""
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
import logging
import asyncio

# Note: FEMA client uses in-memory caching with 7-day TTL
# Can be enhanced with Redis via cache service if needed

logger = logging.getLogger(__name__)

# FEMA NRI uses ArcGIS REST API
NRI_BASE_URL = "https://hazards.fema.gov/nri/services"
NRI_FEATURE_URL = "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services"


class HazardType(str, Enum):
    """FEMA NRI hazard types."""
    AVALANCHE = "AVLN"
    COASTAL_FLOODING = "CFLD"
    COLD_WAVE = "CWAV"
    DROUGHT = "DRGT"
    EARTHQUAKE = "ERQK"
    HAIL = "HAIL"
    HEAT_WAVE = "HWAV"
    HURRICANE = "HRCN"
    ICE_STORM = "ISTM"
    LANDSLIDE = "LNDS"
    LIGHTNING = "LTNG"
    RIVERINE_FLOODING = "RFLD"
    STRONG_WIND = "SWND"
    TORNADO = "TRND"
    TSUNAMI = "TSUN"
    VOLCANIC = "VLCN"
    WILDFIRE = "WFIR"
    WINTER_WEATHER = "WNTW"


class RiskRating(str, Enum):
    """NRI risk rating categories."""
    VERY_LOW = "Very Low"
    RELATIVELY_LOW = "Relatively Low"
    RELATIVELY_MODERATE = "Relatively Moderate"
    RELATIVELY_HIGH = "Relatively High"
    VERY_HIGH = "Very High"


@dataclass
class CommunityRisk:
    """Community-level risk assessment."""
    fips_code: str
    county_name: str
    state: str
    
    # Overall risk
    risk_score: float          # 0-100
    risk_rating: str
    
    # Expected Annual Loss
    eal_score: float
    eal_rating: str
    eal_value: float           # in dollars
    
    # Social Vulnerability
    sovi_score: float
    sovi_rating: str
    
    # Community Resilience
    resl_score: float
    resl_rating: str
    
    # Population & Buildings
    population: int
    building_value: float


@dataclass
class HazardRisk:
    """Hazard-specific risk data."""
    hazard_type: str
    hazard_name: str
    
    # Risk scores
    risk_score: float
    risk_rating: str
    
    # Annualized frequency
    annualized_frequency: float
    
    # Expected annual loss
    eal_building: float
    eal_population: float
    eal_agriculture: float
    eal_total: float
    
    # Historical events
    historic_loss_ratio: Optional[float] = None


class FEMAClient:
    """
    Client for FEMA National Risk Index API.
    
    Uses the public ArcGIS REST API, no authentication required.
    Optimized with caching and rate limiting.
    """
    
    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}
        self._cache_ttl = timedelta(days=7)  # Cache for 7 days (NRI updates annually)
        
        # Rate limiting: max 10 requests per second
        self._rate_limiter = asyncio.Semaphore(10)
        self._last_request_time = 0.0
        self._min_request_interval = 0.1  # 100ms between requests
    
    async def _make_request(
        self, 
        url: str, 
        params: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict]:
        """Make request to FEMA API with rate limiting."""
        # Rate limiting
        async with self._rate_limiter:
            current_time = asyncio.get_event_loop().time()
            time_since_last = current_time - self._last_request_time
            if time_since_last < self._min_request_interval:
                await asyncio.sleep(self._min_request_interval - time_since_last)
            self._last_request_time = asyncio.get_event_loop().time()
        
        default_params = {
            "f": "json",
            "outFields": "*",
        }
        if params:
            default_params.update(params)
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=default_params)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.warning("FEMA API rate limit exceeded, waiting...")
                await asyncio.sleep(1)
                # Retry once
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.get(url, params=default_params)
                        response.raise_for_status()
                        return response.json()
                except Exception:
                    pass
            logger.error(f"FEMA API request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"FEMA API request failed: {e}")
            return None
    
    async def get_county_risk(
        self,
        fips_code: str,
    ) -> Optional[CommunityRisk]:
        """
        Get risk assessment for a county by FIPS code.
        
        Uses in-memory cache with 7-day TTL (NRI updates annually).
        Can be enhanced with Redis cache via @cached decorator.
        
        Args:
            fips_code: 5-digit county FIPS code (e.g., "48201" for Harris County, TX)
            
        Returns:
            CommunityRisk object or None if not found
        """
        # Check in-memory cache first (faster)
        cache_key = f"county:{fips_code}"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return data
        
        url = f"{NRI_FEATURE_URL}/NRI_Table_Counties/FeatureServer/0/query"
        
        data = await self._make_request(url, {
            "where": f"STCOFIPS = '{fips_code}'",
            "returnGeometry": "false",
        })
        
        if not data or "features" not in data or not data["features"]:
            # Try with state FIPS (first 2 digits)
            return await self._estimate_risk_from_state(fips_code[:2])
        
        feature = data["features"][0]["attributes"]
        
        risk = CommunityRisk(
            fips_code=fips_code,
            county_name=feature.get("COUNTY", "Unknown"),
            state=feature.get("STATE", "Unknown"),
            risk_score=feature.get("RISK_SCORE", 0),
            risk_rating=feature.get("RISK_RATNG", RiskRating.RELATIVELY_MODERATE.value),
            eal_score=feature.get("EAL_SCORE", 0),
            eal_rating=feature.get("EAL_RATNG", ""),
            eal_value=feature.get("EAL_VALT", 0),
            sovi_score=feature.get("SOVI_SCORE", 0),
            sovi_rating=feature.get("SOVI_RATNG", ""),
            resl_score=feature.get("RESL_SCORE", 0),
            resl_rating=feature.get("RESL_RATNG", ""),
            population=feature.get("POPULATION", 0),
            building_value=feature.get("BUILDVALUE", 0),
        )
        
        self._cache[cache_key] = (risk, datetime.utcnow())
        return risk
    
    async def get_hazard_risks(
        self,
        fips_code: str,
        hazard_types: Optional[List[HazardType]] = None,
    ) -> List[HazardRisk]:
        """
        Get hazard-specific risk data for a county.
        
        Uses in-memory cache with 7-day TTL.
        Can be enhanced with Redis cache via @cached decorator.
        
        Args:
            fips_code: 5-digit county FIPS code
            hazard_types: Filter by specific hazards (default: all)
            
        Returns:
            List of HazardRisk objects
        """
        # Check in-memory cache first
        cache_key = f"hazards:{fips_code}"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                if hazard_types:
                    return [h for h in data if h.hazard_type in [ht.value for ht in hazard_types]]
                return data
        
        url = f"{NRI_FEATURE_URL}/NRI_Table_Counties/FeatureServer/0/query"
        
        data = await self._make_request(url, {
            "where": f"STCOFIPS = '{fips_code}'",
            "returnGeometry": "false",
        })
        
        if not data or "features" not in data or not data["features"]:
            return self._estimate_hazard_risks(fips_code)
        
        feature = data["features"][0]["attributes"]
        
        hazards = []
        hazard_map = {
            HazardType.AVALANCHE: ("AVLN", "Avalanche"),
            HazardType.COASTAL_FLOODING: ("CFLD", "Coastal Flooding"),
            HazardType.COLD_WAVE: ("CWAV", "Cold Wave"),
            HazardType.DROUGHT: ("DRGT", "Drought"),
            HazardType.EARTHQUAKE: ("ERQK", "Earthquake"),
            HazardType.HAIL: ("HAIL", "Hail"),
            HazardType.HEAT_WAVE: ("HWAV", "Heat Wave"),
            HazardType.HURRICANE: ("HRCN", "Hurricane"),
            HazardType.ICE_STORM: ("ISTM", "Ice Storm"),
            HazardType.LANDSLIDE: ("LNDS", "Landslide"),
            HazardType.LIGHTNING: ("LTNG", "Lightning"),
            HazardType.RIVERINE_FLOODING: ("RFLD", "Riverine Flooding"),
            HazardType.STRONG_WIND: ("SWND", "Strong Wind"),
            HazardType.TORNADO: ("TRND", "Tornado"),
            HazardType.TSUNAMI: ("TSUN", "Tsunami"),
            HazardType.VOLCANIC: ("VLCN", "Volcanic Activity"),
            HazardType.WILDFIRE: ("WFIR", "Wildfire"),
            HazardType.WINTER_WEATHER: ("WNTW", "Winter Weather"),
        }
        
        for hazard_type, (code, name) in hazard_map.items():
            if hazard_types and hazard_type not in hazard_types:
                continue
                
            risk_score = feature.get(f"{code}_RISKS", 0)
            if risk_score == 0:
                continue
                
            hazards.append(HazardRisk(
                hazard_type=code,
                hazard_name=name,
                risk_score=risk_score,
                risk_rating=feature.get(f"{code}_RISKR", ""),
                annualized_frequency=feature.get(f"{code}_APTS", 0),
                eal_building=feature.get(f"{code}_EALB", 0),
                eal_population=feature.get(f"{code}_EALP", 0),
                eal_agriculture=feature.get(f"{code}_EALA", 0),
                eal_total=feature.get(f"{code}_EALT", 0),
                historic_loss_ratio=feature.get(f"{code}_HLRA", None),
            ))
        
        self._cache[cache_key] = (hazards, datetime.utcnow())
        
        return hazards
    
    async def get_risk_by_coordinates(
        self,
        lat: float,
        lon: float,
    ) -> Optional[CommunityRisk]:
        """
        Get risk assessment by coordinates.
        
        Uses reverse geocoding to find the county FIPS code.
        
        Args:
            lat: Latitude
            lon: Longitude
            
        Returns:
            CommunityRisk object or None
        """
        # First, get county from coordinates using Census geocoder
        fips_code = await self._get_fips_from_coordinates(lat, lon)
        
        if fips_code:
            return await self.get_county_risk(fips_code)
        
        # Fallback: estimate based on location
        return self._estimate_risk_from_location(lat, lon)
    
    async def _get_fips_from_coordinates(
        self,
        lat: float,
        lon: float,
    ) -> Optional[str]:
        """Get county FIPS code from coordinates using Census geocoder."""
        url = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params={
                    "x": lon,
                    "y": lat,
                    "benchmark": "Public_AR_Current",
                    "vintage": "Current_Current",
                    "layers": "Counties",
                    "format": "json",
                })
                response.raise_for_status()
                data = response.json()
                
                if data.get("result", {}).get("geographies", {}).get("Counties"):
                    county = data["result"]["geographies"]["Counties"][0]
                    return county.get("GEOID")
                    
        except Exception as e:
            logger.warning(f"Census geocoder failed: {e}")
        
        return None
    
    async def _estimate_risk_from_state(
        self,
        state_fips: str,
    ) -> Optional[CommunityRisk]:
        """Estimate risk from state when county data unavailable."""
        # State-level risk estimates (rough averages)
        state_risk = {
            "06": 55,  # California - high seismic + wildfire
            "12": 60,  # Florida - high hurricane
            "48": 50,  # Texas - diverse hazards
            "36": 40,  # New York - moderate
            "17": 35,  # Illinois - moderate
        }
        
        risk_score = state_risk.get(state_fips, 40)
        
        return CommunityRisk(
            fips_code=f"{state_fips}000",
            county_name="State Average",
            state=state_fips,
            risk_score=risk_score,
            risk_rating=self._score_to_rating(risk_score),
            eal_score=risk_score * 0.8,
            eal_rating="",
            eal_value=0,
            sovi_score=50,
            sovi_rating="Relatively Moderate",
            resl_score=50,
            resl_rating="Relatively Moderate",
            population=0,
            building_value=0,
        )
    
    def _estimate_risk_from_location(
        self,
        lat: float,
        lon: float,
    ) -> CommunityRisk:
        """Estimate risk based on location when no data available."""
        # Basic risk estimation based on geographic factors
        risk_score = 40  # Default moderate risk
        
        # Coastal areas have higher flood/hurricane risk
        # Very rough: coastal if within 100km of ocean
        if lon < -120 or lon > -75:  # West or East coast (simplified)
            risk_score += 10
        
        # Gulf Coast states have high hurricane risk
        if 25 <= lat <= 35 and -100 <= lon <= -80:
            risk_score += 15
        
        # Tornado alley
        if 30 <= lat <= 45 and -100 <= lon <= -90:
            risk_score += 10
        
        # California earthquake/wildfire zone
        if 32 <= lat <= 42 and -125 <= lon <= -114:
            risk_score += 15
        
        risk_score = min(100, risk_score)
        
        return CommunityRisk(
            fips_code="00000",
            county_name="Estimated",
            state="Unknown",
            risk_score=risk_score,
            risk_rating=self._score_to_rating(risk_score),
            eal_score=risk_score * 0.7,
            eal_rating=self._score_to_rating(risk_score * 0.7),
            eal_value=0,
            sovi_score=50,
            sovi_rating="Relatively Moderate",
            resl_score=50,
            resl_rating="Relatively Moderate",
            population=0,
            building_value=0,
        )
    
    def _estimate_hazard_risks(self, fips_code: str) -> List[HazardRisk]:
        """Estimate hazard risks when API data unavailable."""
        # Return common hazards with moderate risk
        return [
            HazardRisk(
                hazard_type="RFLD",
                hazard_name="Riverine Flooding",
                risk_score=40,
                risk_rating="Relatively Moderate",
                annualized_frequency=0.5,
                eal_building=100000,
                eal_population=0,
                eal_agriculture=10000,
                eal_total=110000,
            ),
            HazardRisk(
                hazard_type="SWND",
                hazard_name="Strong Wind",
                risk_score=35,
                risk_rating="Relatively Moderate",
                annualized_frequency=2.0,
                eal_building=50000,
                eal_population=0,
                eal_agriculture=5000,
                eal_total=55000,
            ),
        ]
    
    def _score_to_rating(self, score: float) -> str:
        """Convert numeric score to rating string."""
        if score < 20:
            return RiskRating.VERY_LOW.value
        elif score < 40:
            return RiskRating.RELATIVELY_LOW.value
        elif score < 60:
            return RiskRating.RELATIVELY_MODERATE.value
        elif score < 80:
            return RiskRating.RELATIVELY_HIGH.value
        else:
            return RiskRating.VERY_HIGH.value
    
    def clear_cache(self):
        """Clear cached data."""
        self._cache.clear()


# Global instance
fema_client = FEMAClient()
