"""
SRO (Systemic Risk Observatory) module endpoints.

Provides API for monitoring systemic risks in the financial system,
including institution tracking, correlation analysis, and early warning indicators.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.modules.sro.service import SROService
from src.modules.sro.models import InstitutionType, SystemicImportance, IndicatorType

router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class InstitutionCreate(BaseModel):
    """Request to register new institution."""
    name: str = Field(..., min_length=1, max_length=255)
    institution_type: str = Field(default="other")
    systemic_importance: str = Field(default="low")
    country_code: str = Field(default="DE", max_length=2)
    headquarters_city: Optional[str] = None
    description: Optional[str] = None
    total_assets: Optional[float] = None
    market_cap: Optional[float] = None
    regulator: Optional[str] = None
    lei_code: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class InstitutionUpdate(BaseModel):
    """Request to update institution."""
    name: Optional[str] = None
    description: Optional[str] = None
    systemic_importance: Optional[str] = None
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    tier1_capital: Optional[float] = None
    market_cap: Optional[float] = None
    systemic_risk_score: Optional[float] = None
    contagion_risk: Optional[float] = None
    interconnectedness_score: Optional[float] = None
    leverage_ratio: Optional[float] = None
    liquidity_ratio: Optional[float] = None
    under_stress: Optional[bool] = None
    extra_data: Optional[Dict[str, Any]] = None


class InstitutionResponse(BaseModel):
    """Institution response model."""
    id: str
    sro_id: str
    name: str
    description: Optional[str] = None
    institution_type: str
    systemic_importance: str
    country_code: str
    headquarters_city: Optional[str] = None
    total_assets: Optional[float] = None
    market_cap: Optional[float] = None
    systemic_risk_score: Optional[float] = None
    contagion_risk: Optional[float] = None
    interconnectedness_score: Optional[float] = None
    is_active: bool
    under_stress: bool

    class Config:
        from_attributes = True


class CorrelationCreate(BaseModel):
    """Request to create a correlation."""
    institution_a_id: str = Field(..., description="First institution ID")
    institution_b_id: str = Field(..., description="Second institution ID")
    correlation_coefficient: float = Field(..., ge=-1, le=1)
    relationship_type: str = Field(default="counterparty")
    exposure_amount: Optional[float] = None
    contagion_probability: Optional[float] = Field(None, ge=0, le=1)
    description: Optional[str] = None


class CorrelationResponse(BaseModel):
    """Correlation response model."""
    id: str
    institution_a_id: str
    institution_b_id: str
    correlation_coefficient: float
    relationship_type: str
    exposure_amount: Optional[float] = None
    contagion_probability: Optional[float] = None

    class Config:
        from_attributes = True


class IndicatorCreate(BaseModel):
    """Request to record an indicator."""
    indicator_type: str = Field(..., description="Type of indicator")
    indicator_name: str = Field(..., min_length=1, max_length=255)
    value: float
    scope: str = Field(default="market")
    institution_id: Optional[str] = None
    previous_value: Optional[float] = None
    warning_threshold: Optional[float] = None
    critical_threshold: Optional[float] = None
    data_source: Optional[str] = None


class IndicatorResponse(BaseModel):
    """Indicator response model."""
    id: str
    indicator_type: str
    indicator_name: str
    value: float
    previous_value: Optional[float] = None
    change_pct: Optional[float] = None
    scope: str
    institution_id: Optional[str] = None
    is_breached: bool
    observation_date: datetime

    class Config:
        from_attributes = True


# ==================== HELPER ====================

def _institution_to_response(inst) -> InstitutionResponse:
    """Convert institution model to response."""
    return InstitutionResponse(
        id=inst.id,
        sro_id=inst.sro_id,
        name=inst.name,
        description=inst.description,
        institution_type=inst.institution_type,
        systemic_importance=inst.systemic_importance,
        country_code=inst.country_code,
        headquarters_city=inst.headquarters_city,
        total_assets=inst.total_assets,
        market_cap=inst.market_cap,
        systemic_risk_score=inst.systemic_risk_score,
        contagion_risk=inst.contagion_risk,
        interconnectedness_score=inst.interconnectedness_score,
        is_active=inst.is_active,
        under_stress=inst.under_stress,
    )


# ==================== STATUS ====================

@router.get("", summary="SRO module status")
async def sro_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Return SRO module status and statistics."""
    service = SROService(db)
    stats = await service.get_statistics()
    return {
        "module": "sro",
        "status": "ok",
        "statistics": stats,
    }


# ==================== INSTITUTION CRUD ====================

@router.post("/institutions", response_model=InstitutionResponse, status_code=201)
async def register_institution(
    data: InstitutionCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new financial institution.
    
    Creates an SRO record with:
    - Unique SRO ID (e.g., SRO-BANK-DE-ABC123)
    - Classification (type, systemic importance)
    - Financial metrics
    """
    service = SROService(db)
    
    institution = await service.register_institution(
        name=data.name,
        institution_type=data.institution_type,
        systemic_importance=data.systemic_importance,
        country_code=data.country_code,
        headquarters_city=data.headquarters_city,
        description=data.description,
        total_assets=data.total_assets,
        market_cap=data.market_cap,
        regulator=data.regulator,
        lei_code=data.lei_code,
        extra_data=data.extra_data,
    )
    
    await db.commit()
    
    return _institution_to_response(institution)


@router.get("/institutions", response_model=List[InstitutionResponse])
async def list_institutions(
    institution_type: Optional[str] = Query(None, description="Filter by type"),
    systemic_importance: Optional[str] = Query(None, description="Filter by importance"),
    country_code: Optional[str] = Query(None, description="Filter by country"),
    under_stress: Optional[bool] = Query(None, description="Filter stressed institutions"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List financial institutions with optional filters."""
    service = SROService(db)
    
    institutions = await service.list_institutions(
        institution_type=institution_type,
        systemic_importance=systemic_importance,
        country_code=country_code,
        under_stress=under_stress,
        limit=limit,
        offset=offset,
    )
    
    return [_institution_to_response(i) for i in institutions]


@router.get("/institutions/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get institution by ID or SRO ID."""
    service = SROService(db)
    
    institution = await service.get_institution(institution_id)
    
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    return _institution_to_response(institution)


@router.patch("/institutions/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: str,
    data: InstitutionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update institution attributes."""
    service = SROService(db)
    
    updates = data.model_dump(exclude_unset=True)
    
    institution = await service.update_institution(institution_id, updates)
    
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    await db.commit()
    
    return _institution_to_response(institution)


@router.delete("/institutions/{institution_id}")
async def delete_institution(
    institution_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete institution by ID."""
    service = SROService(db)
    
    success = await service.delete_institution(institution_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    await db.commit()
    
    return {"status": "deleted", "id": institution_id}


# ==================== CORRELATIONS ====================

@router.post("/correlations", response_model=CorrelationResponse, status_code=201)
async def add_correlation(
    data: CorrelationCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Add a risk correlation between institutions.
    
    Tracks how stress in one institution may affect another.
    """
    service = SROService(db)
    
    # Verify both institutions exist
    inst_a = await service.get_institution(data.institution_a_id)
    inst_b = await service.get_institution(data.institution_b_id)
    
    if not inst_a:
        raise HTTPException(status_code=404, detail=f"Institution {data.institution_a_id} not found")
    if not inst_b:
        raise HTTPException(status_code=404, detail=f"Institution {data.institution_b_id} not found")
    
    correlation = await service.add_correlation(
        institution_a_id=data.institution_a_id,
        institution_b_id=data.institution_b_id,
        correlation_coefficient=data.correlation_coefficient,
        relationship_type=data.relationship_type,
        exposure_amount=data.exposure_amount,
        contagion_probability=data.contagion_probability,
        description=data.description,
    )
    
    await db.commit()
    
    return CorrelationResponse(
        id=correlation.id,
        institution_a_id=correlation.institution_a_id,
        institution_b_id=correlation.institution_b_id,
        correlation_coefficient=correlation.correlation_coefficient,
        relationship_type=correlation.relationship_type,
        exposure_amount=correlation.exposure_amount,
        contagion_probability=correlation.contagion_probability,
    )


@router.get("/institutions/{institution_id}/correlations")
async def get_correlations(
    institution_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all correlations for an institution."""
    service = SROService(db)
    
    institution = await service.get_institution(institution_id)
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    correlations = await service.get_correlations(institution_id)
    
    return {
        "institution_id": institution_id,
        "sro_id": institution.sro_id,
        "correlations": [
            CorrelationResponse(
                id=c.id,
                institution_a_id=c.institution_a_id,
                institution_b_id=c.institution_b_id,
                correlation_coefficient=c.correlation_coefficient,
                relationship_type=c.relationship_type,
                exposure_amount=c.exposure_amount,
                contagion_probability=c.contagion_probability,
            ).model_dump()
            for c in correlations
        ],
    }


@router.delete("/correlations/{correlation_id}")
async def delete_correlation(
    correlation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a correlation."""
    service = SROService(db)
    
    success = await service.delete_correlation(correlation_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Correlation not found")
    
    await db.commit()
    
    return {"status": "deleted", "id": correlation_id}


# ==================== INDICATORS ====================

@router.post("/indicators", response_model=IndicatorResponse, status_code=201)
async def record_indicator(
    data: IndicatorCreate,
    db: AsyncSession = Depends(get_db),
):
    """Record a systemic risk indicator value."""
    service = SROService(db)
    
    indicator = await service.record_indicator(
        indicator_type=data.indicator_type,
        indicator_name=data.indicator_name,
        value=data.value,
        scope=data.scope,
        institution_id=data.institution_id,
        previous_value=data.previous_value,
        warning_threshold=data.warning_threshold,
        critical_threshold=data.critical_threshold,
        data_source=data.data_source,
    )
    
    await db.commit()
    
    return IndicatorResponse(
        id=indicator.id,
        indicator_type=indicator.indicator_type,
        indicator_name=indicator.indicator_name,
        value=indicator.value,
        previous_value=indicator.previous_value,
        change_pct=indicator.change_pct,
        scope=indicator.scope,
        institution_id=indicator.institution_id,
        is_breached=indicator.is_breached,
        observation_date=indicator.observation_date,
    )


@router.get("/indicators", response_model=List[IndicatorResponse])
async def list_indicators(
    indicator_type: Optional[str] = Query(None, description="Filter by type"),
    scope: Optional[str] = Query(None, description="Filter by scope"),
    institution_id: Optional[str] = Query(None, description="Filter by institution"),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get latest indicator readings."""
    service = SROService(db)
    
    indicators = await service.get_latest_indicators(
        indicator_type=indicator_type,
        scope=scope,
        institution_id=institution_id,
        limit=limit,
    )
    
    return [
        IndicatorResponse(
            id=i.id,
            indicator_type=i.indicator_type,
            indicator_name=i.indicator_name,
            value=i.value,
            previous_value=i.previous_value,
            change_pct=i.change_pct,
            scope=i.scope,
            institution_id=i.institution_id,
            is_breached=i.is_breached,
            observation_date=i.observation_date,
        )
        for i in indicators
    ]


@router.get("/indicators/breached", response_model=List[IndicatorResponse])
async def get_breached_indicators(
    db: AsyncSession = Depends(get_db),
):
    """Get all indicators that have breached thresholds."""
    service = SROService(db)
    
    indicators = await service.get_breached_indicators()
    
    return [
        IndicatorResponse(
            id=i.id,
            indicator_type=i.indicator_type,
            indicator_name=i.indicator_name,
            value=i.value,
            previous_value=i.previous_value,
            change_pct=i.change_pct,
            scope=i.scope,
            institution_id=i.institution_id,
            is_breached=i.is_breached,
            observation_date=i.observation_date,
        )
        for i in indicators
    ]


# ==================== RISK ASSESSMENT ====================

@router.get("/institutions/{institution_id}/systemic-risk")
async def get_systemic_risk_score(
    institution_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate systemic risk score for an institution.
    
    Returns:
    - Overall systemic risk score (0-100)
    - Component scores
    - Risk level classification
    """
    service = SROService(db)
    
    result = await service.calculate_systemic_risk_score(institution_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.get("/institutions/{institution_id}/contagion")
async def get_contagion_analysis(
    institution_id: str,
    depth: int = Query(2, ge=1, le=5, description="Contagion depth to analyze"),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze potential contagion spread from an institution.
    
    Returns:
    - Affected institutions
    - Total exposure at risk
    - Contagion paths
    """
    service = SROService(db)
    
    result = await service.get_contagion_analysis(institution_id, depth=depth)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


# ==================== REFERENCE DATA ====================

@router.get("/types")
async def get_institution_types():
    """Get list of available institution types."""
    return {
        "types": [
            {"value": t.value, "name": t.name.replace("_", " ").title()}
            for t in InstitutionType
        ]
    }


@router.get("/systemic-importance-levels")
async def get_systemic_importance_levels():
    """Get list of systemic importance levels with descriptions."""
    descriptions = {
        "gsib": "Global Systemically Important Bank",
        "dsib": "Domestic Systemically Important Bank",
        "gsii": "Global Systemically Important Insurer",
        "high": "High systemic importance",
        "medium": "Medium systemic importance",
        "low": "Low systemic importance",
    }
    return {
        "levels": [
            {"value": s.value, "name": s.name, "description": descriptions.get(s.value, "")}
            for s in SystemicImportance
        ]
    }


@router.get("/indicator-types")
async def get_indicator_types():
    """Get list of indicator types."""
    return {
        "types": [
            {"value": t.value, "name": t.name.replace("_", " ").title()}
            for t in IndicatorType
        ]
    }
