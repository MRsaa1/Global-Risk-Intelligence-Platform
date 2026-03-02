"""ERF Agents - ERF_SENTINEL for cross-domain risk monitoring."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

logger = logging.getLogger(__name__)


class ERFSentinelAgent:
    """
    ERF_SENTINEL - Cross-domain existential risk monitoring agent.

    Responsibilities:
    - Monitor all domain modules for risk threshold crossings
    - Detect cross-domain cascade amplification
    - Generate ERF-level alerts when tier upgrades occur
    - Provide longtermist analysis context to ARIN decisions
    """

    AGENT_ID = "erf_sentinel"
    AGENT_TYPE = "ERF_SENTINEL"

    # Tier thresholds that trigger alerts
    TIER_THRESHOLDS = {
        "X": 0.01,
        "1": 0.001,
        "2": 0.0001,
        "3": 0.00001,
    }

    def __init__(self):
        self._alert_history: List[Dict[str, Any]] = []

    async def assess(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Assess cross-domain risk and return structured evaluation.
        Compatible with ARIN orchestrator agent protocol.
        """
        severity = input_data.get("severity", 0.5)
        domains_affected = input_data.get("domains", [])
        scenario_type = input_data.get("scenario_type", "unknown")

        # Cross-domain amplification factor
        n_domains = max(1, len(domains_affected))
        amplification = 1.0 + (n_domains - 1) * 0.15  # 15% per additional domain

        adjusted_score = min(1.0, severity * amplification)

        # Determine ethical urgency
        ethical_urgency = "standard"
        if adjusted_score > 0.7:
            ethical_urgency = "critical"
        elif adjusted_score > 0.4:
            ethical_urgency = "elevated"

        assessment = {
            "agent_id": self.AGENT_ID,
            "agent_type": self.AGENT_TYPE,
            "risk_score": round(adjusted_score, 4),
            "confidence": 0.6,
            "reasoning": self._build_reasoning(scenario_type, domains_affected, adjusted_score),
            "recommendations": self._build_recommendations(adjusted_score, domains_affected),
            "ethical_urgency": ethical_urgency,
            "cross_domain_amplification": round(amplification, 3),
            "domains_assessed": domains_affected,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        return assessment

    def check_tier_transition(
        self,
        previous_p: float,
        current_p: float,
    ) -> Dict[str, Any] | None:
        """Check if a tier boundary was crossed and generate alert."""
        prev_tier = self._classify_tier(previous_p)
        curr_tier = self._classify_tier(current_p)
        if prev_tier != curr_tier:
            alert = {
                "id": str(uuid4()),
                "type": "TIER_TRANSITION",
                "previous_tier": prev_tier,
                "current_tier": curr_tier,
                "previous_p": previous_p,
                "current_p": current_p,
                "direction": "upgrade" if current_p > previous_p else "downgrade",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"Risk tier transition: {prev_tier} -> {curr_tier} (P: {previous_p:.6f} -> {current_p:.6f})",
            }
            self._alert_history.append(alert)
            return alert
        return None

    def _classify_tier(self, p: float) -> str:
        if p >= 0.01:
            return "X"
        if p >= 0.001:
            return "1"
        if p >= 0.0001:
            return "2"
        if p >= 0.00001:
            return "3"
        return "M"

    def _build_reasoning(self, scenario: str, domains: List[str], score: float) -> str:
        n = len(domains)
        if n > 2:
            return (
                f"Multi-domain scenario ({scenario}) affects {n} domains "
                f"({', '.join(domains)}), triggering cross-domain amplification. "
                f"Correlated failure probability elevated to {score:.2%}."
            )
        if score > 0.7:
            return (
                f"High-severity {scenario} scenario with potential extinction-level "
                f"consequences. Immediate cross-domain monitoring activated."
            )
        return (
            f"Scenario ({scenario}) assessed at {score:.2%} aggregate risk. "
            f"Standard ERF monitoring protocols apply."
        )

    def _build_recommendations(self, score: float, domains: List[str]) -> List[str]:
        recs = []
        if score > 0.7:
            recs.append("IMMEDIATE: Activate cross-domain emergency protocols")
            recs.append("Convene full ARIN council including Ethicist agent")
        if score > 0.4:
            recs.append("Increase monitoring frequency to real-time for affected domains")
            recs.append("Prepare stakeholder communication package")
        if "agi" in domains and "biosecurity" in domains:
            recs.append("FLAG: AGI-Bio dual-use risk detected - apply precautionary principle")
        if "nuclear" in domains and "climate" in domains:
            recs.append("FLAG: Nuclear-Climate cascade pathway detected - model nuclear winter overlay")
        recs.append("Update extinction probability timeline with latest observations")
        return recs


# Global instance
erf_sentinel = ERFSentinelAgent()
