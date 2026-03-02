"""
Consensus Engine - Multi-agent risk assessment aggregation.

Aggregates outputs from multiple agents with weighted scoring and dissent capture.
Part of Risk & Intelligence OS.
"""
import logging
from typing import Optional

from src.models.decision_object import (
    AgentAssessment,
    ConsensusResult,
    DissentRecord,
)

logger = logging.getLogger(__name__)

DISSENT_THRESHOLD = 0.25  # Score deviation from consensus to count as dissent
MIN_CONFIDENCE = 0.3  # Minimum confidence to avoid division issues


def aggregate_assessments(assessments: list[AgentAssessment]) -> ConsensusResult:
    """
    Aggregate agent assessments using confidence-weighted mean.
    """
    if not assessments:
        return ConsensusResult(
            method="none",
            final_score=0.5,
            confidence=0.0,
            risk_level="MEDIUM",
            agent_count=0,
        )

    total_weight = 0.0
    weighted_sum = 0.0
    for a in assessments:
        w = max(a.confidence, MIN_CONFIDENCE)
        weighted_sum += a.score * w
        total_weight += w

    final_score = weighted_sum / total_weight if total_weight > 0 else 0.5
    avg_confidence = sum(a.confidence for a in assessments) / len(assessments)
    risk_level = _score_to_risk_level(final_score)

    return ConsensusResult(
        method="confidence_weighted_mean",
        final_score=round(final_score, 4),
        confidence=round(min(avg_confidence, 0.99), 4),
        risk_level=risk_level,
        agent_count=len(assessments),
    )


def detect_dissent(
    assessments: list[AgentAssessment],
    consensus: ConsensusResult,
    threshold: float = DISSENT_THRESHOLD,
) -> Optional[DissentRecord]:
    """
    Identify agents whose scores deviate significantly from consensus.
    """
    if not assessments:
        return None

    dissenting = []
    max_deviation = 0.0

    for a in assessments:
        dev = abs(a.score - consensus.final_score)
        if dev >= threshold:
            dissenting.append(a.agent_id)
            max_deviation = max(max_deviation, dev)

    if not dissenting:
        return None

    # Build explanation from dissenting agents' reasoning
    reasons = [a.reasoning for a in assessments if a.agent_id in dissenting and a.reasoning]
    explanation = " ".join(reasons[:2]) if reasons else "Agents disagree on risk magnitude."

    return DissentRecord(
        dissenting_agents=dissenting,
        dissent_strength=round(min(max_deviation, 1.0), 4),
        explanation=explanation[:500],
    )


def calculate_confidence(assessments: list[AgentAssessment]) -> float:
    """Overall confidence from agent assessments."""
    if not assessments:
        return 0.0
    return sum(a.confidence for a in assessments) / len(assessments)


def _score_to_risk_level(score: float) -> str:
    """Map 0-1 score to risk level. Aligned with h3_spatial/city_risk: critical >= 0.8, high >= 0.6."""
    if score >= 0.8:
        return "CRITICAL"
    if score >= 0.6:
        return "HIGH"
    if score >= 0.4:
        return "MEDIUM"
    return "LOW"


def run_consensus(assessments: list[AgentAssessment]) -> tuple[ConsensusResult, Optional[DissentRecord]]:
    """
    Run full consensus: aggregate and detect dissent.
    """
    consensus = aggregate_assessments(assessments)
    dissent = detect_dissent(assessments, consensus)
    return consensus, dissent
