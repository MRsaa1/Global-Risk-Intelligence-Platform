"""Asset management endpoints - Layer 1: Living Digital Twins."""
import json
from dataclasses import asdict
from typing import Optional, List
from uuid import UUID
from enum import Enum

from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from minio.error import S3Error
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db, is_sqlite
from src.core.security import get_current_user
from src.core.storage import storage
from src.models.asset import Asset, AssetStatus, AssetType, FinancialProductType, InsuranceProductType
from src.models.user import User
from src.layers.simulation.physics_engine import physics_engine
from src.services.event_emitter import event_emitter
from src.services.complex_asset_scoring import ComplexAssetScoringService
from src.services.downtime_forecast import DowntimeForecastService

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
    
    # Financial Product (Phase 0.1)
    financial_product: Optional[FinancialProductType] = None
    insurance_product_type: Optional[InsuranceProductType] = None
    credit_facility_id: Optional[str] = None
    
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
    
    # Financial product filters (Phase 0.1)
    financial_products: Optional[List[FinancialProductType]] = None
    insurance_product_types: Optional[List[InsuranceProductType]] = None
    
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
    credit_limit_min: Optional[float] = Field(None, ge=0)
    credit_limit_max: Optional[float] = None
    
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


def _coerce_uuid(v: object):
    """Coerce id from DB (str or UUID) to UUID."""
    if v is None:
        raise ValueError("id is required")
    if isinstance(v, UUID):
        return v
    if isinstance(v, str):
        return UUID(v)
    return UUID(str(v))


def _coerce_asset_type(v: object) -> AssetType:
    """DB has asset_type as str; coerce to enum or OTHER."""
    if isinstance(v, AssetType):
        return v
    if isinstance(v, str) and v:
        for e in AssetType:
            if e.value == v:
                return e
        return AssetType.OTHER
    return AssetType.OTHER


def _coerce_asset_status(v: object) -> AssetStatus:
    """DB has status as str; coerce to enum or DRAFT."""
    if isinstance(v, AssetStatus):
        return v
    if isinstance(v, str) and v:
        for e in AssetStatus:
            if e.value == v:
                return e
        return AssetStatus.DRAFT
    return AssetStatus.DRAFT


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
    
    # Financial Product (Phase 0.1)
    financial_product: Optional[str] = None
    insurance_product_type: Optional[str] = None
    credit_facility_id: Optional[str] = None
    suggested_credit_limit: Optional[float] = None
    suggested_premium_annual: Optional[float] = None
    
    # Risk Scores
    climate_risk_score: Optional[float]
    physical_risk_score: Optional[float]
    network_risk_score: Optional[float]
    
    # Metadata
    tags: list[str]
    
    # BIM
    bim_file_path: Optional[str] = None
    
    @field_validator("id", mode="before")
    @classmethod
    def parse_id(cls, v: object) -> UUID:
        return _coerce_uuid(v)
    
    @field_validator("asset_type", mode="before")
    @classmethod
    def parse_asset_type(cls, v: object) -> AssetType:
        return _coerce_asset_type(v)
    
    @field_validator("status", mode="before")
    @classmethod
    def parse_status(cls, v: object) -> AssetStatus:
        return _coerce_asset_status(v)
    
    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v: object) -> list[str]:
        """DB stores tags as JSON text (str) or None; normalize to list[str]."""
        if v is None or v == "":
            return []
        if isinstance(v, list):
            return [str(x) for x in v]
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return [str(x) for x in parsed] if isinstance(parsed, list) else [str(parsed)]
            except (json.JSONDecodeError, TypeError):
                return [v] if v else []
        return []
    
    @field_validator("valuation_currency", mode="before")
    @classmethod
    def parse_valuation_currency(cls, v: object) -> str:
        if v is None or v == "":
            return "EUR"
        return str(v)
    
    @field_validator("country_code", mode="before")
    @classmethod
    def parse_country_code(cls, v: object) -> str:
        if v is None or v == "":
            return "DE"
        return str(v)[:2]

    @field_validator("pars_id", mode="before")
    @classmethod
    def parse_pars_id(cls, v: object) -> str:
        if v is None or (isinstance(v, str) and not v.strip()):
            return "—"
        return str(v)

    @field_validator("name", mode="before")
    @classmethod
    def parse_name(cls, v: object) -> str:
        if v is None or (isinstance(v, str) and not v.strip()):
            return "(unnamed)"
        return str(v)
    
    class Config:
        from_attributes = True


class DegradationResponse(BaseModel):
    remaining_useful_life_years: float
    failure_probability: float
    recommended_capex: float
    recommended_capex_priority: str
    factors: dict


class DowntimeForecastResponse(BaseModel):
    asset_id: str
    asset_name: str
    asset_type: str
    expected_downtime_hours: float
    worst_case_days: float
    uptime_probability: float
    factors: list[dict]
    revenue_at_risk_daily: float
    expected_annual_loss: float
    recommendations: list[str]
    mitigation_priority: list[str]


class OperationalRiskResponse(BaseModel):
    asset_id: str
    asset_type: str
    scoring_model: str
    result: dict


class SceneExportResponse(BaseModel):
    asset_id: str
    glb_url: Optional[str] = None
    bim_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    metadata: dict


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
    
    # Financial products (Phase 0.1)
    if filters.financial_products:
        fp_values = [fp.value if hasattr(fp, 'value') else fp for fp in filters.financial_products]
        conditions.append(Asset.financial_product.in_(fp_values))
    
    # Insurance product types (Phase 0.1)
    if filters.insurance_product_types:
        ipt_values = [ipt.value if hasattr(ipt, 'value') else ipt for ipt in filters.insurance_product_types]
        conditions.append(Asset.insurance_product_type.in_(ipt_values))
    
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
    
    # Credit limit range (Phase 0.1)
    if filters.credit_limit_min is not None:
        conditions.append(Asset.suggested_credit_limit >= filters.credit_limit_min)
    if filters.credit_limit_max is not None:
        conditions.append(Asset.suggested_credit_limit <= filters.credit_limit_max)
    
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
    # Financial product filters (Phase 0.1)
    financial_product: Optional[FinancialProductType] = None,
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
    - financial_product: Filter by financial product type
    
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
        financial_products=[financial_product] if financial_product else None,
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
    
    try:
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

        # Sorting (SQLite: avoid nulls_last for better compatibility)
        sort_column = _get_sort_column(sort_by)
        if sort_order == SortOrder.DESC:
            ob = sort_column.desc() if is_sqlite else sort_column.desc().nulls_last()
        else:
            ob = sort_column.asc() if is_sqlite else sort_column.asc().nulls_last()
        query = query.order_by(ob)

        # Pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = await db.execute(query)
        assets = result.scalars().all()

        # Build AssetResponse explicitly to surface serialization errors with context
        items = []
        for i, a in enumerate(assets):
            try:
                items.append(AssetResponse.model_validate(a))
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Asset serialization error at index {i} (id={getattr(a, 'id', '?')}): {e!s}",
                ) from e

        return AssetList(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=(total + page_size - 1) // page_size if total > 0 else 0,
        )
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        hint = ""
        if "no such column" in msg or "no such table" in msg:
            hint = " (Удалите apps/api/dev.db и перезапустите API для пересоздания схемы, либо выполните миграции.)"
        raise HTTPException(status_code=500, detail=f"Assets list error: {e!s}{hint}") from e


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
    try:
        conditions = _build_filter_conditions(filters)
        query = select(Asset)
        if conditions:
            query = query.where(and_(*conditions))

        count_query = select(func.count(Asset.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        sort_column = _get_sort_column(filters.sort_by)
        if filters.sort_order == SortOrder.DESC:
            ob = sort_column.desc() if is_sqlite else sort_column.desc().nulls_last()
        else:
            ob = sort_column.asc() if is_sqlite else sort_column.asc().nulls_last()
        query = query.order_by(ob)

        offset = (filters.page - 1) * filters.page_size
        query = query.offset(offset).limit(filters.page_size)
        result = await db.execute(query)
        assets = result.scalars().all()

        items = []
        for i, a in enumerate(assets):
            try:
                items.append(AssetResponse.model_validate(a))
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Asset serialization error at index {i} (id={getattr(a, 'id', '?')}): {e!s}",
                ) from e

        return AssetList(
            items=items,
            total=total,
            page=filters.page,
            page_size=filters.page_size,
            pages=(total + filters.page_size - 1) // filters.page_size if total > 0 else 0,
        )
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        hint = ""
        if "no such column" in msg or "no such table" in msg:
            hint = " (Удалите apps/api/dev.db и перезапустите API для пересоздания схемы, либо выполните миграции.)"
        raise HTTPException(status_code=500, detail=f"Assets filter error: {e!s}{hint}") from e


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
        raw = row[0]
        if not raw:
            continue
        if isinstance(raw, list):
            all_tags.update([str(x) for x in raw])
            continue
        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    all_tags.update([str(x) for x in parsed])
                else:
                    all_tags.add(str(parsed))
            except Exception:
                all_tags.add(raw)
            continue
        all_tags.add(str(raw))
    
    # Asset types and statuses from enum
    asset_types = [t.value for t in AssetType]
    statuses = [s.value for s in AssetStatus]
    risk_levels = [r.value for r in RiskLevel]
    financial_products = [fp.value for fp in FinancialProductType]
    insurance_product_types = [ipt.value for ipt in InsuranceProductType]
    
    return {
        "countries": sorted(countries),
        "cities": sorted(cities),
        "regions": sorted(regions),
        "tags": sorted(list(all_tags)),
        "asset_types": asset_types,
        "statuses": statuses,
        "risk_levels": risk_levels,
        "financial_products": financial_products,
        "insurance_product_types": insurance_product_types,
        "sort_fields": [f.value for f in AssetSortField],
    }


@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(
    asset_data: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new physical asset.
    
    This creates the asset record and initializes a Digital Twin.
    """
    from uuid import uuid4
    from datetime import datetime
    import json
    from src.models.digital_twin import DigitalTwin, TwinState

    # Asset.id is stored as String(36) in the DB model; keep ids as strings.
    asset_id = str(uuid4())
    pars_id = generate_pars_id(
        asset_data.country_code,
        asset_data.city,
        str(asset_id),
    )

    asset = Asset(
        id=asset_id,
        pars_id=pars_id,
        name=asset_data.name,
        description=asset_data.description,
        asset_type=asset_data.asset_type.value if hasattr(asset_data.asset_type, "value") else str(asset_data.asset_type),
        status=AssetStatus.DRAFT.value,
        latitude=asset_data.latitude,
        longitude=asset_data.longitude,
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
        # Financial Product fields (Phase 0.1)
        financial_product=asset_data.financial_product.value if asset_data.financial_product else None,
        insurance_product_type=asset_data.insurance_product_type.value if asset_data.insurance_product_type else None,
        credit_facility_id=asset_data.credit_facility_id,
        tags=json.dumps(asset_data.tags or []),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    # Initialize Digital Twin record (Layer 1)
    try:
        twin = DigitalTwin(
            asset_id=str(asset.id),
            state=TwinState.INITIALIZING.value,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(twin)
        await db.commit()
    except Exception:
        # Non-fatal: asset exists; twin can be created later.
        await db.rollback()
    
    # Emit portfolio updated event
    try:
        await event_emitter.emit_portfolio_updated(
            portfolio_data={
                "action": "asset_created",
                "asset_id": str(asset.id),
                "name": asset.name,
                "valuation": asset.current_valuation,
                "asset_type": str(getattr(asset, "asset_type", "")),
            }
        )
    except Exception:
        # WebSockets/events should never break CRUD.
        pass
    
    return asset


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single asset by ID."""
    result = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return asset


@router.get("/{asset_id}/degradation", response_model=DegradationResponse)
async def get_asset_degradation(
    asset_id: UUID,
    horizon_years: int = Query(default=10, ge=1, le=30),
    maintenance_quality: str = Query(default="average", description="poor|average|good|excellent"),
    db: AsyncSession = Depends(get_db),
):
    """Phase 1.4: Degradation simulation (remaining life, failure probability, recommended CAPEX)."""
    result = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    sim = await physics_engine.simulate_degradation(
        asset_id=str(asset.id),
        horizon_years=horizon_years,
        asset_type=str(asset.asset_type),
        year_built=int(asset.year_built or 2010),
        physical_risk_score=float(asset.physical_risk_score or 25.0),
        climate_risk_score=float(asset.climate_risk_score or 30.0),
        maintenance_quality=maintenance_quality,
        replacement_cost=float(asset.current_valuation or 10_000_000),
    )
    return DegradationResponse(**asdict(sim))


@router.get("/{asset_id}/downtime-forecast", response_model=DowntimeForecastResponse)
async def get_asset_downtime_forecast(
    asset_id: UUID,
    horizon_years: int = Query(default=1, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    """Phase 2.4-2.5: Downtime forecast for an asset."""
    svc = DowntimeForecastService(db)
    try:
        forecast = await svc.forecast(asset_id=str(asset_id), horizon_years=horizon_years)
    except ValueError:
        raise HTTPException(status_code=404, detail="Asset not found")
    return DowntimeForecastResponse(**asdict(forecast))


@router.get("/{asset_id}/operational-risk", response_model=OperationalRiskResponse)
async def get_asset_operational_risk(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 2.3: Specialized operational risk metrics for complex assets.
    Returns a type-specific scorecard (data_center/logistics/port/energy).
    """
    # Ensure asset exists (and read type)
    result = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    svc = ComplexAssetScoringService(db)
    at = str(asset.asset_type or "")
    at_l = at.lower()

    # Map asset types to scoring models
    if "data_center" in at_l:
        scored = await svc.score_data_center(str(asset_id))
        model = "data_center"
    elif "logistics" in at_l:
        scored = await svc.score_logistics(str(asset_id))
        model = "logistics"
    elif "infrastructure_transport" in at_l:
        scored = await svc.score_port(str(asset_id))
        model = "port"
    elif "energy" in at_l or "infrastructure_power" in at_l:
        scored = await svc.score_energy(str(asset_id))
        model = "energy"
    else:
        # Generic fallback using risk scores
        model = "generic"
        scored = {
            "asset_id": str(asset_id),
            "overall_score": float(max(0, 100 - ((asset.physical_risk_score or 25) * 0.6 + (asset.climate_risk_score or 30) * 0.4))),
            "recommendations": [
                "Collect operational telemetry (uptime, maintenance, incidents) for a type-specific score.",
                "Upload BIM/PointCloud/Satellite for better physical condition inference.",
            ],
        }

    result_dict = asdict(scored) if hasattr(scored, "__dataclass_fields__") else dict(scored)

    return OperationalRiskResponse(
        asset_id=str(asset_id),
        asset_type=at,
        scoring_model=model,
        result=result_dict,
    )


@router.get("/{asset_id}/scene-export", response_model=SceneExportResponse)
async def export_asset_scene(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 6.5-6.6 (MVP): Scene export for an asset (GLB + metadata).
    
    This MVP returns URLs to already-existing asset artifacts (BIM/thumbnail),
    plus a metadata bundle that the frontend can use to assemble a scene.
    """
    result = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # We don't generate GLB server-side in this MVP. If BIM exists, expose BIM endpoint as a source.
    bim_url = f"/api/v1/assets/{asset_id}/bim" if asset.bim_file_path else None

    # Thumbnail is stored as a path in the model but there is no dedicated endpoint in this router.
    # Expose it as metadata for now.
    thumbnail_url = None

    return SceneExportResponse(
        asset_id=str(asset_id),
        glb_url=None,
        bim_url=bim_url,
        thumbnail_url=thumbnail_url,
        metadata={
            "pars_id": asset.pars_id,
            "name": asset.name,
            "asset_type": str(asset.asset_type),
            "location": {
                "latitude": asset.latitude,
                "longitude": asset.longitude,
                "city": asset.city,
                "country_code": asset.country_code,
            },
            "files": {
                "bim_file_path": asset.bim_file_path,
                "point_cloud_path": asset.point_cloud_path,
                "thumbnail_path": asset.thumbnail_path,
            },
            "risk_scores": {
                "climate_risk_score": asset.climate_risk_score,
                "physical_risk_score": asset.physical_risk_score,
                "network_risk_score": asset.network_risk_score,
            },
            "export": {
                "format": "mvp",
                "generated": False,
                "notes": "MVP returns URLs/metadata; GLB generation is not implemented yet.",
            },
        },
    )


@router.delete("/{asset_id}", status_code=204)
async def delete_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an asset."""
    result = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
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


@router.get("/{asset_id}/bim")
async def get_asset_bim_file(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the BIM (IFC) file for an asset.
    
    Returns the IFC file from object storage. Requires the asset to have
    a BIM file previously uploaded via POST /assets/{id}/upload-bim.
    """
    result = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    if not asset.bim_file_path:
        raise HTTPException(status_code=404, detail="No BIM file for this asset")
    
    # bim_file_path format: "bucket/object_name" (from storage.upload_file)
    parts = asset.bim_file_path.split("/", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=500, detail="Invalid BIM path format")
    bucket, object_name = parts[0], parts[1]
    
    try:
        data = storage.download_file(bucket, object_name)
    except S3Error as e:
        raise HTTPException(
            status_code=503,
            detail="Object storage unavailable or file not found",
        ) from e
    
    # Optional: extract filename for Content-Disposition (last part of object_name)
    filename = object_name.split("/")[-1] if "/" in object_name else object_name
    
    return Response(
        content=data,
        media_type="application/ifc",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


@router.post("/{asset_id}/upload-bim")
async def upload_bim_file(
    asset_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a BIM file (IFC format) for an asset.
    
    The file will be stored in MinIO and linked to the asset's Digital Twin.
    Supported formats: .ifc, .ifczip
    """
    # Validate asset exists
    result = await db.execute(select(Asset).where(Asset.id == str(asset_id)))
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
