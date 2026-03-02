"""
Policy Intervention Engine (SRO Phase 1.3).

Levers: monetary, macroprudential, market structure, coordination.
Optimizes policy mix to minimize systemic collapse probability.
"""
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class PolicyLever:
    """Single policy lever."""
    category: str
    name: str
    unit: str
    default_value: float
    effectiveness: float  # 0-1


POLICY_LEVERS = [
    PolicyLever("monetary", "Interest Rate Cut", "bps", -300, 0.3),
    PolicyLever("monetary", "QE Expansion", "USD", 2e12, 0.4),
    PolicyLever("monetary", "Emergency Lending", "USD", 500e9, 0.5),
    PolicyLever("macroprudential", "Capital Buffer Release", "pct", 2.5, 0.35),
    PolicyLever("macroprudential", "Liquidity Requirements", "pct", -50, 0.4),
    PolicyLever("macroprudential", "Countercyclical Buffer", "pct", 0, 0.3),
    PolicyLever("market_structure", "Circuit Breakers", "days", 3, 0.45),
    PolicyLever("market_structure", "Trading Halts", "days", 3, 0.35),
    PolicyLever("coordination", "G7 Joint Action", "binary", 1, 0.6),
    PolicyLever("coordination", "IMF Facility", "USD", 100e9, 0.5),
]


class InterventionEngine:
    """
    Policy intervention optimization.
    """

    def __init__(self, db_session=None):
        self.db = db_session

    def get_levers(self) -> List[Dict[str, Any]]:
        """Return available policy levers."""
        return [
            {
                "category": l.category,
                "name": l.name,
                "unit": l.unit,
                "default_value": l.default_value,
                "effectiveness": l.effectiveness,
            }
            for l in POLICY_LEVERS
        ]

    async def optimize_policy(
        self,
        scenario_id: Optional[str] = None,
        objective: str = "minimize_collapse_probability",
        max_firepower_usd: float = 3e12,
    ) -> Dict[str, Any]:
        """
        Recommend policy mix to minimize systemic collapse probability.

        Runs Contagion Simulator: baseline (no interventions) vs with interventions.
        Returns recommended mix and expected outcome.
        """
        from .contagion_simulator import (
            get_contagion_simulator,
            ShockDefinition,
            PolicyIntervention,
        )
        from .scenarios import load_scenario, scenario_to_shock_and_interventions

        sim = get_contagion_simulator(self.db)
        shock = ShockDefinition(
            shock_type="liquidity_crisis",
            magnitude=2.0,
            affected_region=None,
            affected_sector="finance",
            duration_days=30,
        )
        interventions_from_scenario: List[PolicyIntervention] = []
        if scenario_id:
            try:
                data = load_scenario(scenario_id)
                if data:
                    shock, interventions_from_scenario = scenario_to_shock_and_interventions(data)
            except Exception as e:
                logger.warning("Load scenario for optimize failed: %s", e)

        n_mc = 80
        # Baseline: no interventions
        baseline = await sim.simulate_cascade(
            initial_shock=shock,
            time_horizon_days=90,
            interventions=None,
            n_monte_carlo=n_mc,
        )
        prob_before = baseline.probability_systemic_collapse

        # With recommended intervention mix (early liquidity + circuit breakers + coordination)
        policy_mix = [
            PolicyIntervention(day=5, intervention_type="emergency_liquidity", amount_usd=500e9),
            PolicyIntervention(day=7, intervention_type="circuit_breakers", parameters={"duration_days": 3}),
            PolicyIntervention(day=10, intervention_type="coordination", amount_usd=100e9),
        ]
        if interventions_from_scenario:
            policy_mix = interventions_from_scenario[:5]

        with_interventions = await sim.simulate_cascade(
            initial_shock=shock,
            time_horizon_days=90,
            interventions=policy_mix,
            n_monte_carlo=n_mc,
        )
        prob_after = with_interventions.probability_systemic_collapse

        # Build recommended list
        recommended = []
        for iv in policy_mix:
            action = iv.intervention_type.replace("_", " ").title()
            if iv.amount_usd is not None:
                amt = float(iv.amount_usd)
                action += f" ${amt/1e9:.0f}B"
            effect = f"Collapse prob: {prob_before:.2f} -> {prob_after:.2f}"
            recommended.append({"day": iv.day, "action": action, "effect": effect})

        total_cost = sum(
            iv.amount_usd or 0 for iv in policy_mix
        )
        total_cost = min(total_cost, max_firepower_usd)

        # Safe numeric handling (percentiles may be None/NaN)
        def _safe_float(v):
            if v is None:
                return 0.0
            try:
                import math
                return float(v) if not (isinstance(v, float) and math.isnan(v)) else 0.0
            except (TypeError, ValueError):
                return 0.0

        p50_before = _safe_float(baseline.percentiles.get("institutions_failed_p50"))
        p50_after = _safe_float(with_interventions.percentiles.get("institutions_failed_p50"))
        saved = int(p50_before - p50_after) if prob_after < prob_before else 0
        saved = max(0, saved)

        return {
            "scenario_id": scenario_id,
            "objective": objective,
            "constraint_max_firepower_usd": max_firepower_usd,
            "recommended_mix": recommended,
            "expected_outcome": {
                "systemic_collapse_probability_before": round(_safe_float(prob_before), 3),
                "systemic_collapse_probability_after": round(_safe_float(prob_after), 3),
                "total_cost_usd": total_cost,
                "institutions_saved": saved,
            },
        }


def get_intervention_engine(db_session=None) -> InterventionEngine:
    """Factory for intervention engine."""
    return InterventionEngine(db_session)
