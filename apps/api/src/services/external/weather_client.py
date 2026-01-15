"""
Weather and Climate API Client.

Uses OpenWeather API for weather data and flood risk assessment.
API Documentation: https://openweathermap.org/api

Requires API key for full functionality.
Falls back to climate zone estimates if no key provided.
"""
import httpx
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging
import os

logger = logging.getLogger(__name__)

OPENWEATHER_API_URL = "https://api.openweathermap.org/data/2.5"


class WeatherClient:
    """Client for weather and climate data."""
    
    def __init__(self, api_key: Optional[str] = None, timeout: float = 30.0):
        self.api_key = api_key or os.getenv("OPENWEATHER_API_KEY")
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}
        self._cache_ttl = timedelta(hours=3)
    
    @property
    def is_configured(self) -> bool:
        """Check if API key is configured."""
        return bool(self.api_key)
    
    async def get_current_weather(self, lat: float, lng: float) -> Optional[Dict]:
        """Get current weather for location."""
        if not self.api_key:
            return None
        
        cache_key = f"weather:{lat:.2f},{lng:.2f}"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return data
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{OPENWEATHER_API_URL}/weather",
                    params={
                        "lat": lat,
                        "lon": lng,
                        "appid": self.api_key,
                        "units": "metric",
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                result = {
                    "temp": data.get("main", {}).get("temp"),
                    "humidity": data.get("main", {}).get("humidity"),
                    "pressure": data.get("main", {}).get("pressure"),
                    "wind_speed": data.get("wind", {}).get("speed"),
                    "description": data.get("weather", [{}])[0].get("description"),
                    "rain_1h": data.get("rain", {}).get("1h", 0),
                }
                
                self._cache[cache_key] = (result, datetime.utcnow())
                return result
                
        except Exception as e:
            logger.warning(f"OpenWeather API error: {e}")
            return None
    
    async def get_flood_risk(self, lat: float, lng: float) -> Dict:
        """
        Estimate flood risk for a location.
        
        Uses weather data if available, otherwise estimates based on location.
        """
        # Try to get real weather data
        weather = await self.get_current_weather(lat, lng) if self.api_key else None
        
        if weather:
            # Calculate risk based on current conditions
            rain = weather.get("rain_1h", 0)
            humidity = weather.get("humidity", 50)
            
            # Heavy rain increases flood risk
            rain_factor = min(1.0, rain / 50.0)  # 50mm/h = max risk
            humidity_factor = humidity / 100.0 * 0.3  # humidity adds some risk
            
            flood_risk = rain_factor * 0.7 + humidity_factor
            
            return {
                "flood_risk": round(min(1.0, flood_risk), 2),
                "source": "OpenWeather API",
                "details": f"Rain: {rain}mm/h, Humidity: {humidity}%",
                "current_weather": weather,
            }
        
        # Fallback: estimate based on latitude (tropical = higher risk)
        tropical_factor = 1.0 - abs(lat) / 60.0  # Higher near equator
        coastal_factor = 0.3 if abs(lng) > 100 or abs(lng) < 30 else 0.2
        
        estimated_risk = tropical_factor * 0.5 + coastal_factor
        
        return {
            "flood_risk": round(min(1.0, max(0.1, estimated_risk)), 2),
            "source": "Climate Zone Estimate",
            "details": f"Based on latitude {lat:.1f}, estimated risk",
        }
    
    async def get_hurricane_season_risk(self, lat: float, lng: float) -> Dict:
        """Estimate hurricane/typhoon risk based on location and season."""
        month = datetime.utcnow().month
        
        # Atlantic hurricane season: June-November
        # Pacific typhoon season: May-November
        in_season = 5 <= month <= 11
        
        # Check if in hurricane-prone region
        in_atlantic = -100 < lng < -30 and 10 < lat < 35
        in_pacific = lng > 100 and 5 < lat < 40
        in_indian = 50 < lng < 100 and -15 < lat < 25
        
        if in_atlantic:
            region = "Atlantic Hurricane Zone"
            base_risk = 0.75 if in_season else 0.15
        elif in_pacific:
            region = "Pacific Typhoon Zone"
            base_risk = 0.80 if in_season else 0.20
        elif in_indian:
            region = "Indian Ocean Cyclone Zone"
            base_risk = 0.65 if in_season else 0.15
        else:
            region = "Low cyclone risk zone"
            base_risk = 0.10
        
        return {
            "hurricane_risk": round(base_risk, 2),
            "region": region,
            "in_season": in_season,
            "season_months": "May-November" if in_pacific else "June-November",
        }
    
    def clear_cache(self):
        """Clear cached data."""
        self._cache.clear()
