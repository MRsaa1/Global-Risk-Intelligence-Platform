"""Spatial Data models - Point Cloud and Satellite imagery."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class PointCloudSource(str, enum.Enum):
    """Source of point cloud data."""
    LIDAR = "lidar"
    SATELLITE = "satellite"
    DRONE = "drone"
    PHOTOGRAMMETRY = "photogrammetry"
    OTHER = "other"


class SatelliteProvider(str, enum.Enum):
    """Satellite imagery provider."""
    MAXAR = "maxar"
    PLANET = "planet"
    SENTINEL = "sentinel"
    LANDSAT = "landsat"
    ICEYE = "iceye"
    CAPELLA = "capella"
    OTHER = "other"


class PointCloudCapture(Base):
    """
    Point cloud capture metadata.
    
    Stores information about LiDAR, satellite-derived, or drone point clouds
    for 3D reconstruction and comparison.
    """
    __tablename__ = "point_cloud_captures"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Source information
    source: Mapped[str] = mapped_column(
        String(50),
        default=PointCloudSource.LIDAR.value,
    )
    source_provider: Mapped[Optional[str]] = mapped_column(String(100))
    source_mission_id: Mapped[Optional[str]] = mapped_column(String(100))
    
    # File storage
    file_path: Mapped[str] = mapped_column(String(500))
    file_format: Mapped[Optional[str]] = mapped_column(String(20))  # las, laz, e57, xyz
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Capture metadata
    captured_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    uploaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Coordinate reference
    crs: Mapped[Optional[str]] = mapped_column(String(50))  # e.g., EPSG:4326
    
    # Bounds (WKT or JSON polygon)
    bounds_wkt: Mapped[Optional[str]] = mapped_column(Text)
    min_x: Mapped[Optional[float]] = mapped_column(Float)
    min_y: Mapped[Optional[float]] = mapped_column(Float)
    min_z: Mapped[Optional[float]] = mapped_column(Float)
    max_x: Mapped[Optional[float]] = mapped_column(Float)
    max_y: Mapped[Optional[float]] = mapped_column(Float)
    max_z: Mapped[Optional[float]] = mapped_column(Float)
    
    # Statistics
    point_count: Mapped[Optional[int]] = mapped_column(Integer)
    density_pts_per_m2: Mapped[Optional[float]] = mapped_column(Float)
    
    # Quality
    quality_score: Mapped[Optional[float]] = mapped_column(Float)
    noise_level: Mapped[Optional[float]] = mapped_column(Float)
    
    # Processing status
    processing_status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
    )
    processed_file_path: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Hash for comparison
    geometry_hash: Mapped[Optional[str]] = mapped_column(String(64))
    
    # Flags for damage detection
    is_before: Mapped[bool] = mapped_column(Boolean, default=False)
    is_after: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Metadata
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    def __repr__(self) -> str:
        return f"<PointCloudCapture {self.id}: {self.source}>"


class SatelliteImage(Base):
    """
    Satellite image metadata.
    
    Stores information about satellite imagery for monitoring,
    damage assessment, and before/after comparison.
    """
    __tablename__ = "satellite_images"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Provider and scene
    provider: Mapped[str] = mapped_column(
        String(50),
        default=SatelliteProvider.SENTINEL.value,
    )
    scene_id: Mapped[str] = mapped_column(String(100), index=True)
    product_type: Mapped[Optional[str]] = mapped_column(String(50))  # e.g., S2_L2A
    
    # Capture metadata
    captured_at: Mapped[datetime] = mapped_column(DateTime)
    uploaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Resolution
    resolution_m: Mapped[Optional[float]] = mapped_column(Float)
    bands: Mapped[Optional[str]] = mapped_column(String(255))  # e.g., "RGB,NIR,SWIR"
    
    # Coverage (WKT polygon)
    coverage_wkt: Mapped[Optional[str]] = mapped_column(Text)
    center_lat: Mapped[Optional[float]] = mapped_column(Float)
    center_lon: Mapped[Optional[float]] = mapped_column(Float)
    
    # Quality
    cloud_cover_pct: Mapped[Optional[float]] = mapped_column(Float)
    sun_elevation: Mapped[Optional[float]] = mapped_column(Float)
    off_nadir_angle: Mapped[Optional[float]] = mapped_column(Float)
    
    # Storage
    file_path: Mapped[Optional[str]] = mapped_column(String(500))
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(500))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Damage detection flags
    is_before: Mapped[bool] = mapped_column(Boolean, default=False)
    is_after: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Analysis results
    ndvi_mean: Mapped[Optional[float]] = mapped_column(Float)
    ndwi_mean: Mapped[Optional[float]] = mapped_column(Float)
    change_score: Mapped[Optional[float]] = mapped_column(Float)
    
    # Processing
    processing_status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
    )
    analysis_results: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    
    # Metadata
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    def __repr__(self) -> str:
        return f"<SatelliteImage {self.scene_id}: {self.provider}>"
