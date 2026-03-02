"""
Physics Degradation Service - Engineering models for asset aging.

Implements real engineering formulas:
- Tuutti model for concrete carbonation
- Steel corrosion (chloride-induced)
- S-N fatigue curves
- Climate-adjusted lifetime
"""
import logging
import math
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class PhysicsDegradationService:
    """
    Physics-based degradation models for infrastructure assets.
    
    Uses established engineering formulas for concrete, steel,
    fatigue, and climate effects.
    """

    def concrete_carbonation_depth(
        self,
        age_years: float,
        co2_ppm: float = 420,
        humidity: float = 0.65,
    ) -> float:
        """
        Tuutti model: carbonation depth x = K * sqrt(t).
        
        K depends on CO2 concentration and humidity (Fick's law diffusion).
        Returns depth in mm.
        
        References:
        - Tuutti (1982) Corrosion of Steel in Concrete
        - fib Model Code 2010
        """
        if age_years <= 0:
            return 0.0

        # K_carb: carbonation coefficient (mm / sqrt(year))
        # Typical range 1-10 for ordinary Portland cement
        # Higher CO2 and humidity increase carbonation rate
        k_base = 3.0
        co2_factor = math.sqrt(co2_ppm / 350)  # reference 350 ppm
        humidity_factor = 1.0 + 2.0 * (humidity - 0.5) if 0.3 <= humidity <= 0.9 else 1.0
        k_carb = k_base * co2_factor * humidity_factor

        depth_mm = k_carb * math.sqrt(age_years)
        return max(0.0, round(depth_mm, 2))

    def steel_corrosion_rate(
        self,
        age_years: float,
        chloride_exposure: float = 0.5,
        humidity: float = 0.7,
    ) -> float:
        """
        Chloride-induced steel corrosion rate.
        
        Empirical model: rate increases with chloride content and humidity.
        Returns corrosion rate in mm/year.
        
        Based on Vu & Stewart (2000), Duracrete models.
        """
        if age_years <= 0:
            return 0.0

        # Base rate (mm/year) for mild exposure
        r_base = 0.01
        # Chloride factor: 0 = none, 1 = high (e.g. splash zone)
        chloride_factor = 1.0 + 2.0 * chloride_exposure
        # Humidity: peak corrosion around 70-90% RH
        humidity_factor = 4.0 * humidity * (1.0 - humidity) if 0 < humidity < 1 else 0.5
        humidity_factor = max(0.3, humidity_factor)

        rate = r_base * chloride_factor * humidity_factor
        return max(0.001, round(rate, 4))

    def fatigue_life_remaining(
        self,
        cycles: int,
        stress_range: float,
        material: str = "steel",
    ) -> float:
        """
        S-N curve: N = C / S^m.
        
        Returns fraction of life remaining (0-1).
        Uses ASTM/BS fatigue curves.
        
        Args:
            cycles: Accumulated load cycles
            stress_range: Stress range (MPa) or normalized
            material: "steel", "aluminum", or "concrete"
        """
        if cycles <= 0 or stress_range <= 0:
            return 1.0

        # S-N parameters (simplified): N = C / S^m
        # C, m from fatigue curve; typical m=3 for steel
        params = {
            "steel": {"C": 1e12, "m": 3.0},
            "aluminum": {"C": 5e11, "m": 3.5},
            "concrete": {"C": 1e15, "m": 8.0},
        }
        p = params.get(material, params["steel"])
        c_val = p["C"]
        m_val = p["m"]

        # Total life at this stress range
        n_total = c_val / (stress_range ** m_val)
        if n_total <= 0:
            return 0.0

        consumed = cycles / n_total
        remaining = 1.0 - consumed
        return max(0.0, min(1.0, round(remaining, 4)))

    def climate_adjusted_lifetime(
        self,
        base_lifetime: float,
        temp_increase: float = 1.5,
        precip_change: float = 0.1,
    ) -> float:
        """
        Reduce design lifetime based on climate projections.
        
        Temperature increase accelerates chemical/biological degradation.
        Precipitation change affects moisture-driven mechanisms.
        
        Args:
            base_lifetime: Design lifetime in years
            temp_increase: Projected temperature increase (deg C)
            precip_change: Fractional change in precipitation (+ = wetter)
        
        Returns:
            Adjusted lifetime in years
        """
        if base_lifetime <= 0:
            return 0.0

        # Arrhenius-like factor: ~5-10% reduction per deg C for many degradations
        temp_factor = 1.0 - 0.05 * temp_increase
        # Moisture: wetter can accelerate corrosion, drier can reduce
        # Assume +10% precip = -2% lifetime (more moisture exposure)
        precip_factor = 1.0 - 0.2 * precip_change

        adjusted = base_lifetime * max(0.3, temp_factor) * max(0.5, precip_factor)
        return max(0.0, round(adjusted, 1))

    def apply_degradation_to_graph(
        self,
        graph: Dict[str, Any],
        time_horizon_years: int = 10,
    ) -> Dict[str, Any]:
        """
        Modify graph node properties based on degradation over time.
        
        For each node: compute degraded exposure and adjusted failure thresholds.
        
        Args:
            graph: Dependency graph with nodes and edges
            time_horizon_years: Years over which to apply degradation
            
        Returns:
            Modified graph with degraded properties
        """
        import copy

        result = copy.deepcopy(graph)
        raw_nodes = result.get("nodes", {})

        if isinstance(raw_nodes, dict):
            node_dict = raw_nodes
        elif isinstance(raw_nodes, list):
            node_dict = {n.get("id", i): n for i, n in enumerate(raw_nodes)}
            result["nodes"] = node_dict
        else:
            node_dict = {}

        for node_id, node in node_dict.items():
            if not isinstance(node, dict):
                continue
            props = node.get("properties", node)
            if not isinstance(props, dict):
                props = {}

            material = props.get("material", "steel")
            age = props.get("age_years", 0)
            exposure_raw = props.get("exposure", 0.5)
            # Normalize exposure (may be large $ value) to 0-1 for degradation models
            exposure = min(1.0, exposure_raw / 1e8) if isinstance(exposure_raw, (int, float)) else 0.5
            failure_threshold = props.get("failure_threshold", 0.8)

            # Carbonation (concrete)
            if material == "concrete":
                carb_depth = self.concrete_carbonation_depth(
                    age_years=age + time_horizon_years,
                    humidity=exposure,
                )
                cover = props.get("cover_mm", 30)
                degradation_factor = min(1.0, carb_depth / cover) if cover > 0 else 0
            else:
                # Steel corrosion
                rate = self.steel_corrosion_rate(
                    age_years=age + time_horizon_years,
                    chloride_exposure=exposure,
                )
                degradation_factor = min(1.0, rate * time_horizon_years / 5.0)

            # Adjust failure threshold (easier to fail when degraded)
            adjusted_threshold = failure_threshold * (1.0 - 0.3 * degradation_factor)
            props["degraded_failure_threshold"] = max(0.2, round(adjusted_threshold, 3))
            props["degradation_factor"] = round(degradation_factor, 3)
            props["degradation_horizon_years"] = time_horizon_years

            if "properties" not in node:
                node["properties"] = props
            else:
                node["properties"].update(props)

        return result


# Module-level singleton
_physics_degradation: Optional[PhysicsDegradationService] = None


def get_physics_degradation_service() -> PhysicsDegradationService:
    """Get or create PhysicsDegradationService instance."""
    global _physics_degradation
    if _physics_degradation is None:
        _physics_degradation = PhysicsDegradationService()
    return _physics_degradation
