"""
Physics Simulation Engine.

Simulates physical phenomena:
- Hydrodynamics (flood depth, velocity, duration)
- Structural Analysis (damage ratios for earthquake, wind)
- Thermal Dynamics (cooling demand, operational costs)
- Degradation (remaining useful life, failure probability)
- Fire Spread (ignition probability, spread patterns)
"""
import logging
import math
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

import numpy as np

logger = logging.getLogger(__name__)


class HazardType(str, Enum):
    """Types of physical hazards."""
    FLOOD = "flood"
    EARTHQUAKE = "earthquake"
    WIND = "wind"
    FIRE = "fire"
    HEAT = "heat"


@dataclass
class FloodSimulationResult:
    """Result of flood simulation."""
    max_depth_m: float
    duration_hours: float
    velocity_ms: float
    damage_ratio: float  # 0-1
    structural_impact: float  # 0-100
    content_damage_ratio: float  # 0-1
    recovery_time_days: int
    estimated_cost: float


@dataclass
class StructuralSimulationResult:
    """Result of structural simulation."""
    damage_ratio: float  # 0-1
    damage_grade: str  # none, slight, moderate, severe, collapse
    repair_cost_ratio: float  # % of replacement cost
    downtime_days: int
    safety_rating: str  # safe, restricted, unsafe
    remaining_useful_life_years: float


@dataclass
class ThermalSimulationResult:
    """Result of thermal simulation."""
    annual_cooling_demand_kwh: float
    annual_heating_demand_kwh: float
    peak_cooling_load_kw: float
    comfort_hours_ratio: float  # % of hours in comfort range
    hvac_adequacy: str  # adequate, marginal, inadequate
    annual_energy_cost: float


@dataclass
class PhysicsSimulationSummary:
    """Summary of all physics simulations."""
    simulation_id: UUID
    asset_id: str
    simulated_at: datetime
    
    # Results by hazard
    flood: Optional[FloodSimulationResult] = None
    earthquake: Optional[StructuralSimulationResult] = None
    wind: Optional[StructuralSimulationResult] = None
    thermal: Optional[ThermalSimulationResult] = None
    
    # Aggregate metrics
    total_damage_ratio: float = 0.0
    total_estimated_loss: float = 0.0
    worst_case_damage_ratio: float = 0.0
    annualized_loss: float = 0.0


class PhysicsEngine:
    """
    Physics Simulation Engine.
    
    Simulates physical phenomena and their impact on assets.
    Uses simplified physics models suitable for portfolio-scale analysis.
    """
    
    def __init__(self):
        # Flood damage curves (depth in meters -> damage ratio)
        self.flood_damage_curve = {
            0.0: 0.0,
            0.3: 0.10,
            0.6: 0.25,
            1.0: 0.40,
            1.5: 0.55,
            2.0: 0.70,
            3.0: 0.85,
            5.0: 0.95,
        }
        
        # Wind damage curves (speed in m/s -> damage ratio)
        self.wind_damage_curve = {
            0: 0.0,
            20: 0.0,
            30: 0.05,
            40: 0.15,
            50: 0.35,
            60: 0.55,
            70: 0.75,
            80: 0.90,
        }
    
    async def simulate_flood(
        self,
        asset_id: str,
        flood_depth_m: float,
        flood_duration_hours: float = 24,
        flood_velocity_ms: float = 0.5,
        building_type: str = "commercial_office",
        floor_height_m: float = 3.5,
        basement_present: bool = True,
        flood_protection: bool = False,
        property_value: float = 10_000_000,
        use_physics_nemo: bool = True,
        geometry: Optional[dict] = None,
    ) -> FloodSimulationResult:
        """
        Simulate flood impact on an asset.
        
        Uses NVIDIA PhysicsNeMo for high-accuracy simulations when available.
        Falls back to depth-damage functions if PhysicsNeMo not available.
        
        Args:
            asset_id: Asset being simulated
            flood_depth_m: Maximum flood depth in meters
            flood_duration_hours: Duration of flooding
            flood_velocity_ms: Water velocity
            building_type: Type of building
            floor_height_m: Height of each floor
            basement_present: Whether building has basement
            flood_protection: Whether flood barriers are installed
            property_value: Property value for cost estimation
            use_physics_nemo: Whether to use NVIDIA PhysicsNeMo (if API key available)
            geometry: Building geometry from BIM (for PhysicsNeMo)
            
        Returns:
            FloodSimulationResult with damage assessment
        """
        # Try NVIDIA PhysicsNeMo first if enabled and geometry available
        if use_physics_nemo and geometry and hasattr(physics_nemo_service, 'api_key') and physics_nemo_service.api_key:
            try:
                logger.info("Using NVIDIA PhysicsNeMo for flood simulation")
                nemo_result = await physics_nemo_service.simulate_flood(
                    geometry=geometry,
                    flood_input={
                        "depth_m": flood_depth_m,
                        "velocity_ms": flood_velocity_ms,
                        "duration_hours": flood_duration_hours,
                    },
                    building_properties={
                        "type": building_type,
                        "basement_present": basement_present,
                        "flood_protection": flood_protection,
                    },
                )
                
                # Convert PhysicsNeMo result to our format
                return FloodSimulationResult(
                    max_depth_m=nemo_result.max_depth_m,
                    duration_hours=nemo_result.duration_hours,
                    velocity_ms=nemo_result.velocity_ms,
                    damage_ratio=nemo_result.damage_ratio,
                    structural_impact=nemo_result.damage_ratio * 50,
                    content_damage_ratio=min(1.0, nemo_result.damage_ratio * 1.2),
                    recovery_time_days=int(nemo_result.damage_ratio * 365),
                    estimated_cost=property_value * nemo_result.damage_ratio,
                )
            except Exception as e:
                logger.warning(f"PhysicsNeMo failed, falling back to simplified model: {e}")
        
        # Fallback to simplified model
        # Apply flood protection reduction
        effective_depth = flood_depth_m
        if flood_protection:
            effective_depth = max(0, flood_depth_m - 0.5)  # 0.5m barrier
        
        # Calculate base damage from depth-damage curve
        damage_ratio = self._interpolate_damage(effective_depth, self.flood_damage_curve)
        
        # Adjust for duration (longer = more damage)
        duration_factor = 1 + (flood_duration_hours - 24) / 100
        damage_ratio *= min(1.5, max(0.8, duration_factor))
        
        # Adjust for velocity (higher = more structural damage)
        velocity_factor = 1 + (flood_velocity_ms - 0.5) / 2
        structural_damage_factor = min(2.0, max(1.0, velocity_factor))
        
        # Calculate structural impact (0-100)
        structural_impact = min(100, damage_ratio * 50 * structural_damage_factor)
        
        # Basement increases damage
        if basement_present and effective_depth > 0:
            damage_ratio = min(1.0, damage_ratio * 1.3)
        
        # Content damage (usually higher than structural)
        content_damage = min(1.0, damage_ratio * 1.2)
        
        # Recovery time based on damage
        if damage_ratio < 0.1:
            recovery_days = 7
        elif damage_ratio < 0.3:
            recovery_days = 30
        elif damage_ratio < 0.5:
            recovery_days = 90
        elif damage_ratio < 0.7:
            recovery_days = 180
        else:
            recovery_days = 365
        
        # Estimated cost
        estimated_cost = property_value * damage_ratio
        
        return FloodSimulationResult(
            max_depth_m=flood_depth_m,
            duration_hours=flood_duration_hours,
            velocity_ms=flood_velocity_ms,
            damage_ratio=min(1.0, damage_ratio),
            structural_impact=structural_impact,
            content_damage_ratio=content_damage,
            recovery_time_days=recovery_days,
            estimated_cost=estimated_cost,
        )
    
    async def simulate_earthquake(
        self,
        asset_id: str,
        magnitude: float,
        distance_km: float,
        building_type: str = "commercial_office",
        construction_year: int = 2000,
        seismic_design: bool = True,
        soil_type: str = "firm",  # rock, firm, soft
        stories: int = 10,
        property_value: float = 10_000_000,
    ) -> StructuralSimulationResult:
        """
        Simulate earthquake impact on an asset.
        
        Uses simplified fragility curves based on building type and design.
        
        Args:
            asset_id: Asset being simulated
            magnitude: Earthquake magnitude (Richter)
            distance_km: Distance from epicenter
            building_type: Type of building
            construction_year: Year of construction
            seismic_design: Whether building has seismic design
            soil_type: Soil type at site
            stories: Number of stories
            property_value: Property value
            
        Returns:
            StructuralSimulationResult with damage assessment
        """
        # Calculate Peak Ground Acceleration (simplified)
        # PGA = 10^(0.5 * M - log10(R) - 1.5)  simplified formula
        pga = 10 ** (0.5 * magnitude - math.log10(max(1, distance_km)) - 1.5)
        
        # Soil amplification
        soil_factors = {"rock": 0.8, "firm": 1.0, "soft": 1.4}
        pga *= soil_factors.get(soil_type, 1.0)
        
        # Building vulnerability
        age_factor = 1 + (2024 - construction_year) / 100  # Older = more vulnerable
        seismic_factor = 0.5 if seismic_design else 1.5
        height_factor = 1 + stories / 50  # Taller = more vulnerable
        
        # Calculate damage ratio
        vulnerability = age_factor * seismic_factor * height_factor
        damage_ratio = min(1.0, pga * vulnerability / 2)
        
        # Determine damage grade
        if damage_ratio < 0.02:
            grade = "none"
            safety = "safe"
        elif damage_ratio < 0.10:
            grade = "slight"
            safety = "safe"
        elif damage_ratio < 0.30:
            grade = "moderate"
            safety = "restricted"
        elif damage_ratio < 0.60:
            grade = "severe"
            safety = "unsafe"
        else:
            grade = "collapse"
            safety = "unsafe"
        
        # Repair cost as ratio of replacement
        repair_ratio = damage_ratio * 1.2  # Repairs often cost more than proportional
        
        # Downtime
        downtime = int(damage_ratio * 365 * 2)  # Up to 2 years for severe
        
        # Remaining useful life (seismic damage accelerates aging)
        base_life = 50 - (2024 - construction_year)
        remaining_life = max(0, base_life * (1 - damage_ratio * 0.5))
        
        return StructuralSimulationResult(
            damage_ratio=damage_ratio,
            damage_grade=grade,
            repair_cost_ratio=min(1.0, repair_ratio),
            downtime_days=downtime,
            safety_rating=safety,
            remaining_useful_life_years=remaining_life,
        )
    
    async def simulate_wind(
        self,
        asset_id: str,
        wind_speed_ms: float,
        gust_speed_ms: Optional[float] = None,
        building_type: str = "commercial_office",
        height_m: float = 40,
        facade_type: str = "curtain_wall",  # curtain_wall, masonry, precast
        exposure: str = "urban",  # urban, suburban, open
        property_value: float = 10_000_000,
    ) -> StructuralSimulationResult:
        """
        Simulate wind/storm impact on an asset.
        
        Args:
            asset_id: Asset being simulated
            wind_speed_ms: Sustained wind speed
            gust_speed_ms: Peak gust speed
            building_type: Type of building
            height_m: Building height
            facade_type: Type of facade
            exposure: Wind exposure category
            property_value: Property value
            
        Returns:
            StructuralSimulationResult with damage assessment
        """
        # Use gust speed if provided, otherwise estimate
        peak_wind = gust_speed_ms or wind_speed_ms * 1.3
        
        # Height factor (wind increases with height)
        height_factor = 1 + math.log10(max(10, height_m)) / 3
        
        # Exposure factor
        exposure_factors = {"urban": 0.8, "suburban": 1.0, "open": 1.2}
        exp_factor = exposure_factors.get(exposure, 1.0)
        
        # Facade vulnerability
        facade_factors = {"curtain_wall": 1.2, "masonry": 0.8, "precast": 1.0}
        facade_factor = facade_factors.get(facade_type, 1.0)
        
        # Calculate effective wind pressure
        effective_speed = peak_wind * height_factor * exp_factor
        
        # Get damage from curve
        damage_ratio = self._interpolate_damage(effective_speed, self.wind_damage_curve)
        damage_ratio *= facade_factor
        damage_ratio = min(1.0, damage_ratio)
        
        # Determine damage grade
        if damage_ratio < 0.02:
            grade = "none"
            safety = "safe"
        elif damage_ratio < 0.10:
            grade = "slight"
            safety = "safe"
        elif damage_ratio < 0.25:
            grade = "moderate"
            safety = "restricted"
        elif damage_ratio < 0.50:
            grade = "severe"
            safety = "unsafe"
        else:
            grade = "collapse"
            safety = "unsafe"
        
        return StructuralSimulationResult(
            damage_ratio=damage_ratio,
            damage_grade=grade,
            repair_cost_ratio=damage_ratio * 1.1,
            downtime_days=int(damage_ratio * 180),
            safety_rating=safety,
            remaining_useful_life_years=max(0, 30 * (1 - damage_ratio * 0.3)),
        )
    
    async def simulate_thermal(
        self,
        asset_id: str,
        latitude: float,
        cooling_degree_days: float = 500,
        heating_degree_days: float = 2500,
        floor_area_m2: float = 10000,
        building_envelope_quality: str = "average",  # poor, average, good, excellent
        hvac_efficiency: float = 0.85,
        electricity_price_kwh: float = 0.15,
    ) -> ThermalSimulationResult:
        """
        Simulate thermal performance and energy demand.
        
        Args:
            asset_id: Asset being simulated
            latitude: Location latitude
            cooling_degree_days: Annual cooling degree days
            heating_degree_days: Annual heating degree days
            floor_area_m2: Total floor area
            building_envelope_quality: Envelope thermal quality
            hvac_efficiency: HVAC system efficiency
            electricity_price_kwh: Electricity price
            
        Returns:
            ThermalSimulationResult with energy assessment
        """
        # Base energy intensity (kWh/m2/year)
        envelope_factors = {
            "poor": 250,
            "average": 180,
            "good": 120,
            "excellent": 80,
        }
        base_intensity = envelope_factors.get(building_envelope_quality, 180)
        
        # Calculate heating and cooling demand
        heating_factor = heating_degree_days / 2500  # Normalize
        cooling_factor = cooling_degree_days / 500  # Normalize
        
        heating_demand = floor_area_m2 * base_intensity * 0.4 * heating_factor / hvac_efficiency
        cooling_demand = floor_area_m2 * base_intensity * 0.6 * cooling_factor / hvac_efficiency
        
        # Peak cooling load (simplified)
        peak_cooling = floor_area_m2 * 0.1 * cooling_factor  # ~100W/m2 max
        
        # Comfort hours
        if building_envelope_quality == "excellent":
            comfort_ratio = 0.95
            hvac_adequacy = "adequate"
        elif building_envelope_quality == "good":
            comfort_ratio = 0.90
            hvac_adequacy = "adequate"
        elif building_envelope_quality == "average":
            comfort_ratio = 0.85
            hvac_adequacy = "marginal"
        else:
            comfort_ratio = 0.75
            hvac_adequacy = "inadequate"
        
        # Annual cost
        annual_cost = (heating_demand + cooling_demand) * electricity_price_kwh
        
        return ThermalSimulationResult(
            annual_cooling_demand_kwh=cooling_demand,
            annual_heating_demand_kwh=heating_demand,
            peak_cooling_load_kw=peak_cooling,
            comfort_hours_ratio=comfort_ratio,
            hvac_adequacy=hvac_adequacy,
            annual_energy_cost=annual_cost,
        )
    
    async def run_full_simulation(
        self,
        asset_id: str,
        asset_data: dict,
        scenarios: dict,
    ) -> PhysicsSimulationSummary:
        """
        Run complete physics simulation across all hazards.
        
        Args:
            asset_id: Asset to simulate
            asset_data: Asset properties
            scenarios: Hazard scenarios to simulate
            
        Returns:
            PhysicsSimulationSummary with all results
        """
        property_value = asset_data.get("valuation", 10_000_000)
        
        summary = PhysicsSimulationSummary(
            simulation_id=uuid4(),
            asset_id=asset_id,
            simulated_at=datetime.utcnow(),
        )
        
        total_damage = 0.0
        total_loss = 0.0
        max_damage = 0.0
        
        # Flood simulation
        if "flood" in scenarios:
            flood_params = scenarios["flood"]
            summary.flood = await self.simulate_flood(
                asset_id=asset_id,
                flood_depth_m=flood_params.get("depth_m", 1.0),
                flood_duration_hours=flood_params.get("duration_hours", 24),
                property_value=property_value,
            )
            total_damage += summary.flood.damage_ratio
            total_loss += summary.flood.estimated_cost
            max_damage = max(max_damage, summary.flood.damage_ratio)
        
        # Earthquake simulation
        if "earthquake" in scenarios:
            eq_params = scenarios["earthquake"]
            summary.earthquake = await self.simulate_earthquake(
                asset_id=asset_id,
                magnitude=eq_params.get("magnitude", 6.0),
                distance_km=eq_params.get("distance_km", 20),
                property_value=property_value,
            )
            total_damage += summary.earthquake.damage_ratio
            total_loss += property_value * summary.earthquake.damage_ratio
            max_damage = max(max_damage, summary.earthquake.damage_ratio)
        
        # Wind simulation
        if "wind" in scenarios:
            wind_params = scenarios["wind"]
            summary.wind = await self.simulate_wind(
                asset_id=asset_id,
                wind_speed_ms=wind_params.get("speed_ms", 40),
                property_value=property_value,
            )
            total_damage += summary.wind.damage_ratio
            total_loss += property_value * summary.wind.damage_ratio
            max_damage = max(max_damage, summary.wind.damage_ratio)
        
        # Thermal simulation
        if "thermal" in scenarios:
            thermal_params = scenarios["thermal"]
            summary.thermal = await self.simulate_thermal(
                asset_id=asset_id,
                latitude=thermal_params.get("latitude", 48.0),
                floor_area_m2=asset_data.get("floor_area_m2", 10000),
            )
        
        # Aggregate metrics
        n_hazards = sum(1 for k in ["flood", "earthquake", "wind"] if k in scenarios)
        summary.total_damage_ratio = total_damage / max(1, n_hazards)
        summary.total_estimated_loss = total_loss
        summary.worst_case_damage_ratio = max_damage
        
        # Annualized loss (simplified - would use return periods in production)
        summary.annualized_loss = total_loss * 0.02  # ~2% annual probability
        
        return summary
    
    def _interpolate_damage(self, value: float, curve: dict) -> float:
        """Interpolate damage ratio from a damage curve."""
        sorted_points = sorted(curve.items())
        
        if value <= sorted_points[0][0]:
            return sorted_points[0][1]
        if value >= sorted_points[-1][0]:
            return sorted_points[-1][1]
        
        for i in range(len(sorted_points) - 1):
            x1, y1 = sorted_points[i]
            x2, y2 = sorted_points[i + 1]
            if x1 <= value <= x2:
                t = (value - x1) / (x2 - x1)
                return y1 + t * (y2 - y1)
        
        return 0.0


# Global engine instance
physics_engine = PhysicsEngine()
