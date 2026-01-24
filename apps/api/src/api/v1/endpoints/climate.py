"""
Climate Data API Endpoints.

Provides access to:
- Weather forecasts
- Historical weather data
- Climate risk indicators
- Extreme weather events
"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from src.services.climate_data import climate_service, WeatherData, ClimateIndicator
from src.services.cache import get_cache

router = APIRouter()


# ==================== SCHEMAS ====================

class WeatherDataResponse(BaseModel):
    """Weather data point."""
    timestamp: str
    temperature_c: float
    humidity_percent: float
    precipitation_mm: float
    wind_speed_ms: float
    wind_direction_deg: float
    pressure_hpa: float
    cloud_cover_percent: float = 0.0
    uv_index: float = 0.0


class ForecastResponse(BaseModel):
    """Weather forecast response."""
    latitude: float
    longitude: float
    forecast_days: int
    data: List[WeatherDataResponse]
    source: str = "open_meteo"


class HistoricalResponse(BaseModel):
    """Historical weather response."""
    latitude: float
    longitude: float
    start_date: str
    end_date: str
    data: List[WeatherDataResponse]
    source: str = "open_meteo"


class ClimateIndicatorResponse(BaseModel):
    """Climate indicator."""
    name: str
    value: float
    unit: str
    threshold: Optional[float]
    risk_level: str


class ClimateIndicatorsResponse(BaseModel):
    """Climate indicators for location."""
    latitude: float
    longitude: float
    indicators: List[ClimateIndicatorResponse]
    overall_risk: str


class ExtremeEventResponse(BaseModel):
    """Extreme weather event."""
    type: str
    severity: str
    start_time: str
    description: str


# ==================== HELPERS ====================

def _weather_to_response(w: WeatherData) -> WeatherDataResponse:
    return WeatherDataResponse(
        timestamp=w.timestamp.isoformat(),
        temperature_c=w.temperature_c,
        humidity_percent=w.humidity_percent,
        precipitation_mm=w.precipitation_mm,
        wind_speed_ms=w.wind_speed_ms,
        wind_direction_deg=w.wind_direction_deg,
        pressure_hpa=w.pressure_hpa,
        cloud_cover_percent=getattr(w, 'cloud_cover_percent', 0.0),
        uv_index=getattr(w, 'uv_index', 0.0),
    )


def _calculate_overall_risk(indicators: List[ClimateIndicator]) -> str:
    """Calculate overall risk from individual indicators."""
    risk_order = ["normal", "elevated", "high", "extreme"]
    max_risk = "normal"
    
    for ind in indicators:
        if ind.risk_level in risk_order:
            if risk_order.index(ind.risk_level) > risk_order.index(max_risk):
                max_risk = ind.risk_level
    
    return max_risk


# ==================== ENDPOINTS ====================

@router.get("/forecast", response_model=ForecastResponse)
async def get_weather_forecast(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    days: int = Query(7, ge=1, le=16, description="Forecast days"),
):
    """
    Get weather forecast for a location.
    
    Uses Open-Meteo API (free, no API key required).
    Returns hourly forecast data.
    
    Cached for 1 hour (forecast updates hourly).
    
    **Parameters:**
    - latitude: Location latitude (-90 to 90)
    - longitude: Location longitude (-180 to 180)
    - days: Number of forecast days (1-16, default 7)
    """
    # Check cache first
    cache = await get_cache()
    cache_key = f"climate:forecast:{latitude:.2f}:{longitude:.2f}:{days}"
    cached_result = await cache.get(cache_key)
    if cached_result:
        return ForecastResponse(**cached_result)
    
    try:
        forecasts = await climate_service.get_forecast(latitude, longitude, days)
        
        response = ForecastResponse(
            latitude=latitude,
            longitude=longitude,
            forecast_days=days,
            data=[_weather_to_response(f) for f in forecasts],
        )
        
        # Cache for 1 hour (forecast updates hourly)
        await cache.set(cache_key, response.model_dump(), ttl_seconds=3600)
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch forecast: {str(e)}")


@router.get("/historical", response_model=HistoricalResponse)
async def get_historical_weather(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
):
    """
    Get historical weather data for a location.
    
    Returns daily weather observations.
    Data available from 1940 to present.
    
    **Parameters:**
    - latitude: Location latitude
    - longitude: Location longitude  
    - start_date: Start date (YYYY-MM-DD format)
    - end_date: End date (YYYY-MM-DD format)
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    
    if start > end:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")
    
    if (end - start).days > 365:
        raise HTTPException(status_code=400, detail="Maximum range is 365 days")
    
    try:
        data = await climate_service.get_historical(latitude, longitude, start, end)
        
        return HistoricalResponse(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
            data=[_weather_to_response(d) for d in data],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical data: {str(e)}")


@router.get("/indicators", response_model=ClimateIndicatorsResponse)
async def get_climate_indicators(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    """
    Get climate risk indicators for a location.
    
    Analyzes historical data and forecasts to calculate:
    - **Flood risk**: Based on precipitation forecast vs historical average
    - **Heat stress**: Based on maximum forecast temperature
    - **Storm risk**: Based on wind speed forecast
    - **Drought risk**: Based on recent precipitation deficit
    
    Each indicator includes:
    - Current value
    - Threshold for concern
    - Risk level (normal, elevated, high, extreme)
    """
    # Check cache first
    cache = await get_cache()
    cache_key = f"climate:indicators:{latitude:.2f}:{longitude:.2f}"
    cached_result = await cache.get(cache_key)
    if cached_result:
        return ClimateIndicatorsResponse(**cached_result)
    
    try:
        indicators = await climate_service.get_climate_indicators(latitude, longitude)
        overall = _calculate_overall_risk(indicators)
        
        response = ClimateIndicatorsResponse(
            latitude=latitude,
            longitude=longitude,
            indicators=[
                ClimateIndicatorResponse(
                    name=i.name,
                    value=i.value,
                    unit=i.unit,
                    threshold=i.threshold,
                    risk_level=i.risk_level,
                )
                for i in indicators
            ],
            overall_risk=overall,
        )
        
        # Cache for 24 hours (indicators change slowly)
        await cache.set(cache_key, response.model_dump(), ttl_seconds=24 * 3600)
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate indicators: {str(e)}")


@router.get("/extreme-events", response_model=List[ExtremeEventResponse])
async def get_extreme_events(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(100, ge=10, le=500, description="Search radius in km"),
):
    """
    Get upcoming extreme weather events near a location.
    
    Analyzes forecast data to detect:
    - Extreme heat (>40°C)
    - Heavy rainfall (>20mm/hour)
    - High winds (>90 km/h)
    
    **Parameters:**
    - latitude/longitude: Center location
    - radius_km: Search radius (10-500 km)
    """
    try:
        events = await climate_service.get_extreme_events(latitude, longitude, radius_km)
        
        return [
            ExtremeEventResponse(
                type=e["type"],
                severity=e["severity"],
                start_time=e["start_time"],
                description=e["description"],
            )
            for e in events
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get extreme events: {str(e)}")


@router.get("/locations/risk-summary")
async def get_multi_location_risk(
    locations: str = Query(..., description="Comma-separated lat,lon pairs: lat1,lon1;lat2,lon2"),
):
    """
    Get risk summary for multiple locations.
    
    Example: ?locations=53.55,9.99;52.52,13.40;48.14,11.58
    
    Returns risk indicators for each location.
    """
    location_pairs = []
    try:
        for pair in locations.split(";"):
            lat, lon = pair.strip().split(",")
            location_pairs.append((float(lat), float(lon)))
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid location format. Use: lat1,lon1;lat2,lon2"
        )
    
    if len(location_pairs) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 locations per request")
    
    results = []
    for lat, lon in location_pairs:
        try:
            indicators = await climate_service.get_climate_indicators(lat, lon)
            overall = _calculate_overall_risk(indicators)
            
            results.append({
                "latitude": lat,
                "longitude": lon,
                "overall_risk": overall,
                "risks": {i.name: i.risk_level for i in indicators},
            })
        except Exception:
            results.append({
                "latitude": lat,
                "longitude": lon,
                "overall_risk": "unknown",
                "error": "Failed to fetch data",
            })
    
    return {"locations": results}
