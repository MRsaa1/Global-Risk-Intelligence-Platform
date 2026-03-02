"""
Etiology (root cause) API: cause-effect chains for Analyst and stress reports.

- GET /etiology/chains — list chains (optional cause_type, limit)
- GET /etiology/chains/for-report — chains for Analyst/stress report section
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services import etiology_service

router = APIRouter()


@router.get("/chains", response_model=dict)
async def get_chains(
    cause_type: Optional[str] = None,
    event_id: Optional[str] = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """
    Get cause-effect chains (event A → cause B → industry C) from ontology and KG.
    Used for etiology section in reports and Analyst.
    """
    return await etiology_service.get_cause_effect_chains(
        db, event_id=event_id, cause_type=cause_type, limit=limit
    )


@router.get("/chains/for-report", response_model=list)
async def get_chains_for_report(
    subject_id: Optional[str] = None,
    scenario: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Chains formatted for ANALYST report or stress test report section."""
    return await etiology_service.get_chains_for_analyst_report(
        db, subject_id=subject_id, scenario=scenario
    )
