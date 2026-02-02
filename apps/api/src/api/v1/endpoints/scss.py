"""
SCSS (Supply Chain Sovereignty System) module endpoints.

Provides API for managing suppliers, supply routes, and supply chain risks
with sovereignty assessment and alternative sourcing capabilities.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.modules.scss.service import SCSSService
from src.modules.scss.models import SupplierType, SupplierTier, RiskLevel

router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class SupplierCreate(BaseModel):
    """Request to register new supplier."""
    name: str = Field(..., min_length=1, max_length=255)
    supplier_type: str = Field(default="other")
    tier: str = Field(default="tier_1")
    country_code: str = Field(default="DE", max_length=2)
    region: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    description: Optional[str] = None
    industry_sector: Optional[str] = None
    is_critical: bool = False
    extra_data: Optional[Dict[str, Any]] = None


class SupplierUpdate(BaseModel):
    """Request to update supplier."""
    name: Optional[str] = None
    description: Optional[str] = None
    tier: Optional[str] = None
    is_critical: Optional[bool] = None
    is_active: Optional[bool] = None
    sovereignty_score: Optional[float] = None
    geopolitical_risk: Optional[float] = None
    concentration_risk: Optional[float] = None
    financial_stability: Optional[float] = None
    lead_time_days: Optional[int] = None
    on_time_delivery_pct: Optional[float] = None
    quality_score: Optional[float] = None
    has_alternative: Optional[bool] = None
    extra_data: Optional[Dict[str, Any]] = None


class SupplierResponse(BaseModel):
    """Supplier response model."""
    id: str
    scss_id: str
    name: str
    description: Optional[str] = None
    supplier_type: str
    tier: str
    country_code: str
    region: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    industry_sector: Optional[str] = None
    sovereignty_score: Optional[float] = None
    geopolitical_risk: Optional[float] = None
    concentration_risk: Optional[float] = None
    financial_stability: Optional[float] = None
    is_active: bool
    is_critical: bool
    has_alternative: bool

    class Config:
        from_attributes = True


class RouteCreate(BaseModel):
    """Request to create a supply route."""
    source_id: str = Field(..., description="Source supplier ID")
    target_id: str = Field(..., description="Target supplier or asset ID")
    target_type: str = Field(default="supplier")
    transport_mode: Optional[str] = None
    distance_km: Optional[float] = None
    transit_time_days: Optional[int] = None
    is_primary: bool = True
    description: Optional[str] = None


class RouteResponse(BaseModel):
    """Route response model."""
    id: str
    source_id: str
    target_id: str
    target_type: str
    transport_mode: Optional[str] = None
    distance_km: Optional[float] = None
    transit_time_days: Optional[int] = None
    is_primary: bool
    has_backup: bool

    class Config:
        from_attributes = True


class RiskCreate(BaseModel):
    """Request to create a supply chain risk."""
    title: str = Field(..., min_length=1, max_length=255)
    risk_type: str = Field(..., description="geopolitical, natural, financial, operational, cyber")
    risk_level: str = Field(default="medium")
    description: Optional[str] = None
    affected_supplier_ids: Optional[List[str]] = None
    affected_region: Optional[str] = None
    probability: Optional[float] = Field(None, ge=0, le=1)
    impact_score: Optional[float] = Field(None, ge=0, le=100)
    estimated_loss: Optional[float] = None


class RiskResponse(BaseModel):
    """Risk response model."""
    id: str
    title: str
    risk_type: str
    risk_level: str
    description: Optional[str] = None
    affected_region: Optional[str] = None
    probability: Optional[float] = None
    impact_score: Optional[float] = None
    estimated_loss: Optional[float] = None
    mitigation_status: str

    class Config:
        from_attributes = True


# ==================== HELPER ====================

def _supplier_to_response(supplier) -> SupplierResponse:
    """Convert supplier model to response."""
    return SupplierResponse(
        id=supplier.id,
        scss_id=supplier.scss_id,
        name=supplier.name,
        description=supplier.description,
        supplier_type=supplier.supplier_type,
        tier=supplier.tier,
        country_code=supplier.country_code,
        region=supplier.region,
        city=supplier.city,
        latitude=supplier.latitude,
        longitude=supplier.longitude,
        industry_sector=supplier.industry_sector,
        sovereignty_score=supplier.sovereignty_score,
        geopolitical_risk=supplier.geopolitical_risk,
        concentration_risk=supplier.concentration_risk,
        financial_stability=supplier.financial_stability,
        is_active=supplier.is_active,
        is_critical=supplier.is_critical,
        has_alternative=supplier.has_alternative,
    )


# ==================== STATUS ====================

@router.get("", summary="SCSS module status")
async def scss_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Return SCSS module status and statistics."""
    service = SCSSService(db)
    stats = await service.get_statistics()
    return {
        "module": "scss",
        "status": "ok",
        "statistics": stats,
    }


# ==================== SUPPLIER CRUD ====================

@router.post("/suppliers", response_model=SupplierResponse, status_code=201)
async def register_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new supplier.
    
    Creates a SCSS record with:
    - Unique SCSS ID (e.g., SCSS-COMPONENT-DE-ABC123)
    - Classification (type, tier)
    - Location data
    - Risk scores
    """
    service = SCSSService(db)
    
    supplier = await service.register_supplier(
        name=data.name,
        supplier_type=data.supplier_type,
        tier=data.tier,
        country_code=data.country_code,
        region=data.region,
        city=data.city,
        latitude=data.latitude,
        longitude=data.longitude,
        description=data.description,
        industry_sector=data.industry_sector,
        is_critical=data.is_critical,
        extra_data=data.extra_data,
    )
    
    await db.commit()
    
    return _supplier_to_response(supplier)


@router.get("/suppliers", response_model=List[SupplierResponse])
async def list_suppliers(
    supplier_type: Optional[str] = Query(None, description="Filter by type"),
    tier: Optional[str] = Query(None, description="Filter by tier"),
    country_code: Optional[str] = Query(None, description="Filter by country"),
    is_critical: Optional[bool] = Query(None, description="Filter critical suppliers"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List suppliers with optional filters."""
    service = SCSSService(db)
    
    suppliers = await service.list_suppliers(
        supplier_type=supplier_type,
        tier=tier,
        country_code=country_code,
        is_critical=is_critical,
        limit=limit,
        offset=offset,
    )
    
    return [_supplier_to_response(s) for s in suppliers]


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get supplier by ID or SCSS ID."""
    service = SCSSService(db)
    
    supplier = await service.get_supplier(supplier_id)
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    return _supplier_to_response(supplier)


@router.patch("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update supplier attributes."""
    service = SCSSService(db)
    
    updates = data.model_dump(exclude_unset=True)
    
    supplier = await service.update_supplier(supplier_id, updates)
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    await db.commit()
    
    return _supplier_to_response(supplier)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete supplier by ID."""
    service = SCSSService(db)
    
    success = await service.delete_supplier(supplier_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    await db.commit()
    
    return {"status": "deleted", "id": supplier_id}


# ==================== ROUTES ====================

@router.post("/routes", response_model=RouteResponse, status_code=201)
async def add_route(
    data: RouteCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Add a supply route between entities.
    
    - source_id: Source supplier
    - target_id: Target supplier or asset
    """
    service = SCSSService(db)
    
    # Verify source exists
    source = await service.get_supplier(data.source_id)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source supplier {data.source_id} not found")
    
    route = await service.add_route(
        source_id=data.source_id,
        target_id=data.target_id,
        target_type=data.target_type,
        transport_mode=data.transport_mode,
        distance_km=data.distance_km,
        transit_time_days=data.transit_time_days,
        is_primary=data.is_primary,
        description=data.description,
    )
    
    await db.commit()
    
    return RouteResponse(
        id=route.id,
        source_id=route.source_id,
        target_id=route.target_id,
        target_type=route.target_type,
        transport_mode=route.transport_mode,
        distance_km=route.distance_km,
        transit_time_days=route.transit_time_days,
        is_primary=route.is_primary,
        has_backup=route.has_backup,
    )


@router.get("/suppliers/{supplier_id}/routes")
async def get_routes(
    supplier_id: str,
    direction: str = Query("both", description="outgoing, incoming, or both"),
    db: AsyncSession = Depends(get_db),
):
    """Get supply routes for a supplier."""
    service = SCSSService(db)
    
    supplier = await service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    routes = await service.get_routes(supplier_id, direction=direction)
    
    return {
        "supplier_id": supplier_id,
        "scss_id": supplier.scss_id,
        "outgoing": [
            RouteResponse(
                id=r.id,
                source_id=r.source_id,
                target_id=r.target_id,
                target_type=r.target_type,
                transport_mode=r.transport_mode,
                distance_km=r.distance_km,
                transit_time_days=r.transit_time_days,
                is_primary=r.is_primary,
                has_backup=r.has_backup,
            ).model_dump()
            for r in routes["outgoing"]
        ],
        "incoming": [
            RouteResponse(
                id=r.id,
                source_id=r.source_id,
                target_id=r.target_id,
                target_type=r.target_type,
                transport_mode=r.transport_mode,
                distance_km=r.distance_km,
                transit_time_days=r.transit_time_days,
                is_primary=r.is_primary,
                has_backup=r.has_backup,
            ).model_dump()
            for r in routes["incoming"]
        ],
    }


@router.delete("/routes/{route_id}")
async def delete_route(
    route_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a supply route."""
    service = SCSSService(db)
    
    success = await service.delete_route(route_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Route not found")
    
    await db.commit()
    
    return {"status": "deleted", "id": route_id}


# ==================== RISKS ====================

@router.post("/risks", response_model=RiskResponse, status_code=201)
async def create_risk(
    data: RiskCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a supply chain risk entry."""
    service = SCSSService(db)
    
    risk = await service.create_risk(
        title=data.title,
        risk_type=data.risk_type,
        risk_level=data.risk_level,
        description=data.description,
        affected_supplier_ids=data.affected_supplier_ids,
        affected_region=data.affected_region,
        probability=data.probability,
        impact_score=data.impact_score,
        estimated_loss=data.estimated_loss,
    )
    
    await db.commit()
    
    return RiskResponse(
        id=risk.id,
        title=risk.title,
        risk_type=risk.risk_type,
        risk_level=risk.risk_level,
        description=risk.description,
        affected_region=risk.affected_region,
        probability=risk.probability,
        impact_score=risk.impact_score,
        estimated_loss=risk.estimated_loss,
        mitigation_status=risk.mitigation_status,
    )


@router.get("/risks", response_model=List[RiskResponse])
async def list_risks(
    risk_level: Optional[str] = Query(None, description="Filter by level"),
    risk_type: Optional[str] = Query(None, description="Filter by type"),
    mitigation_status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List supply chain risks."""
    service = SCSSService(db)
    
    risks = await service.list_risks(
        risk_level=risk_level,
        risk_type=risk_type,
        mitigation_status=mitigation_status,
        limit=limit,
        offset=offset,
    )
    
    return [
        RiskResponse(
            id=r.id,
            title=r.title,
            risk_type=r.risk_type,
            risk_level=r.risk_level,
            description=r.description,
            affected_region=r.affected_region,
            probability=r.probability,
            impact_score=r.impact_score,
            estimated_loss=r.estimated_loss,
            mitigation_status=r.mitigation_status,
        )
        for r in risks
    ]


# ==================== SOVEREIGNTY ASSESSMENT ====================

@router.get("/suppliers/{supplier_id}/sovereignty")
async def get_sovereignty_score(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate sovereignty score for a supplier.
    
    Returns:
    - Overall sovereignty score (0-100)
    - Component scores
    - Recommendations
    """
    service = SCSSService(db)
    
    result = await service.calculate_sovereignty_score(supplier_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


# ==================== REFERENCE DATA ====================

@router.get("/types")
async def get_supplier_types():
    """Get list of available supplier types."""
    return {
        "types": [
            {"value": t.value, "name": t.name.replace("_", " ").title()}
            for t in SupplierType
        ]
    }


@router.get("/tiers")
async def get_supplier_tiers():
    """Get list of supplier tiers with descriptions."""
    descriptions = {
        "tier_1": "Direct suppliers - First level of supply chain",
        "tier_2": "Suppliers to Tier 1 - Second level",
        "tier_3": "Suppliers to Tier 2 - Third level",
        "tier_n": "Deep supply chain - Extended network",
    }
    return {
        "tiers": [
            {"value": t.value, "name": t.name, "description": descriptions.get(t.value, "")}
            for t in SupplierTier
        ]
    }


@router.get("/risk-levels")
async def get_risk_levels():
    """Get list of risk levels."""
    return {
        "levels": [
            {"value": r.value, "name": r.name.title()}
            for r in RiskLevel
        ]
    }
