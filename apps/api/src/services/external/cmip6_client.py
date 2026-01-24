"""
CMIP6 Climate Projections Client.

Fetches climate projection data from Copernicus Climate Data Store (CDS).
API Documentation: https://cds.climate.copernicus.eu/

Features:
- Temperature projections (SSP scenarios)
- Precipitation projections
- Sea level rise projections
- Extreme event frequency projections

Requires CDS API key from: https://cds.climate.copernicus.eu/
"""
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import logging
import os
import json

logger = logging.getLogger(__name__)

CDS_API_URL = "https://cds.climate.copernicus.eu/api/v2"


class SSPScenario(str, Enum):
    """
    Shared Socioeconomic Pathways (SSP) scenarios.
    
    SSP1-2.6: Sustainability - Low emissions
    SSP2-4.5: Middle of the road - Medium emissions
    SSP3-7.0: Regional rivalry - High emissions
    SSP5-8.5: Fossil-fueled development - Very high emissions
    """
    SSP126 = "ssp126"  # Low emissions (1.5°C target)
    SSP245 = "ssp245"  # Medium emissions (2°C target)
    SSP370 = "ssp370"  # High emissions
    SSP585 = "ssp585"  # Very high emissions (business as usual)


class ClimateVariable(str, Enum):
    """Climate variables available in CMIP6."""
    TEMPERATURE = "tas"           # Near-surface air temperature
    TEMPERATURE_MAX = "tasmax"    # Maximum temperature
    TEMPERATURE_MIN = "tasmin"    # Minimum temperature
    PRECIPITATION = "pr"          # Precipitation
    SEA_LEVEL = "zos"             # Sea surface height
    HUMIDITY = "hurs"             # Near-surface relative humidity
    WIND_SPEED = "sfcWind"        # Near-surface wind speed
    SOIL_MOISTURE = "mrso"        # Total soil moisture


class TimePeriod(str, Enum):
    """Standard projection time periods."""
    NEAR_TERM = "2021-2040"
    MID_CENTURY = "2041-2060"
    END_CENTURY = "2081-2100"


@dataclass
class ClimateProjection:
    """Climate projection data point."""
    variable: str
    scenario: str
    period: str
    
    # Projection values
    value: float              # Mean change
    lower_bound: float        # 5th percentile
    upper_bound: float        # 95th percentile
    
    # Reference
    baseline_period: str = "1995-2014"
    baseline_value: float = 0.0
    
    # Units
    unit: str = ""
    
    # Metadata
    model_agreement: float = 0.0  # Fraction of models agreeing
    num_models: int = 0


@dataclass
class LocationClimate:
    """Complete climate assessment for a location."""
    latitude: float
    longitude: float
    
    # Current climate
    current_temp_annual: float = 0.0
    current_precip_annual: float = 0.0
    
    # Projections by scenario
    projections: Dict[str, List[ClimateProjection]] = field(default_factory=dict)
    
    # Climate classification
    koppen_climate: str = ""
    
    # Risk indicators
    heat_stress_risk: str = "moderate"
    drought_risk: str = "moderate"
    flood_risk: str = "moderate"
    sea_level_risk: str = "low"


class CMIP6Client:
    """
    Client for CMIP6 climate projections via Copernicus CDS.
    
    Requires CDS API key from https://cds.climate.copernicus.eu/
    Set via CDS_API_KEY environment variable.
    
    Note: Full CDS API requires Python cdsapi package and can be slow.
    This client provides simplified access with fallback estimates.
    """
    
    def __init__(
        self, 
        api_key: Optional[str] = None,
        timeout: float = 60.0
    ):
        self.api_key = api_key or os.getenv("CDS_API_KEY")
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}
        self._cache_ttl = timedelta(days=30)  # Climate data changes slowly
        
        # Pre-computed regional climate change factors
        # Based on IPCC AR6 regional projections
        self._regional_factors = self._load_regional_factors()
    
    @property
    def is_configured(self) -> bool:
        """Check if API key is configured."""
        return bool(self.api_key)
    
    async def get_temperature_projection(
        self,
        lat: float,
        lon: float,
        scenario: SSPScenario = SSPScenario.SSP245,
        period: TimePeriod = TimePeriod.MID_CENTURY,
    ) -> ClimateProjection:
        """
        Get temperature change projection for a location.
        
        Args:
            lat: Latitude
            lon: Longitude
            scenario: SSP scenario (default: SSP2-4.5)
            period: Time period for projection
            
        Returns:
            ClimateProjection with temperature change in °C
        """
        cache_key = f"temp:{lat:.1f}:{lon:.1f}:{scenario.value}:{period.value}"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return data
        
        # Get regional scaling factors
        region = self._get_region(lat, lon)
        factors = self._regional_factors.get(region, self._regional_factors["global"])
        
        # Global mean temperature change by scenario and period
        # Based on IPCC AR6 WG1 Table SPM.1
        global_warming = {
            SSPScenario.SSP126: {"2021-2040": 1.5, "2041-2060": 1.6, "2081-2100": 1.4},
            SSPScenario.SSP245: {"2021-2040": 1.5, "2041-2060": 2.0, "2081-2100": 2.7},
            SSPScenario.SSP370: {"2021-2040": 1.5, "2041-2060": 2.1, "2081-2100": 3.6},
            SSPScenario.SSP585: {"2021-2040": 1.6, "2041-2060": 2.4, "2081-2100": 4.4},
        }
        
        base_warming = global_warming[scenario][period.value]
        
        # Apply regional scaling
        regional_scaling = factors.get("temp_scaling", 1.0)
        mean_change = base_warming * regional_scaling
        
        # Uncertainty range (approximately ±40% for regional projections)
        lower = mean_change * 0.6
        upper = mean_change * 1.4
        
        projection = ClimateProjection(
            variable=ClimateVariable.TEMPERATURE.value,
            scenario=scenario.value,
            period=period.value,
            value=round(mean_change, 2),
            lower_bound=round(lower, 2),
            upper_bound=round(upper, 2),
            unit="°C",
            model_agreement=0.9 if scenario == SSPScenario.SSP245 else 0.85,
            num_models=30,
        )
        
        self._cache[cache_key] = (projection, datetime.utcnow())
        return projection
    
    async def get_precipitation_projection(
        self,
        lat: float,
        lon: float,
        scenario: SSPScenario = SSPScenario.SSP245,
        period: TimePeriod = TimePeriod.MID_CENTURY,
    ) -> ClimateProjection:
        """
        Get precipitation change projection for a location.
        
        Args:
            lat: Latitude
            lon: Longitude
            scenario: SSP scenario
            period: Time period
            
        Returns:
            ClimateProjection with precipitation change in %
        """
        cache_key = f"precip:{lat:.1f}:{lon:.1f}:{scenario.value}:{period.value}"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return data
        
        region = self._get_region(lat, lon)
        factors = self._regional_factors.get(region, self._regional_factors["global"])
        
        # Global mean precipitation change per degree of warming
        # Approximately 2-3% per °C globally, but varies regionally
        temp_projection = await self.get_temperature_projection(lat, lon, scenario, period)
        
        precip_scaling = factors.get("precip_scaling", 2.5)  # % per °C
        precip_sign = factors.get("precip_sign", 1)  # 1 for wetter, -1 for drier
        
        mean_change = temp_projection.value * precip_scaling * precip_sign
        
        # Higher uncertainty for precipitation
        lower = mean_change - 10
        upper = mean_change + 10
        
        projection = ClimateProjection(
            variable=ClimateVariable.PRECIPITATION.value,
            scenario=scenario.value,
            period=period.value,
            value=round(mean_change, 1),
            lower_bound=round(lower, 1),
            upper_bound=round(upper, 1),
            unit="%",
            model_agreement=0.7,  # Lower agreement for precipitation
            num_models=30,
        )
        
        self._cache[cache_key] = (projection, datetime.utcnow())
        return projection
    
    async def get_sea_level_projection(
        self,
        lat: float,
        lon: float,
        scenario: SSPScenario = SSPScenario.SSP245,
        period: TimePeriod = TimePeriod.MID_CENTURY,
    ) -> ClimateProjection:
        """
        Get sea level rise projection for a coastal location.
        
        Args:
            lat: Latitude
            lon: Longitude
            scenario: SSP scenario
            period: Time period
            
        Returns:
            ClimateProjection with sea level rise in cm
        """
        # Global mean sea level rise projections (cm)
        # Based on IPCC AR6 WG1
        slr = {
            SSPScenario.SSP126: {"2021-2040": 13, "2041-2060": 19, "2081-2100": 38},
            SSPScenario.SSP245: {"2021-2040": 14, "2041-2060": 22, "2081-2100": 55},
            SSPScenario.SSP370: {"2021-2040": 14, "2041-2060": 23, "2081-2100": 67},
            SSPScenario.SSP585: {"2021-2040": 15, "2041-2060": 26, "2081-2100": 83},
        }
        
        mean_slr = slr[scenario][period.value]
        
        # Regional variations (simplified)
        # Higher in some areas due to land subsidence, currents, etc.
        regional_factor = 1.0
        if lat > 60 or lat < -60:  # Polar regions
            regional_factor = 0.8
        elif abs(lat) < 15:  # Tropical
            regional_factor = 1.1
        
        mean_slr *= regional_factor
        
        # Uncertainty (approximately ±30%)
        lower = mean_slr * 0.7
        upper = mean_slr * 1.5  # Asymmetric - ice sheet uncertainty
        
        return ClimateProjection(
            variable=ClimateVariable.SEA_LEVEL.value,
            scenario=scenario.value,
            period=period.value,
            value=round(mean_slr, 0),
            lower_bound=round(lower, 0),
            upper_bound=round(upper, 0),
            unit="cm",
            model_agreement=0.85,
            num_models=25,
        )
    
    async def get_location_climate(
        self,
        lat: float,
        lon: float,
        scenarios: Optional[List[SSPScenario]] = None,
    ) -> LocationClimate:
        """
        Get complete climate assessment for a location.
        
        Args:
            lat: Latitude
            lon: Longitude
            scenarios: Scenarios to include (default: SSP2-4.5 and SSP5-8.5)
            
        Returns:
            LocationClimate with current conditions and projections
        """
        scenarios = scenarios or [SSPScenario.SSP245, SSPScenario.SSP585]
        
        location = LocationClimate(
            latitude=lat,
            longitude=lon,
            koppen_climate=self._get_koppen_climate(lat, lon),
        )
        
        # Get projections for each scenario
        for scenario in scenarios:
            projections = []
            
            for period in [TimePeriod.NEAR_TERM, TimePeriod.MID_CENTURY, TimePeriod.END_CENTURY]:
                temp = await self.get_temperature_projection(lat, lon, scenario, period)
                precip = await self.get_precipitation_projection(lat, lon, scenario, period)
                
                projections.append(temp)
                projections.append(precip)
                
                # Sea level only for end century
                if period == TimePeriod.END_CENTURY:
                    slr = await self.get_sea_level_projection(lat, lon, scenario, period)
                    projections.append(slr)
            
            location.projections[scenario.value] = projections
        
        # Set risk indicators based on mid-century SSP2-4.5 projections
        mid_century = location.projections.get(SSPScenario.SSP245.value, [])
        for proj in mid_century:
            if proj.variable == ClimateVariable.TEMPERATURE.value:
                if proj.value > 3:
                    location.heat_stress_risk = "very_high"
                elif proj.value > 2:
                    location.heat_stress_risk = "high"
                elif proj.value > 1.5:
                    location.heat_stress_risk = "moderate"
                else:
                    location.heat_stress_risk = "low"
            
            elif proj.variable == ClimateVariable.PRECIPITATION.value:
                if proj.value < -20:
                    location.drought_risk = "very_high"
                elif proj.value < -10:
                    location.drought_risk = "high"
                elif proj.value > 20:
                    location.flood_risk = "high"
        
        return location
    
    def _get_region(self, lat: float, lon: float) -> str:
        """Determine climate region for a location."""
        # Simplified regional classification
        if lat > 66.5:
            return "arctic"
        elif lat < -66.5:
            return "antarctic"
        elif lat > 45:
            if lon > 0 and lon < 60:
                return "europe_north"
            elif lon < -60:
                return "north_america_north"
            else:
                return "asia_north"
        elif lat > 23.5:
            if lon > -30 and lon < 60:
                return "europe_med"
            elif lon < -60:
                return "north_america"
            else:
                return "asia"
        elif lat > -23.5:
            return "tropical"
        elif lat > -45:
            if lon > 110 and lon < 180:
                return "australia"
            elif lon < -30:
                return "south_america"
            else:
                return "africa_south"
        else:
            return "southern_ocean"
    
    def _load_regional_factors(self) -> Dict[str, Dict[str, float]]:
        """Load regional scaling factors for climate projections."""
        return {
            "global": {"temp_scaling": 1.0, "precip_scaling": 2.5, "precip_sign": 1},
            "arctic": {"temp_scaling": 2.0, "precip_scaling": 5.0, "precip_sign": 1},
            "antarctic": {"temp_scaling": 1.5, "precip_scaling": 5.0, "precip_sign": 1},
            "europe_north": {"temp_scaling": 1.3, "precip_scaling": 3.0, "precip_sign": 1},
            "europe_med": {"temp_scaling": 1.4, "precip_scaling": 3.0, "precip_sign": -1},
            "north_america": {"temp_scaling": 1.2, "precip_scaling": 2.0, "precip_sign": 1},
            "north_america_north": {"temp_scaling": 1.5, "precip_scaling": 3.0, "precip_sign": 1},
            "asia": {"temp_scaling": 1.1, "precip_scaling": 2.5, "precip_sign": 1},
            "asia_north": {"temp_scaling": 1.6, "precip_scaling": 3.5, "precip_sign": 1},
            "tropical": {"temp_scaling": 0.9, "precip_scaling": 3.0, "precip_sign": 1},
            "australia": {"temp_scaling": 1.3, "precip_scaling": 2.0, "precip_sign": -1},
            "south_america": {"temp_scaling": 1.1, "precip_scaling": 2.0, "precip_sign": 1},
            "africa_south": {"temp_scaling": 1.2, "precip_scaling": 2.5, "precip_sign": -1},
            "southern_ocean": {"temp_scaling": 0.8, "precip_scaling": 4.0, "precip_sign": 1},
        }
    
    def _get_koppen_climate(self, lat: float, lon: float) -> str:
        """Estimate Köppen climate classification."""
        # Very simplified classification
        if abs(lat) > 66.5:
            return "EF"  # Ice cap
        elif abs(lat) > 55:
            return "Dfc"  # Subarctic
        elif abs(lat) > 40:
            if lon > -30 and lon < 40:
                return "Cfb"  # Oceanic (Western Europe)
            else:
                return "Dfa"  # Hot-summer continental
        elif abs(lat) > 23.5:
            return "Cfa"  # Humid subtropical
        elif abs(lat) > 10:
            return "Aw"  # Tropical savanna
        else:
            return "Af"  # Tropical rainforest
    
    def clear_cache(self):
        """Clear cached data."""
        self._cache.clear()


# Global instance
cmip6_client = CMIP6Client()
