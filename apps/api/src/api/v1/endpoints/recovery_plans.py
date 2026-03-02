"""
Recovery Plans API (BCP) — CRUD for RecoveryPlan, RecoveryIndicator, RecoveryMeasure.

Linked to stress tests: list by stress_test_id, create plan for a stress test.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.database import get_db
from src.models.recovery_plan import RecoveryIndicator, RecoveryMeasure, RecoveryPlan
from src.models.stress_test import StressTest

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# SCHEMAS
# =============================================================================


class RecoveryIndicatorCreate(BaseModel):
    name: str = Field(..., min_length=1)
    indicator_type: str = Field("kpi", pattern="^(kpi|milestone|metric)$")
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    unit: Optional[str] = None
    frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly)$")


class RecoveryIndicatorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    indicator_type: Optional[str] = Field(None, pattern="^(kpi|milestone|metric)$")
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    unit: Optional[str] = None
    frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly)$")


class RecoveryIndicatorResponse(BaseModel):
    id: str
    recovery_plan_id: str
    name: str
    indicator_type: str
    target_value: Optional[float]
    current_value: Optional[float]
    unit: Optional[str]
    frequency: Optional[str]

    class Config:
        from_attributes = True


class RecoveryMeasureCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    category: str = Field("corrective", pattern="^(preventive|detective|corrective)$")
    priority: str = Field("medium", pattern="^(critical|high|medium|low)$")
    status: str = Field("pending", pattern="^(pending|in_progress|done)$")
    due_date: Optional[str] = None  # ISO datetime
    responsible_role: Optional[str] = None


class RecoveryMeasureUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    category: Optional[str] = Field(None, pattern="^(preventive|detective|corrective)$")
    priority: Optional[str] = Field(None, pattern="^(critical|high|medium|low)$")
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|done)$")
    due_date: Optional[str] = None
    responsible_role: Optional[str] = None


class RecoveryMeasureResponse(BaseModel):
    id: str
    recovery_plan_id: str
    name: str
    description: Optional[str]
    category: str
    priority: str
    status: str
    due_date: Optional[str]
    responsible_role: Optional[str]

    class Config:
        from_attributes = True


class RecoveryPlanCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    stress_test_id: Optional[str] = None
    rto_hours: Optional[float] = Field(None, ge=0)
    rpo_hours: Optional[float] = Field(None, ge=0)
    status: str = Field("draft", pattern="^(draft|active|archived)$")


class RecoveryPlanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    stress_test_id: Optional[str] = None
    rto_hours: Optional[float] = Field(None, ge=0)
    rpo_hours: Optional[float] = Field(None, ge=0)
    status: Optional[str] = Field(None, pattern="^(draft|active|archived)$")


class RecoveryPlanResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    stress_test_id: Optional[str]
    rto_hours: Optional[float]
    rpo_hours: Optional[float]
    status: str
    created_at: Optional[str]
    updated_at: Optional[str]
    indicators: List[RecoveryIndicatorResponse] = []
    measures: List[RecoveryMeasureResponse] = []

    class Config:
        from_attributes = True


def _plan_to_response(plan: RecoveryPlan) -> RecoveryPlanResponse:
    return RecoveryPlanResponse(
        id=plan.id,
        name=plan.name,
        description=plan.description,
        stress_test_id=plan.stress_test_id,
        rto_hours=plan.rto_hours,
        rpo_hours=plan.rpo_hours,
        status=plan.status,
        created_at=plan.created_at.isoformat() if plan.created_at else None,
        updated_at=plan.updated_at.isoformat() if plan.updated_at else None,
        indicators=[RecoveryIndicatorResponse.model_validate(i) for i in plan.indicators],
        measures=[
            RecoveryMeasureResponse(
                id=m.id,
                recovery_plan_id=m.recovery_plan_id,
                name=m.name,
                description=m.description,
                category=m.category,
                priority=m.priority,
                status=m.status,
                due_date=m.due_date.isoformat() if m.due_date else None,
                responsible_role=m.responsible_role,
            )
            for m in plan.measures
        ],
    )


# =============================================================================
# RECOVERY PLANS CRUD
# =============================================================================


@router.get("", response_model=List[RecoveryPlanResponse])
async def list_recovery_plans(
    stress_test_id: Optional[str] = Query(None, description="Filter by stress test"),
    status: Optional[str] = Query(None, description="Filter by status"),
    session: AsyncSession = Depends(get_db),
) -> List[RecoveryPlanResponse]:
    """List recovery plans, optionally by stress_test_id or status."""
    q = (
        select(RecoveryPlan)
        .options(
            selectinload(RecoveryPlan.indicators),
            selectinload(RecoveryPlan.measures),
        )
    )
    if stress_test_id:
        q = q.where(RecoveryPlan.stress_test_id == stress_test_id)
    if status:
        q = q.where(RecoveryPlan.status == status)
    q = q.order_by(RecoveryPlan.updated_at.desc())
    result = await session.execute(q)
    plans = list(result.scalars().all())
    return [_plan_to_response(p) for p in plans]


@router.post("", response_model=RecoveryPlanResponse, status_code=201)
async def create_recovery_plan(
    body: RecoveryPlanCreate,
    session: AsyncSession = Depends(get_db),
) -> RecoveryPlanResponse:
    """Create a recovery plan, optionally linked to a stress test."""
    if body.stress_test_id:
        stress = await session.get(StressTest, body.stress_test_id)
        if not stress:
            raise HTTPException(status_code=404, detail="Stress test not found")
    plan = RecoveryPlan(
        id=str(uuid4()),
        name=body.name,
        description=body.description,
        stress_test_id=body.stress_test_id,
        rto_hours=body.rto_hours,
        rpo_hours=body.rpo_hours,
        status=body.status,
    )
    session.add(plan)
    await session.commit()
    await session.refresh(plan, ["indicators", "measures"])
    return _plan_to_response(plan)


@router.get("/{plan_id}", response_model=RecoveryPlanResponse)
async def get_recovery_plan(
    plan_id: str,
    session: AsyncSession = Depends(get_db),
) -> RecoveryPlanResponse:
    """Get a recovery plan by ID with indicators and measures."""
    q = (
        select(RecoveryPlan)
        .where(RecoveryPlan.id == plan_id)
        .options(
            selectinload(RecoveryPlan.indicators),
            selectinload(RecoveryPlan.measures),
        )
    )
    result = await session.execute(q)
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Recovery plan not found")
    return _plan_to_response(plan)


@router.patch("/{plan_id}", response_model=RecoveryPlanResponse)
async def update_recovery_plan(
    plan_id: str,
    body: RecoveryPlanUpdate,
    session: AsyncSession = Depends(get_db),
) -> RecoveryPlanResponse:
    """Update a recovery plan."""
    plan = await session.get(RecoveryPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Recovery plan not found")
    data = body.model_dump(exclude_unset=True)
    if body.stress_test_id is not None and body.stress_test_id:
        stress = await session.get(StressTest, body.stress_test_id)
        if not stress:
            raise HTTPException(status_code=404, detail="Stress test not found")
    for k, v in data.items():
        setattr(plan, k, v)
    await session.commit()
    await session.refresh(plan, ["indicators", "measures"])
    return _plan_to_response(plan)


@router.delete("/{plan_id}", status_code=204)
async def delete_recovery_plan(
    plan_id: str,
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a recovery plan and its indicators/measures."""
    plan = await session.get(RecoveryPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Recovery plan not found")
    await session.delete(plan)
    await session.commit()


# =============================================================================
# INDICATORS
# =============================================================================


@router.post("/{plan_id}/indicators", response_model=RecoveryIndicatorResponse, status_code=201)
async def create_indicator(
    plan_id: str,
    body: RecoveryIndicatorCreate,
    session: AsyncSession = Depends(get_db),
) -> RecoveryIndicatorResponse:
    """Add an indicator to a recovery plan."""
    plan = await session.get(RecoveryPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Recovery plan not found")
    ind = RecoveryIndicator(
        id=str(uuid4()),
        recovery_plan_id=plan_id,
        name=body.name,
        indicator_type=body.indicator_type,
        target_value=body.target_value,
        current_value=body.current_value,
        unit=body.unit,
        frequency=body.frequency,
    )
    session.add(ind)
    await session.commit()
    await session.refresh(ind)
    return RecoveryIndicatorResponse.model_validate(ind)


@router.patch("/{plan_id}/indicators/{indicator_id}", response_model=RecoveryIndicatorResponse)
async def update_indicator(
    plan_id: str,
    indicator_id: str,
    body: RecoveryIndicatorUpdate,
    session: AsyncSession = Depends(get_db),
) -> RecoveryIndicatorResponse:
    """Update an indicator."""
    ind = await session.get(RecoveryIndicator, indicator_id)
    if not ind or ind.recovery_plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Indicator not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ind, k, v)
    await session.commit()
    await session.refresh(ind)
    return RecoveryIndicatorResponse.model_validate(ind)


@router.delete("/{plan_id}/indicators/{indicator_id}", status_code=204)
async def delete_indicator(
    plan_id: str,
    indicator_id: str,
    session: AsyncSession = Depends(get_db),
) -> None:
    """Remove an indicator."""
    ind = await session.get(RecoveryIndicator, indicator_id)
    if not ind or ind.recovery_plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Indicator not found")
    await session.delete(ind)
    await session.commit()


# =============================================================================
# MEASURES
# =============================================================================


@router.post("/{plan_id}/measures", response_model=RecoveryMeasureResponse, status_code=201)
async def create_measure(
    plan_id: str,
    body: RecoveryMeasureCreate,
    session: AsyncSession = Depends(get_db),
) -> RecoveryMeasureResponse:
    """Add a measure to a recovery plan."""
    plan = await session.get(RecoveryPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Recovery plan not found")
    due_date = None
    if body.due_date:
        try:
            due_date = datetime.fromisoformat(body.due_date.replace("Z", "+00:00"))
        except ValueError:
            pass
    m = RecoveryMeasure(
        id=str(uuid4()),
        recovery_plan_id=plan_id,
        name=body.name,
        description=body.description,
        category=body.category,
        priority=body.priority,
        status=body.status,
        due_date=due_date,
        responsible_role=body.responsible_role,
    )
    session.add(m)
    await session.commit()
    await session.refresh(m)
    return RecoveryMeasureResponse(
        id=m.id,
        recovery_plan_id=m.recovery_plan_id,
        name=m.name,
        description=m.description,
        category=m.category,
        priority=m.priority,
        status=m.status,
        due_date=m.due_date.isoformat() if m.due_date else None,
        responsible_role=m.responsible_role,
    )


@router.patch("/{plan_id}/measures/{measure_id}", response_model=RecoveryMeasureResponse)
async def update_measure(
    plan_id: str,
    measure_id: str,
    body: RecoveryMeasureUpdate,
    session: AsyncSession = Depends(get_db),
) -> RecoveryMeasureResponse:
    """Update a measure."""
    m = await session.get(RecoveryMeasure, measure_id)
    if not m or m.recovery_plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Measure not found")
    data = body.model_dump(exclude_unset=True)
    if "due_date" in data and data["due_date"] is not None:
        try:
            data["due_date"] = datetime.fromisoformat(data["due_date"].replace("Z", "+00:00"))
        except ValueError:
            del data["due_date"]
    for k, v in data.items():
        setattr(m, k, v)
    await session.commit()
    await session.refresh(m)
    return RecoveryMeasureResponse(
        id=m.id,
        recovery_plan_id=m.recovery_plan_id,
        name=m.name,
        description=m.description,
        category=m.category,
        priority=m.priority,
        status=m.status,
        due_date=m.due_date.isoformat() if m.due_date else None,
        responsible_role=m.responsible_role,
    )


@router.delete("/{plan_id}/measures/{measure_id}", status_code=204)
async def delete_measure(
    plan_id: str,
    measure_id: str,
    session: AsyncSession = Depends(get_db),
) -> None:
    """Remove a measure."""
    m = await session.get(RecoveryMeasure, measure_id)
    if not m or m.recovery_plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Measure not found")
    await session.delete(m)
    await session.commit()
