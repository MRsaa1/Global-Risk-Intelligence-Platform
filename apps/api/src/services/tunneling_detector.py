"""
TunnelingDetector — quantum-inspired black swan barrier analysis.

Finds scenarios where a system transitions directly from "stable" to
"critical" without passing through expected intermediate degradation
stages — like quantum tunneling through an energy barrier.

Lower barrier_energy = more vulnerable to unexpected state jumps.
"""
import itertools
import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

DEGRADATION_STATES = ["operational", "degraded", "warning", "critical_failure"]

EVENT_TYPES = [
    "flood_extreme",
    "earthquake",
    "cyber_attack",
    "supply_chain_collapse",
    "financial_crisis",
    "pandemic",
    "power_grid_failure",
    "regulatory_shock",
]


@dataclass
class StateBarrier:
    from_state: str
    to_state: str
    expected_intermediate_states: List[str]
    barrier_energy: float
    tunneling_probability: float


@dataclass
class TunnelingScenario:
    scenario_id: str
    trigger_combination: List[Dict[str, Any]]
    bypassed_states: List[str]
    affected_assets: List[str]
    probability: float
    impact: float
    barrier_energy: float
    explanation: str = ""


class TunnelingDetector:
    """Detects state-space tunneling vulnerabilities in asset portfolios."""

    def __init__(self, cascade_gnn=None, knowledge_graph=None, llm_service=None):
        self._cascade_gnn = cascade_gnn
        self._kg = knowledge_graph
        self._llm = llm_service

    async def find_tunneling_paths(
        self,
        graph: Optional[dict] = None,
        source_state: str = "operational",
        target_state: str = "critical_failure",
        max_compound_events: int = 3,
    ) -> List[TunnelingScenario]:
        """Search for compound event combos that bypass intermediate states."""
        start = time.time()
        scenarios = []

        bypassed = [s for s in DEGRADATION_STATES
                     if s != source_state and s != target_state]

        for n in range(2, max_compound_events + 1):
            for combo in itertools.combinations(EVENT_TYPES, n):
                barrier = self._compute_compound_barrier(combo)
                if barrier < 0.5:
                    prob = math.exp(-barrier * 5)
                    impact = sum(self._event_impact(e) for e in combo)
                    scenario = TunnelingScenario(
                        scenario_id=f"tunnel_{uuid4().hex[:8]}",
                        trigger_combination=[{"event": e, "severity": self._event_impact(e)} for e in combo],
                        bypassed_states=bypassed,
                        affected_assets=[],
                        probability=round(prob, 6),
                        impact=round(impact, 2),
                        barrier_energy=round(barrier, 4),
                    )
                    scenarios.append(scenario)

        scenarios.sort(key=lambda s: s.barrier_energy)

        # LLM plausibility check on top scenarios; otherwise deterministic explanation
        if self._llm and scenarios:
            for s in scenarios[:5]:
                try:
                    events = ", ".join(t["event"] for t in s.trigger_combination)
                    resp = await self._llm.generate(
                        prompt=f"Evaluate plausibility of simultaneous events: {events}. "
                               f"Is this compound scenario realistic? Reply in 2 sentences.",
                        max_tokens=128,
                        temperature=0.4,
                    )
                    s.explanation = resp.content
                except Exception:
                    s.explanation = _explanation_for_combo(s.trigger_combination)
        for s in scenarios:
            if not s.explanation:
                s.explanation = _explanation_for_combo(s.trigger_combination)

        logger.info("Tunneling scan: %d scenarios found in %dms",
                     len(scenarios), int((time.time() - start) * 1000))
        return scenarios[:20]

    async def compute_barrier_energy(
        self,
        asset_id: str,
        from_state: str = "operational",
        to_state: str = "critical_failure",
    ) -> StateBarrier:
        """Compute minimum compound stress to force a direct state transition."""
        bypassed = [s for s in DEGRADATION_STATES if s != from_state and s != to_state]

        # Base barrier from state distance
        from_idx = DEGRADATION_STATES.index(from_state) if from_state in DEGRADATION_STATES else 0
        to_idx = DEGRADATION_STATES.index(to_state) if to_state in DEGRADATION_STATES else len(DEGRADATION_STATES) - 1
        distance = abs(to_idx - from_idx)

        barrier = distance * 0.3
        tunneling_prob = math.exp(-barrier * 5)

        return StateBarrier(
            from_state=from_state,
            to_state=to_state,
            expected_intermediate_states=bypassed,
            barrier_energy=round(barrier, 4),
            tunneling_probability=round(tunneling_prob, 6),
        )

    async def scan_portfolio(
        self,
        portfolio_asset_ids: List[str],
        top_n: int = 10,
    ) -> List[TunnelingScenario]:
        """Portfolio-wide tunneling vulnerability scan."""
        all_scenarios = await self.find_tunneling_paths(max_compound_events=3)
        for s in all_scenarios:
            s.affected_assets = portfolio_asset_ids[:5]
        return all_scenarios[:top_n]

    @staticmethod
    def _compute_compound_barrier(events: tuple) -> float:
        """Lower barrier = easier tunneling. Combination-specific so each scenario differs."""
        base_barriers = {
            "flood_extreme": 0.6,
            "earthquake": 0.7,
            "cyber_attack": 0.5,
            "supply_chain_collapse": 0.45,
            "financial_crisis": 0.4,
            "pandemic": 0.55,
            "power_grid_failure": 0.5,
            "regulatory_shock": 0.65,
        }
        individual = [base_barriers.get(e, 0.5) for e in events]
        n = len(individual)
        # Geometric mean so each combo gets a distinct barrier (not just min)
        product = 1.0
        for b in individual:
            product *= b
        geom_mean = product ** (1.0 / n) if n else 0.5
        # More simultaneous events = lower effective barrier (synergy)
        compound = geom_mean * (0.72 ** (n - 1))
        # Add small deterministic variation per combo so identical barriers get different probs
        combo_hash = hash(events) % 1000
        compound = max(0.05, compound * (0.97 + (combo_hash % 31) / 1000.0))
        return compound

    @staticmethod
    def _event_impact(event: str) -> float:
        impacts = {
            "flood_extreme": 0.8,
            "earthquake": 0.9,
            "cyber_attack": 0.6,
            "supply_chain_collapse": 0.7,
            "financial_crisis": 0.75,
            "pandemic": 0.65,
            "power_grid_failure": 0.7,
            "regulatory_shock": 0.4,
        }
        return impacts.get(event, 0.5)


def _explanation_for_combo(trigger_combination: List[Dict[str, Any]]) -> str:
    """Deterministic short explanation per event combo so each scenario differs."""
    events = [t.get("event", "") for t in trigger_combination]
    if not events:
        return "Compound scenario bypasses normal degradation stages."
    # Vary message by dominant hazard type and count
    hazard_key = "_".join(sorted(e.replace("_", " ") for e in events))[:50]
    seed = hash(hazard_key) % 5
    templates = [
        "Simultaneous {} can overwhelm controls that are designed for single-event response.",
        "This combination skips early-warning triggers because no single event crosses thresholds alone.",
        "Cascading {} creates a direct path to critical failure.",
        "Interconnected risks: {} compound rather than average.",
        "Stress tests often assume independent events; here they are correlated.",
    ]
    event_list = " + ".join(e.replace("_", " ") for e in events)
    return templates[seed].format(event_list)


# Singleton
tunneling_detector = TunnelingDetector()
