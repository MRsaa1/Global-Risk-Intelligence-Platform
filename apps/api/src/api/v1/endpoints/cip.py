"""
CIP (Critical Infrastructure Protection) module endpoints.

Provides API for managing critical infrastructure assets, dependencies,
and risk assessments using the CIP module service layer.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.modules.cip.service import CIPService
from src.modules.cip.models import InfrastructureType, CriticalityLevel, OperationalStatus
from src.services.module_audit import log_module_action

router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class InfrastructureCreate(BaseModel):
    """Request to register new infrastructure."""
    name: str = Field(..., min_length=1, max_length=255)
    infrastructure_type: str = Field(default="other")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    criticality_level: str = Field(default="tier_3")
    country_code: str = Field(default="DE", max_length=2)
    region: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    capacity_value: Optional[float] = None
    capacity_unit: Optional[str] = None
    population_served: Optional[int] = None
    owner_organization: Optional[str] = None
    operator_organization: Optional[str] = None
    asset_id: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class InfrastructureUpdate(BaseModel):
    """Request to update infrastructure."""
    name: Optional[str] = None
    description: Optional[str] = None
    criticality_level: Optional[str] = None
    operational_status: Optional[str] = None
    capacity_value: Optional[float] = None
    capacity_unit: Optional[str] = None
    population_served: Optional[int] = None
    vulnerability_score: Optional[float] = None
    exposure_score: Optional[float] = None
    resilience_score: Optional[float] = None
    estimated_recovery_hours: Optional[float] = None
    extra_data: Optional[Dict[str, Any]] = None


class InfrastructureResponse(BaseModel):
    """Infrastructure response model."""
    id: str
    cip_id: str
    name: str
    description: Optional[str] = None
    asset_id: Optional[str] = None
    infrastructure_type: str
    criticality_level: str
    operational_status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    country_code: str
    region: Optional[str] = None
    city: Optional[str] = None
    capacity_value: Optional[float] = None
    capacity_unit: Optional[str] = None
    population_served: Optional[int] = None
    vulnerability_score: Optional[float] = None
    exposure_score: Optional[float] = None
    resilience_score: Optional[float] = None
    cascade_risk_score: Optional[float] = None
    owner_organization: Optional[str] = None
    operator_organization: Optional[str] = None

    class Config:
        from_attributes = True


class DependencyCreate(BaseModel):
    """Request to create a dependency."""
    source_id: str = Field(..., description="Upstream infrastructure ID")
    target_id: str = Field(..., description="Downstream infrastructure ID")
    dependency_type: str = Field(default="operational")
    strength: float = Field(default=1.0, ge=0, le=1)
    propagation_delay_minutes: Optional[int] = None
    description: Optional[str] = None


class DependencyResponse(BaseModel):
    """Dependency response model."""
    id: str
    source_id: str
    target_id: str
    dependency_type: str
    strength: float
    propagation_delay_minutes: Optional[int] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== HELPER ====================

def _infrastructure_to_response(infra) -> InfrastructureResponse:
    """Convert infrastructure model to response."""
    return InfrastructureResponse(
        id=infra.id,
        cip_id=infra.cip_id,
        name=infra.name,
        description=infra.description,
        asset_id=infra.asset_id,
        infrastructure_type=infra.infrastructure_type,
        criticality_level=infra.criticality_level,
        operational_status=infra.operational_status,
        latitude=infra.latitude,
        longitude=infra.longitude,
        country_code=infra.country_code,
        region=infra.region,
        city=infra.city,
        capacity_value=infra.capacity_value,
        capacity_unit=infra.capacity_unit,
        population_served=infra.population_served,
        vulnerability_score=infra.vulnerability_score,
        exposure_score=infra.exposure_score,
        resilience_score=infra.resilience_score,
        cascade_risk_score=infra.cascade_risk_score,
        owner_organization=infra.owner_organization,
        operator_organization=infra.operator_organization,
    )


# ==================== STATUS ====================

@router.get("", summary="CIP module status")
async def cip_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Return CIP module status and statistics."""
    service = CIPService(db)
    stats = await service.get_statistics()
    return {
        "module": "cip",
        "status": "ok",
        "statistics": stats,
    }


# ==================== INFRASTRUCTURE CRUD ====================

@router.post("/infrastructure", response_model=InfrastructureResponse, status_code=201)
async def register_infrastructure(
    data: InfrastructureCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new critical infrastructure asset.
    
    Creates a CIP record with:
    - Unique CIP ID (e.g., CIP-POWER-DE-ABC123)
    - Classification (type, criticality level)
    - Location data
    - Capacity and service metrics
    """
    service = CIPService(db)
    
    infra = await service.register_infrastructure(
        name=data.name,
        infrastructure_type=data.infrastructure_type,
        latitude=data.latitude,
        longitude=data.longitude,
        criticality_level=data.criticality_level,
        country_code=data.country_code,
        region=data.region,
        city=data.city,
        description=data.description,
        capacity_value=data.capacity_value,
        capacity_unit=data.capacity_unit,
        population_served=data.population_served,
        owner_organization=data.owner_organization,
        operator_organization=data.operator_organization,
        asset_id=data.asset_id,
        extra_data=data.extra_data,
    )
    
    await log_module_action(db, "cip", "create", entity_type="infrastructure", entity_id=infra.id, details={"cip_id": infra.cip_id, "name": infra.name})
    await db.commit()
    return _infrastructure_to_response(infra)


@router.get("/infrastructure", response_model=List[InfrastructureResponse])
async def list_infrastructure(
    infrastructure_type: Optional[str] = Query(None, description="Filter by type"),
    criticality_level: Optional[str] = Query(None, description="Filter by criticality"),
    country_code: Optional[str] = Query(None, description="Filter by country"),
    region: Optional[str] = Query(None, description="Filter by region"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List critical infrastructure with optional filters."""
    service = CIPService(db)
    
    infra_list = await service.list_infrastructure(
        infrastructure_type=infrastructure_type,
        criticality_level=criticality_level,
        country_code=country_code,
        region=region,
        limit=limit,
        offset=offset,
    )
    
    return [_infrastructure_to_response(i) for i in infra_list]


@router.get("/infrastructure/{infrastructure_id}", response_model=InfrastructureResponse)
async def get_infrastructure(
    infrastructure_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get infrastructure by ID or CIP ID."""
    service = CIPService(db)
    
    infra = await service.get_infrastructure(infrastructure_id)
    
    if not infra:
        raise HTTPException(status_code=404, detail="Infrastructure not found")
    
    return _infrastructure_to_response(infra)


@router.patch("/infrastructure/{infrastructure_id}", response_model=InfrastructureResponse)
async def update_infrastructure(
    infrastructure_id: str,
    data: InfrastructureUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update infrastructure attributes."""
    service = CIPService(db)
    
    updates = data.model_dump(exclude_unset=True)
    
    infra = await service.update_infrastructure(infrastructure_id, updates)
    
    if not infra:
        raise HTTPException(status_code=404, detail="Infrastructure not found")
    
    await log_module_action(db, "cip", "update", entity_type="infrastructure", entity_id=infrastructure_id, details=updates)
    await db.commit()
    return _infrastructure_to_response(infra)


@router.delete("/infrastructure/{infrastructure_id}")
async def delete_infrastructure(
    infrastructure_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete infrastructure by ID."""
    service = CIPService(db)
    
    success = await service.delete_infrastructure(infrastructure_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Infrastructure not found")
    
    await log_module_action(db, "cip", "delete", entity_type="infrastructure", entity_id=infrastructure_id)
    await db.commit()
    return {"status": "deleted", "id": infrastructure_id}


# ==================== DEPENDENCIES ====================

@router.post("/dependencies", response_model=DependencyResponse, status_code=201)
async def add_dependency(
    data: DependencyCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Add a dependency relationship between infrastructure assets.
    
    - source_id: Upstream infrastructure (the one being depended on)
    - target_id: Downstream infrastructure (the one that depends)
    """
    service = CIPService(db)
    
    # Verify both infrastructure exist
    source = await service.get_infrastructure(data.source_id)
    target = await service.get_infrastructure(data.target_id)
    
    if not source:
        raise HTTPException(status_code=404, detail=f"Source infrastructure {data.source_id} not found")
    if not target:
        raise HTTPException(status_code=404, detail=f"Target infrastructure {data.target_id} not found")
    
    dep = await service.add_dependency(
        source_id=data.source_id,
        target_id=data.target_id,
        dependency_type=data.dependency_type,
        strength=data.strength,
        propagation_delay_minutes=data.propagation_delay_minutes,
        description=data.description,
    )
    
    await log_module_action(db, "cip", "create", entity_type="dependency", entity_id=dep.id, details={"source_id": dep.source_id, "target_id": dep.target_id})
    await db.commit()
    return DependencyResponse(
        id=dep.id,
        source_id=dep.source_id,
        target_id=dep.target_id,
        dependency_type=dep.dependency_type,
        strength=dep.strength,
        propagation_delay_minutes=dep.propagation_delay_minutes,
        description=dep.description,
    )


@router.get("/infrastructure/{infrastructure_id}/dependencies")
async def get_dependencies(
    infrastructure_id: str,
    direction: str = Query("both", description="upstream, downstream, or both"),
    db: AsyncSession = Depends(get_db),
):
    """Get dependencies for an infrastructure asset."""
    service = CIPService(db)
    
    infra = await service.get_infrastructure(infrastructure_id)
    if not infra:
        raise HTTPException(status_code=404, detail="Infrastructure not found")
    
    deps = await service.get_dependencies(infrastructure_id, direction=direction)
    
    return {
        "infrastructure_id": infrastructure_id,
        "cip_id": infra.cip_id,
        "upstream": [
            DependencyResponse(
                id=d.id,
                source_id=d.source_id,
                target_id=d.target_id,
                dependency_type=d.dependency_type,
                strength=d.strength,
                propagation_delay_minutes=d.propagation_delay_minutes,
                description=d.description,
            ).model_dump()
            for d in deps["upstream"]
        ],
        "downstream": [
            DependencyResponse(
                id=d.id,
                source_id=d.source_id,
                target_id=d.target_id,
                dependency_type=d.dependency_type,
                strength=d.strength,
                propagation_delay_minutes=d.propagation_delay_minutes,
                description=d.description,
            ).model_dump()
            for d in deps["downstream"]
        ],
    }


@router.delete("/dependencies/{dependency_id}")
async def remove_dependency(
    dependency_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove a dependency relationship."""
    service = CIPService(db)
    
    success = await service.remove_dependency(dependency_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Dependency not found")
    
    await log_module_action(db, "cip", "delete", entity_type="dependency", entity_id=dependency_id)
    await db.commit()
    return {"status": "deleted", "id": dependency_id}


@router.get("/dependencies/graph")
async def get_dependencies_graph(
    limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
):
    """
    Get full dependency graph for visualization.
    Returns nodes (infrastructure) and edges (dependencies) for map/graph UI.
    """
    service = CIPService(db)
    return await service.get_graph(limit=limit)


# ==================== RISK ASSESSMENT ====================

@router.get("/infrastructure/{infrastructure_id}/cascade-risk")
async def get_cascade_risk(
    infrastructure_id: str,
    depth: int = Query(3, ge=1, le=10, description="Cascade depth to analyze"),
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate cascade risk for an infrastructure asset.
    
    Analyzes the dependency graph to determine:
    - How many downstream assets would be affected
    - Population at risk
    - Cascade risk score
    """
    service = CIPService(db)
    
    result = await service.calculate_cascade_risk(infrastructure_id, depth=depth)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.get("/infrastructure/{infrastructure_id}/vulnerability")
async def get_vulnerability_assessment(
    infrastructure_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get comprehensive vulnerability assessment for infrastructure.
    
    Returns:
    - Vulnerability, exposure, and resilience scores
    - Dependency counts
    - Recovery estimates
    - Population served
    """
    service = CIPService(db)
    
    result = await service.get_vulnerability_assessment(infrastructure_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


# ==================== REFERENCE DATA ====================

@router.get("/types")
async def get_infrastructure_types():
    """Get list of available infrastructure types."""
    return {
        "types": [
            {"value": t.value, "name": t.name.replace("_", " ").title()}
            for t in InfrastructureType
        ]
    }


@router.get("/criticality-levels")
async def get_criticality_levels():
    """Get list of criticality levels with descriptions."""
    descriptions = {
        "tier_1": "National/Critical - failure causes widespread impact",
        "tier_2": "Regional - failure affects multiple communities",
        "tier_3": "Local - failure affects single community",
        "tier_4": "Supporting - indirect impact",
    }
    return {
        "levels": [
            {"value": c.value, "name": c.name, "description": descriptions.get(c.value, "")}
            for c in CriticalityLevel
        ]
    }


@router.get("/operational-statuses")
async def get_operational_statuses():
    """Get list of operational statuses."""
    return {
        "statuses": [
            {"value": s.value, "name": s.name.replace("_", " ").title()}
            for s in OperationalStatus
        ]
    }


# ==================== CASCADE SIMULATIONS (FR-CIP-006, FR-CIP-007) ====================

class CascadeSimulationRequest(BaseModel):
    """Request to run cascade simulation."""
    initial_failure_ids: List[str] = Field(..., min_length=1)
    time_horizon_hours: int = Field(default=72, ge=1, le=720)
    name: Optional[str] = None


@router.post("/simulations/cascade", summary="Run cascade simulation")
async def run_cascade_simulation(
    data: CascadeSimulationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run cascade simulation: BFS + probabilistic propagation.
    Returns timeline, affected_assets, impact_score, recovery_time.
    """
    try:
        service = CIPService(db)
        result = await service.run_cascade_simulation(
            initial_failure_ids=data.initial_failure_ids,
            time_horizon_hours=data.time_horizon_hours,
            name=data.name,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        try:
            await db.commit()
        except Exception:
            await db.rollback()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/simulations", summary="List cascade simulations")
async def list_cascade_simulations(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List recent cascade simulations."""
    service = CIPService(db)
    return await service.list_cascade_simulations(limit=limit)


@router.get("/simulations/{simulation_id}", summary="Get cascade simulation by ID")
async def get_cascade_simulation(
    simulation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get cascade simulation result by ID."""
    service = CIPService(db)
    result = await service.get_cascade_simulation(simulation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return result
