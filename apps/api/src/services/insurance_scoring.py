"""Insurance Scoring Service - Quote calculation with risk-based pricing."""
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.asset import Asset
from src.services.asset_risk_calculator import AssetRiskCalculator
from src.services.financial_models import financial_model_service

logger = logging.getLogger(__name__)


@dataclass
class InsuranceQuote:
    """Insurance quote result."""
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


class InsuranceScoringService:
    """
    Service for calculating insurance quotes based on asset risk.
    
    Integrates:
    - Climate risk assessment
    - Physical risk assessment
    - Physics engine damage simulations
    - Financial premium models
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.risk_calculator = AssetRiskCalculator()
    
    async def calculate_quote(
        self,
        asset_id: str,
        sum_insured: float,
        coverage_type: str = "property",
        deductible: float = 0,
        base_rate: float = 0.005,
    ) -> InsuranceQuote:
        """
        Calculate insurance quote for an asset.
        
        Args:
            asset_id: Asset ID to quote
            sum_insured: Sum insured amount
            coverage_type: Type of coverage
            deductible: Deductible amount
            base_rate: Base premium rate
            
        Returns:
            InsuranceQuote with premium and breakdown
        """
        # Get asset
        result = await self.db.execute(
            select(Asset).where(Asset.id == asset_id)
        )
        asset = result.scalar_one_or_none()
        
        if not asset:
            raise ValueError(f"Asset not found: {asset_id}")
        
        # Get risk scores
        climate_risk = asset.climate_risk_score or 40
        physical_risk = asset.physical_risk_score or 30
        network_risk = asset.network_risk_score or 20
        
        # Combined risk score for premium calculation
        combined_risk = (
            climate_risk * 0.4 +
            physical_risk * 0.4 +
            network_risk * 0.2
        )
        
        # Adjust base rate by asset type
        type_adjustments = {
            "commercial_office": 1.0,
            "commercial_retail": 1.1,
            "industrial": 1.3,
            "residential_multi": 0.9,
            "infrastructure_power": 1.5,
            "infrastructure_water": 1.4,
            "data_center": 1.2,
            "logistics": 1.2,
            "healthcare": 1.1,
        }
        type_mult = type_adjustments.get(asset.asset_type, 1.0)
        adjusted_base_rate = base_rate * type_mult
        
        # Calculate premium using financial models
        premium_result = financial_model_service.calculate_insurance_premium(
            base_rate=adjusted_base_rate,
            risk_score=combined_risk,
            sum_insured=sum_insured,
            deductible=deductible,
            coverage_type=coverage_type,
        )
        
        # Generate recommendations
        recommendations = []
        if climate_risk > 60:
            recommendations.append("Consider flood mitigation measures to reduce premium")
        if physical_risk > 50:
            recommendations.append("Building improvements may lower physical risk premium")
        if deductible < sum_insured * 0.01:
            recommendations.append("Increasing deductible to 1% of sum insured could reduce premium by 5-10%")
        if coverage_type == "property":
            recommendations.append("Consider adding business interruption coverage for comprehensive protection")
        
        return InsuranceQuote(
            asset_id=asset_id,
            asset_name=asset.name,
            coverage_type=coverage_type,
            sum_insured=sum_insured,
            deductible=deductible,
            annual_premium=premium_result.annual_premium,
            monthly_premium=premium_result.monthly_premium,
            base_premium=premium_result.base_premium,
            risk_loading=premium_result.risk_loading,
            coverage_loading=premium_result.coverage_loading,
            deductible_discount=premium_result.deductible_discount,
            risk_factors={
                "climate_risk": climate_risk,
                "physical_risk": physical_risk,
                "network_risk": network_risk,
                "combined_risk": combined_risk,
                "asset_type_multiplier": type_mult,
            },
            premium_breakdown=premium_result.premium_breakdown,
            recommendations=recommendations,
        )
