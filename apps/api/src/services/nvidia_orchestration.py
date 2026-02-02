"""
NVIDIA AI Orchestration Layer - Multi-model consensus for stress tests.

Uses the same NVIDIA API key (nvidia_api_key) for:
- Model 1: Entity classification (ontology + optional LLM)
- Model 2: Scenario analysis (fast = Mistral NeMo 12B, deep = Llama 70B)
- Model 3: Cascade analysis (existing cascade_gnn / cuGraph)
- Model 4: Executive summary (Llama 70B)

Consensus: parallel fast + deep analysis, consistency score, weighted decision.
"""
import asyncio
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.services.nvidia_llm import llm_service, LLMModel
from src.services.risk_zone_calculator import detect_entity_type

logger = logging.getLogger(__name__)

# Weights for consensus (high confidence in entity; scenario by agreement)
WEIGHT_ENTITY_CLASSIFIER = 0.95
WEIGHT_SCENARIO_FAST = 0.7
WEIGHT_SCENARIO_DEEP = 0.9
CONSISTENCY_THRESHOLD = 0.85  # Above this use fast result; else use deep + flag review


@dataclass
class OrchestrationResult:
    """Result of NVIDIA AI Orchestration analysis."""
    entity_type: str
    analysis: str
    summary: str
    confidence: float
    model_agreement: float  # consistency_score
    used_model_fast: str
    used_model_deep: str
    flag_for_human_review: bool = False
    raw_fast: Optional[str] = None
    raw_deep: Optional[str] = None


def _jaccard_similarity(a: str, b: str) -> float:
    """Simple text similarity 0-1 for consistency check (no embedding API required)."""
    if not a or not b:
        return 0.0
    a = re.sub(r"\W+", " ", a.lower()).strip()
    b = re.sub(r"\W+", " ", b.lower()).strip()
    if not a or not b:
        return 0.0
    sa, sb = set(a.split()), set(b.split())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def select_model_by_severity(severity: float) -> str:
    """
    Select analysis depth by severity.
    severity > 0.8 -> deep (critical), > 0.5 -> balanced, else fast.
    """
    if severity > 0.8:
        return "deep"
    if severity > 0.5:
        return "balanced"
    return "fast"


class NVIDIAConsensusEngine:
    """
    Weighted consensus across multiple NVIDIA models (same API key).
    Entity classification: ontology (or optional NeMo NER when NIM available).
    Scenario: fast (Mistral NeMo 12B) + deep (Llama 70B) in parallel; consensus.
    Summary: Llama 70B.
    """

    def __init__(self):
        self._llm = llm_service
        # Model mapping: fast = Mistral NeMo 12B or Llama 8B fallback, deep = Llama 70B
        self._model_fast = getattr(LLMModel, "MISTRAL_NEMO_12B", LLMModel.LLAMA_8B)
        self._model_deep = LLMModel.LLAMA_70B
        self._model_summary = LLMModel.LLAMA_70B

    @property
    def is_available(self) -> bool:
        return self._llm.is_available

    async def classify_entity(self, entity_name: str) -> tuple[str, float]:
        """
        Entity classification. Uses ontology; optional: call LLM for subtype.
        Returns (entity_type, confidence).
        """
        entity_type = detect_entity_type(entity_name or "")
        # Optional: one LLM call "Classify entity type: {name}" for confidence boost
        confidence = WEIGHT_ENTITY_CLASSIFIER
        return entity_type, confidence

    async def analyze_scenario_fast(self, scenario: Dict[str, Any]) -> str:
        """Fast scenario analysis (Mistral NeMo 12B or Llama 8B)."""
        prompt = self._scenario_prompt(scenario)
        try:
            r = await self._llm.generate(
                prompt=prompt,
                model=self._model_fast,
                max_tokens=400,
                temperature=0.3,
            )
            if r.finish_reason != "mock" and r.content:
                return r.content.strip()
        except Exception as e:
            logger.debug("Orchestration fast analysis failed: %s", e)
        return ""

    async def analyze_scenario_deep(self, scenario: Dict[str, Any]) -> str:
        """Deep scenario analysis (Llama 70B)."""
        prompt = self._scenario_prompt(scenario)
        try:
            r = await self._llm.generate(
                prompt=prompt,
                model=self._model_deep,
                max_tokens=600,
                temperature=0.3,
            )
            if r.finish_reason != "mock" and r.content:
                return r.content.strip()
        except Exception as e:
            logger.debug("Orchestration deep analysis failed: %s", e)
        return ""

    def _scenario_prompt(self, scenario: Dict[str, Any]) -> str:
        entity = scenario.get("entity_name", "")
        entity_type = scenario.get("entity_type", "")
        event = scenario.get("event_name", "")
        event_type = scenario.get("event_type", "")
        severity = scenario.get("severity", 0.5)
        zones = scenario.get("zones_text", "")
        loss = scenario.get("total_loss", 0)
        return f"""Analyze this stress test scenario in 3-5 short bullet points. Plain text, English, no markdown.
Entity: {entity} (Type: {entity_type})
Event: {event} ({event_type}) | Severity: {severity:.0%}
Total loss: €{loss:,.0f}M
Risk zones:
{zones}
Focus: key risks, exposure, immediate priorities."""

    async def generate_summary(self, analysis: str, scenario: Dict[str, Any]) -> str:
        """Executive summary from consolidated analysis (Llama 70B)."""
        prompt = f"""Synthesize the following analysis into a professional executive summary (2-3 paragraphs). Plain text only, no markdown. English.

Analysis:
{analysis}

Write: (1) risk scenario and implications, (2) key findings with metrics, (3) immediate priorities for stakeholders."""
        try:
            r = await self._llm.generate(
                prompt=prompt,
                model=self._model_summary,
                max_tokens=600,
                temperature=0.3,
            )
            if r.finish_reason != "mock" and r.content:
                return r.content.strip()
        except Exception as e:
            logger.debug("Orchestration summary failed: %s", e)
        return ""

    async def analyze_with_consensus(
        self,
        entity_name: str,
        scenario: Dict[str, Any],
        severity: Optional[float] = None,
    ) -> OrchestrationResult:
        """
        Run entity classification, parallel fast + deep scenario analysis,
        consistency check, weighted consensus, then executive summary.
        """
        severity = severity or float(scenario.get("severity", 0.5))
        scenario["entity_name"] = entity_name
        scenario["entity_type"] = detect_entity_type(entity_name or "")

        # 1. Entity classification
        entity_type, _ = await self.classify_entity(entity_name)
        scenario["entity_type"] = entity_type

        # 2. Parallel scenario analysis (fast + deep)
        fast_analysis, deep_analysis = await asyncio.gather(
            self.analyze_scenario_fast(scenario),
            self.analyze_scenario_deep(scenario),
        )

        # 3. Consistency (simple text similarity; no embedding API required)
        consistency_score = _jaccard_similarity(fast_analysis or "", deep_analysis or "")

        # 4. Weighted consensus
        if consistency_score >= CONSISTENCY_THRESHOLD and fast_analysis:
            final_analysis = fast_analysis
            confidence = 0.9
            flag_review = False
        else:
            final_analysis = deep_analysis or fast_analysis or "Analysis unavailable."
            confidence = 0.7
            # Flag for human review when models disagree (low agreement) or below threshold
            flag_review = (
                consistency_score < CONSISTENCY_THRESHOLD and bool(deep_analysis and fast_analysis)
            ) or consistency_score < 0.3

        # 5. Executive summary
        summary = await self.generate_summary(final_analysis, scenario)

        return OrchestrationResult(
            entity_type=entity_type,
            analysis=final_analysis,
            summary=summary or final_analysis,
            confidence=confidence,
            model_agreement=round(consistency_score, 3),
            used_model_fast=self._model_fast.value,
            used_model_deep=self._model_deep.value,
            flag_for_human_review=flag_review,
            raw_fast=fast_analysis or None,
            raw_deep=deep_analysis or None,
        )


# Singleton
nvidia_consensus_engine = NVIDIAConsensusEngine()
