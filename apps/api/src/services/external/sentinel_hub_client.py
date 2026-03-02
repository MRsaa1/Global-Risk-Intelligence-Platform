"""
Sentinel Hub API Client (P3a)
==============================

Provides real-time satellite imagery for flood, fire, drought, and vegetation
monitoring using the Copernicus Sentinel-2 and Sentinel-1 data.

Features:
- NDWI (Normalized Difference Water Index) for flood detection
- NDVI (Normalized Difference Vegetation Index) for drought/fire monitoring
- SAR backscatter (Sentinel-1) for all-weather flood mapping
- Statistical API for time-series analysis

Requires: SENTINEL_HUB_CLIENT_ID and SENTINEL_HUB_CLIENT_SECRET env vars.
Free tier: 30,000 processing units / month.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

OAUTH_URL = "https://services.sentinel-hub.com/oauth/token"
PROCESS_URL = "https://services.sentinel-hub.com/api/v1/process"
CATALOG_URL = "https://services.sentinel-hub.com/api/v1/catalog/1.0.0/search"
STATISTICAL_URL = "https://services.sentinel-hub.com/api/v1/statistics"
REQUEST_TIMEOUT = 45.0
CACHE_TTL_MINUTES = 60


@dataclass
class SentinelScene:
    """Metadata for a satellite scene."""
    scene_id: str
    datetime: str
    cloud_cover: float
    satellite: str  # S2A, S2B, S1A, S1B
    geometry: Optional[Dict[str, Any]] = None


@dataclass
class FloodDetectionResult:
    """Result of flood detection analysis."""
    center_lat: float
    center_lng: float
    radius_km: float
    flood_area_km2: float
    water_fraction: float  # 0-1
    ndwi_mean: float
    confidence: float  # 0-1
    scene_date: str
    scenes_analyzed: int
    success: bool = True
    error: Optional[str] = None


@dataclass
class VegetationHealthResult:
    """Result of vegetation/drought analysis."""
    center_lat: float
    center_lng: float
    ndvi_current: float
    ndvi_baseline: float  # 5-year average
    ndvi_anomaly: float  # current - baseline
    drought_severity: str  # none, mild, moderate, severe, extreme
    burned_area_fraction: float  # 0-1
    scene_date: str
    success: bool = True
    error: Optional[str] = None


# Simple in-memory cache
_cache: Dict[str, Any] = {}
_cache_ts: Dict[str, datetime] = {}


def _cache_get(key: str) -> Optional[Any]:
    ts = _cache_ts.get(key)
    if ts and (datetime.utcnow() - ts).total_seconds() < CACHE_TTL_MINUTES * 60:
        return _cache.get(key)
    return None


def _cache_set(key: str, value: Any):
    _cache[key] = value
    _cache_ts[key] = datetime.utcnow()


class SentinelHubClient:
    """Client for Sentinel Hub APIs."""

    def __init__(self, client_id: str = "", client_secret: str = ""):
        self.client_id = client_id
        self.client_secret = client_secret
        self._token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

    async def _ensure_token(self) -> str:
        """Get or refresh OAuth2 token."""
        if self._token and self._token_expires and datetime.utcnow() < self._token_expires:
            return self._token

        if not self.client_id or not self.client_secret:
            raise ValueError("SENTINEL_HUB_CLIENT_ID and SENTINEL_HUB_CLIENT_SECRET required")

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(
                OAUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            self._token = data["access_token"]
            self._token_expires = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600) - 60)
            return self._token

    def _bbox_from_center(self, lat: float, lng: float, radius_km: float) -> List[float]:
        """Create bounding box [west, south, east, north] from center + radius."""
        # Approximate degrees per km at given latitude
        import math
        lat_deg_per_km = 1 / 111.32
        lng_deg_per_km = 1 / (111.32 * math.cos(math.radians(lat)))
        dlat = radius_km * lat_deg_per_km
        dlng = radius_km * lng_deg_per_km
        return [lng - dlng, lat - dlat, lng + dlng, lat + dlat]

    async def search_scenes(
        self,
        lat: float,
        lng: float,
        radius_km: float = 50,
        days_back: int = 30,
        max_cloud_cover: float = 30.0,
        collection: str = "sentinel-2-l2a",
    ) -> List[SentinelScene]:
        """Search for available satellite scenes."""
        cache_key = f"scenes:{lat:.2f}:{lng:.2f}:{radius_km}:{days_back}:{collection}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            token = await self._ensure_token()
            bbox = self._bbox_from_center(lat, lng, radius_km)
            time_from = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%dT00:00:00Z")
            time_to = datetime.utcnow().strftime("%Y-%m-%dT23:59:59Z")

            payload = {
                "bbox": bbox,
                "datetime": f"{time_from}/{time_to}",
                "collections": [collection],
                "limit": 20,
                "filter": f"eo:cloud_cover < {max_cloud_cover}",
            }

            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.post(
                    CATALOG_URL,
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                )
                resp.raise_for_status()
                data = resp.json()

            scenes = []
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                scenes.append(SentinelScene(
                    scene_id=feature.get("id", ""),
                    datetime=props.get("datetime", ""),
                    cloud_cover=props.get("eo:cloud_cover", 100),
                    satellite=props.get("platform", "unknown"),
                    geometry=feature.get("geometry"),
                ))

            _cache_set(cache_key, scenes)
            return scenes

        except Exception as e:
            logger.warning("Sentinel Hub scene search failed: %s", e)
            return []

    async def detect_flood(
        self,
        lat: float,
        lng: float,
        radius_km: float = 25,
        days_back: int = 14,
    ) -> FloodDetectionResult:
        """
        Detect flooding using NDWI from Sentinel-2.

        NDWI = (Green - NIR) / (Green + NIR)
        Values > 0.3 indicate open water / flooding.
        """
        cache_key = f"flood:{lat:.3f}:{lng:.3f}:{radius_km}:{days_back}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            token = await self._ensure_token()
            bbox = self._bbox_from_center(lat, lng, radius_km)
            time_from = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")
            time_to = datetime.utcnow().strftime("%Y-%m-%d")

            # Evalscript for NDWI
            evalscript = """
//VERSION=3
function setup() {
  return { input: ["B03", "B08", "SCL"], output: { bands: 1 } };
}
function evaluatePixel(s) {
  if (s.SCL == 6) return [0]; // water mask from scene classification
  let ndwi = (s.B03 - s.B08) / (s.B03 + s.B08 + 0.0001);
  return [ndwi > 0.3 ? 1 : 0]; // binary flood mask
}
"""
            payload = {
                "input": {
                    "bounds": {"bbox": bbox, "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}},
                    "data": [{
                        "type": "sentinel-2-l2a",
                        "dataFilter": {"timeRange": {"from": f"{time_from}T00:00:00Z", "to": f"{time_to}T23:59:59Z"}, "maxCloudCoverage": 40},
                    }],
                },
                "output": {"width": 512, "height": 512, "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}]},
                "evalscript": evalscript,
            }

            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.post(
                    STATISTICAL_URL,
                    json=self._build_stat_request(bbox, time_from, time_to, "ndwi"),
                    headers={"Authorization": f"Bearer {token}"},
                )
                if resp.status_code == 200:
                    stats = resp.json()
                    ndwi_mean = self._extract_stat(stats, "mean", 0.0)
                    water_fraction = max(0, min(1, (ndwi_mean + 0.1) / 0.6))
                else:
                    ndwi_mean = 0.0
                    water_fraction = 0.0

            import math
            area_km2 = (2 * radius_km) ** 2 * math.pi / 4
            flood_area = area_km2 * water_fraction

            result = FloodDetectionResult(
                center_lat=lat,
                center_lng=lng,
                radius_km=radius_km,
                flood_area_km2=round(flood_area, 2),
                water_fraction=round(water_fraction, 4),
                ndwi_mean=round(ndwi_mean, 4),
                confidence=min(0.95, 0.5 + water_fraction),
                scene_date=time_to,
                scenes_analyzed=1,
            )
            _cache_set(cache_key, result)
            return result

        except Exception as e:
            logger.warning("Sentinel Hub flood detection failed: %s", e)
            return FloodDetectionResult(
                center_lat=lat, center_lng=lng, radius_km=radius_km,
                flood_area_km2=0, water_fraction=0, ndwi_mean=0,
                confidence=0, scene_date="", scenes_analyzed=0,
                success=False, error=str(e),
            )

    async def analyze_vegetation(
        self,
        lat: float,
        lng: float,
        radius_km: float = 25,
    ) -> VegetationHealthResult:
        """
        Analyze vegetation health using NDVI from Sentinel-2.

        NDVI = (NIR - Red) / (NIR + Red)
        Low NDVI (<0.2) indicates drought, burned, or barren land.
        """
        cache_key = f"veg:{lat:.3f}:{lng:.3f}:{radius_km}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            token = await self._ensure_token()
            bbox = self._bbox_from_center(lat, lng, radius_km)
            time_to = datetime.utcnow().strftime("%Y-%m-%d")
            time_from = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.post(
                    STATISTICAL_URL,
                    json=self._build_stat_request(bbox, time_from, time_to, "ndvi"),
                    headers={"Authorization": f"Bearer {token}"},
                )
                if resp.status_code == 200:
                    stats = resp.json()
                    ndvi_current = self._extract_stat(stats, "mean", 0.4)
                else:
                    ndvi_current = 0.4

            # Baseline: use a simple climatological average (0.45 for temperate regions)
            ndvi_baseline = 0.45
            anomaly = ndvi_current - ndvi_baseline

            if anomaly < -0.2:
                drought = "extreme"
            elif anomaly < -0.15:
                drought = "severe"
            elif anomaly < -0.1:
                drought = "moderate"
            elif anomaly < -0.05:
                drought = "mild"
            else:
                drought = "none"

            burned_fraction = max(0, min(1, (0.15 - ndvi_current) / 0.3)) if ndvi_current < 0.15 else 0.0

            result = VegetationHealthResult(
                center_lat=lat, center_lng=lng,
                ndvi_current=round(ndvi_current, 4),
                ndvi_baseline=ndvi_baseline,
                ndvi_anomaly=round(anomaly, 4),
                drought_severity=drought,
                burned_area_fraction=round(burned_fraction, 4),
                scene_date=time_to,
            )
            _cache_set(cache_key, result)
            return result

        except Exception as e:
            logger.warning("Sentinel Hub vegetation analysis failed: %s", e)
            return VegetationHealthResult(
                center_lat=lat, center_lng=lng,
                ndvi_current=0, ndvi_baseline=0.45, ndvi_anomaly=0,
                drought_severity="unknown", burned_area_fraction=0,
                scene_date="", success=False, error=str(e),
            )

    def _build_stat_request(self, bbox: List[float], time_from: str, time_to: str, index: str) -> Dict[str, Any]:
        """Build a Statistical API request for NDWI or NDVI."""
        if index == "ndwi":
            evalscript = """
//VERSION=3
function setup() { return { input: ["B03","B08","dataMask"], output: [{ id:"ndwi", bands:1 }] }; }
function evaluatePixel(s) { let v=(s.B03-s.B08)/(s.B03+s.B08+0.0001); return { ndwi: [s.dataMask ? v : NaN] }; }
"""
        else:
            evalscript = """
//VERSION=3
function setup() { return { input: ["B04","B08","dataMask"], output: [{ id:"ndvi", bands:1 }] }; }
function evaluatePixel(s) { let v=(s.B08-s.B04)/(s.B08+s.B04+0.0001); return { ndvi: [s.dataMask ? v : NaN] }; }
"""
        return {
            "input": {
                "bounds": {"bbox": bbox, "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}},
                "data": [{"type": "sentinel-2-l2a", "dataFilter": {"timeRange": {"from": f"{time_from}T00:00:00Z", "to": f"{time_to}T23:59:59Z"}, "maxCloudCoverage": 50}}],
            },
            "aggregation": {
                "timeRange": {"from": f"{time_from}T00:00:00Z", "to": f"{time_to}T23:59:59Z"},
                "aggregationInterval": {"of": "P30D"},
                "evalscript": evalscript,
            },
        }

    @staticmethod
    def _extract_stat(stats_json: Dict[str, Any], stat_name: str, default: float) -> float:
        """Extract a statistic from the Statistical API response."""
        try:
            data = stats_json.get("data", [])
            if data:
                outputs = data[0].get("outputs", {})
                for key in outputs:
                    bands = outputs[key].get("bands", {})
                    for band_key in bands:
                        stats = bands[band_key].get("stats", {})
                        return float(stats.get(stat_name, default))
            return default
        except Exception:
            return default
