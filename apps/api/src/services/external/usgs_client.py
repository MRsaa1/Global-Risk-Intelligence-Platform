"""
USGS Earthquake API Client.

Fetches earthquake data from the USGS Earthquake Catalog API.
API Documentation: https://earthquake.usgs.gov/fdsnws/event/1/

Free API, no authentication required.
"""
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

USGS_API_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"


class USGSClient:
    """Client for USGS Earthquake Catalog API."""
    
    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}  # (data, timestamp)
        self._cache_ttl = timedelta(hours=6)
    
    async def get_recent_earthquakes(
        self,
        lat: float,
        lng: float,
        radius_km: float = 500,
        days: int = 365,
        min_magnitude: float = 2.5,
    ) -> List[Dict]:
        """
        Get recent earthquakes near a location.
        
        Args:
            lat: Latitude
            lng: Longitude
            radius_km: Search radius in kilometers
            days: Number of days to look back
            min_magnitude: Minimum magnitude to include
            
        Returns:
            List of earthquake events
        """
        cache_key = f"{lat:.2f},{lng:.2f},{radius_km},{days},{min_magnitude}"
        
        # Check cache
        if cache_key in self._cache:
            data, timestamp = self._cache[cache_key]
            if datetime.utcnow() - timestamp < self._cache_ttl:
                return data
        
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        params = {
            "format": "geojson",
            "latitude": lat,
            "longitude": lng,
            "maxradiuskm": radius_km,
            "starttime": start_time.strftime("%Y-%m-%d"),
            "endtime": end_time.strftime("%Y-%m-%d"),
            "minmagnitude": min_magnitude,
            "orderby": "magnitude",
            "limit": 100,
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(USGS_API_URL, params=params)
                response.raise_for_status()
                data = response.json()
                
                earthquakes = []
                for feature in data.get("features", []):
                    props = feature.get("properties", {})
                    coords = feature.get("geometry", {}).get("coordinates", [])
                    
                    earthquakes.append({
                        "id": feature.get("id"),
                        "magnitude": props.get("mag"),
                        "place": props.get("place"),
                        "time": datetime.fromtimestamp(props.get("time", 0) / 1000),
                        "depth": coords[2] if len(coords) > 2 else None,
                        "coordinates": coords[:2] if len(coords) >= 2 else None,
                        "type": props.get("type"),
                        "tsunami": props.get("tsunami", 0) == 1,
                    })
                
                # Cache result
                self._cache[cache_key] = (earthquakes, datetime.utcnow())
                
                logger.info(f"USGS: Found {len(earthquakes)} earthquakes near ({lat}, {lng})")
                return earthquakes
                
        except httpx.TimeoutException:
            logger.warning(f"USGS API timeout for ({lat}, {lng})")
            return []
        except Exception as e:
            logger.error(f"USGS API error: {e}")
            return []
    
    async def get_significant_earthquakes(self, days: int = 30) -> List[Dict]:
        """Get globally significant earthquakes."""
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        params = {
            "format": "geojson",
            "starttime": start_time.strftime("%Y-%m-%d"),
            "endtime": end_time.strftime("%Y-%m-%d"),
            "minmagnitude": 5.5,
            "orderby": "magnitude",
            "limit": 50,
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(USGS_API_URL, params=params)
                response.raise_for_status()
                data = response.json()
                
                return [
                    {
                        "id": f.get("id"),
                        "magnitude": f.get("properties", {}).get("mag"),
                        "place": f.get("properties", {}).get("place"),
                        "time": datetime.fromtimestamp(
                            f.get("properties", {}).get("time", 0) / 1000
                        ),
                    }
                    for f in data.get("features", [])
                ]
        except Exception as e:
            logger.error(f"USGS significant earthquakes error: {e}")
            return []
    
    def clear_cache(self):
        """Clear cached data."""
        self._cache.clear()


# Global service instance
usgs_client = USGSClient()
