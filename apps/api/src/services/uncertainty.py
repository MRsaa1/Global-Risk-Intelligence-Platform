"""
UncertaintyQuantifier — Heisenberg-inspired information degradation.

Applies mathematically rigorous uncertainty growth to all long-horizon
projections. The further into the future, the wider the confidence bands.

sigma(t) = sigma_0 * (1 + alpha * t^beta) / (data_quality + epsilon)

Where:
- t = time horizon in years
- alpha = growth rate (default 0.15)
- beta = diffusion exponent (0.5 sub-diffusive, 1.0 diffusive, 1.5 chaotic)
- data_quality = 0..1 (1 = real-time sensors, 0 = no data)
"""
import math
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

EPSILON = 0.01

SCORE_TYPE_PROFILES = {
    "climate": {"alpha": 0.20, "beta": 1.2, "base_sigma": 8.0},
    "financial": {"alpha": 0.15, "beta": 0.8, "base_sigma": 6.0},
    "structural": {"alpha": 0.10, "beta": 0.5, "base_sigma": 4.0},
    "operational": {"alpha": 0.12, "beta": 0.7, "base_sigma": 5.0},
    "geopolitical": {"alpha": 0.25, "beta": 1.0, "base_sigma": 10.0},
    "default": {"alpha": 0.15, "beta": 0.5, "base_sigma": 5.0},
}


@dataclass
class UncertaintyBand:
    central_estimate: float
    lower_bound: float
    upper_bound: float
    confidence_level: float
    degradation_factor: float
    data_quality_factor: float


class UncertaintyQuantifier:
    """Applies Heisenberg-style uncertainty growth to projections."""

    def information_degradation_coefficient(
        self,
        time_horizon_years: float,
        data_quality: float = 0.8,
        system_complexity: float = 0.5,
        alpha: float = 0.15,
        beta: float = 0.5,
    ) -> float:
        """
        Returns the multiplicative uncertainty factor at given time horizon.
        Higher values = more uncertainty.
        """
        if time_horizon_years <= 0:
            return 1.0
        complexity_adj = 1.0 + system_complexity * 0.5
        growth = 1.0 + alpha * math.pow(time_horizon_years, beta) * complexity_adj
        quality_factor = max(data_quality, EPSILON)
        return growth / quality_factor

    def apply_uncertainty_band(
        self,
        central_value: float,
        time_horizon_years: float,
        base_sigma: float = 5.0,
        confidence: float = 0.90,
        data_quality: float = 0.8,
        system_complexity: float = 0.5,
    ) -> UncertaintyBand:
        """Compute confidence interval for a projection at given horizon."""
        degradation = self.information_degradation_coefficient(
            time_horizon_years, data_quality, system_complexity,
        )
        sigma = base_sigma * degradation

        # z-score for confidence level (Gaussian approximation)
        z_scores = {0.50: 0.674, 0.80: 1.282, 0.90: 1.645, 0.95: 1.960, 0.99: 2.576}
        z = z_scores.get(confidence, 1.645)

        half_width = z * sigma
        return UncertaintyBand(
            central_estimate=central_value,
            lower_bound=central_value - half_width,
            upper_bound=central_value + half_width,
            confidence_level=confidence,
            degradation_factor=degradation,
            data_quality_factor=data_quality,
        )

    def degrade_risk_score(
        self,
        current_score: float,
        projection_years: float,
        score_type: str = "climate",
        data_quality: float = 0.8,
    ) -> UncertaintyBand:
        """
        Wraps risk scores (0-100) with horizon-dependent uncertainty.
        Different score types have different degradation profiles.
        """
        profile = SCORE_TYPE_PROFILES.get(score_type, SCORE_TYPE_PROFILES["default"])
        degradation = self.information_degradation_coefficient(
            projection_years,
            data_quality=data_quality,
            alpha=profile["alpha"],
            beta=profile["beta"],
        )
        sigma = profile["base_sigma"] * degradation

        z = 1.645  # 90% CI
        lower = max(0.0, current_score - z * sigma)
        upper = min(100.0, current_score + z * sigma)

        return UncertaintyBand(
            central_estimate=current_score,
            lower_bound=lower,
            upper_bound=upper,
            confidence_level=0.90,
            degradation_factor=degradation,
            data_quality_factor=data_quality,
        )


# Singleton
uncertainty_quantifier = UncertaintyQuantifier()
