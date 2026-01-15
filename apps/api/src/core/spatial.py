"""Spatial utilities for PostGIS queries.

Provides helper functions for geographic operations when using PostgreSQL + PostGIS.
Falls back to Python-based calculations when using SQLite.
"""
import math
from typing import Optional, Tuple, List
import json

from .database import is_using_postgis


# Earth radius in km
EARTH_RADIUS_KM = 6371.0


def create_point_wkt(lat: float, lon: float) -> str:
    """Create WKT POINT from lat/lon."""
    return f"POINT({lon} {lat})"


def create_circle_polygon_wkt(lat: float, lon: float, radius_km: float, segments: int = 64) -> str:
    """
    Create WKT POLYGON approximating a circle.
    
    Args:
        lat: Center latitude
        lon: Center longitude
        radius_km: Radius in kilometers
        segments: Number of polygon segments (more = smoother)
    
    Returns:
        WKT POLYGON string
    """
    coords = []
    for i in range(segments + 1):
        angle = (2 * math.pi * i) / segments
        
        # Calculate offset in degrees (approximate)
        lat_offset = (radius_km / EARTH_RADIUS_KM) * math.cos(angle) * (180 / math.pi)
        lon_offset = (radius_km / EARTH_RADIUS_KM) * math.sin(angle) * (180 / math.pi) / math.cos(math.radians(lat))
        
        point_lat = lat + lat_offset
        point_lon = lon + lon_offset
        coords.append(f"{point_lon} {point_lat}")
    
    return f"POLYGON(({', '.join(coords)}))"


def create_geojson_polygon(lat: float, lon: float, radius_km: float, segments: int = 32) -> dict:
    """
    Create GeoJSON polygon for a circular zone.
    
    Args:
        lat: Center latitude
        lon: Center longitude
        radius_km: Radius in kilometers
        segments: Number of segments
    
    Returns:
        GeoJSON dict
    """
    coords = []
    for i in range(segments + 1):
        angle = (2 * math.pi * i) / segments
        
        lat_offset = (radius_km / EARTH_RADIUS_KM) * math.cos(angle) * (180 / math.pi)
        lon_offset = (radius_km / EARTH_RADIUS_KM) * math.sin(angle) * (180 / math.pi) / math.cos(math.radians(lat))
        
        coords.append([lon + lon_offset, lat + lat_offset])
    
    return {
        "type": "Polygon",
        "coordinates": [coords]
    }


def geojson_to_wkt(geojson: dict) -> str:
    """Convert GeoJSON to WKT."""
    geom_type = geojson.get("type", "").upper()
    
    if geom_type == "POINT":
        coords = geojson["coordinates"]
        return f"POINT({coords[0]} {coords[1]})"
    
    elif geom_type == "POLYGON":
        rings = geojson["coordinates"]
        ring_strs = []
        for ring in rings:
            points = ", ".join(f"{p[0]} {p[1]}" for p in ring)
            ring_strs.append(f"({points})")
        return f"POLYGON({', '.join(ring_strs)})"
    
    elif geom_type == "MULTIPOLYGON":
        polygons = geojson["coordinates"]
        poly_strs = []
        for poly in polygons:
            rings = []
            for ring in poly:
                points = ", ".join(f"{p[0]} {p[1]}" for p in ring)
                rings.append(f"({points})")
            poly_strs.append(f"({', '.join(rings)})")
        return f"MULTIPOLYGON({', '.join(poly_strs)})"
    
    raise ValueError(f"Unsupported geometry type: {geom_type}")


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great-circle distance between two points (Haversine formula).
    
    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates
    
    Returns:
        Distance in kilometers
    """
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return EARTH_RADIUS_KM * c


def point_in_circle(point_lat: float, point_lon: float, 
                    center_lat: float, center_lon: float, 
                    radius_km: float) -> bool:
    """Check if a point is within a circular zone."""
    distance = haversine_distance(point_lat, point_lon, center_lat, center_lon)
    return distance <= radius_km


def get_bounding_box(lat: float, lon: float, radius_km: float) -> Tuple[float, float, float, float]:
    """
    Get bounding box for a circular zone.
    
    Returns:
        (min_lon, min_lat, max_lon, max_lat)
    """
    lat_offset = (radius_km / EARTH_RADIUS_KM) * (180 / math.pi)
    lon_offset = lat_offset / math.cos(math.radians(lat))
    
    return (
        lon - lon_offset,  # min_lon
        lat - lat_offset,  # min_lat
        lon + lon_offset,  # max_lon
        lat + lat_offset,  # max_lat
    )


# ============================================
# PostGIS Query Helpers
# ============================================

def postgis_contains_query(geometry_col: str, lat: float, lon: float) -> str:
    """
    Generate PostGIS query to check if a point is contained in geometry.
    
    Example:
        ST_Contains(geometry, ST_SetSRID(ST_Point(-74.006, 40.7128), 4326))
    """
    return f"ST_Contains({geometry_col}, ST_SetSRID(ST_Point({lon}, {lat}), 4326))"


def postgis_distance_query(geometry_col: str, lat: float, lon: float) -> str:
    """
    Generate PostGIS query to calculate distance to a point (in meters).
    
    Example:
        ST_Distance(geometry::geography, ST_SetSRID(ST_Point(-74.006, 40.7128), 4326)::geography)
    """
    return f"ST_Distance({geometry_col}::geography, ST_SetSRID(ST_Point({lon}, {lat}), 4326)::geography)"


def postgis_within_distance_query(geometry_col: str, lat: float, lon: float, distance_m: float) -> str:
    """
    Generate PostGIS query to find geometries within distance (in meters).
    
    Example:
        ST_DWithin(geometry::geography, ST_SetSRID(ST_Point(-74.006, 40.7128), 4326)::geography, 10000)
    """
    return f"ST_DWithin({geometry_col}::geography, ST_SetSRID(ST_Point({lon}, {lat}), 4326)::geography, {distance_m})"


def postgis_intersects_query(geometry_col: str, wkt: str) -> str:
    """
    Generate PostGIS query to check geometry intersection.
    
    Example:
        ST_Intersects(geometry, ST_GeomFromText('POLYGON(...)', 4326))
    """
    return f"ST_Intersects({geometry_col}, ST_GeomFromText('{wkt}', 4326))"


# ============================================
# Fallback for SQLite
# ============================================

def find_assets_in_zone_sqlite(
    assets: List[dict],
    center_lat: float,
    center_lon: float,
    radius_km: float
) -> List[dict]:
    """
    Filter assets within a circular zone (SQLite fallback).
    
    Args:
        assets: List of asset dicts with 'latitude' and 'longitude'
        center_lat, center_lon: Zone center
        radius_km: Zone radius
    
    Returns:
        List of assets within the zone
    """
    result = []
    for asset in assets:
        asset_lat = asset.get("latitude")
        asset_lon = asset.get("longitude")
        
        if asset_lat is not None and asset_lon is not None:
            if point_in_circle(asset_lat, asset_lon, center_lat, center_lon, radius_km):
                result.append(asset)
    
    return result
