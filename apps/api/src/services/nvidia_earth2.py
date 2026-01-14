"""
NVIDIA Earth-2 Integration - Climate Simulations and Weather Forecasting.

Earth-2 provides:
- High-resolution climate simulations
- Weather forecasting (FourCastNet, CorrDiff)
- Climate downscaling
- Historical climate data
"""
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from enum import Enum

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)


class Earth2Model(str, Enum):
    """Available Earth-2 models."""
    FOURCASTNET = "fourcastnet"  # Weather forecasting
    CORRDIFF = "corrdiff"  # High-resolution downscaling
    CLIMATE = "climate"  # Climate projections


@dataclass
class WeatherForecast:
    """Weather forecast from Earth-2."""
    latitude: float
    longitude: float
    forecast_time: datetime
    temperature_c: float
    precipitation_mm: float
    wind_speed_ms: float
    wind_direction_deg: float
    humidity_percent: float
    pressure_hpa: float
    confidence: float


@dataclass
class ClimateProjection:
    """Climate projection from Earth-2."""
    latitude: float
    longitude: float
    scenario: str  # SSP126, SSP245, SSP585
    time_horizon: int  # Year
    temperature_change_c: float
    precipitation_change_pct: float
    extreme_heat_days: int
    extreme_precipitation_days: int
    sea_level_rise_m: float
    confidence: float


class NVIDIAEarth2Service:
    """
    Service for interacting with NVIDIA Earth-2 API.
    
    Provides:
    - Weather forecasting (FourCastNet)
    - Climate projections (CMIP6 downscaling)
    - High-resolution climate data
    """
    
    def __init__(self):
        self.api_key = getattr(settings, 'nvidia_api_key', None) or ""
        self.base_url = getattr(settings, 'earth2_api_url', 'https://api.nvidia.com/v1/earth2')
        
        # Build headers - only include Authorization if API key exists
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        
        self.http_client = httpx.AsyncClient(
            timeout=60.0,
            headers=headers,
        )
    
    async def get_weather_forecast(
        self,
        latitude: float,
        longitude: float,
        forecast_hours: int = 72,
        model: Earth2Model = Earth2Model.FOURCASTNET,
    ) -> list[WeatherForecast]:
        """
        Get weather forecast from Earth-2 FourCastNet.
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            forecast_hours: Hours ahead to forecast
            model: Model to use (FourCastNet recommended)
            
        Returns:
            List of weather forecasts for each time step
        """
        if not self.api_key:
            logger.warning("NVIDIA API key not configured, using mock data")
            return self._mock_weather_forecast(latitude, longitude, forecast_hours)
        
        try:
            response = await self.http_client.post(
                f"{self.base_url}/forecast",
                json={
                    "latitude": latitude,
                    "longitude": longitude,
                    "forecast_hours": forecast_hours,
                    "model": model.value,
                    "variables": [
                        "temperature_2m",
                        "precipitation",
                        "wind_speed_10m",
                        "wind_direction_10m",
                        "relative_humidity_2m",
                        "surface_pressure",
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            
            forecasts = []
            for step in data.get("forecast_steps", []):
                forecasts.append(WeatherForecast(
                    latitude=latitude,
                    longitude=longitude,
                    forecast_time=datetime.fromisoformat(step["time"]),
                    temperature_c=step["temperature_2m"],
                    precipitation_mm=step["precipitation"],
                    wind_speed_ms=step["wind_speed_10m"],
                    wind_direction_deg=step["wind_direction_10m"],
                    humidity_percent=step["relative_humidity_2m"],
                    pressure_hpa=step["surface_pressure"],
                    confidence=step.get("confidence", 0.85),
                ))
            
            return forecasts
            
        except Exception as e:
            logger.error(f"Earth-2 API error: {e}")
            # Fallback to mock data
            return self._mock_weather_forecast(latitude, longitude, forecast_hours)
    
    async def get_climate_projection(
        self,
        latitude: float,
        longitude: float,
        scenario: str = "ssp245",
        time_horizon: int = 2050,
        model: Earth2Model = Earth2Model.CLIMATE,
    ) -> ClimateProjection:
        """
        Get climate projection from Earth-2.
        
        Uses CMIP6 downscaling for high-resolution projections.
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            scenario: SSP scenario (ssp126, ssp245, ssp585)
            time_horizon: Target year
            model: Climate model to use
            
        Returns:
            ClimateProjection with temperature, precipitation, extremes
        """
        if not self.api_key:
            logger.warning("NVIDIA API key not configured, using mock data")
            return self._mock_climate_projection(latitude, longitude, scenario, time_horizon)
        
        try:
            response = await self.http_client.post(
                f"{self.base_url}/climate/project",
                json={
                    "latitude": latitude,
                    "longitude": longitude,
                    "scenario": scenario,
                    "time_horizon": time_horizon,
                    "model": model.value,
                    "variables": [
                        "temperature",
                        "precipitation",
                        "extreme_heat",
                        "extreme_precipitation",
                        "sea_level_rise",
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            
            return ClimateProjection(
                latitude=latitude,
                longitude=longitude,
                scenario=scenario,
                time_horizon=time_horizon,
                temperature_change_c=data["temperature_change"],
                precipitation_change_pct=data["precipitation_change"],
                extreme_heat_days=data["extreme_heat_days"],
                extreme_precipitation_days=data["extreme_precipitation_days"],
                sea_level_rise_m=data.get("sea_level_rise", 0),
                confidence=data.get("confidence", 0.80),
            )
            
        except Exception as e:
            logger.error(f"Earth-2 API error: {e}")
            return self._mock_climate_projection(latitude, longitude, scenario, time_horizon)
    
    async def get_historical_climate(
        self,
        latitude: float,
        longitude: float,
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict]:
        """
        Get historical climate data from Earth-2.
        
        Useful for calibration and trend analysis.
        """
        if not self.api_key:
            return []
        
        try:
            response = await self.http_client.post(
                f"{self.base_url}/historical",
                json={
                    "latitude": latitude,
                    "longitude": longitude,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                },
            )
            response.raise_for_status()
            return response.json().get("data", [])
        except Exception as e:
            logger.error(f"Earth-2 historical data error: {e}")
            return []
    
    def _mock_weather_forecast(
        self,
        latitude: float,
        longitude: float,
        forecast_hours: int,
    ) -> list[WeatherForecast]:
        """Mock weather forecast for development."""
        from datetime import timedelta
        import random
        
        forecasts = []
        base_temp = 20.0 - abs(latitude) * 0.5  # Rough temperature estimate
        base_time = datetime.utcnow()
        
        for hour in range(0, forecast_hours, 6):  # Every 6 hours
            forecasts.append(WeatherForecast(
                latitude=latitude,
                longitude=longitude,
                forecast_time=base_time + timedelta(hours=hour),
                temperature_c=base_temp + random.uniform(-5, 5),
                precipitation_mm=random.uniform(0, 10),
                wind_speed_ms=random.uniform(5, 15),
                wind_direction_deg=random.uniform(0, 360),
                humidity_percent=random.uniform(40, 80),
                pressure_hpa=random.uniform(990, 1020),
                confidence=0.75,
            ))
        
        return forecasts
    
    def _mock_climate_projection(
        self,
        latitude: float,
        longitude: float,
        scenario: str,
        time_horizon: int,
    ) -> ClimateProjection:
        """Mock climate projection for development."""
        scenario_multipliers = {
            "ssp126": 1.0,
            "ssp245": 1.5,
            "ssp370": 2.0,
            "ssp585": 2.5,
        }
        multiplier = scenario_multipliers.get(scenario, 1.5)
        years_ahead = time_horizon - 2024
        
        return ClimateProjection(
            latitude=latitude,
            longitude=longitude,
            scenario=scenario,
            time_horizon=time_horizon,
            temperature_change_c=years_ahead * 0.02 * multiplier,
            precipitation_change_pct=years_ahead * 0.5 * multiplier,
            extreme_heat_days=int(years_ahead * 0.5 * multiplier),
            extreme_precipitation_days=int(years_ahead * 0.3 * multiplier),
            sea_level_rise_m=years_ahead * 0.003 * multiplier,
            confidence=0.75,
        )
    
    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()


# Global service instance
earth2_service = NVIDIAEarth2Service()
