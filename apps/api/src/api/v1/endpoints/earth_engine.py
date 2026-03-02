"""Google Earth Engine data API — climate, flood, elevation, land use."""
from fastapi import APIRouter, Query

from src.services.external.google_earth_engine_client import earth_engine_client

router = APIRouter(tags=["Earth Engine"])


@router.get("/status")
async def earth_engine_status():
    """Return whether Earth Engine is configured, enabled, and actually initialized."""
    enabled = earth_engine_client.enabled
    initialized = earth_engine_client.initialized
    if not enabled:
        msg = "Configure GCLOUD_PROJECT_ID and GCLOUD_SERVICE_ACCOUNT_JSON — see docs/EARTH_ENGINE_SETUP.md"
    elif not initialized:
        msg = "Config OK but EE not initialized — data is mock. Run: gcloud auth application-default login; ensure earthengine-api is installed and project is registered for Earth Engine."
    else:
        msg = "Earth Engine ready — real data."
    return {
        "enabled": enabled,
        "initialized": initialized,
        "project_id": earth_engine_client.project_id if enabled else None,
        "message": msg,
    }


@router.get("/climate")
async def earth_engine_climate(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_m: int = Query(5000, ge=100, le=50000),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    """Get climate data (ERA5 temperature, MODIS NDVI) for a point from Earth Engine."""
    return await earth_engine_client.get_climate_data(lat, lng, radius_m, start_date, end_date)


@router.get("/flood-risk")
async def earth_engine_flood_risk(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """Get flood occurrence (JRC Global Surface Water) for a point from Earth Engine."""
    return await earth_engine_client.get_flood_risk(lat, lng)


@router.get("/water-index")
async def earth_engine_water_index(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_m: int = Query(5000, ge=100, le=50000),
    date: str | None = Query(None, description="Date for image (YYYY-MM-DD); default recent"),
):
    """Get MNDWI/NDWI water index at point (Landsat 8). Tutorial #12."""
    return await earth_engine_client.get_water_index(lat, lng, radius_m, date)


@router.get("/flood-extent")
async def earth_engine_flood_extent(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_m: int = Query(5000, ge=100, le=50000),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    """Detect water surface / flood extent over period (JRC GSW). Tutorial #1."""
    return await earth_engine_client.get_flood_extent(lat, lng, radius_m, start_date, end_date)


@router.get("/elevation")
async def earth_engine_elevation(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """Get elevation (SRTM) for a point from Earth Engine."""
    return await earth_engine_client.get_elevation(lat, lng)


@router.get("/land-use")
async def earth_engine_land_use(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """Get land use class (Dynamic World) for a point from Earth Engine."""
    return await earth_engine_client.get_land_use(lat, lng)


@router.get("/precipitation")
async def earth_engine_precipitation(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_m: int = Query(5000, ge=100, le=50000),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    """Get precipitation (CHIRPS daily) — mean and total over period."""
    return await earth_engine_client.get_precipitation(lat, lng, radius_m, start_date, end_date)


@router.get("/drought")
async def earth_engine_drought(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_m: int = Query(5000, ge=100, le=50000),
):
    """Get drought indicator (TerraClimate PDSI), soil moisture, severity and percentile. Tutorial #4."""
    return await earth_engine_client.get_drought(lat, lng, radius_m)


@router.get("/water-stress")
async def earth_engine_water_stress(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_m: int = Query(5000, ge=100, le=50000),
):
    """Get water stress index (TerraClimate soil/deficit). Tutorials #17, #18."""
    return await earth_engine_client.get_water_stress(lat, lng, radius_m)


@router.get("/wildfire")
async def earth_engine_wildfire(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_km: int = Query(10, ge=1, le=100),
    days: int = Query(365, ge=30, le=730),
):
    """Get wildfire activity (MODIS thermal anomalies) — fire pixel count in buffer."""
    return await earth_engine_client.get_wildfire(lat, lng, radius_km * 1000, days)


@router.get("/historical-climate")
async def earth_engine_historical_climate(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    start_year: int = Query(1990, ge=1958, le=2024),
    end_year: int | None = Query(None, ge=1958, le=2024),
    radius_m: int = Query(5000, ge=100, le=50000),
):
    """Get historical climate by year (TerraClimate): temp, precipitation, PDSI, drought months and extremes."""
    return await earth_engine_client.get_historical_climate(lat, lng, start_year, end_year, radius_m)


@router.get("/temperature-anomaly")
async def earth_engine_temperature_anomaly(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_m: int = Query(5000, ge=100, le=50000),
    baseline_start_year: int = Query(1990, ge=1958, le=2020),
    baseline_end_year: int = Query(2020, ge=1990, le=2024),
):
    """Current 12-month mean temperature minus baseline mean (TerraClimate). Tutorial #11."""
    return await earth_engine_client.get_temperature_anomaly(lat, lng, radius_m, baseline_start_year, baseline_end_year)


@router.get("/wind")
async def earth_engine_wind(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_m: int = Query(5000, ge=100, le=50000),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    """Mean wind u/v, speed and direction (ERA5 10m). Tutorial #10."""
    return await earth_engine_client.get_wind(lat, lng, radius_m, start_date, end_date)
