"""Insurance API endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services.insurance_scoring import InsuranceScoringService

router = APIRouter()


class InsuranceQuoteRequest(BaseModel):
    """Request for insurance quote."""
    asset_id: str
    sum_insured: float = Field(..., ge=0)
    coverage_type: str = Field(default="property")
    deductible: float = Field(default=0, ge=0)
    base_rate: float = Field(default=0.005, ge=0, le=0.1)


class InsuranceQuoteResponse(BaseModel):
    """Response for insurance quote."""
    asset_id: str
    asset_name: str
    coverage_type: str
    sum_insured: float
    deductible: float
    annual_premium: float
    monthly_premium: float
    base_premium: float
    risk_loading: float
    coverage_loading: float
    deductible_discount: float
    risk_factors: dict
    premium_breakdown: dict
    recommendations: list[str]


@router.post("/quote", response_model=InsuranceQuoteResponse)
async def get_insurance_quote(
    request: InsuranceQuoteRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate insurance quote for an asset.
    
    Uses asset risk scores and coverage parameters to calculate
    a premium with detailed breakdown.
    
    Coverage Types:
    - property: Standard property coverage
    - liability: Liability coverage
    - business_interruption: Business interruption coverage
    - natural_disaster: Natural disaster coverage
    - comprehensive: All-risk comprehensive coverage
    """
    service = InsuranceScoringService(db)
    
    try:
        quote = await service.calculate_quote(
            asset_id=request.asset_id,
            sum_insured=request.sum_insured,
            coverage_type=request.coverage_type,
            deductible=request.deductible,
            base_rate=request.base_rate,
        )
        
        return InsuranceQuoteResponse(
            asset_id=quote.asset_id,
            asset_name=quote.asset_name,
            coverage_type=quote.coverage_type,
            sum_insured=quote.sum_insured,
            deductible=quote.deductible,
            annual_premium=quote.annual_premium,
            monthly_premium=quote.monthly_premium,
            base_premium=quote.base_premium,
            risk_loading=quote.risk_loading,
            coverage_loading=quote.coverage_loading,
            deductible_discount=quote.deductible_discount,
            risk_factors=quote.risk_factors,
            premium_breakdown=quote.premium_breakdown,
            recommendations=quote.recommendations,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
