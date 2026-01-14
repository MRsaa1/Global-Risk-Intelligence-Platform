"""
Geo Data Preparation Service
=============================

Prepares geographic data for client-side rendering:
- GeoJSON for boundaries, regions
- Risk hotspots with computed fields
- Data optimized for CesiumJS/Deck.gl

Key principle: Server computes, client renders
"""
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)


# Risk hotspots - ONLY cities with 3D Tiles in Cesium Ion
RISK_HOTSPOTS = [
    {
        "id": "newyork",
        "name": "New York City",
        "lat": 40.7128,
        "lng": -74.0060,
        "exposure": 52.3,
        "risk_score": 0.75,
        "risk_factors": {
            "flood": 0.65,
            "hurricane": 0.55,
            "credit": 0.35,
        },
        "assets_count": 1834,
        "pd_1y": 0.028,
        "lgd": 0.42,
    },
    {
        "id": "tokyo",
        "name": "Tokyo",
        "lat": 35.6762,
        "lng": 139.6503,
        "exposure": 45.2,
        "risk_score": 0.92,
        "risk_factors": {
            "earthquake": 0.95,
            "flood": 0.75,
            "typhoon": 0.85,
            "credit": 0.45,
        },
        "assets_count": 1247,
        "pd_1y": 0.042,
        "lgd": 0.55,
    },
    {
        "id": "melbourne",
        "name": "Melbourne",
        "lat": -37.8136,
        "lng": 144.9631,
        "exposure": 28.5,
        "risk_score": 0.58,
        "risk_factors": {
            "flood": 0.35,
            "fire": 0.45,
            "credit": 0.30,
        },
        "assets_count": 892,
        "pd_1y": 0.022,
        "lgd": 0.40,
    },
    {
        "id": "boston",
        "name": "Boston",
        "lat": 42.3601,
        "lng": -71.0589,
        "exposure": 31.2,
        "risk_score": 0.62,
        "risk_factors": {
            "flood": 0.55,
            "hurricane": 0.40,
            "credit": 0.28,
        },
        "assets_count": 756,
        "pd_1y": 0.025,
        "lgd": 0.38,
    },
    {
        "id": "sydney",
        "name": "Sydney",
        "lat": -33.8688,
        "lng": 151.2093,
        "exposure": 38.7,
        "risk_score": 0.52,
        "risk_factors": {
            "fire": 0.60,
            "flood": 0.40,
            "credit": 0.22,
        },
        "assets_count": 945,
        "pd_1y": 0.020,
        "lgd": 0.35,
    },
    {
        "id": "denver",
        "name": "Denver",
        "lat": 39.7392,
        "lng": -104.9903,
        "exposure": 18.9,
        "risk_score": 0.45,
        "risk_factors": {
            "fire": 0.35,
            "flood": 0.25,
            "credit": 0.18,
        },
        "assets_count": 423,
        "pd_1y": 0.018,
        "lgd": 0.32,
    },
    {
        "id": "washington",
        "name": "Washington DC",
        "lat": 38.9072,
        "lng": -77.0369,
        "exposure": 42.1,
        "risk_score": 0.48,
        "risk_factors": {
            "flood": 0.45,
            "hurricane": 0.35,
            "credit": 0.20,
        },
        "assets_count": 678,
        "pd_1y": 0.019,
        "lgd": 0.34,
    },
    {
        "id": "montreal",
        "name": "Montreal",
        "lat": 45.5017,
        "lng": -73.5673,
        "exposure": 22.4,
        "risk_score": 0.55,
        "risk_factors": {
            "flood": 0.50,
            "cold": 0.40,
            "credit": 0.25,
        },
        "assets_count": 512,
        "pd_1y": 0.022,
        "lgd": 0.36,
    },
]


class GeoDataService:
    """Service for preparing geographic data for visualization."""

    def get_risk_hotspots_geojson(
        self,
        min_risk: float = 0.0,
        max_risk: float = 1.0,
        scenario: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Returns risk hotspots as GeoJSON FeatureCollection.
        
        Optimized for Deck.gl/CesiumJS rendering.
        """
        features = []
        
        for spot in RISK_HOTSPOTS:
            if spot["risk_score"] < min_risk or spot["risk_score"] > max_risk:
                continue
            
            # Apply scenario adjustment if specified
            adjusted_risk = spot["risk_score"]
            if scenario == "climate_physical":
                climate_factor = max(
                    spot["risk_factors"].get("flood", 0),
                    spot["risk_factors"].get("typhoon", 0),
                    spot["risk_factors"].get("hurricane", 0),
                    spot["risk_factors"].get("cyclone", 0),
                )
                adjusted_risk = min(1.0, adjusted_risk * (1 + climate_factor * 0.3))
            elif scenario == "credit_shock":
                credit_factor = spot["risk_factors"].get("credit", 0.3)
                adjusted_risk = min(1.0, adjusted_risk * (1 + credit_factor * 0.5))
            
            feature = {
                "type": "Feature",
                "id": spot["id"],
                "geometry": {
                    "type": "Point",
                    "coordinates": [spot["lng"], spot["lat"]],
                },
                "properties": {
                    "name": spot["name"],
                    "exposure": spot["exposure"],
                    "risk_score": adjusted_risk,
                    "base_risk": spot["risk_score"],
                    "risk_factors": spot["risk_factors"],
                    "assets_count": spot["assets_count"],
                    "pd_1y": spot["pd_1y"],
                    "lgd": spot["lgd"],
                    "expected_loss": spot["exposure"] * spot["pd_1y"] * spot["lgd"],
                    # Visual properties for client
                    "radius": 200000 + adjusted_risk * 400000,  # meters
                    "color": self._risk_to_color(adjusted_risk),
                    "elevation": adjusted_risk * 100000,  # for 3D extrusion
                },
            }
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "scenario": scenario,
                "total_exposure": sum(s["exposure"] for s in RISK_HOTSPOTS),
                "hotspot_count": len(features),
            },
        }

    def get_risk_network_json(self) -> Dict[str, Any]:
        """
        Returns risk network as nodes + edges for force-directed graph.
        
        Optimized for Deck.gl/Sigma.js rendering.
        """
        nodes = []
        edges = []
        
        for spot in RISK_HOTSPOTS:
            nodes.append({
                "id": spot["id"],
                "name": spot["name"],
                "x": spot["lng"] * 10,  # Scaled for visualization
                "y": spot["lat"] * 10,
                "size": spot["exposure"] * 2,
                "risk": spot["risk_score"],
                "color": self._risk_to_color(spot["risk_score"]),
            })
        
        # Create edges based on correlation (simplified)
        for i, spot1 in enumerate(RISK_HOTSPOTS):
            for spot2 in RISK_HOTSPOTS[i + 1:]:
                # Correlation based on shared risk factors
                shared = set(spot1["risk_factors"].keys()) & set(spot2["risk_factors"].keys())
                if shared:
                    correlation = sum(
                        spot1["risk_factors"][k] * spot2["risk_factors"][k]
                        for k in shared
                    ) / len(shared)
                    
                    if correlation > 0.3:  # Only show significant correlations
                        edges.append({
                            "source": spot1["id"],
                            "target": spot2["id"],
                            "weight": correlation,
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
        """
        # Create global grid
        lons = np.linspace(-180, 180, resolution)
        lats = np.linspace(-90, 90, resolution // 2)
        
        # Initialize grid with base values
        grid = np.zeros((len(lats), len(lons)))
        
        # Add gaussian influence from each hotspot
        for spot in RISK_HOTSPOTS:
            lat_idx = np.abs(lats - spot["lat"]).argmin()
            lon_idx = np.abs(lons - spot["lng"]).argmin()
            
            # Create gaussian kernel
            for i, lat in enumerate(lats):
                for j, lon in enumerate(lons):
                    dist = np.sqrt((lat - spot["lat"])**2 + (lon - spot["lng"])**2)
                    influence = spot["risk_score"] * np.exp(-dist**2 / 500)
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

    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Returns aggregated portfolio metrics."""
        total_exposure = sum(s["exposure"] for s in RISK_HOTSPOTS)
        weighted_risk = sum(s["exposure"] * s["risk_score"] for s in RISK_HOTSPOTS) / total_exposure
        total_expected_loss = sum(
            s["exposure"] * s["pd_1y"] * s["lgd"]
            for s in RISK_HOTSPOTS
        )
        
        at_risk = sum(s["exposure"] for s in RISK_HOTSPOTS if s["risk_score"] > 0.6)
        critical = sum(s["exposure"] for s in RISK_HOTSPOTS if s["risk_score"] > 0.8)
        
        return {
            "total_exposure": total_exposure,
            "weighted_risk": weighted_risk,
            "total_expected_loss": total_expected_loss,
            "at_risk_exposure": at_risk,
            "critical_exposure": critical,
            "hotspot_count": len(RISK_HOTSPOTS),
            "total_assets": sum(s["assets_count"] for s in RISK_HOTSPOTS),
            "highest_risk": max(RISK_HOTSPOTS, key=lambda x: x["risk_score"]),
            "highest_exposure": max(RISK_HOTSPOTS, key=lambda x: x["exposure"]),
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
        
        # Generate climate-adjusted risk data
        climate_hotspots = []
        for spot in RISK_HOTSPOTS:
            # Calculate climate vulnerability
            climate_factors = [
                spot["risk_factors"].get("flood", 0),
                spot["risk_factors"].get("typhoon", 0),
                spot["risk_factors"].get("hurricane", 0),
                spot["risk_factors"].get("cyclone", 0),
                spot["risk_factors"].get("heat", 0),
                spot["risk_factors"].get("sea_level", 0),
                spot["risk_factors"].get("water_stress", 0),
            ]
            climate_vulnerability = max(climate_factors) if climate_factors else 0.3
            
            # Projected climate risk
            projected_risk = min(1.0, spot["risk_score"] * multiplier * time_factor * climate_vulnerability)
            
            climate_hotspots.append({
                "id": spot["id"],
                "name": spot["name"],
                "coordinates": [spot["lng"], spot["lat"]],
                "current_risk": spot["risk_score"],
                "projected_risk": projected_risk,
                "risk_change": projected_risk - spot["risk_score"],
                "exposure": spot["exposure"],
                "projected_loss": spot["exposure"] * projected_risk * 0.1,  # Simplified
                "climate_factors": {
                    "temperature_impact": multiplier * time_factor * 0.3,
                    "precipitation_impact": multiplier * time_factor * 0.25,
                    "sea_level_impact": multiplier * time_factor * 0.15,
                    "extreme_events": multiplier * time_factor * 0.2,
                },
            })
        
        # Aggregate stats
        total_current_risk = sum(h["current_risk"] * h["exposure"] for h in climate_hotspots)
        total_projected_risk = sum(h["projected_risk"] * h["exposure"] for h in climate_hotspots)
        total_exposure = sum(h["exposure"] for h in climate_hotspots)
        
        return {
            "scenario": scenario,
            "time_horizon": time_horizon,
            "hotspots": climate_hotspots,
            "summary": {
                "total_exposure": total_exposure,
                "current_weighted_risk": total_current_risk / total_exposure,
                "projected_weighted_risk": total_projected_risk / total_exposure,
                "risk_increase_pct": ((total_projected_risk / total_current_risk) - 1) * 100,
                "high_risk_zones": len([h for h in climate_hotspots if h["projected_risk"] > 0.8]),
            },
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "scenario_description": f"SSP {scenario[-3:]}" if "ssp" in scenario else scenario,
                "data_source": "NVIDIA Earth-2 (simulated)",
            },
        }


# Singleton instance
geo_data_service = GeoDataService()
