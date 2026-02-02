"""Spatial Data API endpoints - Point Cloud and Satellite."""
import json
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.spatial_data import PointCloudCapture, SatelliteImage

router = APIRouter()


# ==================== Point Cloud ====================

class PointCloudCreate(BaseModel):
    """Create point cloud metadata."""
    source: str = Field(default="lidar")
    source_provider: Optional[str] = None
    file_path: str
    captured_at: Optional[datetime] = None
    crs: Optional[str] = None
    point_count: Optional[int] = None
    is_before: bool = False
    is_after: bool = False


class PointCloudResponse(BaseModel):
    """Point cloud response."""
    id: str
    asset_id: str
    source: str
    source_provider: Optional[str]
    file_path: str
    captured_at: Optional[datetime]
    crs: Optional[str]
    point_count: Optional[int]
    density_pts_per_m2: Optional[float]
    quality_score: Optional[float]
    processing_status: str
    is_before: bool
    is_after: bool
    created_at: Optional[datetime]
    
    class Config:
        from_attributes = True


@router.get("/assets/{asset_id}/point-cloud", response_model=list[PointCloudResponse])
async def list_asset_point_clouds(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all point cloud captures for an asset."""
    result = await db.execute(
        select(PointCloudCapture)
        .where(PointCloudCapture.asset_id == asset_id)
        .order_by(PointCloudCapture.captured_at.desc())
    )
    return list(result.scalars().all())


@router.post("/assets/{asset_id}/point-cloud", response_model=PointCloudResponse)
async def create_point_cloud(
    asset_id: str,
    data: PointCloudCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create point cloud metadata entry."""
    point_cloud = PointCloudCapture(
        id=str(uuid4()),
        asset_id=asset_id,
        source=data.source,
        source_provider=data.source_provider,
        file_path=data.file_path,
        captured_at=data.captured_at,
        crs=data.crs,
        point_count=data.point_count,
        is_before=data.is_before,
        is_after=data.is_after,
        uploaded_at=datetime.utcnow(),
    )
    
    db.add(point_cloud)
    await db.commit()
    await db.refresh(point_cloud)
    
    return point_cloud


@router.get("/point-cloud/{point_cloud_id}", response_model=PointCloudResponse)
async def get_point_cloud(
    point_cloud_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get point cloud by ID."""
    result = await db.execute(
        select(PointCloudCapture).where(PointCloudCapture.id == point_cloud_id)
    )
    point_cloud = result.scalar_one_or_none()
    
    if not point_cloud:
        raise HTTPException(status_code=404, detail="Point cloud not found")
    
    return point_cloud


# ==================== Satellite ====================

class SatelliteImageCreate(BaseModel):
    """Create satellite image metadata."""
    provider: str = Field(default="sentinel")
    scene_id: str
    captured_at: datetime
    resolution_m: Optional[float] = None
    bands: Optional[str] = None
    cloud_cover_pct: Optional[float] = None
    file_path: Optional[str] = None
    is_before: bool = False
    is_after: bool = False
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None


class SatelliteImageResponse(BaseModel):
    """Satellite image response."""
    id: str
    asset_id: str
    provider: str
    scene_id: str
    captured_at: datetime
    resolution_m: Optional[float]
    bands: Optional[str]
    cloud_cover_pct: Optional[float]
    file_path: Optional[str]
    thumbnail_path: Optional[str]
    is_before: bool
    is_after: bool
    processing_status: str
    ndvi_mean: Optional[float]
    ndwi_mean: Optional[float]
    change_score: Optional[float]
    created_at: Optional[datetime]
    
    class Config:
        from_attributes = True


@router.get("/assets/{asset_id}/satellite", response_model=list[SatelliteImageResponse])
async def list_asset_satellite_images(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all satellite images for an asset."""
    result = await db.execute(
        select(SatelliteImage)
        .where(SatelliteImage.asset_id == asset_id)
        .order_by(SatelliteImage.captured_at.desc())
    )
    return list(result.scalars().all())


@router.post("/assets/{asset_id}/satellite", response_model=SatelliteImageResponse)
async def create_satellite_image(
    asset_id: str,
    data: SatelliteImageCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create satellite image metadata entry."""
    satellite = SatelliteImage(
        id=str(uuid4()),
        asset_id=asset_id,
        provider=data.provider,
        scene_id=data.scene_id,
        captured_at=data.captured_at,
        resolution_m=data.resolution_m,
        bands=data.bands,
        cloud_cover_pct=data.cloud_cover_pct,
        file_path=data.file_path,
        is_before=data.is_before,
        is_after=data.is_after,
        center_lat=data.center_lat,
        center_lon=data.center_lon,
        uploaded_at=datetime.utcnow(),
    )
    
    db.add(satellite)
    await db.commit()
    await db.refresh(satellite)
    
    return satellite


@router.get("/satellite/{image_id}", response_model=SatelliteImageResponse)
async def get_satellite_image(
    image_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get satellite image by ID."""
    result = await db.execute(
        select(SatelliteImage).where(SatelliteImage.id == image_id)
    )
    image = result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(status_code=404, detail="Satellite image not found")
    
    return image
