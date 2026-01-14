"""Asset management endpoints - Layer 1: Living Digital Twins."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.models.asset import Asset, AssetStatus, AssetType

router = APIRouter()


# Pydantic Schemas
class AssetCreate(BaseModel):
    """Schema for creating an asset."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    asset_type: AssetType = AssetType.COMMERCIAL_OFFICE
    
    # Location
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = None
    country_code: str = Field(default="DE", min_length=2, max_length=2)
    region: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    
    # Physical
    gross_floor_area_m2: Optional[float] = Field(None, ge=0)
    net_leasable_area_m2: Optional[float] = Field(None, ge=0)
    floors_above_ground: Optional[int] = Field(None, ge=0)
    floors_below_ground: Optional[int] = Field(None, ge=0)
    year_built: Optional[int] = Field(None, ge=1800, le=2100)
    year_renovated: Optional[int] = Field(None, ge=1800, le=2100)
    construction_type: Optional[str] = None
    
    # Financial
    current_valuation: Optional[float] = Field(None, ge=0)
    valuation_currency: str = Field(default="EUR", min_length=3, max_length=3)
    
    # Metadata
    tags: list[str] = Field(default_factory=list)


class AssetResponse(BaseModel):
    """Schema for asset response."""
    id: UUID
    pars_id: str
    name: str
    description: Optional[str]
    asset_type: AssetType
    status: AssetStatus
    
    # Location
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str]
    country_code: str
    city: Optional[str]
    
    # Physical
    gross_floor_area_m2: Optional[float]
    year_built: Optional[int]
    
    # Financial
    current_valuation: Optional[float]
    valuation_currency: str
    
    # Risk Scores
    climate_risk_score: Optional[float]
    physical_risk_score: Optional[float]
    network_risk_score: Optional[float]
    
    # Metadata
    tags: list[str]
    
    class Config:
        from_attributes = True


class AssetList(BaseModel):
    """Paginated list of assets."""
    items: list[AssetResponse]
    total: int
    page: int
    page_size: int
    pages: int


def generate_pars_id(country_code: str, city: str | None, asset_id: str) -> str:
    """Generate PARS Protocol ID."""
    city_code = (city or "XXX")[:3].upper()
    short_id = asset_id[-8:].upper()
    return f"PARS-EU-{country_code.upper()}-{city_code}-{short_id}"


@router.get("", response_model=AssetList)
async def list_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    asset_type: Optional[AssetType] = None,
    status: Optional[AssetStatus] = None,
    country_code: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List all assets with pagination and filtering.
    
    - **page**: Page number (1-indexed)
    - **page_size**: Items per page (max 100)
    - **asset_type**: Filter by asset type
    - **status**: Filter by status
    - **country_code**: Filter by country (ISO 2-letter)
    - **search**: Search in name, description, address
    """
    query = select(Asset)
    
    # Apply filters
    if asset_type:
        query = query.where(Asset.asset_type == asset_type)
    if status:
        query = query.where(Asset.status == status)
    if country_code:
        query = query.where(Asset.country_code == country_code.upper())
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            Asset.name.ilike(search_filter) |
            Asset.description.ilike(search_filter) |
            Asset.address.ilike(search_filter)
        )
    
    # Count total
    count_result = await db.execute(select(Asset.id).where(query.whereclause or True))
    total = len(count_result.all())
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Asset.created_at.desc())
    
    result = await db.execute(query)
    assets = result.scalars().all()
    
    return AssetList(
        items=assets,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(
    asset_data: AssetCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new physical asset.
    
    This creates the asset record and initializes a Digital Twin.
    """
    from uuid import uuid4
    from sqlalchemy import func
    from geoalchemy2.functions import ST_SetSRID, ST_MakePoint
    
    asset_id = uuid4()
    pars_id = generate_pars_id(
        asset_data.country_code,
        asset_data.city,
        str(asset_id),
    )
    
    # Create location point if coordinates provided
    location = None
    if asset_data.latitude is not None and asset_data.longitude is not None:
        location = func.ST_SetSRID(
            func.ST_MakePoint(asset_data.longitude, asset_data.latitude),
            4326,
        )
    
    asset = Asset(
        id=asset_id,
        pars_id=pars_id,
        name=asset_data.name,
        description=asset_data.description,
        asset_type=asset_data.asset_type,
        status=AssetStatus.DRAFT,
        location=location,
        address=asset_data.address,
        country_code=asset_data.country_code.upper(),
        region=asset_data.region,
        city=asset_data.city,
        postal_code=asset_data.postal_code,
        gross_floor_area_m2=asset_data.gross_floor_area_m2,
        net_leasable_area_m2=asset_data.net_leasable_area_m2,
        floors_above_ground=asset_data.floors_above_ground,
        floors_below_ground=asset_data.floors_below_ground,
        year_built=asset_data.year_built,
        year_renovated=asset_data.year_renovated,
        construction_type=asset_data.construction_type,
        current_valuation=asset_data.current_valuation,
        valuation_currency=asset_data.valuation_currency,
        tags=asset_data.tags,
    )
    
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    
    return asset


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single asset by ID."""
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return asset


@router.delete("/{asset_id}", status_code=204)
async def delete_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete an asset."""
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    await db.delete(asset)
    await db.commit()


@router.post("/{asset_id}/upload-bim")
async def upload_bim_file(
    asset_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a BIM file (IFC format) for an asset.
    
    The file will be stored in MinIO and linked to the asset's Digital Twin.
    Supported formats: .ifc, .ifczip
    """
    # Validate asset exists
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Validate file type
    allowed_extensions = {".ifc", ".ifczip"}
    file_ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}",
        )
    
    # TODO: Store in MinIO and process BIM file
    # For now, return placeholder
    return {
        "status": "uploaded",
        "asset_id": str(asset_id),
        "filename": file.filename,
        "size": file.size,
        "message": "BIM file processing will be implemented",
    }
