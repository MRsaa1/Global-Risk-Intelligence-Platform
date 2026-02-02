"""
High-Fidelity Scenario Schemas (ETL ↔ API contract).

Shared Pydantic models for WRF/ADCIRC ETL output and Layer 4 API responses.
Cesium and UE5 consume the same response shape as Open-Meteo flood/wind endpoints.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


# --- Flood (compatible with FloodForecastResponse) ---

class HighFidelityFloodDay(BaseModel):
    """Flood forecast for a single day (high-fidelity)."""
    date: str
    precipitation_mm: float = 0.0
    flood_depth_m: float
    risk_level: str  # normal | elevated | high | critical


class HighFidelityFloodPayload(BaseModel):
    """Flood scenario payload from ETL (WRF/ADCIRC). Same shape as FloodForecastResponse."""
    latitude: float
    longitude: float
    days: int = 1
    daily: List[HighFidelityFloodDay] = Field(default_factory=list)
    max_flood_depth_m: float
    max_risk_level: str
    polygon: Optional[List[List[float]]] = None  # [[lng, lat], ...]
    source: str = Field(..., pattern="^(wrf|adcirc)$")
    scenario_id: Optional[str] = None
    valid_time: Optional[str] = None  # ISO datetime


# --- Wind (compatible with WindForecastResponse) ---

class HighFidelityWindDay(BaseModel):
    """Wind forecast for a single day (high-fidelity)."""
    date: str
    wind_speed_kmh: float
    category: int  # 0 = Tropical Storm, 1-5 = Hurricane
    category_label: str


class HighFidelityWindPayload(BaseModel):
    """Wind scenario payload from ETL (WRF/ADCIRC). Same shape as WindForecastResponse."""
    latitude: float
    longitude: float
    days: int = 1
    daily: List[HighFidelityWindDay] = Field(default_factory=list)
    max_wind_kmh: float
    max_category: int
    max_category_label: str
    polygon: Optional[List[List[float]]] = None
    source: str = Field(..., pattern="^(wrf|adcirc)$")
    scenario_id: Optional[str] = None
    valid_time: Optional[str] = None


# --- Metadata (ETL catalog) ---

class HighFidelityScenarioMetadata(BaseModel):
    """Metadata for a high-fidelity scenario (stored as metadata.json by ETL)."""
    scenario_id: str
    model: str = Field(..., pattern="^(wrf|adcirc)$")
    run_time: str  # ISO datetime
    bbox: List[float] = Field(..., min_length=4, max_length=4)  # [min_lon, min_lat, max_lon, max_lat]
    resolution: Optional[str] = None  # e.g. "1km", "500m"
    description: Optional[str] = None
    has_flood: bool = True
    has_wind: bool = False
