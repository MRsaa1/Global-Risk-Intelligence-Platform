"""Complex Asset Scoring Service - Specialized scoring for infrastructure."""
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.asset import Asset

logger = logging.getLogger(__name__)


@dataclass
class DataCenterScore:
    """Data center operational risk score."""
    asset_id: str
    uptime_score: float
    cooling_efficiency_score: float
    redundancy_score: float
    power_reliability_score: float
    connectivity_score: float
    security_score: float
    overall_score: float
    tier_classification: str
    recommendations: list[str]


@dataclass
class LogisticsScore:
    """Logistics facility operational risk score."""
    asset_id: str
    throughput_score: float
    chokepoint_risk_score: float
    accessibility_score: float
    storage_capacity_score: float
    automation_score: float
    labor_availability_score: float
    overall_score: float
    recommendations: list[str]


@dataclass
class PortScore:
    """Port operational risk score."""
    asset_id: str
    draft_depth_score: float
    berth_capacity_score: float
    hurricane_exposure_score: float
    tidal_risk_score: float
    container_throughput_score: float
    intermodal_score: float
    overall_score: float
    recommendations: list[str]


@dataclass
class EnergyScore:
    """Energy asset operational risk score."""
    asset_id: str
    capacity_factor_score: float
    grid_connection_score: float
    resource_availability_score: float
    maintenance_score: float
    regulatory_score: float
    curtailment_risk_score: float
    overall_score: float
    recommendations: list[str]


class ComplexAssetScoringService:
    """
    Service for scoring complex infrastructure assets.
    
    Provides specialized scoring for:
    - Data centers
    - Logistics facilities
    - Ports
    - Energy assets
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def score_data_center(self, asset_id: str) -> DataCenterScore:
        """
        Score a data center for operational risk.
        
        Args:
            asset_id: Data center asset ID
            
        Returns:
            DataCenterScore with component scores
        """
        asset = await self._get_asset(asset_id)
        
        # In production, these would come from actual asset data
        # For now, generate based on asset attributes
        year_built = asset.year_built or 2015
        age = 2026 - year_built
        
        # Score components (0-100, higher is better)
        uptime = 100 - (age * 1.5)  # Older = slightly lower
        cooling = 80 + (10 if year_built > 2018 else 0)  # Newer = better cooling
        redundancy = 85 if asset.floors_above_ground and asset.floors_above_ground > 3 else 75
        power = 90 - (age * 0.5)
        connectivity = 85
        security = 88
        
        # Normalize
        uptime = max(0, min(100, uptime))
        cooling = max(0, min(100, cooling))
        power = max(0, min(100, power))
        
        overall = (uptime * 0.25 + cooling * 0.15 + redundancy * 0.20 + 
                   power * 0.20 + connectivity * 0.10 + security * 0.10)
        
        # Tier classification
        if overall >= 95:
            tier = "Tier IV"
        elif overall >= 85:
            tier = "Tier III"
        elif overall >= 70:
            tier = "Tier II"
        else:
            tier = "Tier I"
        
        recommendations = []
        if uptime < 95:
            recommendations.append("Consider UPS and generator upgrades for higher uptime")
        if cooling < 85:
            recommendations.append("Evaluate modern cooling solutions (free cooling, liquid)")
        if redundancy < 85:
            recommendations.append("Add N+1 redundancy to critical systems")
        
        return DataCenterScore(
            asset_id=asset_id,
            uptime_score=uptime,
            cooling_efficiency_score=cooling,
            redundancy_score=redundancy,
            power_reliability_score=power,
            connectivity_score=connectivity,
            security_score=security,
            overall_score=overall,
            tier_classification=tier,
            recommendations=recommendations,
        )
    
    async def score_logistics(self, asset_id: str) -> LogisticsScore:
        """Score a logistics facility for operational risk."""
        asset = await self._get_asset(asset_id)
        
        gfa = asset.gross_floor_area_m2 or 50000
        
        # Score components
        throughput = min(100, 50 + (gfa / 2000))  # Larger = higher capacity
        chokepoint = 75  # Default moderate risk
        accessibility = 85 if asset.city else 70
        storage = min(100, 40 + (gfa / 1500))
        automation = 70  # Default moderate automation
        labor = 80 if asset.country_code in ["DE", "NL", "BE"] else 65
        
        overall = (throughput * 0.20 + chokepoint * 0.15 + accessibility * 0.20 +
                   storage * 0.15 + automation * 0.15 + labor * 0.15)
        
        recommendations = []
        if throughput < 80:
            recommendations.append("Consider expansion to increase throughput capacity")
        if automation < 75:
            recommendations.append("Evaluate automation opportunities for efficiency")
        if chokepoint > 50:
            recommendations.append("Assess alternative routes to reduce chokepoint risk")
        
        return LogisticsScore(
            asset_id=asset_id,
            throughput_score=throughput,
            chokepoint_risk_score=100 - chokepoint,  # Invert for risk
            accessibility_score=accessibility,
            storage_capacity_score=storage,
            automation_score=automation,
            labor_availability_score=labor,
            overall_score=overall,
            recommendations=recommendations,
        )
    
    async def score_port(self, asset_id: str) -> PortScore:
        """Score a port for operational risk."""
        asset = await self._get_asset(asset_id)
        
        # Score components
        draft = 80  # Default good draft
        berth = 75
        hurricane = 90 if asset.latitude and abs(asset.latitude) > 35 else 60  # Lower risk outside tropics
        tidal = 85
        container = 78
        intermodal = 70
        
        overall = (draft * 0.20 + berth * 0.15 + hurricane * 0.20 +
                   tidal * 0.10 + container * 0.20 + intermodal * 0.15)
        
        recommendations = []
        if hurricane < 70:
            recommendations.append("Develop hurricane preparedness and resilience plan")
        if draft < 75:
            recommendations.append("Consider dredging to accommodate larger vessels")
        if intermodal < 75:
            recommendations.append("Improve rail and road connections for intermodal efficiency")
        
        return PortScore(
            asset_id=asset_id,
            draft_depth_score=draft,
            berth_capacity_score=berth,
            hurricane_exposure_score=hurricane,
            tidal_risk_score=tidal,
            container_throughput_score=container,
            intermodal_score=intermodal,
            overall_score=overall,
            recommendations=recommendations,
        )
    
    async def score_energy(self, asset_id: str) -> EnergyScore:
        """Score an energy asset for operational risk."""
        asset = await self._get_asset(asset_id)
        
        asset_type = asset.asset_type or ""
        
        # Base scores vary by energy type
        if "solar" in asset_type.lower():
            capacity = 85
            resource = 80
        elif "wind" in asset_type.lower():
            capacity = 75
            resource = 70
        else:  # Conventional
            capacity = 90
            resource = 95
        
        grid = 85
        maintenance = 80
        regulatory = 75
        curtailment = 85 if "solar" in asset_type.lower() else 90
        
        overall = (capacity * 0.25 + grid * 0.15 + resource * 0.20 +
                   maintenance * 0.15 + regulatory * 0.10 + curtailment * 0.15)
        
        recommendations = []
        if capacity < 80:
            recommendations.append("Evaluate capacity enhancement opportunities")
        if grid < 80:
            recommendations.append("Assess grid connection upgrade options")
        if curtailment < 85:
            recommendations.append("Consider battery storage to reduce curtailment")
        
        return EnergyScore(
            asset_id=asset_id,
            capacity_factor_score=capacity,
            grid_connection_score=grid,
            resource_availability_score=resource,
            maintenance_score=maintenance,
            regulatory_score=regulatory,
            curtailment_risk_score=curtailment,
            overall_score=overall,
            recommendations=recommendations,
        )
    
    async def _get_asset(self, asset_id: str) -> Asset:
        """Get asset by ID."""
        result = await self.db.execute(
            select(Asset).where(Asset.id == asset_id)
        )
        asset = result.scalar_one_or_none()
        
        if not asset:
            raise ValueError(f"Asset not found: {asset_id}")
        
        return asset
