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
from fastapi.responses import Response
from pydantic import BaseModel, Field

from src.services.climate_data import climate_service, WeatherData, ClimateIndicator
from src.services.flood_impact_service import flood_impact_service
from src.services.wind_impact_service import wind_impact_service
from src.services.climate_anomalies_service import climate_anomalies_service
from src.services.cache import get_cache
from src.services.high_fidelity_loader import load_flood, load_wind, load_metadata, load_export_rows, list_scenarios

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


class FloodDayResponse(BaseModel):
    """Flood forecast for a single day."""
    date: str
    precipitation_mm: float
    flood_depth_m: float
    risk_level: str


class FloodForecastResponse(BaseModel):
    """Flood forecast from Open-Meteo + CPU impact logic (no GPU)."""
    latitude: float
    longitude: float
    days: int
    daily: List[FloodDayResponse]
    max_flood_depth_m: float
    max_risk_level: str
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


class WindDayResponse(BaseModel):
    """Wind forecast for a single day."""
    date: str
    wind_speed_kmh: float
    category: int  # 0 = Tropical Storm, 1-5 = Hurricane
    category_label: str


class WindForecastResponse(BaseModel):
    """Wind forecast from Open-Meteo + CPU category mapping (no GPU)."""
    latitude: float
    longitude: float
    days: int
    daily: List[WindDayResponse]
    max_wind_kmh: float
    max_category: int
    max_category_label: str
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


class MetroEntranceResponse(BaseModel):
    """Metro/subway entrance for flood visualization."""
    lat: float
    lon: float
    name: str
    flood_depth_m: float


class MetroFloodResponse(BaseModel):
    """Metro entrances with flood depth for 3D viz (cylinders at entrances)."""
    entrances: List[MetroEntranceResponse]
    source: str = "open_meteo"


# --- Climate anomalies (heat, heavy rain, drought, UV) ---
class HeatDayResponse(BaseModel):
    date: str
    max_temp_c: float
    risk_level: str


class HeatForecastResponse(BaseModel):
    latitude: float
    longitude: float
    days: int
    daily: List[HeatDayResponse]
    max_temp_c: float
    max_risk_level: str
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


class HeavyRainDayResponse(BaseModel):
    date: str
    precipitation_mm: float
    risk_level: str


class HeavyRainForecastResponse(BaseModel):
    latitude: float
    longitude: float
    days: int
    daily: List[HeavyRainDayResponse]
    max_precipitation_mm: float
    max_risk_level: str
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


class DroughtForecastResponse(BaseModel):
    latitude: float
    longitude: float
    drought_risk: str
    value_mm_30d: float
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


class UvDayResponse(BaseModel):
    date: str
    max_uv: float
    risk_level: str


class UvForecastResponse(BaseModel):
    latitude: float
    longitude: float
    days: int
    daily: List[UvDayResponse]
    max_uv: float
    max_risk_level: str
    polygon: Optional[List[List[float]]] = None
    source: str = "open_meteo"


# Static metro entrances (NYC sample; expand per city as needed)
_METRO_ENTRANCES = [
    ("Times Square", 40.755983, -73.986229),
    ("Grand Central", 40.752721, -73.977229),
    ("Penn Station", 40.750581, -73.993519),
    ("Union Square", 40.734673, -73.990953),
    ("Columbus Circle", 40.768247, -73.981929),
]


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


@router.get("/flood-forecast", response_model=FloodForecastResponse)
async def get_flood_forecast(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    days: int = Query(7, ge=1, le=16, description="Forecast days"),
    include_polygon: bool = Query(True, description="Include polygon for 3D visualization"),
):
    """
    Get flood forecast from Open-Meteo (no GPU required).

    Uses precipitation forecast and CPU-only rules to derive flood depth and risk level
    per day. Returns polygon (buffer around point) for Cesium/Deck flood layer.
    """
    cache = await get_cache()
    cache_key = f"climate:flood_forecast:{latitude:.2f}:{longitude:.2f}:{days}:{include_polygon}"
    cached = await cache.get(cache_key)
    if cached:
        return FloodForecastResponse(**cached)
    try:
        result = await flood_impact_service.get_flood_forecast(
            latitude=latitude,
            longitude=longitude,
            days=days,
            include_polygon=include_polygon,
        )
        response = FloodForecastResponse(
            latitude=result.latitude,
            longitude=result.longitude,
            days=result.days,
            daily=[
                FloodDayResponse(
                    date=d.date,
                    precipitation_mm=d.precipitation_mm,
                    flood_depth_m=d.flood_depth_m,
                    risk_level=d.risk_level,
                )
                for d in result.daily
            ],
            max_flood_depth_m=result.max_flood_depth_m,
            max_risk_level=result.max_risk_level,
            polygon=result.polygon,
            source=result.source,
        )
        await cache.set(cache_key, response.model_dump(), ttl_seconds=3600)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch flood forecast: {str(e)}")


@router.get("/wind-forecast", response_model=WindForecastResponse)
async def get_wind_forecast(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    days: int = Query(7, ge=1, le=16, description="Forecast days"),
    include_polygon: bool = Query(True, description="Include polygon for 3D visualization"),
):
    """
    Get wind forecast from Open-Meteo (no GPU required).

    Maps wind speed to Saffir–Simpson hurricane categories (0–5) for
    wind damage zone visualization. Returns polygon for Cesium/Deck layer.
    """
    cache = await get_cache()
    cache_key = f"climate:wind_forecast:{latitude:.2f}:{longitude:.2f}:{days}:{include_polygon}"
    cached = await cache.get(cache_key)
    if cached:
        return WindForecastResponse(**cached)
    try:
        result = await wind_impact_service.get_wind_forecast(
            latitude=latitude,
            longitude=longitude,
            days=days,
            include_polygon=include_polygon,
        )
        response = WindForecastResponse(
            latitude=result.latitude,
            longitude=result.longitude,
            days=result.days,
            daily=[
                WindDayResponse(
                    date=d.date,
                    wind_speed_kmh=d.wind_speed_kmh,
                    category=d.category,
                    category_label=d.category_label,
                )
                for d in result.daily
            ],
            max_wind_kmh=result.max_wind_kmh,
            max_category=result.max_category,
            max_category_label=result.max_category_label,
            polygon=result.polygon,
            source=result.source,
        )
        await cache.set(cache_key, response.model_dump(), ttl_seconds=3600)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch wind forecast: {str(e)}")


# --- High-Fidelity (WRF/ADCIRC) pre-computed scenarios ---

@router.get("/high-fidelity/scenarios")
async def get_high_fidelity_scenarios():
    """
    List available high-fidelity scenario IDs (from local storage).
    Cesium/UE5 can use these to request flood or wind data by scenario_id.
    """
    ids = list_scenarios()
    return {"scenario_ids": ids}


@router.get("/high-fidelity/flood", response_model=FloodForecastResponse)
async def get_high_fidelity_flood(
    scenario_id: str = Query(..., description="Scenario ID (e.g. wrf_nyc_001, adcirc_nyc_001)"),
):
    """
    Get pre-computed flood/surge scenario from WRF or ADCIRC ETL output.
    Same response shape as /flood-forecast for Cesium/UE5 compatibility.
    """
    cache = await get_cache()
    cache_key = f"high_fidelity:flood:{scenario_id}"
    cached = await cache.get(cache_key)
    if cached:
        return FloodForecastResponse(**cached)
    data = load_flood(scenario_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"High-fidelity flood scenario not found: {scenario_id}")
    response = FloodForecastResponse(**data)
    await cache.set(cache_key, response.model_dump(), ttl_seconds=3600)
    return response


@router.get("/high-fidelity/wind", response_model=WindForecastResponse)
async def get_high_fidelity_wind(
    scenario_id: str = Query(..., description="Scenario ID (e.g. wrf_nyc_001)"),
):
    """
    Get pre-computed wind scenario from WRF ETL output.
    Same response shape as /wind-forecast for Cesium/UE5 compatibility.
    """
    cache = await get_cache()
    cache_key = f"high_fidelity:wind:{scenario_id}"
    cached = await cache.get(cache_key)
    if cached:
        return WindForecastResponse(**cached)
    data = load_wind(scenario_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"High-fidelity wind scenario not found: {scenario_id}")
    response = WindForecastResponse(**data)
    await cache.set(cache_key, response.model_dump(), ttl_seconds=3600)
    return response


@router.get("/high-fidelity/metadata")
async def get_high_fidelity_metadata(
    scenario_id: str = Query(..., description="Scenario ID"),
):
    """Get metadata for a high-fidelity scenario (model, run_time, bbox, resolution)."""
    data = load_metadata(scenario_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"High-fidelity metadata not found: {scenario_id}")
    return data


@router.get("/high-fidelity/export")
async def get_high_fidelity_export(
    scenario_id: str = Query(..., description="Scenario ID"),
    export_format: str = Query("json", alias="format", description="Export format: csv or json"),
):
    """Export high-fidelity scenario as table (cells/polygons summary). CSV or JSON."""
    import csv
    import io
    rows = load_export_rows(scenario_id)
    if rows is None:
        raise HTTPException(status_code=404, detail=f"High-fidelity scenario not found: {scenario_id}")
    if export_format == "csv":
        out = io.StringIO()
        if rows:
            writer = csv.DictWriter(out, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        return Response(
            content=out.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=high_fidelity_{scenario_id}.csv"},
        )
    return rows


@router.get("/heat-forecast", response_model=HeatForecastResponse)
async def get_heat_forecast(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    days: int = Query(7, ge=1, le=16),
    include_polygon: bool = Query(True),
):
    """Heat stress / extreme heat forecast (Open-Meteo). Polygon for 3D layer «Жара»."""
    cache = await get_cache()
    cache_key = f"climate:heat:{latitude:.2f}:{longitude:.2f}:{days}:{include_polygon}"
    cached = await cache.get(cache_key)
    if cached:
        return HeatForecastResponse(**cached)
    try:
        result = await climate_anomalies_service.get_heat_forecast(latitude, longitude, days=days, include_polygon=include_polygon)
        response = HeatForecastResponse(
            latitude=result.latitude,
            longitude=result.longitude,
            days=result.days,
            daily=[HeatDayResponse(date=d.date, max_temp_c=d.max_temp_c, risk_level=d.risk_level) for d in result.daily],
            max_temp_c=result.max_temp_c,
            max_risk_level=result.max_risk_level,
            polygon=result.polygon,
            source=result.source,
        )
        await cache.set(cache_key, response.model_dump(), ttl_seconds=3600)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/heavy-rain-forecast", response_model=HeavyRainForecastResponse)
async def get_heavy_rain_forecast(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    days: int = Query(7, ge=1, le=16),
    include_polygon: bool = Query(True),
):
    """Heavy rain / precipitation forecast (Open-Meteo). Polygon for 3D layer «Ливни»."""
    cache = await get_cache()
    cache_key = f"climate:heavy_rain:{latitude:.2f}:{longitude:.2f}:{days}:{include_polygon}"
    cached = await cache.get(cache_key)
    if cached:
        return HeavyRainForecastResponse(**cached)
    try:
        result = await climate_anomalies_service.get_heavy_rain_forecast(latitude, longitude, days=days, include_polygon=include_polygon)
        response = HeavyRainForecastResponse(
            latitude=result.latitude,
            longitude=result.longitude,
            days=result.days,
            daily=[HeavyRainDayResponse(date=d.date, precipitation_mm=d.precipitation_mm, risk_level=d.risk_level) for d in result.daily],
            max_precipitation_mm=result.max_precipitation_mm,
            max_risk_level=result.max_risk_level,
            polygon=result.polygon,
            source=result.source,
        )
        await cache.set(cache_key, response.model_dump(), ttl_seconds=3600)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drought-forecast", response_model=DroughtForecastResponse)
async def get_drought_forecast(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    include_polygon: bool = Query(True),
):
    """Drought risk from climate indicators (Open-Meteo). Polygon for 3D layer «Засуха»."""
    cache = await get_cache()
    cache_key = f"climate:drought:{latitude:.2f}:{longitude:.2f}:{include_polygon}"
    cached = await cache.get(cache_key)
    if cached:
        return DroughtForecastResponse(**cached)
    try:
        result = await climate_anomalies_service.get_drought_forecast(latitude, longitude, include_polygon=include_polygon)
        response = DroughtForecastResponse(
            latitude=result.latitude,
            longitude=result.longitude,
            drought_risk=result.drought_risk,
            value_mm_30d=result.value_mm_30d,
            polygon=result.polygon,
            source=result.source,
        )
        await cache.set(cache_key, response.model_dump(), ttl_seconds=3600)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/uv-forecast", response_model=UvForecastResponse)
async def get_uv_forecast(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    days: int = Query(7, ge=1, le=16),
    include_polygon: bool = Query(True),
):
    """UV index forecast (Open-Meteo). Polygon for 3D layer «УФ»."""
    cache = await get_cache()
    cache_key = f"climate:uv:{latitude:.2f}:{longitude:.2f}:{days}:{include_polygon}"
    cached = await cache.get(cache_key)
    if cached:
        return UvForecastResponse(**cached)
    try:
        result = await climate_anomalies_service.get_uv_forecast(latitude, longitude, days=days, include_polygon=include_polygon)
        response = UvForecastResponse(
            latitude=result.latitude,
            longitude=result.longitude,
            days=result.days,
            daily=[UvDayResponse(date=d.date, max_uv=d.max_uv, risk_level=d.risk_level) for d in result.daily],
            max_uv=result.max_uv,
            max_risk_level=result.max_risk_level,
            polygon=result.polygon,
            source=result.source,
        )
        await cache.set(cache_key, response.model_dump(), ttl_seconds=3600)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Approximate distance in km between two points."""
    import math
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@router.get("/metro-flood", response_model=MetroFloodResponse)
async def get_metro_flood(
    latitude: float = Query(..., ge=-90, le=90, description="Center latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Center longitude"),
    radius_km: float = Query(15, ge=1, le=50, description="Radius to include metro entrances (km)"),
):
    """
    Get metro/subway entrances with flood depth for 3D visualization.

    Returns entrances within radius_km of (latitude, longitude). flood_depth_m
    is from Open-Meteo flood forecast at center (same for all in this MVP).
    """
    try:
        flood = await flood_impact_service.get_flood_forecast(
            latitude=latitude,
            longitude=longitude,
            days=7,
            include_polygon=False,
        )
        depth_m = flood.max_flood_depth_m
    except Exception:
        depth_m = 0.0

    entrances = []
    for name, lat, lon in _METRO_ENTRANCES:
        if _haversine_km(latitude, longitude, lat, lon) <= radius_km:
            entrances.append(
                MetroEntranceResponse(lat=lat, lon=lon, name=name, flood_depth_m=round(depth_m, 2))
            )
    return MetroFloodResponse(entrances=entrances, source="open_meteo")


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
