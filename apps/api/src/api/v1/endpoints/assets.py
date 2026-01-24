"""Asset management endpoints - Layer 1: Living Digital Twins."""
from typing import Optional, List
from uuid import UUID
from enum import Enum

from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from minio.error import S3Error
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.core.storage import storage
from src.models.asset import Asset, AssetStatus, AssetType
from src.services.event_emitter import event_emitter

router = APIRouter()


# ==================== ENUMS ====================

class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"


class AssetSortField(str, Enum):
    NAME = "name"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    VALUATION = "current_valuation"
    CLIMATE_RISK = "climate_risk_score"
    PHYSICAL_RISK = "physical_risk_score"
    NETWORK_RISK = "network_risk_score"
    YEAR_BUILT = "year_built"
    FLOOR_AREA = "gross_floor_area_m2"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ==================== SCHEMAS ====================

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


class AdvancedFilterRequest(BaseModel):
    """Advanced filter request for assets."""
    # Basic filters
    asset_types: Optional[List[AssetType]] = None
    statuses: Optional[List[AssetStatus]] = None
    country_codes: Optional[List[str]] = None
    cities: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    
    # Risk score filters
    climate_risk_min: Optional[float] = Field(None, ge=0, le=100)
    climate_risk_max: Optional[float] = Field(None, ge=0, le=100)
    physical_risk_min: Optional[float] = Field(None, ge=0, le=100)
    physical_risk_max: Optional[float] = Field(None, ge=0, le=100)
    network_risk_min: Optional[float] = Field(None, ge=0, le=100)
    network_risk_max: Optional[float] = Field(None, ge=0, le=100)
    risk_levels: Optional[List[RiskLevel]] = None
    
    # Financial filters
    valuation_min: Optional[float] = Field(None, ge=0)
    valuation_max: Optional[float] = None
    
    # Physical filters
    year_built_min: Optional[int] = Field(None, ge=1800)
    year_built_max: Optional[int] = None
    floor_area_min: Optional[float] = Field(None, ge=0)
    floor_area_max: Optional[float] = None
    floors_min: Optional[int] = Field(None, ge=0)
    floors_max: Optional[int] = None
    
    # Tags
    tags: Optional[List[str]] = None
    tags_match_all: bool = False  # If True, all tags must match
    
    # Text search
    search: Optional[str] = None
    
    # Pagination & sorting
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: AssetSortField = AssetSortField.CREATED_AT
    sort_order: SortOrder = SortOrder.DESC


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


def _get_risk_level(score: Optional[float]) -> str:
    """Convert risk score to risk level."""
    if score is None:
        return "unknown"
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def _build_filter_conditions(filters: AdvancedFilterRequest) -> list:
    """Build SQLAlchemy filter conditions from AdvancedFilterRequest."""
    conditions = []
    
    # Asset types
    if filters.asset_types:
        conditions.append(Asset.asset_type.in_(filters.asset_types))
    
    # Statuses
    if filters.statuses:
        conditions.append(Asset.status.in_(filters.statuses))
    
    # Countries
    if filters.country_codes:
        upper_codes = [c.upper() for c in filters.country_codes]
        conditions.append(Asset.country_code.in_(upper_codes))
    
    # Cities
    if filters.cities:
        city_conditions = [Asset.city.ilike(f"%{city}%") for city in filters.cities]
        conditions.append(or_(*city_conditions))
    
    # Regions
    if filters.regions:
        region_conditions = [Asset.region.ilike(f"%{region}%") for region in filters.regions]
        conditions.append(or_(*region_conditions))
    
    # Risk score ranges
    if filters.climate_risk_min is not None:
        conditions.append(Asset.climate_risk_score >= filters.climate_risk_min)
    if filters.climate_risk_max is not None:
        conditions.append(Asset.climate_risk_score <= filters.climate_risk_max)
    
    if filters.physical_risk_min is not None:
        conditions.append(Asset.physical_risk_score >= filters.physical_risk_min)
    if filters.physical_risk_max is not None:
        conditions.append(Asset.physical_risk_score <= filters.physical_risk_max)
    
    if filters.network_risk_min is not None:
        conditions.append(Asset.network_risk_score >= filters.network_risk_min)
    if filters.network_risk_max is not None:
        conditions.append(Asset.network_risk_score <= filters.network_risk_max)
    
    # Risk levels (based on climate risk score)
    if filters.risk_levels:
        level_conditions = []
        for level in filters.risk_levels:
            if level == RiskLevel.CRITICAL:
                level_conditions.append(Asset.climate_risk_score >= 75)
            elif level == RiskLevel.HIGH:
                level_conditions.append(and_(Asset.climate_risk_score >= 50, Asset.climate_risk_score < 75))
            elif level == RiskLevel.MEDIUM:
                level_conditions.append(and_(Asset.climate_risk_score >= 25, Asset.climate_risk_score < 50))
            elif level == RiskLevel.LOW:
                level_conditions.append(Asset.climate_risk_score < 25)
        if level_conditions:
            conditions.append(or_(*level_conditions))
    
    # Valuation range
    if filters.valuation_min is not None:
        conditions.append(Asset.current_valuation >= filters.valuation_min)
    if filters.valuation_max is not None:
        conditions.append(Asset.current_valuation <= filters.valuation_max)
    
    # Year built range
    if filters.year_built_min is not None:
        conditions.append(Asset.year_built >= filters.year_built_min)
    if filters.year_built_max is not None:
        conditions.append(Asset.year_built <= filters.year_built_max)
    
    # Floor area range
    if filters.floor_area_min is not None:
        conditions.append(Asset.gross_floor_area_m2 >= filters.floor_area_min)
    if filters.floor_area_max is not None:
        conditions.append(Asset.gross_floor_area_m2 <= filters.floor_area_max)
    
    # Floors range
    if filters.floors_min is not None:
        conditions.append(Asset.floors_above_ground >= filters.floors_min)
    if filters.floors_max is not None:
        conditions.append(Asset.floors_above_ground <= filters.floors_max)
    
    # Tags filter
    if filters.tags:
        if filters.tags_match_all:
            # All tags must be present
            for tag in filters.tags:
                conditions.append(Asset.tags.contains([tag]))
        else:
            # Any tag matches
            tag_conditions = [Asset.tags.contains([tag]) for tag in filters.tags]
            conditions.append(or_(*tag_conditions))
    
    # Text search
    if filters.search:
        search_term = f"%{filters.search}%"
        conditions.append(or_(
            Asset.name.ilike(search_term),
            Asset.description.ilike(search_term),
            Asset.address.ilike(search_term),
            Asset.city.ilike(search_term),
            Asset.pars_id.ilike(search_term),
        ))
    
    return conditions


def _get_sort_column(sort_by: AssetSortField):
    """Get SQLAlchemy column for sorting."""
    sort_mapping = {
        AssetSortField.NAME: Asset.name,
        AssetSortField.CREATED_AT: Asset.created_at,
        AssetSortField.UPDATED_AT: Asset.updated_at,
        AssetSortField.VALUATION: Asset.current_valuation,
        AssetSortField.CLIMATE_RISK: Asset.climate_risk_score,
        AssetSortField.PHYSICAL_RISK: Asset.physical_risk_score,
        AssetSortField.NETWORK_RISK: Asset.network_risk_score,
        AssetSortField.YEAR_BUILT: Asset.year_built,
        AssetSortField.FLOOR_AREA: Asset.gross_floor_area_m2,
    }
    return sort_mapping.get(sort_by, Asset.created_at)


@router.get("", response_model=AssetList)
async def list_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    asset_type: Optional[AssetType] = None,
    status: Optional[AssetStatus] = None,
    country_code: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    # Risk filters
    climate_risk_min: Optional[float] = Query(None, ge=0, le=100),
    climate_risk_max: Optional[float] = Query(None, ge=0, le=100),
    risk_level: Optional[RiskLevel] = None,
    # Financial filters
    valuation_min: Optional[float] = Query(None, ge=0),
    valuation_max: Optional[float] = None,
    # Physical filters
    year_built_min: Optional[int] = Query(None, ge=1800),
    year_built_max: Optional[int] = None,
    # Sorting
    sort_by: AssetSortField = AssetSortField.CREATED_AT,
    sort_order: SortOrder = SortOrder.DESC,
    db: AsyncSession = Depends(get_db),
):
    """
    List all assets with pagination, filtering, and sorting.
    
    **Basic Filters:**
    - asset_type: Filter by asset type
    - status: Filter by status
    - country_code: Filter by country (ISO 2-letter)
    - city: Filter by city name (partial match)
    - search: Search in name, description, address
    
    **Risk Filters:**
    - climate_risk_min/max: Climate risk score range (0-100)
    - risk_level: Filter by risk level (low, medium, high, critical)
    
    **Financial Filters:**
    - valuation_min/max: Valuation range in EUR
    
    **Physical Filters:**
    - year_built_min/max: Year built range
    
    **Sorting:**
    - sort_by: Field to sort by
    - sort_order: asc or desc
    """
    # Build filter request
    filters = AdvancedFilterRequest(
        asset_types=[asset_type] if asset_type else None,
        statuses=[status] if status else None,
        country_codes=[country_code] if country_code else None,
        cities=[city] if city else None,
        climate_risk_min=climate_risk_min,
        climate_risk_max=climate_risk_max,
        risk_levels=[risk_level] if risk_level else None,
        valuation_min=valuation_min,
        valuation_max=valuation_max,
        year_built_min=year_built_min,
        year_built_max=year_built_max,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    # Build query
    conditions = _build_filter_conditions(filters)
    query = select(Asset)
    if conditions:
        query = query.where(and_(*conditions))
    
    # Count total
    count_query = select(func.count(Asset.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Sorting
    sort_column = _get_sort_column(sort_by)
    if sort_order == SortOrder.DESC:
        query = query.order_by(sort_column.desc().nulls_last())
    else:
        query = query.order_by(sort_column.asc().nulls_last())
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    assets = result.scalars().all()
    
    return AssetList(
        items=assets,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


@router.post("/filter", response_model=AssetList)
async def filter_assets_advanced(
    filters: AdvancedFilterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Advanced multi-criteria filtering for assets.
    
    Supports complex filtering with multiple conditions:
    - Multiple asset types, statuses, countries, cities
    - Risk score ranges (climate, physical, network)
    - Financial filters (valuation range)
    - Physical filters (year built, floor area, floors)
    - Tag filtering (match any or all)
    - Text search across multiple fields
    - Flexible sorting
    
    Use this endpoint for complex filter combinations that
    exceed the GET endpoint's query parameter limits.
    """
    # Build query
    conditions = _build_filter_conditions(filters)
    query = select(Asset)
    if conditions:
        query = query.where(and_(*conditions))
    
    # Count total
    count_query = select(func.count(Asset.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Sorting
    sort_column = _get_sort_column(filters.sort_by)
    if filters.sort_order == SortOrder.DESC:
        query = query.order_by(sort_column.desc().nulls_last())
    else:
        query = query.order_by(sort_column.asc().nulls_last())
    
    # Pagination
    offset = (filters.page - 1) * filters.page_size
    query = query.offset(offset).limit(filters.page_size)
    
    result = await db.execute(query)
    assets = result.scalars().all()
    
    return AssetList(
        items=assets,
        total=total,
        page=filters.page,
        page_size=filters.page_size,
        pages=(total + filters.page_size - 1) // filters.page_size if total > 0 else 0,
    )


@router.get("/filters/options")
async def get_filter_options(
    db: AsyncSession = Depends(get_db),
):
    """
    Get available filter options (for UI dropdowns).
    
    Returns distinct values for:
    - Countries
    - Cities
    - Regions
    - Asset types
    - Tags
    """
    # Get distinct countries
    countries_result = await db.execute(
        select(Asset.country_code).distinct().where(Asset.country_code.isnot(None))
    )
    countries = [r[0] for r in countries_result.all()]
    
    # Get distinct cities
    cities_result = await db.execute(
        select(Asset.city).distinct().where(Asset.city.isnot(None))
    )
    cities = [r[0] for r in cities_result.all()]
    
    # Get distinct regions
    regions_result = await db.execute(
        select(Asset.region).distinct().where(Asset.region.isnot(None))
    )
    regions = [r[0] for r in regions_result.all()]
    
    # Get all tags (flatten from all assets)
    tags_result = await db.execute(select(Asset.tags))
    all_tags = set()
    for row in tags_result.all():
        if row[0]:
            all_tags.update(row[0])
    
    # Asset types and statuses from enum
    asset_types = [t.value for t in AssetType]
    statuses = [s.value for s in AssetStatus]
    risk_levels = [r.value for r in RiskLevel]
    
    return {
        "countries": sorted(countries),
        "cities": sorted(cities),
        "regions": sorted(regions),
        "tags": sorted(list(all_tags)),
        "asset_types": asset_types,
        "statuses": statuses,
        "risk_levels": risk_levels,
        "sort_fields": [f.value for f in AssetSortField],
    }


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
    
    # Emit portfolio updated event
    await event_emitter.emit_portfolio_updated(
        portfolio_data={
            "action": "asset_created",
            "asset_id": str(asset.id),
            "name": asset.name,
            "valuation": asset.current_valuation,
            "asset_type": asset.asset_type.value if hasattr(asset.asset_type, 'value') else str(asset.asset_type),
        }
    )
    
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
    
    asset_name = asset.name
    asset_valuation = asset.current_valuation
    await db.delete(asset)
    await db.commit()
    
    # Emit portfolio updated event
    await event_emitter.emit_portfolio_updated(
        portfolio_data={
            "action": "asset_deleted",
            "asset_id": str(asset_id),
            "name": asset_name,
            "valuation": asset_valuation,
        }
    )


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

    content = await file.read()
    object_name = f"bim/{asset_id}/{file.filename}"
    try:
        bim_path = storage.upload_file(
            settings.minio_bucket_assets,
            object_name,
            BytesIO(content),
            content_type="application/ifc",
        )
    except S3Error:
        raise HTTPException(status_code=503, detail="Object storage unavailable")

    asset.bim_file_path = bim_path
    await db.commit()

    # Emit twin opened event (BIM upload indicates digital twin activation)
    await event_emitter.emit(
        event_type="TWIN_OPENED",
        entity_type="digital_twin",
        entity_id=str(asset_id),
        action="opened",
        data={
            "name": asset.name,
            "twin_type": "bim",
            "bim_file": file.filename,
        },
        intent=False,
    )
    
    return {
        "status": "uploaded",
        "asset_id": str(asset_id),
        "filename": file.filename,
        "size": len(content),
        "bim_path": bim_path,
    }
