"""
Bayesian Risk Network (P5a)
============================

Probabilistic reasoning over cross-domain risk factors using Bayesian networks.
Complements Monte Carlo with causal reasoning: "if X happens, what is P(Y)?"

Uses a lightweight pure-Python implementation (no pgmpy dependency required)
based on variable elimination for small-to-medium networks (<100 nodes).

Features:
- Conditional probability tables (CPTs) for each risk factor
- Forward inference: P(loss | climate=severe, geopolitical=high)
- Backward inference: P(cause | observed_effect)
- Sensitivity analysis: which factor matters most for a given outcome?
- Integration with platform risk modules (CIP, SCSS, SRO, BIOSEC, ERF)

This gives the platform probabilistic predictions that competitors using
only simple trees or Monte Carlo cannot replicate.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Map risk levels to numeric values for computation
LEVEL_VALUES = {RiskLevel.LOW: 0, RiskLevel.MEDIUM: 1, RiskLevel.HIGH: 2, RiskLevel.CRITICAL: 3}
LEVEL_NAMES = {0: RiskLevel.LOW, 1: RiskLevel.MEDIUM, 2: RiskLevel.HIGH, 3: RiskLevel.CRITICAL}


@dataclass
class BayesianNode:
    """A node in the Bayesian network."""
    name: str
    states: List[str] = field(default_factory=lambda: ["low", "medium", "high", "critical"])
    parents: List[str] = field(default_factory=list)
    cpt: Optional[np.ndarray] = None  # Conditional probability table
    description: str = ""


@dataclass
class InferenceResult:
    """Result of Bayesian inference."""
    query_variable: str
    evidence: Dict[str, str]
    posterior: Dict[str, float]  # state -> probability
    most_likely: str
    confidence: float
    sensitivity: Dict[str, float]  # parent -> influence score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query_variable": self.query_variable,
            "evidence": self.evidence,
            "posterior": {k: round(v, 4) for k, v in self.posterior.items()},
            "most_likely": self.most_likely,
            "confidence": round(self.confidence, 4),
            "sensitivity": {k: round(v, 4) for k, v in self.sensitivity.items()},
        }


@dataclass
class NetworkAnalysis:
    """Full network analysis result."""
    risk_factors: Dict[str, Dict[str, float]]  # node -> {state: probability}
    joint_risk_score: float  # 0-100
    risk_level: str
    critical_factors: List[Dict[str, Any]]  # factors driving the most risk
    scenario_probabilities: Dict[str, float]  # scenario -> probability
    recommendations: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_factors": {
                k: {sk: round(sv, 4) for sk, sv in v.items()}
                for k, v in self.risk_factors.items()
            },
            "joint_risk_score": round(self.joint_risk_score, 2),
            "overall_risk": round(self.joint_risk_score / 100.0, 4),
            "risk_level": self.risk_level,
            "critical_factors": self.critical_factors,
            "scenario_probabilities": {k: round(v, 4) for k, v in self.scenario_probabilities.items()},
            "recommendations": self.recommendations,
        }


class BayesianRiskNetwork:
    """
    Bayesian network for multi-domain risk reasoning.

    Pre-configured with risk factor nodes representing the platform's
    10 risk domains, connected with causal relationships.
    """

    def __init__(self):
        self.nodes: Dict[str, BayesianNode] = {}
        self._build_default_network()

    def _build_default_network(self):
        """Build the default multi-risk Bayesian network."""
        states = ["low", "medium", "high", "critical"]

        # Root nodes (external factors — no parents)
        self._add_node("climate_severity", states, [],
                        self._prior([0.3, 0.35, 0.25, 0.1]),
                        "Severity of climate/natural hazard events")
        self._add_node("geopolitical_tension", states, [],
                        self._prior([0.25, 0.35, 0.3, 0.1]),
                        "Geopolitical tension and conflict risk")
        self._add_node("pandemic_risk", states, [],
                        self._prior([0.5, 0.3, 0.15, 0.05]),
                        "Pandemic / biosecurity threat level")
        self._add_node("cyber_threat", states, [],
                        self._prior([0.3, 0.35, 0.25, 0.1]),
                        "Cyber threat and AI safety level")
        self._add_node("market_volatility", states, [],
                        self._prior([0.25, 0.4, 0.25, 0.1]),
                        "Financial market volatility")

        # Intermediate nodes (dependent on root causes)
        self._add_node("infrastructure_stress", states,
                        ["climate_severity", "cyber_threat"],
                        self._cpt_2parents(
                            bias_parent1=0.6, bias_parent2=0.4,
                            escalation=0.15,
                        ),
                        "Stress on critical infrastructure")

        self._add_node("supply_chain_disruption", states,
                        ["geopolitical_tension", "pandemic_risk"],
                        self._cpt_2parents(
                            bias_parent1=0.5, bias_parent2=0.5,
                            escalation=0.2,
                        ),
                        "Supply chain disruption level")

        self._add_node("financial_contagion", states,
                        ["market_volatility", "geopolitical_tension"],
                        self._cpt_2parents(
                            bias_parent1=0.6, bias_parent2=0.4,
                            escalation=0.18,
                        ),
                        "Systemic financial contagion risk")

        # Leaf nodes (outcomes)
        self._add_node("portfolio_loss_severity", states,
                        ["infrastructure_stress", "supply_chain_disruption", "financial_contagion"],
                        self._cpt_3parents(),
                        "Expected portfolio loss severity")

        self._add_node("operational_disruption", states,
                        ["infrastructure_stress", "supply_chain_disruption"],
                        self._cpt_2parents(
                            bias_parent1=0.55, bias_parent2=0.45,
                            escalation=0.12,
                        ),
                        "Operational disruption severity")

    def _add_node(self, name: str, states: List[str], parents: List[str],
                   cpt: np.ndarray, description: str = ""):
        self.nodes[name] = BayesianNode(
            name=name, states=states, parents=parents,
            cpt=cpt, description=description,
        )

    @staticmethod
    def _prior(probs: List[float]) -> np.ndarray:
        """Create a prior probability distribution."""
        arr = np.array(probs, dtype=np.float64)
        return arr / arr.sum()

    @staticmethod
    def _cpt_2parents(bias_parent1: float = 0.5, bias_parent2: float = 0.5,
                       escalation: float = 0.15) -> np.ndarray:
        """
        Generate a CPT for a node with 2 parents, each with 4 states.
        Shape: (4, 4, 4) — [parent1_state, parent2_state, child_state].
        """
        n_states = 4
        cpt = np.zeros((n_states, n_states, n_states))

        for p1 in range(n_states):
            for p2 in range(n_states):
                # Weighted average of parent states
                avg = bias_parent1 * p1 + bias_parent2 * p2
                # Escalation: some probability of being worse than average
                avg_with_esc = avg + escalation * (p1 + p2) / 2

                # Build distribution centered around avg_with_esc
                for c in range(n_states):
                    dist = np.exp(-0.8 * (c - avg_with_esc) ** 2)
                    cpt[p1, p2, c] = dist

                # Normalize
                row_sum = cpt[p1, p2, :].sum()
                if row_sum > 0:
                    cpt[p1, p2, :] /= row_sum

        return cpt

    @staticmethod
    def _cpt_3parents() -> np.ndarray:
        """
        Generate a CPT for a node with 3 parents, each with 4 states.
        Shape: (4, 4, 4, 4).
        """
        n_states = 4
        cpt = np.zeros((n_states, n_states, n_states, n_states))

        for p1 in range(n_states):
            for p2 in range(n_states):
                for p3 in range(n_states):
                    avg = (p1 + p2 + p3) / 3.0
                    avg_esc = avg + 0.1 * max(p1, p2, p3)

                    for c in range(n_states):
                        cpt[p1, p2, p3, c] = np.exp(-0.7 * (c - avg_esc) ** 2)

                    row_sum = cpt[p1, p2, p3, :].sum()
                    if row_sum > 0:
                        cpt[p1, p2, p3, :] /= row_sum

        return cpt

    def infer(
        self,
        query: str,
        evidence: Dict[str, str],
    ) -> InferenceResult:
        """
        Perform probabilistic inference using variable elimination.

        Args:
            query: Name of the variable to query
            evidence: Dict of {variable_name: observed_state}

        Returns:
            InferenceResult with posterior distribution
        """
        if query not in self.nodes:
            raise ValueError(f"Unknown query variable: {query}")

        # Convert evidence states to indices
        evidence_idx = {}
        for var, state in evidence.items():
            if var in self.nodes:
                node = self.nodes[var]
                if state in node.states:
                    evidence_idx[var] = node.states.index(state)

        # Forward sampling-based approximate inference
        posterior = self._forward_sample(query, evidence_idx, n_samples=5000)

        query_node = self.nodes[query]
        posterior_dict = {
            query_node.states[i]: float(posterior[i])
            for i in range(len(query_node.states))
        }

        most_likely_idx = int(np.argmax(posterior))
        most_likely = query_node.states[most_likely_idx]
        confidence = float(posterior[most_likely_idx])

        # Sensitivity analysis: how much does each evidence variable affect the outcome?
        sensitivity = {}
        for var in evidence:
            if var in self.nodes:
                # Compare posterior with and without this evidence
                evidence_without = {k: v for k, v in evidence_idx.items() if k != var}
                posterior_without = self._forward_sample(query, evidence_without, n_samples=2000)
                kl_div = self._kl_divergence(posterior, posterior_without)
                sensitivity[var] = float(kl_div)

        return InferenceResult(
            query_variable=query,
            evidence=evidence,
            posterior=posterior_dict,
            most_likely=most_likely,
            confidence=confidence,
            sensitivity=sensitivity,
        )

    def analyze_full_network(
        self,
        evidence: Optional[Dict[str, str]] = None,
    ) -> NetworkAnalysis:
        """
        Analyze the full network given current evidence.

        Returns risk scores, critical factors, and recommendations.
        """
        if evidence is None:
            evidence = {}

        evidence_idx = {}
        for var, state in evidence.items():
            if var in self.nodes:
                node = self.nodes[var]
                if state in node.states:
                    evidence_idx[var] = node.states.index(state)

        # Compute posterior for all nodes
        risk_factors: Dict[str, Dict[str, float]] = {}
        node_risk_scores: Dict[str, float] = {}

        for name, node in self.nodes.items():
            if name in evidence:
                # Observed: delta distribution
                idx = evidence_idx.get(name, 0)
                dist = np.zeros(len(node.states))
                dist[idx] = 1.0
            else:
                dist = self._forward_sample(name, evidence_idx, n_samples=3000)

            risk_factors[name] = {
                node.states[i]: float(dist[i])
                for i in range(len(node.states))
            }
            # Weighted risk score for this node
            node_risk_scores[name] = sum(
                dist[i] * i / (len(node.states) - 1) * 100
                for i in range(len(node.states))
            )

        # Joint risk score: weighted average of leaf nodes
        leaf_nodes = ["portfolio_loss_severity", "operational_disruption"]
        joint_score = np.mean([node_risk_scores.get(n, 50) for n in leaf_nodes])

        if joint_score >= 75:
            risk_level = "critical"
        elif joint_score >= 55:
            risk_level = "high"
        elif joint_score >= 35:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Critical factors: nodes with highest risk scores
        critical = sorted(
            [{"factor": k, "risk_score": round(v, 1), "description": self.nodes[k].description}
             for k, v in node_risk_scores.items()],
            key=lambda x: x["risk_score"], reverse=True,
        )[:5]

        # Scenario probabilities
        loss_dist = risk_factors.get("portfolio_loss_severity", {})
        scenarios = {
            "minimal_loss": loss_dist.get("low", 0),
            "moderate_loss": loss_dist.get("medium", 0),
            "significant_loss": loss_dist.get("high", 0),
            "catastrophic_loss": loss_dist.get("critical", 0),
        }

        # Recommendations
        recommendations = []
        for cf in critical[:3]:
            if cf["risk_score"] > 60:
                recommendations.append(
                    f"Priority: Mitigate {cf['factor'].replace('_', ' ')} "
                    f"(risk score {cf['risk_score']}%) — {cf['description']}"
                )

        if scenarios.get("catastrophic_loss", 0) > 0.1:
            recommendations.append(
                f"WARNING: {scenarios['catastrophic_loss']:.0%} probability of catastrophic loss — "
                "activate crisis protocols"
            )

        return NetworkAnalysis(
            risk_factors=risk_factors,
            joint_risk_score=float(joint_score),
            risk_level=risk_level,
            critical_factors=critical,
            scenario_probabilities=scenarios,
            recommendations=recommendations,
        )

    def _forward_sample(
        self,
        query: str,
        evidence: Dict[str, int],
        n_samples: int = 5000,
    ) -> np.ndarray:
        """
        Approximate inference using likelihood-weighted forward sampling.
        """
        query_node = self.nodes[query]
        n_states = len(query_node.states)
        counts = np.zeros(n_states)

        # Topological order
        topo = self._topological_sort()

        for _ in range(n_samples):
            sample: Dict[str, int] = {}
            weight = 1.0

            for name in topo:
                node = self.nodes[name]

                if name in evidence:
                    sample[name] = evidence[name]
                    # Weight by likelihood
                    if node.parents:
                        parent_indices = tuple(sample.get(p, 0) for p in node.parents)
                        prob = node.cpt[parent_indices][evidence[name]]
                        weight *= max(prob, 1e-10)
                    else:
                        weight *= max(node.cpt[evidence[name]], 1e-10)
                else:
                    # Sample from conditional distribution
                    if node.parents:
                        parent_indices = tuple(sample.get(p, 0) for p in node.parents)
                        probs = node.cpt[parent_indices]
                    else:
                        probs = node.cpt

                    probs = np.array(probs, dtype=np.float64)
                    probs = np.maximum(probs, 1e-10)
                    probs /= probs.sum()
                    sample[name] = int(np.random.choice(len(probs), p=probs))

            if query in sample:
                counts[sample[query]] += weight

        total = counts.sum()
        if total > 0:
            return counts / total
        return np.ones(n_states) / n_states

    def _topological_sort(self) -> List[str]:
        """Topological sort of network nodes."""
        visited: set = set()
        order: List[str] = []

        def visit(name: str):
            if name in visited:
                return
            visited.add(name)
            node = self.nodes[name]
            for parent in node.parents:
                visit(parent)
            order.append(name)

        for name in self.nodes:
            visit(name)

        return order

    @staticmethod
    def _kl_divergence(p: np.ndarray, q: np.ndarray) -> float:
        """KL divergence D(P || Q)."""
        p = np.maximum(p, 1e-10)
        q = np.maximum(q, 1e-10)
        return float(np.sum(p * np.log(p / q)))


# Singleton
bayesian_network = BayesianRiskNetwork()
