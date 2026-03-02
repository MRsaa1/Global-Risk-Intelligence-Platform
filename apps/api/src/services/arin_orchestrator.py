"""
ARIN Orchestrator - Multi-agent risk assessment coordination.

Coordinates existing agents (SENTINEL, ANALYST, ADVISOR, ETHICIST, REPORTER, module agents)
for unified risk assessment. Part of Risk & Intelligence OS.

Roles:
- coordinator: ARIN aggregates specialist assessments, runs consensus and DAE; ARIN produces the final verdict.
- specialists: SENTINEL, ANALYST, ADVISOR, ETHICIST, and module agents (CIP_SENTINEL, SRO_SENTINEL, etc.) only provide assessments; they do not decide the final outcome.

Human-in-the-loop: CRITICAL / >€10M / life_safety → human_confirmation_required + escalation_reason.
"""
import logging
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from src.core.config import settings
from src.models.decision_object import (
    DecisionObject,
    AgentAssessment,
    ConsensusResult,
    DissentRecord,
    Verdict,
    Provenance,
)
from src.services.consensus_engine import run_consensus
from src.services.dae import DAEEngine

logger = logging.getLogger(__name__)

# Map object types to relevant agents
# ARIN receives report data from all services: stress_test, cip, scss, sro, asgi, erf, biosec, asm, cadapt, bcp, action_plans
# Ethicist is included for high-severity and existential scenarios
AGENT_ROUTING: dict[str, list[str]] = {
    "stress_test": ["sentinel", "analyst", "advisor", "ethicist"],
    "scenario": ["sentinel", "analyst", "advisor", "ethicist"],
    "infrastructure": ["cip_sentinel", "sentinel", "analyst", "ethicist"],
    "supplier": ["scss_advisor", "sentinel", "analyst"],
    "institution": ["sro_sentinel", "sentinel", "analyst"],
    "asset": ["sentinel", "analyst", "advisor"],
    "ai_system": ["sentinel", "analyst", "ethicist"],
    "existential": ["erf_sentinel", "sentinel", "analyst", "ethicist"],
    "biosecurity": ["biosec_sentinel", "sentinel", "analyst", "ethicist"],
    "nuclear": ["asm_sentinel", "sentinel", "analyst", "ethicist"],
    "adaptation": ["sentinel", "analyst", "advisor"],
    "default": ["sentinel", "analyst", "advisor", "ethicist"],
}


class ARINOrchestrator:
    """
    Coordinates agents for multi-perspective risk assessment.
    Produces DecisionObject and evaluates via DAE.
    """

    def __init__(self):
        self._dae = DAEEngine()

    def _select_agents(self, object_type: str) -> list[str]:
        """Select agents relevant to the object type."""
        return AGENT_ROUTING.get(object_type, AGENT_ROUTING["default"])

    async def _get_agent_assessments(
        self,
        input_data: dict,
        object_type: str,
        object_id: str,
        source_module: str,
    ) -> list[AgentAssessment]:
        """
        Collect assessments from selected agents.
        Uses real agent implementations when available (Ethicist, ERF, BIOSEC, ASM),
        falls back to simplified assessments for others.
        input_data may include shared_context fields (overseer_status, recent_alerts, portfolio_id).
        """
        agents = self._select_agents(object_type)
        assessments: list[AgentAssessment] = []
        # Inject source_module for Ethicist (ethics_rails module matrix); keep shared_context in input_data
        input_data = {**input_data, "source_module": source_module}

        # Derive a base score from input_data if present
        base_score = 0.5
        if "severity" in input_data:
            base_score = float(input_data.get("severity", 0.5))
        elif "risk_score" in input_data:
            base_score = float(input_data.get("risk_score", 0.5))

        for i, agent_id in enumerate(agents):
            # Try real agent implementation first
            real_result = await self._try_real_agent(agent_id, input_data, object_type)
            if real_result:
                assessments.append(
                    AgentAssessment(
                        agent_id=agent_id,
                        model_version="v1.0",
                        score=round(real_result.get("risk_score", base_score), 4),
                        confidence=real_result.get("confidence", 0.7),
                        reasoning=real_result.get("reasoning", f"Agent {agent_id} assessment"),
                        execution_time_ms=50 + i * 20,
                        risk_domain=agent_id.replace("_", " ").title(),
                    )
                )
            else:
                # Fallback: vary slightly per agent (simulate different perspectives)
                offset = (i - 1) * 0.05
                score = max(0.0, min(1.0, base_score + offset))
                assessments.append(
                    AgentAssessment(
                        agent_id=agent_id,
                        model_version="v1.0",
                        score=round(score, 4),
                        confidence=0.75 + (i * 0.03),
                        reasoning=f"Agent {agent_id} assessment for {object_type} {object_id}",
                        execution_time_ms=50 + i * 20,
                        risk_domain=agent_id.replace("_", " ").title(),
                    )
                )

        return assessments

    async def _try_real_agent(
        self, agent_id: str, input_data: dict, object_type: str
    ) -> Optional[dict]:
        """Attempt to run a real agent implementation."""
        try:
            if agent_id == "ethicist":
                from src.layers.agents.ethicist import ethicist_agent
                return await ethicist_agent.assess(input_data)
            elif agent_id == "erf_sentinel":
                from src.modules.erf.agents import erf_sentinel
                return await erf_sentinel.assess(input_data)
            elif agent_id == "biosec_sentinel":
                from src.modules.biosec.agents import biosec_sentinel
                return await biosec_sentinel.assess(input_data)
            elif agent_id == "asm_sentinel":
                from src.modules.asm.agents import asm_sentinel
                return await asm_sentinel.assess(input_data)
            elif agent_id == "sentinel":
                from src.layers.agents.sentinel import sentinel_agent
                out = await sentinel_agent.execute("scan", {"scope": "portfolio"}, input_data)
                alerts = out.get("alerts", [])
                alerts_count = out.get("alerts_count", len(alerts))
                severity_sum = sum(
                    0.9 if a.get("severity") == "critical" else 0.7 if a.get("severity") == "high" else 0.4
                    for a in alerts[:20]
                )
                risk_score = min(1.0, (severity_sum / 3.0) + (alerts_count * 0.05)) if alerts else float(input_data.get("risk_score", input_data.get("severity", 0.5)))
                return {
                    "risk_score": risk_score,
                    "confidence": 0.75,
                    "reasoning": f"SENTINEL scan: {alerts_count} alerts; " + (out.get("output", "") or "scan completed"),
                }
            elif agent_id == "analyst":
                from src.layers.agents.analyst import analyst_agent
                out = await analyst_agent.execute("run_analysis", {"asset_name": input_data.get("object_id", "portfolio")}, input_data)
                analyses = out.get("analyses", [])
                confidences = [a.get("confidence", 0.5) for a in analyses if isinstance(a, dict)]
                avg_conf = sum(confidences) / len(confidences) if confidences else 0.5
                risk_score = min(1.0, 0.3 + (1.0 - avg_conf) * 0.6) if confidences else float(input_data.get("risk_score", input_data.get("severity", 0.5)))
                return {
                    "risk_score": risk_score,
                    "confidence": avg_conf if confidences else 0.7,
                    "reasoning": (out.get("llm_analysis", "") or f"ANALYST run_analysis: {len(analyses)} analyses")[:500],
                }
            elif agent_id == "advisor":
                from src.layers.agents.advisor import advisor_agent
                out = await advisor_agent.execute("assess_risks", {"asset_id": input_data.get("object_id", "portfolio")}, input_data)
                recs = out.get("recommendations", [])
                urgency_sum = sum(0.8 if r.get("urgency") == "high" else 0.5 for r in recs[:10] if isinstance(r, dict))
                risk_score = min(1.0, 0.35 + (urgency_sum / 5.0)) if recs else float(input_data.get("risk_score", input_data.get("severity", 0.5)))
                return {
                    "risk_score": risk_score,
                    "confidence": 0.72,
                    "reasoning": (out.get("llm_advice", "") or f"ADVISOR assess_risks: {len(recs)} recommendations")[:500],
                }
        except Exception as e:
            logger.warning(f"Real agent {agent_id} failed, using fallback: {e}")
        return None

    async def assess(
        self,
        source_module: str,
        object_type: str,
        object_id: str,
        input_data: Optional[dict] = None,
        shared_context: Optional[dict] = None,
    ) -> DecisionObject:
        """
        Run multi-agent assessment and produce DecisionObject.
        shared_context: optional request-scoped context (overseer_status, recent_alerts, portfolio_id)
        merged into input_data so all agents in the chain see it.
        """
        input_data = input_data or {}
        if shared_context:
            input_data = {**input_data, "_shared_context": shared_context}
        decision_id = f"DEC-{datetime.utcnow().strftime('%Y-%m-%d')}-{uuid4().hex[:8].upper()}"

        assessments = await self._get_agent_assessments(
            input_data, object_type, object_id, source_module
        )
        consensus, dissent = run_consensus(assessments)

        # Human-in-the-loop: CRITICAL / >€10M / life_safety → human review
        escalation_threshold_eur = getattr(settings, "ethicist_escalation_threshold_eur", 10_000_000.0)
        life_safety_threshold = getattr(settings, "ethicist_life_safety_severity_threshold", 0.85)
        financial_impact_eur = float(input_data.get("financial_impact_eur") or input_data.get("impact_eur") or 0)
        life_safety = bool(input_data.get("life_safety") or input_data.get("life_safety_risk"))
        severity = float(input_data.get("severity", consensus.final_score))
        human_required = consensus.risk_level == "HIGH"
        escalation_reason: Optional[str] = None
        if consensus.risk_level == "CRITICAL" or (consensus.risk_level == "HIGH" and severity >= 0.9):
            human_required = True
            escalation_reason = "CRITICAL"
        if financial_impact_eur >= escalation_threshold_eur:
            human_required = True
            escalation_reason = "financial_impact"
        if life_safety or severity >= life_safety_threshold:
            human_required = True
            escalation_reason = escalation_reason or "life_safety"

        verdict = Verdict(
            risk_level=consensus.risk_level,
            confidence=consensus.confidence,
            recommendation=self._score_to_recommendation(consensus.final_score),
            time_horizon_days=30,
            suggested_actions=self._suggest_actions(consensus),
            human_confirmation_required=human_required,
            escalation_reason=escalation_reason,
        )

        provenance = Provenance(
            input_hash=None,
            model_versions={"arin_orchestrator": "1.0"},
            source_module=source_module,
        )

        decision = DecisionObject(
            decision_id=decision_id,
            source_module=source_module,
            object_type=object_type,
            object_id=object_id,
            agent_assessments=assessments,
            consensus=consensus,
            dissent=dissent,
            verdict=verdict,
            provenance=provenance,
            input_snapshot=input_data,
        )

        # Run DAE
        await self._dae.evaluate_and_audit(decision)

        # Optional: log to unified agent audit for AgentOps
        try:
            from src.services.agent_actions_log import append as log_append
            result_summary = f"{consensus.risk_level} score={consensus.final_score:.2f}"
            if verdict.human_confirmation_required and verdict.escalation_reason:
                result_summary += f" escalation={verdict.escalation_reason}"
            await log_append(
                source="arin",
                agent_id="arin",
                action_type="assess",
                input_summary=f"{object_type} {object_id} [{source_module}]"[:500],
                result_summary=result_summary[:500],
                meta={"decision_id": decision_id},
            )
        except Exception as e:
            logger.debug("ARIN agent actions log append skipped: %s", e)

        return decision

    def _score_to_recommendation(self, score: float) -> str:
        if score >= 0.8:
            return "REDUCE"
        if score >= 0.6:
            return "MONITOR"
        if score >= 0.4:
            return "HOLD"
        return "HOLD"

    def _suggest_actions(self, consensus: ConsensusResult) -> list[str]:
        if consensus.risk_level == "CRITICAL":
            return ["immediate_review", "reduce_exposure", "consider_hedge"]
        if consensus.risk_level == "HIGH":
            return ["review_exposure", "consider_hedge"]
        if consensus.risk_level == "MEDIUM":
            return ["monitor_closely"]
        return []


_arin_orchestrator: Optional[ARINOrchestrator] = None


def get_arin_orchestrator() -> ARINOrchestrator:
    """Get singleton ARIN orchestrator."""
    global _arin_orchestrator
    if _arin_orchestrator is None:
        _arin_orchestrator = ARINOrchestrator()
    return _arin_orchestrator
