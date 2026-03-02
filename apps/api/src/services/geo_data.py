"""
Geo Data Preparation Service
=============================

Prepares geographic data for client-side rendering:
- GeoJSON for boundaries, regions
- Risk hotspots with computed fields
- Data optimized for CesiumJS/Deck.gl

Key principle: Server computes, client renders

Now uses CityRiskCalculator for dynamic risk scoring based on:
- Seismic activity (USGS data)
- Flood/Hurricane risk (weather data)
- Political stability
- Economic exposure
- Historical events
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np

from .city_risk_calculator import CityRiskCalculator, CityRiskScore, get_city_risk_calculator
from .external.usgs_client import USGSClient
from .external.weather_client import WeatherClient
from ..data.cities import get_all_cities, get_city, CITIES_DATABASE
from ..core.config import get_settings

logger = logging.getLogger(__name__)

# Map risk factor names to dominant risk type for zone grading (geopolitical, climate, economic, seismic, other)
_FACTOR_TO_DOMINANT_TYPE: Dict[str, str] = {
    "conflict": "geopolitical",
    "political": "geopolitical",
    "sanctions": "geopolitical",
    "logistics": "geopolitical",
    "flood": "climate",
    "hurricane": "climate",
    "flood_external": "climate",
    "seismic": "seismic",
    "economic": "economic",
}


def _dominant_risk_type_from_factors(risk_factors_dict: Dict[str, float]) -> str:
    """Pick dominant risk type from factor names (max value); fallback 'other'."""
    if not risk_factors_dict:
        return "other"
    best_name = max(risk_factors_dict.keys(), key=lambda k: risk_factors_dict.get(k, 0.0))
    return _FACTOR_TO_DOMINANT_TYPE.get(best_name, "other")


class GeoDataService:
    """Service for preparing geographic data for visualization."""
    
    def __init__(self):
        """Initialize with external API clients."""
        self.usgs_client = USGSClient()
        self.weather_client = WeatherClient()
        self._calculator: Optional[CityRiskCalculator] = None
        self._cached_scores: Dict[str, CityRiskScore] = {}
        self._cache_time: Optional[datetime] = None
        # Long TTL so risk levels stay stable; configurable via RISK_CACHE_TTL_HOURS on server
        self._cache_ttl_hours = get_settings().risk_cache_ttl_hours
        self._calc_lock = asyncio.Lock()

    def invalidate_cache(self) -> None:
        """
        Invalidate cached city risk scores.

        Use when underlying city parameters (exposure, known risks, regions) change
        and the API should reflect updates immediately.
        """
        self._cached_scores = {}
        self._cache_time = None

    async def recalculate_cities(self, city_ids: List[str], max_cities: int = 300) -> None:
        """
        Recalculate risk scores only for the given city IDs and update cache.
        Used by ingestion pipeline when affected_city_ids is set (e.g. from GDELT, USGS).
        Limits to max_cities to avoid overloading external APIs.
        """
        if not city_ids:
            return
        ids = list(dict.fromkeys(city_ids))[:max_cities]  # dedupe and cap
        calculator = self._get_calculator()
        use_v2 = get_settings().risk_model_version == 2
        concurrency = 15
        updated = 0
        for i in range(0, len(ids), concurrency):
            batch = ids[i : i + concurrency]
            tasks = [
                calculator.calculate_risk(
                    cid,
                    force_recalculate=True,
                    use_external_data=True,
                    use_risk_model_v2=use_v2,
                )
                for cid in batch
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for cid, result in zip(batch, results):
                if isinstance(result, Exception):
                    logger.debug("Recalc city %s failed: %s", cid, result)
                    continue
                if result is not None:
                    self._cached_scores[result.city_id] = result
                    updated += 1
        if updated > 0:
            logger.info("Recalculated risk for %s cities (ingestion trigger)", updated)
    
    def _get_calculator(self) -> CityRiskCalculator:
        """Get or create risk calculator with API clients."""
        if self._calculator is None:
            self._calculator = CityRiskCalculator(
                usgs_client=self.usgs_client,
                weather_client=self.weather_client,
            )
        return self._calculator
    
    async def _ensure_risk_scores(self, force_recalculate: bool = False) -> Dict[str, CityRiskScore]:
        """Ensure risk scores are calculated and cached."""
        now = datetime.utcnow()
        
        # Check if cache is valid
        if (not force_recalculate 
            and self._cache_time 
            and (now - self._cache_time).total_seconds() < self._cache_ttl_hours * 3600
            and self._cached_scores):
            return self._cached_scores
        
        # Prevent stampede on cold start
        async with self._calc_lock:
            # Check cache again after acquiring lock
            if (not force_recalculate
                and self._cache_time
                and (now - self._cache_time).total_seconds() < self._cache_ttl_hours * 3600
                and self._cached_scores):
                return self._cached_scores

            # When cache expired (we had scores before) or force_recalculate: use external APIs
            # (USGS, weather) so zone counts and globe reflect changing situation. First load only
            # uses static data to avoid slow timeout.
            use_external_data = bool(force_recalculate) or bool(self._cached_scores)

            calculator = self._get_calculator()
            use_v2 = get_settings().risk_model_version == 2
            scores = await calculator.calculate_all_cities(
                force_recalculate=force_recalculate,
                use_external_data=use_external_data,
                max_concurrency=25,
                use_risk_model_v2=use_v2,
            )

            # Cache results
            self._cached_scores = {s.city_id: s for s in scores}
            self._cache_time = now

            logger.info(
                "Calculated risk scores for %s cities (external=%s)",
                len(scores),
                use_external_data,
            )
            return self._cached_scores

    def get_risk_hotspots_geojson(
        self,
        min_risk: float = 0.0,
        max_risk: float = 1.0,
        scenario: Optional[str] = None,
        risk_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Returns risk hotspots as GeoJSON FeatureCollection.
        
        Optimized for Deck.gl/CesiumJS rendering.
        Uses CityRiskCalculator for dynamic risk scoring.
        Each feature includes dominant_risk_type (geopolitical, climate, economic, seismic, other).
        If risk_type is set, only features with that dominant_risk_type are returned.
        """
        # Run async calculation in sync context
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If already in async context, use cached or compute
                scores = self._cached_scores or {}
            else:
                scores = loop.run_until_complete(self._ensure_risk_scores())
        except RuntimeError:
            # No event loop, create one
            scores = asyncio.run(self._ensure_risk_scores())
        
        features = []
        total_exposure = 0.0
        
        for city_id, score in scores.items():
            if score.risk_score < min_risk or score.risk_score > max_risk:
                continue
            
            # Apply scenario adjustment if specified
            adjusted_risk = score.risk_score
            risk_factors_dict = {
                name: factor.value 
                for name, factor in score.risk_factors.items()
            }
            
            if scenario == "climate_physical":
                climate_factor = max(
                    risk_factors_dict.get("flood", 0),
                    risk_factors_dict.get("hurricane", 0),
                )
                adjusted_risk = min(1.0, adjusted_risk * (1 + climate_factor * 0.3))
            elif scenario == "credit_shock":
                economic_factor = risk_factors_dict.get("economic", 0.3)
                adjusted_risk = min(1.0, adjusted_risk * (1 + economic_factor * 0.5))
            elif scenario == "seismic_event":
                seismic_factor = risk_factors_dict.get("seismic", 0)
                adjusted_risk = min(1.0, adjusted_risk * (1 + seismic_factor * 0.4))
            
            # Calculate derived metrics
            pd_1y = 0.02 + adjusted_risk * 0.03  # 2-5% based on risk
            lgd = 0.30 + adjusted_risk * 0.25   # 30-55% based on risk
            
            dominant_risk_type = _dominant_risk_type_from_factors(risk_factors_dict)
            if risk_type is not None and dominant_risk_type != risk_type:
                continue
            
            feature = {
                "type": "Feature",
                "id": city_id,
                "geometry": {
                    "type": "Point",
                    "coordinates": list(score.coordinates),
                },
                "properties": {
                    "name": score.name,
                    "exposure": score.exposure,
                    "risk_score": round(adjusted_risk, 3),
                    "base_risk": round(score.risk_score, 3),
                    "confidence": round(score.confidence, 2),
                    "calculation_method": score.calculation_method,
                    "dominant_risk_type": dominant_risk_type,
                    "risk_factors": {
                        name: {
                            "value": round(factor.value, 2),
                            "source": factor.source,
                            "details": factor.details,
                        }
                        for name, factor in score.risk_factors.items()
                    },
                    "assets_count": score.assets_count,
                    "pd_1y": round(pd_1y, 3),
                    "lgd": round(lgd, 2),
                    "expected_loss": round(score.exposure * pd_1y * lgd, 2),
                    "data_freshness": score.data_freshness.isoformat(),
                    # Visual properties for client
                    "radius": 200000 + adjusted_risk * 400000,
                    "color": self._risk_to_color(adjusted_risk),
                    "elevation": adjusted_risk * 100000,
                },
            }
            features.append(feature)
            total_exposure += score.exposure
        
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "scenario": scenario,
                "total_exposure": round(total_exposure, 1),
                "hotspot_count": len(features),
                "calculation_method": "CityRiskCalculator v1.0",
                "data_sources": ["USGS Earthquake Catalog", "Climate Zones", "Known Risk Database"],
            },
        }

    def get_risk_network_json(self) -> Dict[str, Any]:
        """
        Returns risk network as nodes + edges for force-directed graph.
        
        Optimized for Deck.gl/Sigma.js rendering.
        Uses dynamic risk scores from CityRiskCalculator.
        """
        nodes = []
        edges = []
        
        # Use cached scores or empty
        scores = self._cached_scores or {}
        score_list = list(scores.values())
        
        for score in score_list:
            nodes.append({
                "id": score.city_id,
                "name": score.name,
                "x": score.coordinates[0] * 10,  # Scaled for visualization
                "y": score.coordinates[1] * 10,
                "size": score.exposure * 2,
                "risk": round(score.risk_score, 2),
                "color": self._risk_to_color(score.risk_score),
            })
        
        # Create edges based on correlation of risk factors
        for i, score1 in enumerate(score_list):
            factors1 = {name: f.value for name, f in score1.risk_factors.items()}
            
            for score2 in score_list[i + 1:]:
                factors2 = {name: f.value for name, f in score2.risk_factors.items()}
                
                # Correlation based on shared risk factors
                shared = set(factors1.keys()) & set(factors2.keys())
                if shared:
                    correlation = sum(
                        factors1[k] * factors2[k]
                        for k in shared
                    ) / len(shared)
                    
                    if correlation > 0.3:  # Only show significant correlations
                        edges.append({
                            "source": score1.city_id,
                            "target": score2.city_id,
                            "weight": round(correlation, 2),
                            "color": self._correlation_to_color(correlation),
                        })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "node_count": len(nodes),
                "edge_count": len(edges),
            },
        }

    def get_heatmap_grid(
        self,
        resolution: int = 36,  # 36x18 = 10 degree cells
        variable: str = "risk",
    ) -> Dict[str, Any]:
        """
        Returns global heatmap as grid data.
        
        Optimized for WebGL heatmap rendering.
        Uses dynamic risk scores from CityRiskCalculator.
        """
        # Create global grid
        lons = np.linspace(-180, 180, resolution)
        lats = np.linspace(-90, 90, resolution // 2)
        
        # Initialize grid with base values
        grid = np.zeros((len(lats), len(lons)))
        
        # Use cached scores
        scores = self._cached_scores or {}
        
        # Add gaussian influence from each city
        for score in scores.values():
            city_lat = score.coordinates[1]
            city_lng = score.coordinates[0]
            
            # Create gaussian kernel
            for i, lat in enumerate(lats):
                for j, lon in enumerate(lons):
                    dist = np.sqrt((lat - city_lat)**2 + (lon - city_lng)**2)
                    influence = score.risk_score * np.exp(-dist**2 / 500)
                    grid[i, j] = max(grid[i, j], influence)
        
        # Convert to list of [lon, lat, value] for Deck.gl HeatmapLayer
        data = []
        for i, lat in enumerate(lats):
            for j, lon in enumerate(lons):
                if grid[i, j] > 0.05:  # Only include significant values
                    data.append({
                        "coordinates": [float(lon), float(lat)],
                        "weight": float(grid[i, j]),
                    })
        
        return {
            "data": data,
            "bounds": {
                "minLon": -180,
                "maxLon": 180,
                "minLat": -90,
                "maxLat": 90,
            },
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "resolution": resolution,
                "variable": variable,
                "point_count": len(data),
            },
        }

    def get_portfolio_summary(
        self,
        country_code: Optional[str] = None,
        city_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Returns aggregated portfolio metrics using dynamic risk scores.
        When country_code or city_id is set, metrics are scoped to that country or city only.
        """
        scores = self._cached_scores or {}
        score_list = list(scores.values())

        if city_id:
            score_list = [s for s in score_list if s.city_id == city_id]
        elif country_code:
            code = (country_code or "").strip().upper()
            if code:
                score_list = [s for s in score_list if get_city(s.city_id) and (get_city(s.city_id).country_code or "").upper() == code]

        if not score_list:
            return {
                "total_exposure": 0,
                "weighted_risk": 0,
                "total_expected_loss": 0,
                "at_risk_exposure": 0,
                "critical_exposure": 0,
                "hotspot_count": 0,
                "total_assets": 0,
                "critical_count": 0,
                "high_count": 0,
                "medium_count": 0,
                "low_count": 0,
            }
        
        total_exposure = sum(s.exposure for s in score_list)
        weighted_risk = sum(s.exposure * s.risk_score for s in score_list) / total_exposure if total_exposure > 0 else 0
        
        # Calculate expected loss
        total_expected_loss = sum(
            s.exposure * (0.02 + s.risk_score * 0.03) * (0.30 + s.risk_score * 0.25)
            for s in score_list
        )
        
        at_risk = sum(s.exposure for s in score_list if s.risk_score > 0.6)
        critical = sum(s.exposure for s in score_list if s.risk_score > 0.8)

        # Zone counts: use hysteresis zone when present (v2), else score bands
        def _zone_of(s: CityRiskScore) -> str:
            if getattr(s, "zone", None):
                return s.zone
            if s.risk_score > 0.8:
                return "CRITICAL"
            if s.risk_score > 0.6:
                return "HIGH"
            if s.risk_score > 0.4:
                return "MEDIUM"
            return "LOW"
        critical_count = sum(1 for s in score_list if _zone_of(s) == "CRITICAL")
        high_count = sum(1 for s in score_list if _zone_of(s) == "HIGH")
        medium_count = sum(1 for s in score_list if _zone_of(s) == "MEDIUM")
        low_count = sum(1 for s in score_list if _zone_of(s) == "LOW")

        # Find highest risk and exposure
        highest_risk = max(score_list, key=lambda x: x.risk_score)
        highest_exposure = max(score_list, key=lambda x: x.exposure)
        
        return {
            "total_exposure": round(total_exposure, 1),
            "weighted_risk": round(weighted_risk, 3),
            "total_expected_loss": round(total_expected_loss, 2),
            "at_risk_exposure": round(at_risk, 1),
            "critical_exposure": round(critical, 1),
            "hotspot_count": len(score_list),
            "total_assets": sum(s.assets_count for s in score_list),
            "critical_count": critical_count,
            "high_count": high_count,
            "medium_count": medium_count,
            "low_count": low_count,
            "highest_risk": {
                "id": highest_risk.city_id,
                "name": highest_risk.name,
                "risk_score": round(highest_risk.risk_score, 2),
            },
            "highest_exposure": {
                "id": highest_exposure.city_id,
                "name": highest_exposure.name,
                "exposure": highest_exposure.exposure,
            },
        }

    def _risk_to_color(self, risk: float) -> List[int]:
        """Convert risk score to RGBA color."""
        if risk > 0.8:
            return [255, 34, 34, 230]  # Red
        elif risk > 0.6:
            return [255, 136, 34, 230]  # Orange
        elif risk > 0.4:
            return [255, 204, 34, 230]  # Yellow
        else:
            return [34, 255, 102, 230]  # Green

    def _correlation_to_color(self, correlation: float) -> List[int]:
        """Convert correlation to RGBA color."""
        intensity = int(100 + correlation * 155)
        return [intensity, intensity, 255, int(correlation * 200)]

    def get_climate_risk_overlay(
        self,
        scenario: str = "ssp245",
        time_horizon: int = 2050,
    ) -> Dict[str, Any]:
        """
        Returns climate risk overlay data for visualization.
        
        Combines:
        - Physical climate risks (temperature, precipitation, sea level)
        - Impact on portfolio hotspots
        - Time-based projections
        
        Uses dynamic risk scores from CityRiskCalculator.
        """
        # Climate impact multipliers by scenario (SSP1-2.6, SSP2-4.5, SSP5-8.5)
        scenario_multipliers = {
            "ssp126": 1.0,
            "ssp245": 1.5,
            "ssp370": 2.0,
            "ssp585": 2.5,
        }
        multiplier = scenario_multipliers.get(scenario, 1.5)
        
        # Time-based scaling (2030 = 1.0, 2050 = 1.5, 2100 = 2.5)
        time_factor = 1.0 + (time_horizon - 2025) / 75
        
        # Use cached scores
        scores = self._cached_scores or {}
        
        # Generate climate-adjusted risk data
        climate_hotspots = []
        for score in scores.values():
            # Calculate climate vulnerability from risk factors
            factors = {name: f.value for name, f in score.risk_factors.items()}
            climate_factors = [
                factors.get("flood", 0),
                factors.get("hurricane", 0),
                factors.get("seismic", 0) * 0.3,  # Seismic less climate-related
            ]
            climate_vulnerability = max(climate_factors) if climate_factors else 0.3
            
            # Projected climate risk
            projected_risk = min(1.0, score.risk_score * multiplier * time_factor * climate_vulnerability)
            
            climate_hotspots.append({
                "id": score.city_id,
                "name": score.name,
                "coordinates": list(score.coordinates),
                "current_risk": round(score.risk_score, 2),
                "projected_risk": round(projected_risk, 2),
                "risk_change": round(projected_risk - score.risk_score, 3),
                "exposure": score.exposure,
                "projected_loss": round(score.exposure * projected_risk * 0.1, 2),
                "climate_factors": {
                    "temperature_impact": round(multiplier * time_factor * 0.3, 2),
                    "precipitation_impact": round(multiplier * time_factor * 0.25, 2),
                    "sea_level_impact": round(multiplier * time_factor * 0.15, 2),
                    "extreme_events": round(multiplier * time_factor * 0.2, 2),
                },
            })
        
        # Aggregate stats
        total_exposure = sum(h["exposure"] for h in climate_hotspots) or 1
        total_current_risk = sum(h["current_risk"] * h["exposure"] for h in climate_hotspots)
        total_projected_risk = sum(h["projected_risk"] * h["exposure"] for h in climate_hotspots)
        
        return {
            "scenario": scenario,
            "time_horizon": time_horizon,
            "hotspots": climate_hotspots,
            "summary": {
                "total_exposure": round(total_exposure, 1),
                "current_weighted_risk": round(total_current_risk / total_exposure, 3),
                "projected_weighted_risk": round(total_projected_risk / total_exposure, 3),
                "risk_increase_pct": round(((total_projected_risk / max(total_current_risk, 0.01)) - 1) * 100, 1),
                "high_risk_zones": len([h for h in climate_hotspots if h["projected_risk"] > 0.8]),
            },
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "scenario_description": f"SSP {scenario[-3:]}" if "ssp" in scenario else scenario,
                "data_source": "CityRiskCalculator + Climate Projections",
            },
        }


# Singleton instance
geo_data_service = GeoDataService()
