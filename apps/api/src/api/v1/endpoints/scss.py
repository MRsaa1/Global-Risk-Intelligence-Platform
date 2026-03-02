"""
SCSS (Supply Chain Sovereignty System) module endpoints.

Provides API for managing suppliers, supply routes, and supply chain risks
with sovereignty assessment and alternative sourcing capabilities.

Implements: FR-SCSS-001 (Suppliers), FR-SCSS-002 (Chain Mapping), FR-SCSS-004 (Bottlenecks),
FR-SCSS-006 (Geopolitical Simulation), FR-SCSS-007 (SCSS_ADVISOR alternatives).
Phase 5: Sync (config, run, audit). Phase 6: Compliance (sanctions), Audit trail, Executive report.
"""
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.modules.scss.service import SCSSService
from src.modules.scss.sync_service import SCSSSyncService
from src.modules.scss.compliance_service import SCSSComplianceService
from src.modules.scss.models import SupplierType, SupplierTier, RiskLevel, AuditLog
from src.services.pdf_report import generate_scss_executive_pdf, HAS_PDF

router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class SupplierCreate(BaseModel):
    """Request to register new supplier (FR-SCSS-001)."""
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
    materials: Optional[List[str]] = Field(None, description="e.g. ['lithium', 'cobalt']")
    capacity: Optional[int] = Field(None, ge=0, description="Capacity units per month (e.g. tons)")
    lead_time_days: Optional[int] = Field(None, ge=0)
    geopolitical_risk: Optional[float] = Field(None, ge=0, le=100)
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
    materials: Optional[List[str]] = None
    capacity: Optional[int] = Field(None, ge=0)
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
    materials: Optional[List[str]] = None
    capacity: Optional[int] = None
    lead_time_days: Optional[int] = None

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
    extra = {}
    if supplier.extra_data:
        try:
            extra = json.loads(supplier.extra_data)
        except Exception:
            pass
    materials = extra.get("materials") if isinstance(extra.get("materials"), list) else None
    capacity = extra.get("capacity") if isinstance(extra.get("capacity"), (int, float)) else None
    if capacity is not None:
        capacity = int(capacity)
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
        materials=materials,
        capacity=capacity,
        lead_time_days=supplier.lead_time_days,
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
        materials=data.materials,
        capacity=data.capacity,
        lead_time_days=data.lead_time_days,
        geopolitical_risk=data.geopolitical_risk,
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


# ==================== BOTTLENECK ANALYSIS ====================

class BottleneckAnalyzeRequest(BaseModel):
    """Request to analyze bottlenecks (optional scope)."""
    supplier_ids: Optional[List[str]] = Field(None, description="Limit analysis to these supplier IDs; omit for all")
    min_geopolitical_risk: float = Field(70.0, ge=0, le=100, description="Threshold for high geopolitical risk")


@router.post("/bottlenecks/analyze")
async def analyze_bottlenecks(
    data: Optional[BottleneckAnalyzeRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Identify supply chain bottlenecks.
    
    Bottleneck types:
    - single_point_of_failure: supplier is the only source for one or more targets
    - high_geopolitical_critical: high geopolitical risk and marked critical
    - concentration: only supplier in country for this supplier_type
    
    Returns list of bottlenecks with supplier_id, risk_types, bottleneck_score,
    severity, affected_downstream_count, and recommendations.
    """
    service = SCSSService(db)
    supplier_ids = data.supplier_ids if data else None
    min_geo = data.min_geopolitical_risk if data else 70.0
    result = await service.analyze_bottlenecks(
        supplier_ids=supplier_ids,
        min_geopolitical_risk=min_geo,
    )
    return result


@router.get("/bottlenecks")
async def get_bottlenecks(
    min_geopolitical_risk: float = Query(70.0, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get bottleneck analysis for all suppliers (convenience GET)."""
    service = SCSSService(db)
    return await service.analyze_bottlenecks(
        supplier_ids=None,
        min_geopolitical_risk=min_geopolitical_risk,
    )


@router.get("/bottlenecks/heatmap", summary="Bottleneck heatmap for world map (FR-SCSS-005)")
async def get_bottlenecks_heatmap(
    min_geopolitical_risk: float = Query(70.0, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Bottleneck heatmap: geographic points with bottleneck scores for world map visualization.
    Returns list of {latitude, longitude, bottleneck_score, severity, supplier_id, country_code}.
    """
    service = SCSSService(db)
    result = await service.analyze_bottlenecks(
        supplier_ids=None,
        min_geopolitical_risk=min_geopolitical_risk,
    )
    heatmap_points = []
    for b in result.get("bottlenecks", []):
        supplier = await service.get_supplier(b["supplier_id"])
        if supplier and (supplier.latitude or supplier.longitude):
            heatmap_points.append({
                "latitude": supplier.latitude,
                "longitude": supplier.longitude,
                "bottleneck_score": b["bottleneck_score"],
                "severity": b["severity"],
                "supplier_id": b["supplier_id"],
                "country_code": b.get("country_code", supplier.country_code),
                "name": b.get("name", supplier.name),
            })
        else:
            heatmap_points.append({
                "latitude": None,
                "longitude": None,
                "bottleneck_score": b["bottleneck_score"],
                "severity": b["severity"],
                "supplier_id": b["supplier_id"],
                "country_code": b.get("country_code"),
                "name": b.get("name"),
            })
    return {"heatmap": heatmap_points, "summary": result.get("summary", {})}


# ==================== ALTERNATIVE SUPPLIER RECOMMENDATIONS (SCSS_ADVISOR) ====================

class AlternativeSuppliersRequest(BaseModel):
    """Request for alternative supplier recommendations."""
    supplier_id: str = Field(..., description="Supplier to find alternatives for")
    limit: int = Field(10, ge=1, le=50)
    prefer_different_country: bool = Field(True, description="Prioritize suppliers in different countries")
    same_supplier_type: bool = Field(True, description="Restrict to same supplier_type")


@router.post("/recommendations/alternative-suppliers")
async def get_alternative_suppliers(
    data: AlternativeSuppliersRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Get alternative supplier recommendations (SCSS_ADVISOR).
    
    Ranks alternatives by lower geopolitical risk, geographic diversification,
    sovereignty score, financial stability.
    """
    service = SCSSService(db)
    result = await service.find_alternative_suppliers(
        supplier_id=data.supplier_id,
        limit=data.limit,
        prefer_different_country=data.prefer_different_country,
        same_supplier_type=data.same_supplier_type,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


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


# ==================== SUPPLY CHAINS CRUD (FR-SCSS-002, FR-SCSS-003, FR-SCSS-004) ====================

class SupplyChainCreate(BaseModel):
    """Request to create supply chain."""
    name: str = Field(..., min_length=1)
    root_supplier_id: str = Field(...)
    description: Optional[str] = None


@router.post("/supply-chains", status_code=201)
async def create_supply_chain(
    data: SupplyChainCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a named supply chain (raw material -> component -> product)."""
    service = SCSSService(db)
    chain = await service.create_supply_chain(
        name=data.name,
        root_supplier_id=data.root_supplier_id,
        description=data.description,
    )
    if not chain:
        raise HTTPException(status_code=404, detail="Root supplier not found")
    await db.commit()
    return {"id": chain.id, "name": chain.name, "root_supplier_id": chain.root_supplier_id}


@router.get("/supply-chains")
async def list_supply_chains(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List supply chains."""
    service = SCSSService(db)
    return await service.list_supply_chains(limit=limit)


@router.get("/supply-chains/{chain_id}/graph", summary="Visualize supply chain graph (FR-SCSS-003)")
async def get_supply_chain_graph(
    chain_id: str,
    max_tiers: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    """Get supply chain graph: nodes, edges, tiers (Sankey/hierarchical)."""
    service = SCSSService(db)
    chain = await service.get_supply_chain(chain_id)
    if not chain or not chain.root_supplier_id:
        raise HTTPException(status_code=404, detail="Supply chain not found")
    return await service.map_supply_chain(
        root_supplier_id=chain.root_supplier_id,
        max_tiers=max_tiers,
    )


@router.post("/supply-chains/{chain_id}/analyze-bottlenecks", summary="Analyze bottlenecks for chain (FR-SCSS-004)")
async def analyze_supply_chain_bottlenecks(
    chain_id: str,
    min_geopolitical_risk: float = Query(70.0, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Identify bottlenecks within this supply chain."""
    service = SCSSService(db)
    chain = await service.get_supply_chain(chain_id)
    if not chain or not chain.root_supplier_id:
        raise HTTPException(status_code=404, detail="Supply chain not found")
    mapped = await service.map_supply_chain(
        root_supplier_id=chain.root_supplier_id,
        max_tiers=10,
    )
    supplier_ids = [n["id"] for n in mapped.get("nodes", [])]
    result = await service.analyze_bottlenecks(
        supplier_ids=supplier_ids if supplier_ids else None,
        min_geopolitical_risk=min_geopolitical_risk,
    )
    result["chain_id"] = chain_id
    result["chain_name"] = chain.name
    return result


# ==================== SUPPLY CHAIN MAPPING (FR-SCSS-002) ====================

@router.get("/chain/map")
async def map_supply_chain(
    root_supplier_id: str = Query(..., description="Root supplier ID or SCSS ID (e.g. final assembly)"),
    max_tiers: int = Query(5, ge=1, le=10),
    max_nodes: Optional[int] = Query(None, ge=1, le=2000, description="Cap total nodes (optional, for large chains)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Build multi-tier supply chain graph from a root node (FR-SCSS-002).
    
    Returns nodes by tier, edges, and geographic concentration summary.
    Traverses incoming routes (who supplies whom) up to max_tiers.
    Use max_nodes to limit graph size for performance.
    """
    service = SCSSService(db)
    result = await service.map_supply_chain(
        root_supplier_id=root_supplier_id,
        max_tiers=max_tiers,
        max_nodes=max_nodes,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ==================== GEOPOLITICAL SIMULATION (FR-SCSS-006) ====================

class SimulateRequest(BaseModel):
    """Request to run geopolitical simulation (Phase 4: scope, cascade, timeline)."""
    scenario: str = Field(..., description="trade_war | sanctions | disaster")
    country_code: Optional[str] = Field(None, description="Target country (e.g. CN, RU)")
    country_codes: Optional[List[str]] = Field(None, description="Multiple target countries for scope")
    region: Optional[str] = Field(None, description="Target region for disaster")
    tariff_pct: float = Field(25.0, ge=0, le=100, description="For trade_war")
    severity: float = Field(7.0, ge=1, le=10, description="For disaster (1-10)")
    root_supplier_id: Optional[str] = Field(None, description="Limit scope to chain from this supplier")
    supplier_ids: Optional[List[str]] = Field(None, description="Limit scope to these supplier IDs")
    duration_months: int = Field(12, ge=1, le=60)
    cascade: bool = Field(True, description="Include cascading effects in timeline")


@router.post("/simulate")
async def run_geopolitical_simulation(
    data: SimulateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run geopolitical scenario (FR-SCSS-006).
    
    Scenarios:
    - trade_war: Apply tariff to suppliers in country_code
    - sanctions: Cut off suppliers in country_code
    - disaster: Capacity loss by severity in region/country
    
    Returns impact, recovery_plan, cost_analysis.
    """
    service = SCSSService(db)
    params = {
        "country_code": data.country_code,
        "country_codes": data.country_codes,
        "region": data.region,
        "tariff_pct": data.tariff_pct,
        "severity": data.severity,
        "cascade": data.cascade,
    }
    result = await service.run_geopolitical_simulation(
        scenario=data.scenario,
        scenario_params=params,
        root_supplier_id=data.root_supplier_id,
        supplier_ids=data.supplier_ids,
        duration_months=data.duration_months,
    )
    if "error" in result and "supported" not in result:
        raise HTTPException(status_code=400, detail=result["error"])
    # Phase 6: audit trail for scenario run
    await service.log_audit(
        "scenario",
        data.root_supplier_id,
        "simulate",
        None,
        {"scenario": data.scenario, "country_codes": data.country_codes, "cascade": data.cascade},
    )
    return result


# ==================== Phase 5: Sync ====================

@router.get("/sync/status")
async def get_sync_status(db: AsyncSession = Depends(get_db)):
    """Data sync status: last_refresh, next_scheduled, adapter (from config)."""
    sync_svc = SCSSSyncService(db)
    return await sync_svc.get_status()


class SyncConfigUpdate(BaseModel):
    """Request to create/update sync config."""
    adapter_type: str = Field(default="manual", description="manual, sap, oracle, edi")
    cron_expression: Optional[str] = Field(None, description="e.g. 0 */15 * * *")
    webhook_url: Optional[str] = None
    config_json: Optional[str] = None
    is_enabled: bool = True


@router.get("/sync/config")
async def get_sync_config(db: AsyncSession = Depends(get_db)):
    """Get current sync configuration."""
    sync_svc = SCSSSyncService(db)
    config = await sync_svc.get_config()
    if not config:
        return {"adapter_type": "manual", "is_enabled": False, "message": "No config. Use PUT to create."}
    return {
        "id": config.id,
        "adapter_type": config.adapter_type,
        "cron_expression": config.cron_expression,
        "webhook_url": config.webhook_url,
        "is_enabled": config.is_enabled,
    }


@router.put("/sync/config")
async def put_sync_config(
    data: SyncConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Create or update sync configuration (cron/webhook, adapter)."""
    sync_svc = SCSSSyncService(db)
    config = await sync_svc.save_config(
        adapter_type=data.adapter_type,
        cron_expression=data.cron_expression,
        webhook_url=data.webhook_url,
        config_json=data.config_json,
        is_enabled=data.is_enabled,
    )
    await db.commit()
    return {"id": config.id, "adapter_type": config.adapter_type, "is_enabled": config.is_enabled}


@router.post("/sync/run")
async def post_sync_run(
    triggered_by: str = Query("api", description="Who triggered the run"),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a sync run (fetch from adapter, change detection, data quality, import audit)."""
    sync_svc = SCSSSyncService(db)
    result = await sync_svc.run_sync(triggered_by=triggered_by)
    await db.commit()
    return result


@router.get("/sync/runs")
async def list_sync_runs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List recent sync runs (audit)."""
    sync_svc = SCSSSyncService(db)
    return await sync_svc.list_sync_runs(limit=limit, offset=offset)


@router.get("/sync/runs/{run_id}/audit")
async def get_sync_run_audit(
    run_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Import audit entries for a sync run."""
    sync_svc = SCSSSyncService(db)
    return await sync_svc.list_import_audit(run_id)


# ==================== Phase 6: Compliance ====================

@router.get("/compliance/sanctions/graph")
async def get_sanctions_graph(
    entity_id: str = Query(..., description="Node id (e.g. asset or entity) to start BFS from"),
    max_hops: int = Query(6, ge=1, le=10, description="Max path length (5-6 handshakes)"),
):
    """
    Sanctions graph: BFS from given entity up to max_hops.
    Returns chains (paths) and all nodes within radius (e.g. «5-6 handshakes» to sanctioned entity).
    Uses Knowledge Graph (Neo4j); when disabled returns empty.
    """
    from src.services.knowledge_graph import get_knowledge_graph_service
    kg = get_knowledge_graph_service()
    if not kg.is_available:
        return {"paths": [], "nodes_in_radius": [], "entity_id": entity_id, "max_hops": max_hops, "message": "Neo4j disabled"}
    return await kg.bfs_from_entity(entity_id=entity_id, max_hops=max_hops)


@router.get("/compliance/sanctions-status")
async def get_sanctions_status(db: AsyncSession = Depends(get_db)):
    """Sanctions screening status: last_scan, matches, pending review."""
    comp_svc = SCSSComplianceService(db)
    return await comp_svc.get_sanctions_status()


@router.post("/compliance/sanctions-scan")
async def post_sanctions_scan(db: AsyncSession = Depends(get_db)):
    """Run sanctions screening on all active suppliers (OFAC/EU stub)."""
    comp_svc = SCSSComplianceService(db)
    result = await comp_svc.run_sanctions_scan()
    await db.commit()
    return result


@router.get("/compliance/sanctions-matches")
async def list_sanctions_matches(
    status: Optional[str] = Query(None, description="pending, reviewed, cleared"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List sanctions matches with optional status filter."""
    comp_svc = SCSSComplianceService(db)
    return await comp_svc.list_sanctions_matches(status=status, limit=limit, offset=offset)


class SanctionsMatchReview(BaseModel):
    """Review a sanctions match."""
    status: str = Field(..., description="reviewed | cleared")
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None


@router.patch("/compliance/sanctions-matches/{match_id}")
async def patch_sanctions_match(
    match_id: str,
    data: SanctionsMatchReview,
    db: AsyncSession = Depends(get_db),
):
    """Update match status (reviewed/cleared)."""
    comp_svc = SCSSComplianceService(db)
    match = await comp_svc.update_match_status(
        match_id,
        status=data.status,
        reviewed_by=data.reviewed_by,
        notes=data.notes,
    )
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    await db.commit()
    return {"id": match.id, "status": match.status, "reviewed_at": match.reviewed_at.isoformat() if match.reviewed_at else None}


# ==================== Phase 6: Audit trail ====================

@router.get("/audit")
async def get_audit_trail(
    entity_type: Optional[str] = Query(None, description="supplier, route, risk, scenario, export"),
    entity_id: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, description="ISO date"),
    to_date: Optional[str] = Query(None, description="ISO date"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Query audit trail (who changed what)."""
    query = select(AuditLog).order_by(AuditLog.changed_at.desc())
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if from_date:
        query = query.where(AuditLog.changed_at >= from_date)
    if to_date:
        query = query.where(AuditLog.changed_at <= to_date)
    query = query.limit(limit).offset(offset)
    r = await db.execute(query)
    rows = r.scalars().all()
    return [
        {
            "id": row.id,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "action": row.action,
            "changed_by": row.changed_by,
            "changed_at": row.changed_at.isoformat() if row.changed_at else None,
            "details_json": row.details_json,
        }
        for row in rows
    ]


# ==================== Phase 6: Executive report ====================

@router.get("/reports/executive/data")
async def get_executive_report_data(
    root_supplier_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get executive report data as JSON (for Present to board / dashboards)."""
    service = SCSSService(db)
    return await service.get_executive_report_data(root_supplier_id=root_supplier_id)


@router.get("/reports/executive")
async def get_executive_report_pdf(
    root_supplier_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Generate and download SCSS Executive Report as PDF."""
    if not HAS_PDF:
        raise HTTPException(
            status_code=503,
            detail="PDF generation not available. Install reportlab.",
        )
    service = SCSSService(db)
    data = await service.get_executive_report_data(root_supplier_id=root_supplier_id)
    try:
        pdf_bytes = generate_scss_executive_pdf(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}") from e
    from datetime import datetime
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M")
    filename = f"scss_executive_report_{ts}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
