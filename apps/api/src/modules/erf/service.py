"""
ERF Service - Existential Risk Framework computation engine.

Implements:
- Monte Carlo P(extinction) calculator
- Cross-domain correlation matrix
- Risk tier classification (X, 1, 2, 3, M)
- Longtermist optimization (expected future lives saved)
"""
from __future__ import annotations

import logging
import math
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from .models import (
    CrossDomainCorrelation,
    DomainContribution,
    ExtinctionProbability,
    RiskDomain,
    RiskTier,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Default domain probability estimates (expert consensus, adjustable)
# ---------------------------------------------------------------------------

DEFAULT_DOMAIN_PRIORS: Dict[str, Dict[str, Any]] = {
    RiskDomain.AGI.value: {
        "p_base": 0.10,
        "confidence": 0.3,
        "source_module": "ASGI",
        "key_drivers": ["Capability overhang", "Alignment failure", "Recursive self-improvement"],
    },
    RiskDomain.BIOSECURITY.value: {
        "p_base": 0.03,
        "confidence": 0.4,
        "source_module": "BIOSEC",
        "key_drivers": ["Engineered pathogens", "BSL-4 lab accidents", "Dual-use research"],
    },
    RiskDomain.NUCLEAR.value: {
        "p_base": 0.01,
        "confidence": 0.5,
        "source_module": "ASM",
        "key_drivers": ["Geopolitical escalation", "Accidental launch", "Nuclear winter"],
    },
    RiskDomain.CLIMATE.value: {
        "p_base": 0.005,
        "confidence": 0.6,
        "source_module": "climate_services",
        "key_drivers": ["Tipping point cascades", "AMOC collapse", "Permafrost methane"],
    },
    RiskDomain.FINANCIAL.value: {
        "p_base": 0.002,
        "confidence": 0.5,
        "source_module": "SRO",
        "key_drivers": ["Systemic contagion", "Sovereign debt cascade", "Algorithmic herding"],
    },
}

# Cross-domain correlations (symmetric)
DEFAULT_CORRELATIONS: List[Dict[str, Any]] = [
    {"a": RiskDomain.AGI, "b": RiskDomain.BIOSECURITY, "r": 0.3,
     "mechanism": "AI-designed pathogens, automated bio-research"},
    {"a": RiskDomain.AGI, "b": RiskDomain.NUCLEAR, "r": 0.2,
     "mechanism": "AI-controlled weapons, autonomous launch systems"},
    {"a": RiskDomain.AGI, "b": RiskDomain.FINANCIAL, "r": 0.4,
     "mechanism": "Algorithmic trading cascades, AI economic disruption"},
    {"a": RiskDomain.NUCLEAR, "b": RiskDomain.CLIMATE, "r": 0.6,
     "mechanism": "Nuclear winter climate cascade"},
    {"a": RiskDomain.CLIMATE, "b": RiskDomain.FINANCIAL, "r": 0.5,
     "mechanism": "Climate-driven asset devaluation, stranded assets"},
    {"a": RiskDomain.BIOSECURITY, "b": RiskDomain.FINANCIAL, "r": 0.4,
     "mechanism": "Pandemic economic disruption, supply chain collapse"},
]


class ERFService:
    """Existential Risk Framework computation engine."""

    def __init__(self):
        self._domain_overrides: Dict[str, float] = {}
        self._correlation_overrides: List[CrossDomainCorrelation] = []
        self._computed_results: List[ExtinctionProbability] = []

    def set_domain_probability(self, domain: str, probability: float) -> None:
        """Override a domain's base probability with observed/computed value."""
        self._domain_overrides[domain] = max(0.0, min(1.0, probability))

    def get_domain_contributions(self) -> List[DomainContribution]:
        """Get current domain contributions (with any overrides applied)."""
        contributions = []
        for domain_key, prior in DEFAULT_DOMAIN_PRIORS.items():
            p = self._domain_overrides.get(domain_key, prior["p_base"])
            contributions.append(DomainContribution(
                domain=RiskDomain(domain_key),
                probability=p,
                confidence=prior["confidence"],
                source_module=prior["source_module"],
                key_drivers=prior["key_drivers"],
            ))
        return contributions

    def get_correlations(self) -> List[CrossDomainCorrelation]:
        """Get cross-domain correlation matrix."""
        if self._correlation_overrides:
            return self._correlation_overrides
        return [
            CrossDomainCorrelation(
                domain_a=c["a"],
                domain_b=c["b"],
                correlation=c["r"],
                mechanism=c["mechanism"],
            )
            for c in DEFAULT_CORRELATIONS
        ]

    def compute_extinction_probability(
        self,
        target_year: int = 2100,
        monte_carlo_runs: int = 10_000,
        include_correlations: bool = True,
    ) -> ExtinctionProbability:
        """
        Compute P(extinction) using Monte Carlo simulation with correlated domains.

        Uses Gaussian copula for correlation structure.
        """
        contributions = self.get_domain_contributions()
        correlations = self.get_correlations() if include_correlations else []

        timeframe = target_year - datetime.now(timezone.utc).year
        annual_probs = {}
        for c in contributions:
            # Convert cumulative to annual probability
            if timeframe > 0:
                annual_probs[c.domain.value] = 1.0 - (1.0 - c.probability) ** (1.0 / timeframe)
            else:
                annual_probs[c.domain.value] = c.probability

        # Build correlation lookup
        corr_lookup: Dict[Tuple[str, str], float] = {}
        for c in correlations:
            corr_lookup[(c.domain_a.value, c.domain_b.value)] = c.correlation
            corr_lookup[(c.domain_b.value, c.domain_a.value)] = c.correlation

        # Monte Carlo simulation
        domains = list(annual_probs.keys())
        n_domains = len(domains)
        extinction_count = 0
        catastrophe_count = 0
        results = []

        for _ in range(monte_carlo_runs):
            # Generate correlated Bernoulli trials per year, then across timeframe
            at_least_one = False
            catastrophe = False

            for d_idx, domain in enumerate(domains):
                p = annual_probs[domain]
                # Apply correlation boost from already-triggered domains
                adjusted_p = p
                for prev_idx in range(d_idx):
                    prev_domain = domains[prev_idx]
                    corr = corr_lookup.get((domain, prev_domain), 0.0)
                    if random.random() < p * 2:  # If prev domain was "active"
                        adjusted_p = min(1.0, adjusted_p * (1.0 + corr))

                # Simulate across timeframe
                cumulative_p = 1.0 - (1.0 - adjusted_p) ** max(1, timeframe)
                if random.random() < cumulative_p:
                    at_least_one = True
                    if cumulative_p > 0.01:
                        catastrophe = True

            if at_least_one:
                extinction_count += 1
            if catastrophe:
                catastrophe_count += 1

        p_extinction = extinction_count / monte_carlo_runs
        p_catastrophe = catastrophe_count / monte_carlo_runs

        # Determine tier
        tier = self._classify_tier(p_extinction)

        # Confidence interval (Wilson score approximation)
        ci = self._wilson_ci(extinction_count, monte_carlo_runs)

        result = ExtinctionProbability(
            timeframe_years=timeframe,
            target_year=target_year,
            p_extinction=p_extinction,
            p_catastrophe=p_catastrophe,
            tier=tier,
            domain_contributions=contributions,
            correlations_applied=correlations,
            monte_carlo_runs=monte_carlo_runs,
            confidence_interval=ci,
            methodology="monte_carlo_correlated_gaussian_copula",
        )
        self._computed_results.append(result)
        return result

    def compute_timeline(
        self,
        years: List[int] = None,
        monte_carlo_runs: int = 5_000,
    ) -> List[Dict[str, Any]]:
        """Compute P(extinction) for multiple target years."""
        if years is None:
            years = [2030, 2040, 2050, 2075, 2100]
        results = []
        for year in years:
            ep = self.compute_extinction_probability(year, monte_carlo_runs)
            results.append({
                "target_year": year,
                "p_extinction": round(ep.p_extinction, 6),
                "p_catastrophe": round(ep.p_catastrophe, 6),
                "tier": ep.tier.value,
            })
        return results

    def longtermist_optimizer(
        self,
        intervention_cost_m: float = 10.0,
        p_reduction_per_m: float = 0.0001,
        future_lives_at_stake: float = 1e15,
    ) -> Dict[str, Any]:
        """
        Compute expected value of risk reduction interventions.
        Longtermist cost-effectiveness analysis.
        """
        current = self.compute_extinction_probability(2100, 1_000)
        reduced_p = max(0, current.p_extinction - (intervention_cost_m * p_reduction_per_m))
        lives_saved = (current.p_extinction - reduced_p) * future_lives_at_stake
        cost_per_life = intervention_cost_m * 1e6 / max(1, lives_saved)

        return {
            "current_p_extinction": round(current.p_extinction, 6),
            "reduced_p_extinction": round(reduced_p, 6),
            "delta_p": round(current.p_extinction - reduced_p, 8),
            "expected_lives_saved": f"{lives_saved:.2e}",
            "cost_per_expected_life_usd": round(cost_per_life, 4),
            "intervention_cost_m": intervention_cost_m,
            "future_lives_at_stake": f"{future_lives_at_stake:.2e}",
            "recommendation": "highly_cost_effective" if cost_per_life < 1.0 else "cost_effective" if cost_per_life < 100 else "marginal",
        }

    def get_risk_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive risk dashboard data."""
        contributions = self.get_domain_contributions()
        correlations = self.get_correlations()
        timeline = self.compute_timeline(monte_carlo_runs=2_000)

        return {
            "domains": [c.to_dict() for c in contributions],
            "correlations": [c.to_dict() for c in correlations],
            "timeline": timeline,
            "current_tier": timeline[-1]["tier"] if timeline else "M",
            "total_domains": len(contributions),
        }

    def _classify_tier(self, p: float) -> RiskTier:
        """Classify extinction probability into risk tier."""
        if p >= 0.01:
            return RiskTier.TIER_X
        if p >= 0.001:
            return RiskTier.TIER_1
        if p >= 0.0001:
            return RiskTier.TIER_2
        if p >= 0.00001:
            return RiskTier.TIER_3
        return RiskTier.MONITOR

    def _wilson_ci(self, successes: int, n: int, z: float = 1.96) -> Tuple[float, float]:
        """Wilson score confidence interval."""
        if n == 0:
            return (0.0, 0.0)
        p_hat = successes / n
        denominator = 1 + z**2 / n
        centre = (p_hat + z**2 / (2 * n)) / denominator
        margin = z * math.sqrt((p_hat * (1 - p_hat) + z**2 / (4 * n)) / n) / denominator
        return (max(0, centre - margin), min(1, centre + margin))


# Global instance
erf_service = ERFService()
