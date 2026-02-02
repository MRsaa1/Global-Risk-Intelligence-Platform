"""Credit Risk API endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services.credit_scoring import CreditScoringService

router = APIRouter()


class CreditRiskProfileRequest(BaseModel):
    """Request for credit risk profile."""
    asset_id: str
    product: str = Field(default="credit_facility")
    tenure_years: int = Field(default=10, ge=1, le=30)
    outstanding_debt: Optional[float] = Field(default=None, ge=0)
    dscr: float = Field(default=1.4, ge=0)
    occupancy: float = Field(default=0.95, ge=0, le=1)
    risk_appetite: str = Field(default="moderate")


class CreditRiskProfileResponse(BaseModel):
    """Response for credit risk profile."""
    asset_id: str
    asset_name: str
    product_type: str
    tenure_years: int
    
    probability_of_default: float
    loss_given_default: float
    rating: str
    
    credit_limit: float
    max_limit: float
    risk_adjusted_limit: float
    
    spread_bps: int
    all_in_rate: float
    
    collateral_value: float
    collateral_adequacy: float
    ltv: float
    
    risk_factors: dict
    recommendations: list[str]


@router.post("/risk-profile", response_model=CreditRiskProfileResponse)
async def get_credit_risk_profile(
    request: CreditRiskProfileRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate credit risk profile for an asset.
    
    Provides:
    - PD/LGD analysis with climate adjustment
    - Credit limit recommendation
    - Pricing spread
    - Collateral adequacy
    
    Product Types:
    - credit_facility: General credit facility
    - mortgage: Mortgage loan
    - project_finance: Project financing
    - construction: Construction loan
    """
    service = CreditScoringService(db)
    
    try:
        profile = await service.calculate_risk_profile(
            asset_id=request.asset_id,
            product=request.product,
            tenure_years=request.tenure_years,
            outstanding_debt=request.outstanding_debt,
            dscr=request.dscr,
            occupancy=request.occupancy,
            risk_appetite=request.risk_appetite,
        )
        
        return CreditRiskProfileResponse(
            asset_id=profile.asset_id,
            asset_name=profile.asset_name,
            product_type=profile.product_type,
            tenure_years=profile.tenure_years,
            probability_of_default=profile.probability_of_default,
            loss_given_default=profile.loss_given_default,
            rating=profile.rating,
            credit_limit=profile.credit_limit,
            max_limit=profile.max_limit,
            risk_adjusted_limit=profile.risk_adjusted_limit,
            spread_bps=profile.spread_bps,
            all_in_rate=profile.all_in_rate,
            collateral_value=profile.collateral_value,
            collateral_adequacy=profile.collateral_adequacy,
            ltv=profile.ltv,
            risk_factors=profile.risk_factors,
            recommendations=profile.recommendations,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
