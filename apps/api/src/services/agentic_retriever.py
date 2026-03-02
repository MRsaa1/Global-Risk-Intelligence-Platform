"""
Agentic Retriever - Multi-round evaluate/expand retrieval loop.

Wraps NeMoRetrieverService in an agentic loop that:
1. Retrieves initial results
2. Evaluates sufficiency via LLM
3. Expands query if needed and iterates
"""
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class AgenticRetrievalResult:
    """Result from agentic retrieval with evaluation metadata."""
    results: List[Dict[str, Any]] = field(default_factory=list)
    sufficiency_score: float = 0.0  # 0-1
    contradictions: List[str] = field(default_factory=list)
    query_expansions: List[str] = field(default_factory=list)
    rounds_used: int = 0


class AgenticRetriever:
    """
    Agentic retriever that wraps NeMoRetrieverService in a multi-round
    evaluate/expand loop.
    
    For each round:
    1. Call retriever.retrieve(query, top_k=10) or get_context_for_analysis
    2. Ask LLM: sufficiency, contradictions, additional info needed
    3. If sufficient, return; otherwise expand query and continue
    """

    def __init__(self, llm_service=None):
        self._llm = llm_service
        self._retriever = None

    def _get_retriever(self):
        """Lazy load NeMoRetrieverService."""
        if self._retriever is None:
            try:
                from src.services.nemo_retriever import get_nemo_retriever_service
                self._retriever = get_nemo_retriever_service()
            except ImportError as e:
                logger.warning(f"NeMo retriever unavailable: {e}")
        return self._retriever

    def _get_llm(self):
        """Lazy load LLM service."""
        if self._llm is None:
            try:
                from src.services.nvidia_llm import llm_service
                self._llm = llm_service
            except ImportError as e:
                logger.warning(f"NVIDIA LLM unavailable: {e}")
        return self._llm

    async def agentic_retrieve(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        max_rounds: int = 3,
    ) -> AgenticRetrievalResult:
        """
        Perform multi-round retrieval with LLM-driven evaluation and expansion.

        Args:
            query: Initial retrieval query
            context: Optional context dict (e.g., asset_id, subject)
            max_rounds: Maximum evaluate/expand rounds

        Returns:
            AgenticRetrievalResult with best results and metadata
        """
        context = context or {}
        expansions: List[str] = []
        best_results: List[Dict[str, Any]] = []
        best_score = 0.0
        contradictions: List[str] = []
        current_query = query
        round_num = 0

        retriever = self._get_retriever()
        llm = self._get_llm()

        if retriever is None:
            logger.warning("Retriever unavailable, returning empty result")
            return AgenticRetrievalResult(
                results=[],
                sufficiency_score=0.0,
                contradictions=[],
                query_expansions=[],
                rounds_used=0,
            )

        for round_num in range(max_rounds):
            try:
                # 1. Retrieve
                if context.get("subject") and context.get("subject_id"):
                    result = await retriever.get_context_for_analysis(
                        subject=context["subject"],
                        subject_id=context.get("subject_id"),
                        query=current_query,
                    )
                    docs = result.get("retrieved_documents", [])
                else:
                    ret_result = await retriever.retrieve(
                        query=current_query,
                        top_k=10,
                        asset_id=context.get("asset_id"),
                    )
                    docs = ret_result.retrieved_documents if hasattr(ret_result, "retrieved_documents") else ret_result.get("retrieved_documents", [])

                if not docs:
                    if round_num == 0:
                        return AgenticRetrievalResult(
                            results=[],
                            sufficiency_score=0.0,
                            contradictions=[],
                            query_expansions=expansions,
                            rounds_used=round_num + 1,
                        )
                    break

                best_results = docs

                # 2. LLM evaluation (if available)
                if llm is None:
                    best_score = 0.7
                    break

                eval_prompt = _build_eval_prompt(query, docs)
                eval_response = await llm.generate(
                    prompt=eval_prompt,
                    temperature=0.2,
                )
                score, new_contradictions, expand_query = _parse_eval_response(eval_response)
                contradictions.extend(new_contradictions)

                if score > best_score:
                    best_score = score
                    best_results = docs

                if score >= 0.85 or expand_query is None:
                    break

                if expand_query:
                    expansions.append(expand_query)
                    current_query = expand_query

            except Exception as e:
                logger.warning(f"Agentic retrieval round {round_num + 1} failed: {e}")
                if best_results:
                    break

        rounds_used = min(round_num + 1, max_rounds)
        return AgenticRetrievalResult(
            results=best_results,
            sufficiency_score=best_score,
            contradictions=list(dict.fromkeys(contradictions)),
            query_expansions=expansions,
            rounds_used=rounds_used,
        )


def _build_eval_prompt(query: str, docs: List[Dict[str, Any]]) -> str:
    """Build LLM evaluation prompt."""
    snippets = "\n".join(
        f"- {d.get('snippet', d.get('title', str(d)))[:300]}" for d in docs[:10]
    )
    return f"""Evaluate these retrieval results for the query: "{query}"

Retrieved documents:
{snippets}

Respond in this exact format:
SUFFICIENCY: <0-1 score, e.g. 0.7>
CONTRADICTIONS: <comma-separated list of contradictions, or NONE>
EXPAND: <suggested expanded query to find missing info, or NONE if sufficient>
"""


def _parse_eval_response(response: Any) -> tuple:
    """Parse LLM evaluation response. Returns (score, contradictions, expand_query)."""
    text = getattr(response, "content", str(response)) if response else ""
    score = 0.5
    contradictions: List[str] = []
    expand_query = None

    for line in text.strip().split("\n"):
        line = line.strip()
        if line.upper().startswith("SUFFICIENCY:"):
            try:
                val = line.split(":", 1)[1].strip()
                score = min(1.0, max(0.0, float(val.split()[0]) if val else 0.5))
            except (ValueError, IndexError):
                pass
        elif line.upper().startswith("CONTRADICTIONS:"):
            val = line.split(":", 1)[1].strip() if ":" in line else ""
            if val.upper() != "NONE":
                contradictions = [c.strip() for c in val.split(",") if c.strip()]
        elif line.upper().startswith("EXPAND:"):
            val = line.split(":", 1)[1].strip() if ":" in line else ""
            if val.upper() != "NONE":
                expand_query = val

    return score, contradictions, expand_query


# Module-level singletons
_agentic_retriever: Optional[AgenticRetriever] = None


def get_agentic_retriever(llm_service=None) -> AgenticRetriever:
    """Get or create AgenticRetriever instance."""
    global _agentic_retriever
    if _agentic_retriever is None:
        _agentic_retriever = AgenticRetriever(llm_service=llm_service)
    return _agentic_retriever
