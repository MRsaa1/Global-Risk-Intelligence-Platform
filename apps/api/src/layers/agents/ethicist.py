"""
ETHICIST Agent - Ethical evaluation of risk decisions.

Fourth agent in ARIN council (Sentinel, Analyst, Advisor, Ethicist).

- Ethics rails: config/ethics_rails (harm_prevention, fairness, protect_pii) applied per module.
- NIM pipeline: optional bias-detector, content-safety, PII-detection microservices.
- NeMo Guardrails: optional Colang flows when nemo_guardrails_url is set.
- Module check matrix: which rails apply to ERF, ASGI, BIOSEC, ASM, SRO, CIP, CADAPT, stress_test.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class EthicalFramework:
    """Ethical evaluation frameworks."""
    UTILITARIAN = "utilitarian"            # Greatest good for greatest number
    LONGTERMIST = "longtermist"           # Prioritize future generations
    PRECAUTIONARY = "precautionary"       # Avoid irreversible harm
    RAWLSIAN = "rawlsian"               # Protect the most vulnerable
    RIGHTS_BASED = "rights_based"         # Fundamental human rights


class EthicistAgent:
    """
    ETHICIST - Ethical evaluation agent for ARIN council.

    Evaluates decisions through multiple ethical lenses and can override
    pure risk-math recommendations when ethical concerns warrant it.
    """

    AGENT_ID = "ethicist"
    AGENT_TYPE = "ETHICIST"

    # Severity thresholds that trigger different ethical frameworks
    PRECAUTIONARY_THRESHOLD = 0.6    # Apply precautionary principle above this
    EXISTENTIAL_THRESHOLD = 0.8      # Apply longtermist framework above this

    async def assess(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Produce ethical assessment for ARIN DecisionObject.

        Applies: ethics_rails (per module), NIM pipeline (bias/safety/PII), then
        ethical frameworks (utilitarian, longtermist, precautionary, Rawlsian).
        """
        severity = float(input_data.get("severity", 0.5))
        object_type = input_data.get("object_type", "default")
        scenario_type = input_data.get("scenario_type", "unknown")
        affected_population = int(input_data.get("affected_population", 0) or 0)
        vulnerable_groups = input_data.get("vulnerable_groups") or []
        reversibility = input_data.get("reversibility", "reversible")
        source_module = (input_data.get("source_module") or "default").strip().lower()

        # 0. Ethics rails (config/ethics_rails) per module matrix
        rails_triggered: List[Dict[str, Any]] = []
        try:
            from src.services.ethics_rails import (
                get_rails_for_module,
                load_ethics_rails_config,
                apply_rail_rules,
            )
            rail_names = get_rails_for_module(source_module)
            configs = load_ethics_rails_config()
            context = {
                "severity": severity,
                "reversibility": reversibility,
                "scenario_type": scenario_type,
                "affected_population": affected_population,
                "vulnerable_groups": vulnerable_groups,
            }
            for name in rail_names:
                cfg = configs.get(name)
                if cfg:
                    for t in apply_rail_rules(cfg, context):
                        rails_triggered.append({"rail": name, **t})
        except Exception as e:
            logger.debug("Ethics rails load/apply failed: %s", e)

        # 0b. NIM pipeline (bias, content-safety, PII) when configured
        nim_results: Dict[str, Any] = {}
        try:
            from src.services.ethicist_nim import run_ethicist_nim_pipeline
            nim_results = await run_ethicist_nim_pipeline(
                input_snapshot=input_data,
                reasoning="",
                recommendations=None,
            )
        except Exception as e:
            logger.debug("Ethicist NIM pipeline failed: %s", e)

        # 1. Ethical frameworks (rule-based)
        frameworks_applied = []
        ethical_score = severity
        flags = []
        overrides = []

        util_assessment = self._utilitarian_eval(severity, affected_population, input_data)
        frameworks_applied.append(util_assessment)

        if severity >= self.PRECAUTIONARY_THRESHOLD or reversibility == "irreversible":
            precaution = self._precautionary_eval(severity, reversibility, scenario_type)
            frameworks_applied.append(precaution)
            if precaution.get("override"):
                ethical_score = max(ethical_score, precaution["adjusted_score"])
                overrides.append("precautionary_override")
                flags.append("PRECAUTIONARY: Irreversible harm risk - apply maximum caution")

        if severity >= self.EXISTENTIAL_THRESHOLD:
            longtermist = self._longtermist_eval(severity, scenario_type)
            frameworks_applied.append(longtermist)
            if longtermist.get("override"):
                ethical_score = max(ethical_score, longtermist["adjusted_score"])
                overrides.append("longtermist_override")
                flags.append("LONGTERMIST: Existential risk detected - future generations at stake")

        if vulnerable_groups:
            rawlsian = self._rawlsian_eval(severity, vulnerable_groups, affected_population)
            frameworks_applied.append(rawlsian)
            if rawlsian.get("override"):
                ethical_score = max(ethical_score, rawlsian["adjusted_score"])
                overrides.append("rawlsian_override")
                flags.append(f"JUSTICE: Vulnerable populations affected ({', '.join(vulnerable_groups[:3])})")

        scores = [f.get("score", severity) for f in frameworks_applied]
        confidence = 1.0 - (max(scores) - min(scores)) if scores else 0.5

        recommendations = self._build_recommendations(ethical_score, flags, overrides, vulnerable_groups)
        reasoning = self._build_reasoning(ethical_score, frameworks_applied, flags)

        return {
            "agent_id": self.AGENT_ID,
            "agent_type": self.AGENT_TYPE,
            "risk_score": round(min(1.0, ethical_score), 4),
            "confidence": round(confidence, 3),
            "reasoning": reasoning,
            "recommendations": recommendations,
            "frameworks_applied": frameworks_applied,
            "ethical_flags": flags,
            "overrides_active": overrides,
            "ethics_rails_triggered": rails_triggered,
            "nim_pipeline": nim_results,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _utilitarian_eval(self, severity: float, population: int, data: Dict) -> Dict[str, Any]:
        """Utilitarian: greatest good for greatest number."""
        expected_harm = severity * max(1, population)
        score = min(1.0, severity * (1 + min(1.0, population / 1_000_000)))
        return {
            "framework": EthicalFramework.UTILITARIAN,
            "score": round(score, 4),
            "expected_harm_index": round(expected_harm, 0),
            "rationale": f"Expected harm index: {expected_harm:.0f} (severity × affected population)",
        }

    def _precautionary_eval(self, severity: float, reversibility: str, scenario: str) -> Dict[str, Any]:
        """Precautionary principle: when in doubt, prevent irreversible harm."""
        irreversibility_factor = {"reversible": 1.0, "partially_reversible": 1.3, "irreversible": 1.6}
        factor = irreversibility_factor.get(reversibility, 1.0)
        adjusted = min(1.0, severity * factor)
        return {
            "framework": EthicalFramework.PRECAUTIONARY,
            "score": round(adjusted, 4),
            "adjusted_score": round(adjusted, 4),
            "override": adjusted > severity,
            "reversibility": reversibility,
            "rationale": f"Irreversibility factor {factor}x applied. Original: {severity:.2%}, Adjusted: {adjusted:.2%}",
        }

    def _longtermist_eval(self, severity: float, scenario: str) -> Dict[str, Any]:
        """Longtermist: prioritize reduction of existential risk."""
        # Existential scenarios get maximum weight
        existential_scenarios = {"nuclear_exchange", "agi_unaligned", "engineered_pandemic", "nuclear_winter"}
        is_existential = any(s in scenario.lower() for s in existential_scenarios)
        adjusted = min(1.0, severity * (1.5 if is_existential else 1.1))
        # Future lives multiplier
        future_lives = 1e15  # Potential future humans
        expected_future_value = (1.0 - severity) * future_lives

        return {
            "framework": EthicalFramework.LONGTERMIST,
            "score": round(adjusted, 4),
            "adjusted_score": round(adjusted, 4),
            "override": is_existential and severity > 0.5,
            "is_existential": is_existential,
            "expected_future_value": f"{expected_future_value:.2e}",
            "rationale": (
                f"{'EXISTENTIAL SCENARIO: ' if is_existential else ''}Future lives at stake: ~{future_lives:.0e}. "
                f"Expected future value preservation: {expected_future_value:.2e}"
            ),
        }

    def _rawlsian_eval(self, severity: float, vulnerable_groups: List[str], population: int) -> Dict[str, Any]:
        """Rawlsian justice: protect the most vulnerable."""
        vulnerability_factor = 1.0 + len(vulnerable_groups) * 0.1
        adjusted = min(1.0, severity * vulnerability_factor)
        return {
            "framework": EthicalFramework.RAWLSIAN,
            "score": round(adjusted, 4),
            "adjusted_score": round(adjusted, 4),
            "override": len(vulnerable_groups) >= 2 and severity > 0.4,
            "vulnerable_groups": vulnerable_groups,
            "rationale": (
                f"Vulnerable populations identified: {', '.join(vulnerable_groups)}. "
                f"Vulnerability factor: {vulnerability_factor:.2f}x. "
                f"Rawlsian justice demands priority protection."
            ),
        }

    def _build_reasoning(self, score: float, frameworks: List[Dict], flags: List[str]) -> str:
        parts = [f"Ethical assessment across {len(frameworks)} frameworks:"]
        for f in frameworks:
            parts.append(f"  - {f.get('framework', 'unknown')}: {f.get('rationale', '')}")
        if flags:
            parts.append(f"Ethical flags raised: {'; '.join(flags)}")
        parts.append(f"Final ethical risk score: {score:.2%}")
        return " ".join(parts)

    def _build_recommendations(
        self,
        score: float,
        flags: List[str],
        overrides: List[str],
        vulnerable_groups: List[str],
    ) -> List[str]:
        recs = []
        if "precautionary_override" in overrides:
            recs.append("Apply precautionary principle: take preventive action before full evidence")
        if "longtermist_override" in overrides:
            recs.append("Prioritize existential risk reduction: expected value of intervention is astronomically high")
        if "rawlsian_override" in overrides:
            recs.append(f"Ensure protection measures prioritize vulnerable populations: {', '.join(vulnerable_groups[:3])}")
        if score > 0.7:
            recs.append("Recommend immediate escalation to decision-makers with full ethical assessment")
        if score > 0.5:
            recs.append("Conduct impact assessment on affected communities before proceeding")
        recs.append("Document ethical considerations in decision audit trail")
        return recs


    async def execute(self, action: str, params: dict, context: dict) -> dict:
        """
        Unified execution facade for Agent OS workflow dispatch.
        Routes action to the appropriate internal method.
        """
        import time as _time
        start = _time.time()

        if action in ("review", "assess", "verify"):
            severity = params.get("severity", 0.5)
            prev_recs = context.get("step_s3_result") or context.get("step_s2_result") or {}
            recommendations = prev_recs.get("recommendations", [])

            if recommendations:
                severity = max(severity, 0.5)

            input_data = {
                "severity": severity,
                "object_type": params.get("object_type", "risk_assessment"),
                "scenario_type": params.get("scenario_type", "multi_hazard"),
                "affected_population": params.get("affected_population", 0),
                "vulnerable_groups": params.get("vulnerable_groups", []),
                "reversibility": params.get("reversibility", "reversible"),
                "source_module": params.get("source_module", "default"),
            }
            result = await self.assess(input_data)

            return {
                "agent": "ETHICIST",
                "action": action,
                "status": "completed",
                "verdict": result,
                "duration_ms": int((_time.time() - start) * 1000),
            }

        return {
            "agent": "ETHICIST",
            "action": action,
            "status": "completed",
            "output": f"ETHICIST action '{action}' completed",
            "duration_ms": int((_time.time() - start) * 1000),
        }


# Global instance
ethicist_agent = EthicistAgent()
