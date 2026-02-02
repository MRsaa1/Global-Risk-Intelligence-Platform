"""Project Finance API endpoints."""
import json
from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.project import Project, ProjectPhase, ProjectType, ProjectStatus, PhaseType
from src.services.project_finance import ProjectFinanceService

router = APIRouter()


# ==================== Schemas ====================

class ProjectCreate(BaseModel):
    """Create project request."""
    name: str
    description: Optional[str] = None
    code: Optional[str] = None
    project_type: str = Field(default="commercial")
    status: str = Field(default="development")
    currency: str = Field(default="EUR")
    total_capex_planned: Optional[float] = None
    annual_opex_planned: Optional[float] = None
    annual_revenue_projected: Optional[float] = None
    primary_asset_id: Optional[str] = None
    linked_asset_ids: Optional[list[str]] = None
    country_code: str = Field(default="DE")
    region: Optional[str] = None
    city: Optional[str] = None
    start_date: Optional[date] = None
    target_completion_date: Optional[date] = None
    sponsor_name: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Update project request."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    total_capex_planned: Optional[float] = None
    total_capex_actual: Optional[float] = None
    annual_opex_planned: Optional[float] = None
    annual_revenue_projected: Optional[float] = None
    overall_completion_pct: Optional[float] = None
    target_completion_date: Optional[date] = None


class ProjectResponse(BaseModel):
    """Project response."""
    id: str
    name: str
    description: Optional[str]
    code: Optional[str]
    project_type: str
    status: str
    currency: str
    total_capex_planned: Optional[float]
    total_capex_actual: Optional[float]
    annual_opex_planned: Optional[float]
    annual_revenue_projected: Optional[float]
    irr: Optional[float]
    npv: Optional[float]
    payback_period_years: Optional[float]
    primary_asset_id: Optional[str]
    linked_asset_ids: Optional[list[str]]
    country_code: str
    region: Optional[str]
    city: Optional[str]
    start_date: Optional[date]
    target_completion_date: Optional[date]
    overall_completion_pct: Optional[float]
    risk_score: Optional[float]
    sponsor_name: Optional[str]
    created_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class PhaseCreate(BaseModel):
    """Create phase request."""
    name: str
    description: Optional[str] = None
    phase_type: str = Field(default="construction")
    sequence_number: int = Field(default=1)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    capex_planned: Optional[float] = None
    opex_annual_planned: Optional[float] = None


class PhaseResponse(BaseModel):
    """Phase response."""
    id: str
    project_id: str
    name: str
    description: Optional[str]
    phase_type: str
    sequence_number: int
    start_date: Optional[date]
    end_date: Optional[date]
    completion_pct: float
    capex_planned: Optional[float]
    capex_actual: Optional[float]
    cost_variance_pct: Optional[float]
    schedule_variance_days: Optional[int]
    
    class Config:
        from_attributes = True


class IRRResponse(BaseModel):
    """IRR/NPV calculation response."""
    project_id: str
    project_name: str
    currency: str
    irr: float
    npv: float
    payback_period_years: float
    total_capex: float
    annual_opex: float
    annual_revenue: float
    annual_net_cashflow: float
    discount_rate: float
    analysis_period_years: int
    irr_sensitivity: dict
    npv_sensitivity: dict
    breakeven_year: Optional[int]


# ==================== Project CRUD ====================

@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    project_type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all projects with optional filters."""
    query = select(Project).order_by(Project.created_at.desc())
    
    if project_type:
        query = query.where(Project.project_type == project_type)
    if status:
        query = query.where(Project.status == status)
    
    result = await db.execute(query)
    projects = list(result.scalars().all())
    
    # Parse linked_asset_ids
    response = []
    for p in projects:
        data = ProjectResponse.model_validate(p)
        if p.linked_asset_ids:
            try:
                data.linked_asset_ids = json.loads(p.linked_asset_ids)
            except:
                data.linked_asset_ids = []
        response.append(data)
    
    return response


@router.post("", response_model=ProjectResponse)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new project."""
    project = Project(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
        code=data.code or f"PRJ-{str(uuid4())[:8].upper()}",
        project_type=data.project_type,
        status=data.status,
        currency=data.currency,
        total_capex_planned=data.total_capex_planned,
        annual_opex_planned=data.annual_opex_planned,
        annual_revenue_projected=data.annual_revenue_projected,
        primary_asset_id=data.primary_asset_id,
        linked_asset_ids=json.dumps(data.linked_asset_ids) if data.linked_asset_ids else None,
        country_code=data.country_code,
        region=data.region,
        city=data.city,
        start_date=data.start_date,
        target_completion_date=data.target_completion_date,
        sponsor_name=data.sponsor_name,
        created_at=datetime.utcnow(),
    )
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get project by ID."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    data = ProjectResponse.model_validate(project)
    if project.linked_asset_ids:
        try:
            data.linked_asset_ids = json.loads(project.linked_asset_ids)
        except:
            pass
    
    return data


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    
    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)
    
    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.delete(project)
    await db.commit()
    
    return {"status": "deleted", "id": project_id}


# ==================== Phases ====================

@router.get("/{project_id}/phases", response_model=list[PhaseResponse])
async def list_phases(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all phases for a project."""
    result = await db.execute(
        select(ProjectPhase)
        .where(ProjectPhase.project_id == project_id)
        .order_by(ProjectPhase.sequence_number)
    )
    return list(result.scalars().all())


@router.post("/{project_id}/phases", response_model=PhaseResponse)
async def create_phase(
    project_id: str,
    data: PhaseCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a phase for a project."""
    # Verify project exists
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")
    
    phase = ProjectPhase(
        id=str(uuid4()),
        project_id=project_id,
        name=data.name,
        description=data.description,
        phase_type=data.phase_type,
        sequence_number=data.sequence_number,
        start_date=data.start_date,
        end_date=data.end_date,
        capex_planned=data.capex_planned,
        opex_annual_planned=data.opex_annual_planned,
        created_at=datetime.utcnow(),
    )
    
    db.add(phase)
    await db.commit()
    await db.refresh(phase)
    
    return phase


# ==================== Financials ====================

@router.get("/{project_id}/financials", response_model=dict)
async def get_project_financials(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get CAPEX/OPEX summary for a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get phases
    phases_result = await db.execute(
        select(ProjectPhase).where(ProjectPhase.project_id == project_id)
    )
    phases = list(phases_result.scalars().all())
    
    return {
        "project_id": project_id,
        "currency": project.currency,
        "total_capex_planned": project.total_capex_planned or sum(p.capex_planned or 0 for p in phases),
        "total_capex_actual": project.total_capex_actual or sum(p.capex_actual or 0 for p in phases),
        "annual_opex_planned": project.annual_opex_planned,
        "annual_opex_actual": project.annual_opex_actual,
        "annual_revenue_projected": project.annual_revenue_projected,
        "irr": project.irr,
        "npv": project.npv,
        "phase_breakdown": [
            {
                "name": p.name,
                "capex_planned": p.capex_planned,
                "capex_actual": p.capex_actual,
                "variance_pct": p.cost_variance_pct,
            }
            for p in phases
        ],
    }


@router.get("/{project_id}/schedule", response_model=list[dict])
async def get_project_schedule(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get project schedule (phases for Gantt chart)."""
    result = await db.execute(
        select(ProjectPhase)
        .where(ProjectPhase.project_id == project_id)
        .order_by(ProjectPhase.sequence_number)
    )
    phases = list(result.scalars().all())
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "type": p.phase_type,
            "start": p.start_date.isoformat() if p.start_date else None,
            "end": p.end_date.isoformat() if p.end_date else None,
            "progress": p.completion_pct,
            "dependencies": json.loads(p.dependencies) if p.dependencies else [],
        }
        for p in phases
    ]


@router.get("/{project_id}/irr", response_model=IRRResponse)
async def calculate_project_irr(
    project_id: str,
    discount_rate: float = 0.08,
    scenario: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate IRR and NPV for a project.
    
    Scenarios:
    - low_availability: 15% lower revenue
    - high_cost: 25% higher OPEX
    - delayed_construction: 15% higher CAPEX
    """
    service = ProjectFinanceService(db)
    
    try:
        result = await service.calculate_irr_npv(
            project_id=project_id,
            discount_rate=discount_rate,
            scenario=scenario,
        )
        
        return IRRResponse(
            project_id=result.project_id,
            project_name=result.project_name,
            currency=result.currency,
            irr=result.irr,
            npv=result.npv,
            payback_period_years=result.payback_period_years,
            total_capex=result.total_capex,
            annual_opex=result.annual_opex,
            annual_revenue=result.annual_revenue,
            annual_net_cashflow=result.annual_net_cashflow,
            discount_rate=result.discount_rate,
            analysis_period_years=result.analysis_period_years,
            irr_sensitivity=result.irr_sensitivity,
            npv_sensitivity=result.npv_sensitivity,
            breakeven_year=result.breakeven_year,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{project_id}/assets", response_model=list[dict])
async def get_project_assets(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get assets linked to a project."""
    from src.models.asset import Asset
    
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    asset_ids = []
    if project.primary_asset_id:
        asset_ids.append(project.primary_asset_id)
    if project.linked_asset_ids:
        try:
            asset_ids.extend(json.loads(project.linked_asset_ids))
        except:
            pass
    
    if not asset_ids:
        return []
    
    assets_result = await db.execute(
        select(Asset).where(Asset.id.in_(asset_ids))
    )
    assets = list(assets_result.scalars().all())
    
    return [
        {
            "id": a.id,
            "name": a.name,
            "type": a.asset_type,
            "is_primary": a.id == project.primary_asset_id,
            "latitude": a.latitude,
            "longitude": a.longitude,
            "valuation": a.current_valuation,
            "has_bim": bool(a.bim_file_path),
        }
        for a in assets
    ]
