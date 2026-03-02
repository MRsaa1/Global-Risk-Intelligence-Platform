"""
Google Earth Engine client for climate, terrain, and flood data.

Authenticates via:
  - Service account (JSON key path or inline JSON), or
  - Application Default Credentials (ADC) when key creation is disabled by org policy.
Falls back to mock data when credentials are not configured.
"""
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from src.core.config import settings

logger = logging.getLogger(__name__)


def _parse_service_account(value: str) -> Tuple[str, Optional[str], Optional[str]]:
    """
    Parse GCLOUD_SERVICE_ACCOUNT_JSON: path to .json file or inline JSON string.
    Returns (client_email, key_file_path, key_data).
    """
    if not value or not value.strip():
        return "", None, None
    value = value.strip()
    if value.startswith("{") and "client_email" in value:
        try:
            data = json.loads(value)
            email = (data.get("client_email") or "").strip()
            return email, None, value
        except json.JSONDecodeError:
            return "", None, None
    path = Path(value)
    if path.is_file():
        try:
            with open(path, "r") as f:
                data = json.load(f)
            email = (data.get("client_email") or "").strip()
            return email, value, None
        except Exception:
            return "", None, None
    return "", None, None


class EarthEngineClient:
    """Client for Google Earth Engine data access."""

    def __init__(self):
        self.project_id = getattr(settings, "gcloud_project_id", "") or ""
        self.service_account_json = getattr(settings, "gcloud_service_account_json", "") or ""
        self._initialized = False
        self._service_account_email = ""

    @property
    def enabled(self) -> bool:
        if not getattr(settings, "enable_earth_engine", True):
            return False
        # Enabled if we have project and (service account key OR we will try ADC)
        if not self.project_id:
            return False
        email, path, data = _parse_service_account(self.service_account_json)
        if path or data:
            return bool(email)
        # No key: allow ADC (e.g. when org policy blocks key creation)
        return True

    @property
    def initialized(self) -> bool:
        """True if EE is actually initialized and real data will be returned."""
        self._initialize()
        return self._initialized

    def _initialize(self):
        if self._initialized:
            return
        if not self.project_id:
            logger.info("Earth Engine: no GCLOUD_PROJECT_ID, using mock data")
            return
        try:
            import ee
        except ImportError:
            logger.warning("Earth Engine: earthengine-api not installed. pip install earthengine-api or pip install -e .[earth_engine]")
            return

        email, key_path, key_data = _parse_service_account(self.service_account_json)
        if email and (key_path or key_data):
            # Service account key
            self._service_account_email = email
            try:
                if key_path:
                    credentials = ee.ServiceAccountCredentials(email, key_file_path=key_path)
                else:
                    credentials = ee.ServiceAccountCredentials(email, key_data=key_data)
                ee.Initialize(credentials=credentials, project=self.project_id)
                self._initialized = True
                logger.info("Earth Engine initialized for project %s (service account)", self.project_id)
            except Exception as e:
                logger.warning("Earth Engine init failed: %s", e)
            return

        # No key: use Application Default Credentials (e.g. gcloud auth application-default login)
        try:
            ee.Initialize(project=self.project_id)
            self._initialized = True
            logger.info("Earth Engine initialized for project %s (ADC)", self.project_id)
        except Exception as e:
            logger.warning(
                "Earth Engine ADC init failed: %s. Run: gcloud auth application-default login",
                e,
            )

    async def get_climate_data(
        self,
        lat: float,
        lng: float,
        radius_m: int = 5000,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get climate data for a point (temperature, precipitation, vegetation)."""
        self._initialize()
        if not self._initialized:
            return self._mock_climate(lat, lng)

        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            sd = start_date or (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d")
            ed = end_date or datetime.utcnow().strftime("%Y-%m-%d")

            # ERA5 Land temperature
            era5 = ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR").filterDate(sd, ed)
            temp = era5.select("temperature_2m").mean().reduceRegion(
                reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=1000
            ).getInfo()

            # MODIS vegetation
            ndvi = ee.ImageCollection("MODIS/061/MOD13Q1").filterDate(sd, ed)
            veg = ndvi.select("NDVI").mean().reduceRegion(
                reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=250
            ).getInfo()

            return {
                "source": "google_earth_engine",
                "lat": lat, "lng": lng,
                "temperature_2m_k": temp.get("temperature_2m"),
                "ndvi": (veg.get("NDVI") or 0) / 10000.0,
                "period": {"start": sd, "end": ed},
            }
        except Exception as e:
            logger.warning("EE query failed: %s", e)
            return self._mock_climate(lat, lng)

    async def get_flood_risk(self, lat: float, lng: float) -> Dict[str, Any]:
        """Get flood risk data from JRC Global Surface Water."""
        self._initialize()
        if not self._initialized:
            return {"source": "mock", "lat": lat, "lng": lng, "flood_occurrence_pct": 15.0, "max_extent": True}
        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
            occ = jrc.select("occurrence").reduceRegion(
                reducer=ee.Reducer.mean(), geometry=point.buffer(1000), scale=30
            ).getInfo()
            return {
                "source": "jrc_global_surface_water",
                "lat": lat, "lng": lng,
                "flood_occurrence_pct": occ.get("occurrence", 0),
            }
        except Exception as e:
            logger.warning("EE flood query failed: %s", e)
            return {"source": "mock", "lat": lat, "lng": lng, "flood_occurrence_pct": 15.0}

    async def get_water_index(
        self,
        lat: float,
        lng: float,
        radius_m: int = 5000,
        date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get MNDWI/NDWI water index at point (Sentinel-2 or Landsat). Tutorial #12."""
        self._initialize()
        if not self._initialized:
            return {"source": "mock", "lat": lat, "lng": lng, "mndwi": 0.1, "ndwi": 0.05, "water_index": 0.1, "date": date or datetime.utcnow().strftime("%Y-%m-%d")}
        try:
            import ee
            point = ee.Geometry.Point([lng, lat]).buffer(radius_m)
            target_date = date or datetime.utcnow().strftime("%Y-%m-%d")
            # Use Landsat 8 for broad availability (green, nir, swir)
            col = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2").filterBounds(point).filterDate(
                (datetime.strptime(target_date, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d"),
                (datetime.strptime(target_date, "%Y-%m-%d") + timedelta(days=5)).strftime("%Y-%m-%d"),
            ).sort("CLOUD_COVER", True).first()
            green = col.select("SR_B3").multiply(0.0000275).add(-0.2)
            nir = col.select("SR_B5").multiply(0.0000275).add(-0.2)
            swir = col.select("SR_B6").multiply(0.0000275).add(-0.2)
            ndwi = green.subtract(nir).divide(green.add(nir)).rename("NDWI")
            mndwi = green.subtract(swir).divide(green.add(swir)).rename("MNDWI")
            reg = ee.Image.cat([ndwi, mndwi]).reduceRegion(reducer=ee.Reducer.mean(), geometry=point, scale=30, maxPixels=1e6).getInfo()
            ndwi_val = reg.get("NDWI")
            mndwi_val = reg.get("MNDWI")
            if ndwi_val is not None:
                ndwi_val = round(float(ndwi_val), 4)
            if mndwi_val is not None:
                mndwi_val = round(float(mndwi_val), 4)
            water_index = mndwi_val if mndwi_val is not None else ndwi_val
            return {
                "source": "landsat8",
                "lat": lat, "lng": lng,
                "mndwi": mndwi_val,
                "ndwi": ndwi_val,
                "water_index": water_index,
                "date": target_date,
                "note": "MNDWI/NDWI > 0 often indicates water; higher values more water",
            }
        except Exception as e:
            logger.warning("EE water index query failed: %s", e)
            return {"source": "mock", "lat": lat, "lng": lng, "mndwi": 0.1, "ndwi": 0.05, "water_index": 0.1, "date": date or datetime.utcnow().strftime("%Y-%m-%d")}

    async def get_flood_extent(
        self,
        lat: float,
        lng: float,
        radius_m: int = 5000,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Detect water surface / flood extent over period (JRC change or water mask). Tutorial #1."""
        self._initialize()
        if not self._initialized:
            ed = end_date or datetime.utcnow().strftime("%Y-%m-%d")
            sd = start_date or (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
            return {"source": "mock", "lat": lat, "lng": lng, "water_pixel_ratio": 0.05, "flood_detected": False, "period": {"start": sd, "end": ed}}
        try:
            import ee
            point = ee.Geometry.Point([lng, lat]).buffer(radius_m)
            sd = start_date or (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
            ed = end_date or datetime.utcnow().strftime("%Y-%m-%d")
            # JRC Global Surface Water — occurrence as proxy for water presence in area
            jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
            occurrence = jrc.select("occurrence")
            reg = occurrence.reduceRegion(reducer=ee.Reducer.mean(), geometry=point, scale=30, maxPixels=1e6).getInfo()
            occ_val = reg.get("occurrence")
            if occ_val is not None:
                occ_val = round(float(occ_val), 2)
            water_ratio = (occ_val / 100.0) if occ_val is not None else 0.0
            flood_detected = water_ratio > 0.1
            return {
                "source": "jrc_gsw",
                "lat": lat, "lng": lng,
                "water_pixel_ratio": water_ratio,
                "flood_detected": flood_detected,
                "occurrence_pct": occ_val,
                "period": {"start": sd, "end": ed},
                "note": "Based on JRC permanent water occurrence; for event-based flood use SAR (Sentinel-1).",
            }
        except Exception as e:
            logger.warning("EE flood extent query failed: %s", e)
            ed = end_date or datetime.utcnow().strftime("%Y-%m-%d")
            sd = start_date or (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
            return {"source": "mock", "lat": lat, "lng": lng, "water_pixel_ratio": 0.05, "flood_detected": False, "period": {"start": sd, "end": ed}}

    async def get_elevation(self, lat: float, lng: float) -> Dict[str, Any]:
        """Get elevation data from SRTM/Copernicus DEM."""
        self._initialize()
        if not self._initialized:
            return {"source": "mock", "lat": lat, "lng": lng, "elevation_m": 50.0}
        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            dem = ee.Image("USGS/SRTMGL1_003")
            elev = dem.reduceRegion(reducer=ee.Reducer.mean(), geometry=point, scale=30).getInfo()
            return {"source": "srtm", "lat": lat, "lng": lng, "elevation_m": elev.get("elevation")}
        except Exception as e:
            return {"source": "mock", "lat": lat, "lng": lng, "elevation_m": 50.0}

    async def get_land_use(self, lat: float, lng: float) -> Dict[str, Any]:
        """Get Dynamic World land use classification."""
        self._initialize()
        if not self._initialized:
            return {"source": "mock", "lat": lat, "lng": lng, "land_class": "built", "confidence": 0.7}
        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterBounds(point).sort("system:time_start", False).first()
            label = dw.select("label").reduceRegion(reducer=ee.Reducer.mode(), geometry=point, scale=10).getInfo()
            classes = ["water", "trees", "grass", "flooded_veg", "crops", "shrub_scrub", "built", "bare", "snow_ice"]
            idx = int(label.get("label", 6))
            return {"source": "dynamic_world", "lat": lat, "lng": lng, "land_class": classes[idx] if idx < len(classes) else "unknown"}
        except Exception as e:
            return {"source": "mock", "lat": lat, "lng": lng, "land_class": "built"}

    async def get_precipitation(
        self,
        lat: float,
        lng: float,
        radius_m: int = 5000,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get precipitation (CHIRPS daily) — mean and total over period."""
        self._initialize()
        if not self._initialized:
            return {"source": "mock", "lat": lat, "lng": lng, "precipitation_mm_day": 2.5, "precipitation_total_mm": 75.0, "days": 30}
        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            sd = start_date or (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
            ed = end_date or datetime.utcnow().strftime("%Y-%m-%d")
            chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate(sd, ed).select("precipitation")
            total = chirps.sum().reduceRegion(reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=5566).getInfo()
            mean_img = chirps.mean()
            mean_val = mean_img.reduceRegion(reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=5566).getInfo()
            pr_total = total.get("precipitation")
            pr_mean = mean_val.get("precipitation")
            return {
                "source": "chirps",
                "lat": lat, "lng": lng,
                "precipitation_total_mm": round(pr_total, 2) if pr_total is not None else None,
                "precipitation_mm_day": round(pr_mean, 2) if pr_mean is not None else None,
                "period": {"start": sd, "end": ed},
            }
        except Exception as e:
            logger.warning("EE precipitation query failed: %s", e)
            return {"source": "mock", "lat": lat, "lng": lng, "precipitation_mm_day": 2.5, "precipitation_total_mm": 75.0}

    async def get_drought(
        self,
        lat: float,
        lng: float,
        radius_m: int = 5000,
    ) -> Dict[str, Any]:
        """Get drought indicator (TerraClimate PDSI), soil moisture, severity and percentile. Tutorial #4."""
        self._initialize()
        if not self._initialized:
            return {
                "source": "mock", "lat": lat, "lng": lng,
                "pdsi": 0.0, "soil_moisture_mm": 100.0,
                "soil_moisture_percentile": 50, "drought_severity_class": "normal",
                "note": "PDSI: < -2 drought, -2 to 2 normal, > 2 wet",
            }
        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            # Latest month
            tc = ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE").filterDate(
                (datetime.utcnow() - timedelta(days=65)).strftime("%Y-%m-%d"),
                datetime.utcnow().strftime("%Y-%m-%d"),
            ).select("pdsi", "soil").sort("system:time_start", False)
            latest = tc.first()
            reg = latest.reduceRegion(reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=4638).getInfo()
            pdsi = reg.get("pdsi")
            soil = reg.get("soil")
            if pdsi is not None and isinstance(pdsi, (int, float)):
                pdsi = round(float(pdsi) * 0.01, 2)
            if soil is not None and isinstance(soil, (int, float)):
                soil = round(float(soil) * 0.1, 1)

            # Soil moisture percentile: get last 10 years of soil, compute percentile of current
            soil_moisture_percentile: Optional[float] = None
            drought_severity_class = "unknown"
            try:
                baseline_start = (datetime.utcnow() - timedelta(days=365 * 10)).strftime("%Y-%m-%d")
                baseline_end = datetime.utcnow().strftime("%Y-%m-%d")
                tc_hist = ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE").filterDate(baseline_start, baseline_end).select("soil")
                soil_hist = tc_hist.map(lambda img: img.multiply(0.1))
                current_soil = float(soil) if soil is not None else 0.0
                percentiles = soil_hist.reduce(ee.Reducer.percentile([5, 25, 50, 75, 95]))
                reg_p = percentiles.reduceRegion(reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=4638).getInfo()
                p50 = reg_p.get("soil_p50")
                p25 = reg_p.get("soil_p25")
                p75 = reg_p.get("soil_p75")
                if p50 is not None and current_soil is not None:
                    if float(p50) > 0:
                        soil_moisture_percentile = round(min(100, max(0, (current_soil / float(p50)) * 50)), 1)
                    if p25 is not None and p75 is not None:
                        p25v, p75v = float(p25), float(p75)
                        if current_soil <= p25v:
                            drought_severity_class = "severe" if current_soil < p25v * 0.5 else "moderate"
                        elif current_soil >= p75v:
                            drought_severity_class = "wet"
                        else:
                            drought_severity_class = "normal"
            except Exception:
                pass
            if drought_severity_class == "unknown" and pdsi is not None:
                if pdsi < -3:
                    drought_severity_class = "severe"
                elif pdsi < -2:
                    drought_severity_class = "moderate"
                elif pdsi < -1:
                    drought_severity_class = "mild"
                elif pdsi > 2:
                    drought_severity_class = "wet"
                else:
                    drought_severity_class = "normal"

            return {
                "source": "terraclimate",
                "lat": lat, "lng": lng,
                "pdsi": pdsi,
                "soil_moisture_mm": soil,
                "soil_moisture_percentile": soil_moisture_percentile,
                "drought_severity_class": drought_severity_class,
                "note": "PDSI: < -2 drought, -2 to 2 normal, > 2 wet",
            }
        except Exception as e:
            logger.warning("EE drought query failed: %s", e)
            return {"source": "mock", "lat": lat, "lng": lng, "pdsi": 0.0, "soil_moisture_mm": 100.0, "soil_moisture_percentile": None, "drought_severity_class": "unknown"}

    async def get_water_stress(self, lat: float, lng: float, radius_m: int = 5000) -> Dict[str, Any]:
        """Get water stress index (TerraClimate AET/PET proxy or soil deficit). Tutorials #17, #18."""
        self._initialize()
        if not self._initialized:
            return {"source": "mock", "lat": lat, "lng": lng, "stress_index": 0.3, "note": "Water stress 0–1; higher = more stress."}
        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            tc = ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE").filterDate(
                (datetime.utcnow() - timedelta(days=65)).strftime("%Y-%m-%d"),
                datetime.utcnow().strftime("%Y-%m-%d"),
            ).select("soil", "def").sort("system:time_start", False)
            latest = tc.first()
            reg = latest.reduceRegion(reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=4638).getInfo()
            soil = reg.get("soil")
            def_val = reg.get("def")
            if soil is not None:
                soil = float(soil) * 0.1
            if def_val is not None:
                def_val = float(def_val)
            stress = 0.5
            if soil is not None and def_val is not None:
                if soil < 50 and def_val > 50:
                    stress = min(1.0, 0.3 + (def_val / 200))
                elif soil >= 100:
                    stress = 0.2
            return {
                "source": "terraclimate",
                "lat": lat, "lng": lng,
                "stress_index": round(stress, 3),
                "soil_moisture_mm": round(soil, 1) if soil is not None else None,
                "climate_deficit_mm": round(def_val, 1) if def_val is not None else None,
                "note": "Water stress 0–1; higher = more stress. Based on soil moisture and climate deficit.",
            }
        except Exception as e:
            logger.warning("EE water stress query failed: %s", e)
            return {"source": "mock", "lat": lat, "lng": lng, "stress_index": 0.3, "note": "Water stress 0–1; higher = more stress."}

    async def get_temperature_anomaly(
        self,
        lat: float,
        lng: float,
        radius_m: int = 5000,
        baseline_start_year: int = 1990,
        baseline_end_year: int = 2020,
    ) -> Dict[str, Any]:
        """Current 12-month mean temperature minus baseline mean. Tutorial #11."""
        self._initialize()
        if not self._initialized:
            return {
                "source": "mock", "lat": lat, "lng": lng,
                "anomaly_c": 0.5, "current_period_mean_c": 15.0, "baseline_mean_c": 14.5,
                "baseline_period": {"start_year": baseline_start_year, "end_year": baseline_end_year},
            }
        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            now = datetime.utcnow()
            current_start = (now - timedelta(days=365)).strftime("%Y-%m-%d")
            current_end = now.strftime("%Y-%m-%d")
            tc_current = ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE").filterDate(current_start, current_end).select("tmmx", "tmmn")
            current_mean_img = tc_current.map(lambda img: img.select("tmmx").add(img.select("tmmn")).divide(2)).mean().multiply(0.1)
            current_reg = current_mean_img.reduceRegion(reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=4638).getInfo()
            current_mean = current_reg.get("tmmx")
            if current_mean is not None:
                current_mean = round(float(current_mean), 2)

            baseline_start_d = f"{baseline_start_year}-01-01"
            baseline_end_d = f"{baseline_end_year}-12-31"
            tc_base = ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE").filterDate(baseline_start_d, baseline_end_d).select("tmmx", "tmmn")
            base_mean_img = tc_base.map(lambda img: img.select("tmmx").add(img.select("tmmn")).divide(2)).mean().multiply(0.1)
            base_reg = base_mean_img.reduceRegion(reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=4638).getInfo()
            baseline_mean = base_reg.get("tmmx")
            if baseline_mean is not None:
                baseline_mean = round(float(baseline_mean), 2)

            anomaly = None
            if current_mean is not None and baseline_mean is not None:
                anomaly = round(current_mean - baseline_mean, 2)
            return {
                "source": "terraclimate",
                "lat": lat, "lng": lng,
                "anomaly_c": anomaly,
                "current_period_mean_c": current_mean,
                "baseline_mean_c": baseline_mean,
                "baseline_period": {"start_year": baseline_start_year, "end_year": baseline_end_year},
                "current_period": {"start": current_start, "end": current_end},
            }
        except Exception as e:
            logger.warning("EE temperature anomaly query failed: %s", e)
            return {
                "source": "mock", "lat": lat, "lng": lng,
                "anomaly_c": 0.5, "current_period_mean_c": 15.0, "baseline_mean_c": 14.5,
                "baseline_period": {"start_year": baseline_start_year, "end_year": baseline_end_year},
            }

    async def get_wind(
        self,
        lat: float,
        lng: float,
        radius_m: int = 5000,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Mean wind u/v and derived speed/direction from ERA5. Tutorial #10."""
        self._initialize()
        if not self._initialized:
            sd = start_date or (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
            ed = end_date or datetime.utcnow().strftime("%Y-%m-%d")
            return {"source": "mock", "lat": lat, "lng": lng, "u_component": 2.0, "v_component": 1.0, "speed_m_s": 2.2, "direction_deg": 27, "period": {"start": sd, "end": ed}}
        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            sd = start_date or (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
            ed = end_date or datetime.utcnow().strftime("%Y-%m-%d")
            era5 = ee.ImageCollection("ECMWF/ERA5/DAILY").filterDate(sd, ed).select("u_component_of_wind_10m", "v_component_of_wind_10m")
            mean_img = era5.mean()
            reg = mean_img.reduceRegion(reducer=ee.Reducer.mean(), geometry=point.buffer(radius_m), scale=25000).getInfo()
            u = reg.get("u_component_of_wind_10m")
            v = reg.get("v_component_of_wind_10m")
            if u is not None:
                u = round(float(u), 3)
            if v is not None:
                v = round(float(v), 3)
            speed = None
            direction = None
            if u is not None and v is not None:
                import math
                speed = round(math.sqrt(float(u) ** 2 + float(v) ** 2), 3)
                direction = round((math.degrees(math.atan2(-float(u), -float(v))) + 360) % 360, 1)
            return {
                "source": "era5",
                "lat": lat, "lng": lng,
                "u_component": u,
                "v_component": v,
                "speed_m_s": speed,
                "direction_deg": direction,
                "period": {"start": sd, "end": ed},
                "note": "10m wind; direction from which wind blows (meteorological convention).",
            }
        except Exception as e:
            logger.warning("EE wind query failed: %s", e)
            sd = start_date or (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
            ed = end_date or datetime.utcnow().strftime("%Y-%m-%d")
            return {"source": "mock", "lat": lat, "lng": lng, "u_component": 2.0, "v_component": 1.0, "speed_m_s": 2.2, "direction_deg": 27, "period": {"start": sd, "end": ed}}

    async def get_wildfire(
        self,
        lat: float,
        lng: float,
        radius_m: int = 10000,
        days: int = 365,
    ) -> Dict[str, Any]:
        """Get wildfire activity (MODIS thermal anomalies) — fire pixel count in buffer over period."""
        self._initialize()
        if not self._initialized:
            return {"source": "mock", "lat": lat, "lng": lng, "fire_pixel_count": 0, "has_fire": False}
        try:
            import ee
            point = ee.Geometry.Point([lng, lat]).buffer(radius_m)
            sd = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
            ed = datetime.utcnow().strftime("%Y-%m-%d")
            fire_mask = ee.ImageCollection("MODIS/061/MOD14A1").filterDate(sd, ed).select("FireMask")
            mask_fire = fire_mask.map(lambda img: img.gte(7))
            combined = mask_fire.sum()
            reg = combined.reduceRegion(reducer=ee.Reducer.sum(), geometry=point, scale=1000, maxPixels=1e7).getInfo()
            total = reg.get("FireMask", 0)
            count = int(total) if total is not None else 0
            return {
                "source": "modis_fire",
                "lat": lat, "lng": lng,
                "fire_pixel_count": count,
                "has_fire": count > 0,
                "radius_km": round(radius_m / 1000, 1),
                "period_days": days,
            }
        except Exception as e:
            logger.warning("EE wildfire query failed: %s", e)
            return {"source": "mock", "lat": lat, "lng": lng, "fire_pixel_count": 0, "has_fire": False}

    async def get_historical_climate(
        self,
        lat: float,
        lng: float,
        start_year: int = 1990,
        end_year: Optional[int] = None,
        radius_m: int = 5000,
    ) -> Dict[str, Any]:
        """
        Get historical climate summary by year (TerraClimate): temp, precipitation, PDSI, drought months.
        Returns yearly stats and extremes: wettest/driest/hottest/coldest years, years with drought.
        """
        self._initialize()
        end_year = end_year or datetime.utcnow().year - 1
        mock_result = {
            "source": "mock",
            "lat": lat,
            "lng": lng,
            "years": [],
            "summary": {"wettest_year": None, "driest_year": None, "hottest_year": None, "coldest_year": None, "years_with_drought": 0},
            "note": "Set ENABLE_EARTH_ENGINE and GCLOUD_PROJECT_ID — see docs/EARTH_ENGINE_SETUP.md",
        }
        if not self._initialized:
            return mock_result
        try:
            import ee
            point = ee.Geometry.Point([lng, lat])
            start_date = f"{start_year}-01-01"
            end_date = f"{end_year}-12-31"
            tc = (
                ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE")
                .filterDate(start_date, end_date)
                .select("pr", "tmmx", "tmmn", "pdsi")
            )
            # getRegion returns list of [lon, lat, time_ms, pr, tmmx, tmmn, pdsi]
            region = tc.getRegion(point, scale=4638).getInfo()
            if not region or len(region) < 2:
                return mock_result
            headers = region[0]
            rows = region[1:]
            time_idx = headers.index("system:time_start") if "system:time_start" in headers else headers.index("time") if "time" in headers else 3
            pr_idx = headers.index("pr") if "pr" in headers else 4
            tmmx_idx = headers.index("tmmx") if "tmmx" in headers else 5
            tmmn_idx = headers.index("tmmn") if "tmmn" in headers else 6
            pdsi_idx = headers.index("pdsi") if "pdsi" in headers else 7

            by_year: Dict[int, List[Dict[str, Any]]] = {}
            for row in rows:
                if len(row) <= max(time_idx, pr_idx, tmmx_idx, tmmn_idx, pdsi_idx):
                    continue
                t_ms = int(row[time_idx])
                dt = datetime.utcfromtimestamp(t_ms / 1000.0)
                year, month = dt.year, dt.month
                if start_year <= year <= end_year:
                    pr = float(row[pr_idx]) if row[pr_idx] is not None else None
                    tmmx = float(row[tmmx_idx]) * 0.1 if row[tmmx_idx] is not None else None
                    tmmn = float(row[tmmn_idx]) * 0.1 if row[tmmn_idx] is not None else None
                    pdsi = float(row[pdsi_idx]) * 0.01 if row[pdsi_idx] is not None else None
                    if year not in by_year:
                        by_year[year] = []
                    by_year[year].append({"month": month, "pr": pr, "tmmx": tmmx, "tmmn": tmmn, "pdsi": pdsi})

            def _longest_drought_run(months: List[Dict[str, Any]]) -> tuple:
                """Return (duration_months, start_month, end_month) for longest consecutive PDSI < -2."""
                sorted_m = sorted(months, key=lambda x: x["month"])
                best_len, best_start, best_end = 0, None, None
                curr_len, curr_start = 0, None
                for m in sorted_m:
                    if m.get("pdsi") is not None and m["pdsi"] < -2:
                        if curr_len == 0:
                            curr_start = m["month"]
                        curr_len += 1
                        if curr_len > best_len:
                            best_len, best_start, best_end = curr_len, curr_start, m["month"]
                    else:
                        curr_len, curr_start = 0, None
                return (best_len, best_start, best_end)

            years_list: List[Dict[str, Any]] = []
            for y in sorted(by_year.keys()):
                months = by_year[y]
                pr_vals = [m["pr"] for m in months if m["pr"] is not None]
                tmmx_vals = [m["tmmx"] for m in months if m["tmmx"] is not None]
                tmmn_vals = [m["tmmn"] for m in months if m["tmmn"] is not None]
                pdsi_vals = [m["pdsi"] for m in months if m["pdsi"] is not None]
                precip_mm = round(sum(pr_vals), 1) if pr_vals else None
                temp_max_c = round(sum(tmmx_vals) / len(tmmx_vals), 2) if tmmx_vals else None
                temp_min_c = round(sum(tmmn_vals) / len(tmmn_vals), 2) if tmmn_vals else None
                pdsi_mean = round(sum(pdsi_vals) / len(pdsi_vals), 2) if pdsi_vals else None
                drought_months = sum(1 for p in pdsi_vals if p < -2) if pdsi_vals else 0
                duration_months, drought_start_m, drought_end_m = _longest_drought_run(months)
                year_entry: Dict[str, Any] = {
                    "year": y,
                    "precipitation_mm": precip_mm,
                    "temp_max_c": temp_max_c,
                    "temp_min_c": temp_min_c,
                    "pdsi_mean": pdsi_mean,
                    "drought_months": drought_months,
                }
                if duration_months > 0:
                    year_entry["drought_duration_months"] = duration_months
                    year_entry["drought_start_month"] = drought_start_m
                    year_entry["drought_end_month"] = drought_end_m
                    year_entry["event_duration_note"] = f"Drought lasted {duration_months} month(s) (longest run with PDSI < -2)"
                else:
                    year_entry["event_duration_note"] = "Extreme year: full 12 months"
                years_list.append(year_entry)

            # Summary extremes
            with_precip = [a for a in years_list if a.get("precipitation_mm") is not None]
            with_tmax = [a for a in years_list if a.get("temp_max_c") is not None]
            with_tmin = [a for a in years_list if a.get("temp_min_c") is not None]
            wettest = max(with_precip, key=lambda x: x["precipitation_mm"])["year"] if with_precip else None
            driest = min(with_precip, key=lambda x: x["precipitation_mm"])["year"] if with_precip else None
            hottest = max(with_tmax, key=lambda x: x["temp_max_c"])["year"] if with_tmax else None
            coldest = min(with_tmin, key=lambda x: x["temp_min_c"])["year"] if with_tmin else None
            years_with_drought = sum(1 for a in years_list if (a.get("drought_months") or 0) >= 1)

            return {
                "source": "terraclimate",
                "lat": lat,
                "lng": lng,
                "period": {"start_year": start_year, "end_year": end_year},
                "years": years_list,
                "summary": {
                    "wettest_year": wettest,
                    "driest_year": driest,
                    "hottest_year": hottest,
                    "coldest_year": coldest,
                    "years_with_drought": years_with_drought,
                },
                "note_damage": "Earth Engine does not provide damage or loss data. For impact (deaths, economic loss) use EM-DAT, national disaster databases, or this platform's Historical Events API.",
            }
        except Exception as e:
            logger.warning("EE historical climate query failed: %s", e)
            return mock_result

    def _mock_climate(self, lat: float, lng: float) -> Dict[str, Any]:
        return {
            "source": "mock",
            "lat": lat, "lng": lng,
            "temperature_2m_k": 288.5,
            "ndvi": 0.45,
            "note": "Set ENABLE_EARTH_ENGINE=true and GCLOUD_PROJECT_ID; use GCLOUD_SERVICE_ACCOUNT_JSON (key) or gcloud auth application-default login (ADC) — see docs/EARTH_ENGINE_SETUP.md",
        }


earth_engine_client = EarthEngineClient()
