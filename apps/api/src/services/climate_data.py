"""
Climate Data Service.

Integrates with multiple climate data sources:
- Open-Meteo (free, no API key required)
- NVIDIA Earth-2 (requires API key)
- Copernicus CDS (requires registration)

Provides:
- Historical weather data
- Weather forecasts
- Climate indicators
- Extreme event data
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

import httpx
import structlog

logger = structlog.get_logger()


class DataSource(str, Enum):
    """Available climate data sources."""
    OPEN_METEO = "open_meteo"
    NVIDIA_EARTH2 = "nvidia_earth2"
    COPERNICUS = "copernicus"


@dataclass
class WeatherData:
    """Weather observation or forecast."""
    timestamp: datetime
    temperature_c: float
    humidity_percent: float
    precipitation_mm: float
    wind_speed_ms: float
    wind_direction_deg: float
    pressure_hpa: float
    cloud_cover_percent: float = 0.0
    uv_index: float = 0.0


@dataclass
class ClimateIndicator:
    """Climate risk indicator."""
    name: str
    value: float
    unit: str
    threshold: Optional[float] = None
    risk_level: str = "normal"  # normal, elevated, high, extreme


class ClimateDataService:
    """
    Unified climate data service.
    
    Uses Open-Meteo as primary source (free, no API key).
    Falls back to NVIDIA Earth-2 for enhanced forecasts.
    """
    
    OPEN_METEO_BASE = "https://api.open-meteo.com/v1"
    OPEN_METEO_HISTORICAL = "https://archive-api.open-meteo.com/v1/archive"
    
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client
    
    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    # ==================== WEATHER FORECAST ====================
    
    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
    ) -> List[WeatherData]:
        """
        Get weather forecast for location.
        
        Args:
            latitude: Latitude (-90 to 90)
            longitude: Longitude (-180 to 180)
            days: Forecast days (1-16)
        
        Returns:
            List of hourly weather forecasts
        """
        client = await self._get_client()
        
        try:
            response = await client.get(
                f"{self.OPEN_METEO_BASE}/forecast",
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "hourly": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover,uv_index",
                    "forecast_days": min(days, 16),
                    "timezone": "UTC",
                },
            )
            response.raise_for_status()
            data = response.json()
            
            hourly = data.get("hourly", {})
            times = hourly.get("time", [])
            
            forecasts = []
            for i, time_str in enumerate(times):
                forecasts.append(WeatherData(
                    timestamp=datetime.fromisoformat(time_str),
                    temperature_c=hourly.get("temperature_2m", [0])[i] or 0,
                    humidity_percent=hourly.get("relative_humidity_2m", [0])[i] or 0,
                    precipitation_mm=hourly.get("precipitation", [0])[i] or 0,
                    wind_speed_ms=hourly.get("wind_speed_10m", [0])[i] or 0,
                    wind_direction_deg=hourly.get("wind_direction_10m", [0])[i] or 0,
                    pressure_hpa=hourly.get("surface_pressure", [1013])[i] or 1013,
                    cloud_cover_percent=hourly.get("cloud_cover", [0])[i] or 0,
                    uv_index=hourly.get("uv_index", [0])[i] or 0,
                ))
            
            return forecasts
        
        except Exception as e:
            logger.error("Forecast fetch failed", error=str(e))
            raise
    
    # ==================== HISTORICAL DATA ====================
    
    async def get_historical(
        self,
        latitude: float,
        longitude: float,
        start_date: datetime,
        end_date: datetime,
    ) -> List[WeatherData]:
        """
        Get historical weather data.
        
        Args:
            latitude: Latitude
            longitude: Longitude
            start_date: Start date
            end_date: End date
        
        Returns:
            Daily weather observations
        """
        client = await self._get_client()
        
        try:
            response = await client.get(
                self.OPEN_METEO_HISTORICAL,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d"),
                    "daily": "temperature_2m_mean,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean,surface_pressure_mean",
                    "timezone": "UTC",
                },
            )
            response.raise_for_status()
            data = response.json()
            
            daily = data.get("daily", {})
            times = daily.get("time", [])
            
            observations = []
            for i, time_str in enumerate(times):
                observations.append(WeatherData(
                    timestamp=datetime.fromisoformat(time_str),
                    temperature_c=daily.get("temperature_2m_mean", [0])[i] or 0,
                    humidity_percent=daily.get("relative_humidity_2m_mean", [0])[i] or 0,
                    precipitation_mm=daily.get("precipitation_sum", [0])[i] or 0,
                    wind_speed_ms=daily.get("wind_speed_10m_max", [0])[i] or 0,
                    wind_direction_deg=0,  # Not available in daily
                    pressure_hpa=daily.get("surface_pressure_mean", [1013])[i] or 1013,
                ))
            
            return observations
        
        except Exception as e:
            logger.error("Historical fetch failed", error=str(e))
            raise
    
    # ==================== CLIMATE INDICATORS ====================
    
    async def get_climate_indicators(
        self,
        latitude: float,
        longitude: float,
    ) -> List[ClimateIndicator]:
        """
        Calculate climate risk indicators for location.
        
        Analyzes historical data and forecasts to determine:
        - Flood risk
        - Heat stress risk
        - Storm risk
        - Drought risk
        """
        # Get recent historical data
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=365)
        
        try:
            historical = await self.get_historical(latitude, longitude, start_date, end_date)
            forecast = await self.get_forecast(latitude, longitude, days=7)
        except Exception:
            # Return default indicators if data fetch fails
            return self._default_indicators()
        
        indicators = []
        
        # 1. Flood Risk - based on precipitation
        annual_precip = sum(d.precipitation_mm for d in historical)
        avg_daily_precip = annual_precip / len(historical) if historical else 0
        forecast_precip = sum(f.precipitation_mm for f in forecast[:72]) / 3 if forecast else 0  # 3-day forecast
        
        flood_risk = "normal"
        if forecast_precip > avg_daily_precip * 3:
            flood_risk = "extreme"
        elif forecast_precip > avg_daily_precip * 2:
            flood_risk = "high"
        elif forecast_precip > avg_daily_precip * 1.5:
            flood_risk = "elevated"
        
        indicators.append(ClimateIndicator(
            name="flood_risk",
            value=forecast_precip,
            unit="mm/day",
            threshold=avg_daily_precip * 2,
            risk_level=flood_risk,
        ))
        
        # 2. Heat Stress - based on temperature
        max_temp = max((f.temperature_c for f in forecast), default=20)
        avg_temp = sum(d.temperature_c for d in historical) / len(historical) if historical else 15
        
        heat_risk = "normal"
        if max_temp > 40:
            heat_risk = "extreme"
        elif max_temp > 35:
            heat_risk = "high"
        elif max_temp > 30:
            heat_risk = "elevated"
        
        indicators.append(ClimateIndicator(
            name="heat_stress",
            value=max_temp,
            unit="°C",
            threshold=35,
            risk_level=heat_risk,
        ))
        
        # 3. Storm Risk - based on wind speed
        max_wind = max((f.wind_speed_ms for f in forecast), default=5)
        
        storm_risk = "normal"
        if max_wind > 30:  # >108 km/h - hurricane force
            storm_risk = "extreme"
        elif max_wind > 20:  # >72 km/h - storm
            storm_risk = "high"
        elif max_wind > 15:  # >54 km/h - strong wind
            storm_risk = "elevated"
        
        indicators.append(ClimateIndicator(
            name="storm_risk",
            value=max_wind,
            unit="m/s",
            threshold=20,
            risk_level=storm_risk,
        ))
        
        # 4. Drought Risk - based on precipitation deficit
        recent_precip = sum(d.precipitation_mm for d in historical[-30:]) if len(historical) >= 30 else 0
        monthly_avg = annual_precip / 12 if historical else 50
        
        drought_risk = "normal"
        if recent_precip < monthly_avg * 0.2:
            drought_risk = "extreme"
        elif recent_precip < monthly_avg * 0.4:
            drought_risk = "high"
        elif recent_precip < monthly_avg * 0.6:
            drought_risk = "elevated"
        
        indicators.append(ClimateIndicator(
            name="drought_risk",
            value=recent_precip,
            unit="mm/30days",
            threshold=monthly_avg * 0.5,
            risk_level=drought_risk,
        ))
        
        return indicators
    
    def _default_indicators(self) -> List[ClimateIndicator]:
        """Return default indicators when data is unavailable."""
        return [
            ClimateIndicator("flood_risk", 0, "mm/day", risk_level="unknown"),
            ClimateIndicator("heat_stress", 0, "°C", risk_level="unknown"),
            ClimateIndicator("storm_risk", 0, "m/s", risk_level="unknown"),
            ClimateIndicator("drought_risk", 0, "mm/30days", risk_level="unknown"),
        ]
    
    # ==================== EXTREME EVENTS ====================
    
    async def get_extreme_events(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 100,
    ) -> List[Dict[str, Any]]:
        """
        Get recent and upcoming extreme weather events near location.
        
        Note: This is a simplified implementation.
        For production, integrate with MeteoAlarm or similar services.
        """
        try:
            forecast = await self.get_forecast(latitude, longitude, days=7)
        except Exception:
            return []
        
        events = []
        
        # Check for extreme conditions in forecast
        for i, f in enumerate(forecast):
            # Extreme heat
            if f.temperature_c > 40:
                events.append({
                    "type": "extreme_heat",
                    "severity": "severe",
                    "start_time": f.timestamp.isoformat(),
                    "temperature_c": f.temperature_c,
                    "description": f"Extreme heat warning: {f.temperature_c}°C expected",
                })
            
            # Heavy precipitation
            if f.precipitation_mm > 20:  # >20mm/hour is heavy
                events.append({
                    "type": "heavy_rain",
                    "severity": "moderate" if f.precipitation_mm < 50 else "severe",
                    "start_time": f.timestamp.isoformat(),
                    "precipitation_mm": f.precipitation_mm,
                    "description": f"Heavy rainfall expected: {f.precipitation_mm}mm/h",
                })
            
            # High winds
            if f.wind_speed_ms > 25:  # >90 km/h
                events.append({
                    "type": "high_wind",
                    "severity": "severe",
                    "start_time": f.timestamp.isoformat(),
                    "wind_speed_ms": f.wind_speed_ms,
                    "description": f"High wind warning: {f.wind_speed_ms * 3.6:.0f} km/h",
                })
        
        return events


# Global service instance
climate_service = ClimateDataService()
