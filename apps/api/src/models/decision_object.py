"""
Decision Object - Unified machine-readable output format for all risk assessments.

Part of Risk & Intelligence OS. Enables:
- Reproducibility via full provenance
- Auditability for regulatory compliance
- Actionability via DAE policy engine
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AgentAssessment(BaseModel):
    """Individual agent risk assessment."""
    agent_id: str = Field(..., description="Agent identifier (e.g. sentinel, analyst, advisor)")
    model_version: Optional[str] = Field(None, description="Model/agent version")
    score: float = Field(..., ge=0.0, le=1.0, description="Risk score 0-1")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in assessment")
    reasoning: str = Field("", description="Explainable reasoning chain")
    execution_time_ms: Optional[int] = Field(None, description="Execution latency")
    risk_domain: Optional[str] = Field(None, description="Risk domain (market, liquidity, operational, etc.)")


class ConsensusResult(BaseModel):
    """Aggregated consensus from multiple agents."""
    method: str = Field("confidence_weighted_mean", description="Aggregation method")
    final_score: float = Field(..., ge=0.0, le=1.0, description="Consensus risk score")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Overall confidence")
    risk_level: str = Field(..., description="CRITICAL, HIGH, MEDIUM, LOW")
    agent_count: int = Field(1, description="Number of agents contributing")


class DissentRecord(BaseModel):
    """Record of dissenting agent opinions."""
    dissenting_agents: list[str] = Field(default_factory=list)
    dissent_strength: float = Field(0.0, ge=0.0, le=1.0, description="Magnitude of dissent")
    explanation: str = Field("", description="Why agents disagree")


class Verdict(BaseModel):
    """Final verdict and recommendation."""
    risk_level: str = Field(..., description="CRITICAL, HIGH, MEDIUM, LOW")
    confidence: float = Field(..., ge=0.0, le=1.0)
    recommendation: str = Field("MONITOR", description="REDUCE, INCREASE, HOLD, MONITOR, ESCALATE")
    time_horizon_days: Optional[int] = Field(None, description="Suggested action horizon")
    suggested_actions: list[str] = Field(default_factory=list)
    human_confirmation_required: bool = Field(False)
    escalation_reason: Optional[str] = Field(None, description="CRITICAL / financial_impact / life_safety")


class Provenance(BaseModel):
    """Provenance for reproducibility and audit."""
    input_hash: Optional[str] = Field(None, description="Hash of input data")
    model_versions: dict[str, str] = Field(default_factory=dict)
    code_commit: Optional[str] = Field(None)
    policy_version: Optional[str] = Field(None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source_module: str = Field("", description="cip, scss, sro, stress_test")


class DecisionObject(BaseModel):
    """
    Machine-readable risk assessment output.
    Central artifact for reproducibility, auditability, and DAE actionability.
    """
    schema_version: str = Field("2.0", description="Schema version")
    decision_id: str = Field(..., description="Unique decision identifier")
    source_module: str = Field(..., description="cip, scss, sro, stress_test")
    object_type: str = Field(..., description="infrastructure, supplier, institution, scenario, asset")
    object_id: str = Field(..., description="ID of assessed object")

    agent_assessments: list[AgentAssessment] = Field(default_factory=list)
    consensus: ConsensusResult
    dissent: Optional[DissentRecord] = None

    verdict: Verdict
    provenance: Provenance

    # Optional input snapshot for replay
    input_snapshot: Optional[dict[str, Any]] = Field(None, description="Input data for replay_decision")
    source_request_id: Optional[str] = Field(None)

    class Config:
        json_schema_extra = {
            "example": {
                "schema_version": "2.0",
                "decision_id": "DEC-2026-02-06-001",
                "source_module": "stress_test",
                "object_type": "scenario",
                "object_id": "NGFS-SSP2-4.5",
                "consensus": {
                    "method": "confidence_weighted_mean",
                    "final_score": 0.67,
                    "confidence": 0.82,
                    "risk_level": "HIGH",
                    "agent_count": 3
                },
                "verdict": {
                    "risk_level": "HIGH",
                    "confidence": 0.82,
                    "recommendation": "REDUCE",
                    "time_horizon_days": 30,
                    "human_confirmation_required": True
                },
                "provenance": {
                    "timestamp": "2026-02-06T10:21:00Z",
                    "source_module": "stress_test"
                }
            }
        }
