"""Downtime Forecast Service - Predicting operational disruptions."""
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.asset import Asset

logger = logging.getLogger(__name__)


@dataclass
class DowntimeFactor:
    """Individual factor contributing to downtime."""
    name: str
    category: str
    probability: float
    expected_hours: float
    worst_case_hours: float
    mitigation: str


@dataclass
class DowntimeForecast:
    """Downtime forecast result."""
    asset_id: str
    asset_name: str
    asset_type: str
    
    # Summary metrics
    expected_downtime_hours: float
    worst_case_days: float
    uptime_probability: float
    
    # Factors
    factors: list[DowntimeFactor]
    
    # Financial impact
    revenue_at_risk_daily: float
    expected_annual_loss: float
    
    # Recommendations
    recommendations: list[str]
    mitigation_priority: list[str]


class DowntimeForecastService:
    """
    Service for forecasting asset downtime.
    
    Integrates:
    - Physics engine failure probability
    - Climate service extreme events
    - Knowledge graph cascade effects
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def forecast(
        self,
        asset_id: str,
        horizon_years: int = 1,
    ) -> DowntimeForecast:
        """
        Forecast downtime for an asset.
        
        Args:
            asset_id: Asset ID
            horizon_years: Forecast horizon
            
        Returns:
            DowntimeForecast with expected downtime and factors
        """
        # Get asset
        result = await self.db.execute(
            select(Asset).where(Asset.id == asset_id)
        )
        asset = result.scalar_one_or_none()
        
        if not asset:
            raise ValueError(f"Asset not found: {asset_id}")
        
        # Get risk scores
        climate_risk = asset.climate_risk_score or 30
        physical_risk = asset.physical_risk_score or 25
        network_risk = asset.network_risk_score or 20
        
        # Calculate factors based on asset type and risk
        factors = self._calculate_factors(asset, climate_risk, physical_risk, network_risk)
        
        # Sum up expected downtime
        expected_hours = sum(f.probability * f.expected_hours for f in factors) * horizon_years
        worst_case_hours = sum(f.worst_case_hours for f in factors) * horizon_years
        worst_case_days = worst_case_hours / 24
        
        # Uptime probability (assuming independent events)
        event_prob = sum(f.probability for f in factors)
        uptime_prob = max(0, 1 - event_prob)
        
        # Financial impact (estimate based on asset value)
        daily_revenue = (asset.current_valuation or 10_000_000) * 0.0001  # 0.01% of value per day
        revenue_at_risk = daily_revenue
        expected_annual_loss = expected_hours / 24 * daily_revenue
        
        # Generate recommendations
        recommendations = []
        mitigation_priority = []
        
        # Sort factors by expected impact
        sorted_factors = sorted(
            factors,
            key=lambda f: f.probability * f.expected_hours,
            reverse=True,
        )
        
        for f in sorted_factors[:3]:
            recommendations.append(f"Address {f.name}: {f.mitigation}")
            mitigation_priority.append(f.name)
        
        return DowntimeForecast(
            asset_id=asset_id,
            asset_name=asset.name,
            asset_type=asset.asset_type,
            expected_downtime_hours=expected_hours,
            worst_case_days=worst_case_days,
            uptime_probability=uptime_prob,
            factors=factors,
            revenue_at_risk_daily=revenue_at_risk,
            expected_annual_loss=expected_annual_loss,
            recommendations=recommendations,
            mitigation_priority=mitigation_priority,
        )
    
    def _calculate_factors(
        self,
        asset: Asset,
        climate_risk: float,
        physical_risk: float,
        network_risk: float,
    ) -> list[DowntimeFactor]:
        """Calculate downtime factors based on asset and risk."""
        factors = []
        
        # Climate-related factors
        if climate_risk > 40:
            factors.append(DowntimeFactor(
                name="Flood Event",
                category="climate",
                probability=climate_risk / 500,  # Higher risk = higher probability
                expected_hours=48,
                worst_case_hours=168,
                mitigation="Install flood barriers and improve drainage",
            ))
        
        if climate_risk > 30:
            factors.append(DowntimeFactor(
                name="Extreme Heat",
                category="climate",
                probability=climate_risk / 400,
                expected_hours=8,
                worst_case_hours=24,
                mitigation="Upgrade cooling systems and heat-resistant materials",
            ))
        
        if climate_risk > 50:
            factors.append(DowntimeFactor(
                name="Storm Damage",
                category="climate",
                probability=climate_risk / 600,
                expected_hours=24,
                worst_case_hours=120,
                mitigation="Reinforce structural elements and secure loose items",
            ))
        
        # Physical condition factors
        if physical_risk > 30:
            factors.append(DowntimeFactor(
                name="Equipment Failure",
                category="physical",
                probability=physical_risk / 300,
                expected_hours=12,
                worst_case_hours=72,
                mitigation="Implement preventive maintenance program",
            ))
        
        if physical_risk > 40:
            factors.append(DowntimeFactor(
                name="Structural Issue",
                category="physical",
                probability=physical_risk / 500,
                expected_hours=72,
                worst_case_hours=240,
                mitigation="Conduct structural assessment and repairs",
            ))
        
        # Age-related factors
        age = 2026 - (asset.year_built or 2010)
        if age > 20:
            factors.append(DowntimeFactor(
                name="Age-Related Degradation",
                category="physical",
                probability=0.05,
                expected_hours=24,
                worst_case_hours=96,
                mitigation="Plan major renovation or modernization",
            ))
        
        # Network/dependency factors
        if network_risk > 30:
            factors.append(DowntimeFactor(
                name="Supply Chain Disruption",
                category="network",
                probability=network_risk / 300,
                expected_hours=16,
                worst_case_hours=72,
                mitigation="Diversify suppliers and maintain buffer inventory",
            ))
        
        if network_risk > 40:
            factors.append(DowntimeFactor(
                name="Utility Outage",
                category="network",
                probability=network_risk / 400,
                expected_hours=8,
                worst_case_hours=48,
                mitigation="Install backup power and water systems",
            ))
        
        # Always include some base maintenance downtime
        factors.append(DowntimeFactor(
            name="Scheduled Maintenance",
            category="planned",
            probability=1.0,  # Certain to occur
            expected_hours=16,  # Per year
            worst_case_hours=24,
            mitigation="Optimize maintenance scheduling for minimal disruption",
        ))
        
        return factors
