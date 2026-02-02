"""Credit Scoring Service - Risk profile and limit calculation."""
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.asset import Asset
from src.services.financial_models import financial_model_service

logger = logging.getLogger(__name__)


@dataclass
class CreditRiskProfile:
    """Credit risk profile result."""
    asset_id: str
    asset_name: str
    product_type: str
    tenure_years: int
    
    # PD/LGD
    probability_of_default: float
    loss_given_default: float
    rating: str
    
    # Limits
    credit_limit: float
    max_limit: float
    risk_adjusted_limit: float
    
    # Pricing
    spread_bps: int
    all_in_rate: float
    
    # Collateral
    collateral_value: float
    collateral_adequacy: float
    ltv: float
    
    # Risk factors
    risk_factors: dict
    recommendations: list[str]


class CreditScoringService:
    """
    Service for calculating credit risk profiles.
    
    Integrates:
    - PD calculation with climate adjustment
    - LGD calculation with damage scenarios
    - Credit limit determination
    - Pricing recommendations
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def calculate_risk_profile(
        self,
        asset_id: str,
        product: str = "credit_facility",
        tenure_years: int = 10,
        outstanding_debt: Optional[float] = None,
        dscr: float = 1.4,
        occupancy: float = 0.95,
        risk_appetite: str = "moderate",
    ) -> CreditRiskProfile:
        """
        Calculate credit risk profile for an asset.
        
        Args:
            asset_id: Asset ID to analyze
            product: Financial product type
            tenure_years: Loan tenure
            outstanding_debt: Current debt (if any)
            dscr: Debt Service Coverage Ratio
            occupancy: Occupancy rate
            risk_appetite: Risk appetite level
            
        Returns:
            CreditRiskProfile with limits and pricing
        """
        # Get asset
        result = await self.db.execute(
            select(Asset).where(Asset.id == asset_id)
        )
        asset = result.scalar_one_or_none()
        
        if not asset:
            raise ValueError(f"Asset not found: {asset_id}")
        
        # Get risk scores
        climate_risk = asset.climate_risk_score or 35
        physical_risk = asset.physical_risk_score or 25
        network_risk = asset.network_risk_score or 20
        
        # Use asset valuation as collateral
        collateral_value = asset.current_valuation or 10_000_000
        
        # Calculate LTV
        if outstanding_debt is None:
            outstanding_debt = collateral_value * 0.6  # Assume 60% LTV
        ltv = outstanding_debt / collateral_value if collateral_value > 0 else 1.0
        
        # Calculate PD
        pd_result = financial_model_service.calculate_pd(
            dscr=dscr,
            ltv=ltv,
            occupancy=occupancy,
            climate_risk_score=climate_risk,
            physical_risk_score=physical_risk,
            network_risk_score=network_risk,
        )
        
        # Calculate LGD (assume some damage scenarios)
        lgd_result = financial_model_service.calculate_lgd(
            property_value=collateral_value,
            outstanding_debt=outstanding_debt,
            flood_damage_ratio=climate_risk / 200,  # Convert to damage ratio
            structural_damage_ratio=physical_risk / 300,
        )
        
        # Calculate credit limit
        limit_result = financial_model_service.calculate_credit_limit(
            pd=pd_result.final_pd,
            lgd=lgd_result.final_lgd,
            ead=outstanding_debt,
            collateral_value=collateral_value,
            tenure_years=tenure_years,
            risk_appetite=risk_appetite,
        )
        
        # Calculate pricing spread
        # Base spread + PD contribution + tenure adjustment
        base_spread = 100  # 100 bps base
        pd_spread = int(pd_result.final_pd * 10000)  # Convert PD to bps
        tenure_spread = (tenure_years - 5) * 10 if tenure_years > 5 else 0
        total_spread = base_spread + pd_spread + tenure_spread
        
        # All-in rate (assume risk-free of 3%)
        risk_free_rate = 0.03
        all_in_rate = risk_free_rate + (total_spread / 10000)
        
        # Collateral adequacy
        collateral_adequacy = (collateral_value / limit_result.suggested_limit) if limit_result.suggested_limit > 0 else 0
        
        # Recommendations
        recommendations = []
        if pd_result.final_pd > 0.03:
            recommendations.append("Consider requiring additional collateral to reduce PD")
        if ltv > 0.75:
            recommendations.append("LTV exceeds 75% - consider reducing loan amount")
        if dscr < 1.3:
            recommendations.append("DSCR below 1.3x - review cash flow projections")
        if climate_risk > 60:
            recommendations.append("High climate risk - consider insurance requirements")
        if tenure_years > 15:
            recommendations.append("Long tenure - consider periodic covenant reviews")
        
        return CreditRiskProfile(
            asset_id=asset_id,
            asset_name=asset.name,
            product_type=product,
            tenure_years=tenure_years,
            probability_of_default=pd_result.final_pd,
            loss_given_default=lgd_result.final_lgd,
            rating=pd_result.rating.value,
            credit_limit=limit_result.suggested_limit,
            max_limit=limit_result.max_limit,
            risk_adjusted_limit=limit_result.risk_adjusted_limit,
            spread_bps=total_spread,
            all_in_rate=all_in_rate,
            collateral_value=collateral_value,
            collateral_adequacy=collateral_adequacy,
            ltv=ltv,
            risk_factors={
                "climate_risk": climate_risk,
                "physical_risk": physical_risk,
                "network_risk": network_risk,
                "dscr": dscr,
                "occupancy": occupancy,
                "pd_factors": pd_result.factors,
                "lgd_factors": lgd_result.factors,
            },
            recommendations=recommendations,
        )
