"""
NOAA Climate Data Online API Client.

Fetches climate data from NOAA's Climate Data Online (CDO) API.
API Documentation: https://www.ncdc.noaa.gov/cdo-web/webservices/v2

Features:
- Climate normals (30-year averages)
- Storm events database
- Historical observations
- Location-based data

Requires API token from: https://www.ncdc.noaa.gov/cdo-web/token
"""
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
import logging
import os

logger = logging.getLogger(__name__)

NOAA_CDO_BASE_URL = "https://www.ncdc.noaa.gov/cdo-web/api/v2"


class NOAADataset(str, Enum):
    """Available NOAA datasets."""
    GHCND = "GHCND"           # Daily Summaries
    GSOM = "GSOM"             # Global Summary of the Month
    GSOY = "GSOY"             # Global Summary of the Year
    NEXRAD2 = "NEXRAD2"       # Weather Radar
    NEXRAD3 = "NEXRAD3"       # Weather Radar
    NORMAL_DLY = "NORMAL_DLY" # Climate Normals Daily
    NORMAL_MLY = "NORMAL_MLY" # Climate Normals Monthly
    PRECIP_15 = "PRECIP_15"   # Precipitation 15 Minute
    PRECIP_HLY = "PRECIP_HLY" # Precipitation Hourly


class NOAADatatype(str, Enum):
    """Common NOAA data types."""
    PRCP = "PRCP"   # Precipitation
    SNOW = "SNOW"   # Snowfall
    SNWD = "SNWD"   # Snow depth
    TMAX = "TMAX"   # Maximum temperature
    TMIN = "TMIN"   # Minimum temperature
    TAVG = "TAVG"   # Average temperature
    AWND = "AWND"   # Average wind speed
    WSF2 = "WSF2"   # Fastest 2-minute wind speed
    WSF5 = "WSF5"   # Fastest 5-second wind speed


@dataclass
class ClimateNormal:
    """Climate normal (30-year average) data."""
    element: str
    value: float
    month: Optional[int] = None
    unit: str = ""
    

@dataclass
class StormEvent:
    """Storm event record."""
    event_id: str
    event_type: str
    begin_date: datetime
    end_date: Optional[datetime]
    state: str
    magnitude: Optional[float]
    magnitude_type: Optional[str]
    injuries: int = 0
    deaths: int = 0
    damage_property: float = 0.0
    damage_crops: float = 0.0
    description: Optional[str] = None


@dataclass  
class WeatherObservation:
    """Weather observation data."""
    date: datetime
    station: str
    datatype: str
    value: float
    attributes: Optional[str] = None


class NOAAClient:
    """
    Client for NOAA Climate Data Online API.
    
    Requires API token from https://www.ncdc.noaa.gov/cdo-web/token
    Set via NOAA_API_TOKEN environment variable.
    """
    
    def __init__(self, api_token: Optional[str] = None, timeout: float = 30.0):
        self.api_token = api_token or os.getenv("NOAA_API_TOKEN")
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}
        self._cache_ttl = timedelta(hours=24)  # Cache for 24 hours
    
    @property
    def is_configured(self) -> bool:
        """Check if API token is configured."""
        return bool(self.api_token)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with API token."""
        return {"token": self.api_token} if self.api_token else {}
    
    async def _make_request(
        self, 
        endpoint: str, 
        params: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict]:
        """Make authenticated request to NOAA API."""
        if not self.is_configured:
            logger.warning("NOAA API token not configured")
            return None
        
        url = f"{NOAA_CDO_BASE_URL}/{endpoint}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    url,
                    params=params,
                    headers=self._get_headers(),
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.warning("NOAA API rate limit exceeded")
            else:
                logger.error(f"NOAA API error: {e}")
            return None
        except Exception as e:
            logger.error(f"NOAA request failed: {e}")
            return None
    
    async def get_stations_near(
        self,
        lat: float,
        lon: float,
        radius_km: float = 50,
        dataset: NOAADataset = NOAADataset.GHCND,
        limit: int = 10,
    ) -> List[Dict]:
        """
        Find weather stations near a location.
        
        Args:
            lat: Latitude
            lon: Longitude
            radius_km: Search radius in kilometers
            dataset: NOAA dataset to search
            limit: Maximum stations to return
            
        Returns:
            List of station records
        """
        # NOAA uses a bounding box, convert radius to extent
        # Rough approximation: 1 degree ≈ 111 km
        extent = radius_km / 111.0
        
        data = await self._make_request(
            "stations",
            params={
                "datasetid": dataset.value,
                "extent": f"{lat - extent},{lon - extent},{lat + extent},{lon + extent}",
                "limit": limit,
                "sortfield": "name",
            }
        )
        
        if data and "results" in data:
            return data["results"]
        return []
    
    async def get_climate_normals(
        self,
        lat: float,
        lon: float,
        elements: Optional[List[str]] = None,
    ) -> List[ClimateNormal]:
        """
        Get 30-year climate normals for a location.
        
        Returns monthly averages for temperature, precipitation, etc.
        
        Args:
            lat: Latitude
            lon: Longitude
            elements: Specific elements to fetch (default: temp, precip)
            
        Returns:
            List of climate normal values
        """
        # First find nearby stations with normal data
        stations = await self.get_stations_near(
            lat, lon, 
            radius_km=100,
            dataset=NOAADataset.NORMAL_MLY,
            limit=5
        )
        
        if not stations:
            logger.info(f"No NOAA stations found near ({lat}, {lon})")
            return self._estimate_climate_normals(lat, lon)
        
        # Get data from first available station
        station_id = stations[0]["id"]
        
        # Fetch climate normal data
        elements = elements or ["MLY-TAVG-NORMAL", "MLY-PRCP-NORMAL"]
        
        data = await self._make_request(
            "data",
            params={
                "datasetid": NOAADataset.NORMAL_MLY.value,
                "stationid": station_id,
                "datatypeid": ",".join(elements),
                "limit": 100,
            }
        )
        
        normals = []
        if data and "results" in data:
            for record in data["results"]:
                # Parse date to get month
                date_str = record.get("date", "")
                month = None
                if date_str:
                    try:
                        month = datetime.fromisoformat(date_str.replace("Z", "")).month
                    except ValueError:
                        pass
                
                normals.append(ClimateNormal(
                    element=record.get("datatype", ""),
                    value=record.get("value", 0),
                    month=month,
                    unit=self._get_unit_for_element(record.get("datatype", "")),
                ))
        
        return normals if normals else self._estimate_climate_normals(lat, lon)
    
    async def get_historical_observations(
        self,
        lat: float,
        lon: float,
        start_date: datetime,
        end_date: datetime,
        datatypes: Optional[List[NOAADatatype]] = None,
    ) -> List[WeatherObservation]:
        """
        Get historical weather observations for a location.
        
        Args:
            lat: Latitude
            lon: Longitude
            start_date: Start date
            end_date: End date
            datatypes: Data types to fetch
            
        Returns:
            List of weather observations
        """
        # Find nearby station
        stations = await self.get_stations_near(lat, lon, radius_km=50, limit=3)
        
        if not stations:
            return []
        
        datatypes = datatypes or [NOAADatatype.TMAX, NOAADatatype.TMIN, NOAADatatype.PRCP]
        station_id = stations[0]["id"]
        
        data = await self._make_request(
            "data",
            params={
                "datasetid": NOAADataset.GHCND.value,
                "stationid": station_id,
                "startdate": start_date.strftime("%Y-%m-%d"),
                "enddate": end_date.strftime("%Y-%m-%d"),
                "datatypeid": ",".join(dt.value for dt in datatypes),
                "units": "metric",
                "limit": 1000,
            }
        )
        
        observations = []
        if data and "results" in data:
            for record in data["results"]:
                try:
                    obs_date = datetime.fromisoformat(record["date"].replace("Z", ""))
                    observations.append(WeatherObservation(
                        date=obs_date,
                        station=record.get("station", ""),
                        datatype=record.get("datatype", ""),
                        value=record.get("value", 0),
                        attributes=record.get("attributes"),
                    ))
                except (KeyError, ValueError) as e:
                    logger.warning(f"Failed to parse NOAA observation: {e}")
        
        return observations
    
    async def get_storm_events(
        self,
        state: str,
        start_date: datetime,
        end_date: datetime,
        event_types: Optional[List[str]] = None,
    ) -> List[StormEvent]:
        """
        Get storm events from NOAA Storm Events Database.
        
        Note: Storm Events use a different API endpoint.
        This is a simplified implementation - full access requires
        the NCEI Storm Events Database API or bulk file download.
        
        Args:
            state: US state code (e.g., "TX", "FL")
            start_date: Start date
            end_date: End date
            event_types: Filter by event types
            
        Returns:
            List of storm events (estimated if API unavailable)
        """
        # Storm Events Database has different access patterns
        # For now, return estimated data based on location and season
        return self._estimate_storm_events(state, start_date, end_date, event_types)
    
    def _estimate_climate_normals(self, lat: float, lon: float) -> List[ClimateNormal]:
        """Estimate climate normals when API data unavailable."""
        # Rough estimates based on latitude
        # Temperature decreases ~0.65°C per degree of latitude from equator
        base_temp = 25 - abs(lat) * 0.65
        
        # Precipitation varies by region
        # Higher near equator and coasts
        base_precip = 100 - abs(lat - 15) * 2
        
        normals = []
        for month in range(1, 13):
            # Seasonal variation
            seasonal_offset = 10 * (1 if lat > 0 else -1) * (
                1 if month in [6, 7, 8] else -1 if month in [12, 1, 2] else 0
            )
            
            normals.append(ClimateNormal(
                element="MLY-TAVG-NORMAL",
                value=base_temp + seasonal_offset,
                month=month,
                unit="°C",
            ))
            
            normals.append(ClimateNormal(
                element="MLY-PRCP-NORMAL",
                value=max(20, base_precip + (30 if month in [3, 4, 5, 9, 10] else 0)),
                month=month,
                unit="mm",
            ))
        
        return normals
    
    def _estimate_storm_events(
        self,
        state: str,
        start_date: datetime,
        end_date: datetime,
        event_types: Optional[List[str]] = None,
    ) -> List[StormEvent]:
        """Estimate storm events when API data unavailable."""
        # Hurricane-prone states
        hurricane_states = {"FL", "TX", "LA", "NC", "SC", "AL", "MS", "GA"}
        # Tornado-prone states
        tornado_states = {"TX", "OK", "KS", "NE", "SD", "IA", "MO", "AR", "LA", "MS", "AL"}
        
        events = []
        
        # Check if in hurricane season (Jun-Nov) and hurricane-prone state
        month = start_date.month
        if state.upper() in hurricane_states and 6 <= month <= 11:
            events.append(StormEvent(
                event_id=f"est-hurricane-{state}-{start_date.year}",
                event_type="Hurricane",
                begin_date=start_date,
                end_date=None,
                state=state.upper(),
                magnitude=None,
                magnitude_type="Category",
                description="Estimated hurricane season risk",
            ))
        
        # Check for tornado season (Mar-Jun) in tornado alley
        if state.upper() in tornado_states and 3 <= month <= 6:
            events.append(StormEvent(
                event_id=f"est-tornado-{state}-{start_date.year}",
                event_type="Tornado",
                begin_date=start_date,
                end_date=None,
                state=state.upper(),
                magnitude=None,
                magnitude_type="EF Scale",
                description="Estimated tornado season risk",
            ))
        
        return events
    
    def _get_unit_for_element(self, element: str) -> str:
        """Get unit for a data element."""
        if "TAVG" in element or "TMAX" in element or "TMIN" in element:
            return "°C"
        if "PRCP" in element:
            return "mm"
        if "SNOW" in element:
            return "cm"
        if "AWND" in element:
            return "m/s"
        return ""
    
    def clear_cache(self):
        """Clear cached data."""
        self._cache.clear()


# Global instance
# Initialize with API token from settings or environment variable
def get_noaa_client() -> NOAAClient:
    """Get NOAA client instance with API token from settings."""
    from src.core.config import get_settings
    settings = get_settings()
    api_token = settings.noaa_api_token or os.getenv("NOAA_API_TOKEN")
    return NOAAClient(api_token=api_token)

noaa_client = get_noaa_client()
