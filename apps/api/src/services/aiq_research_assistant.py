"""
AI-Q style "Research Assistant" orchestration for the platform.

Goal:
- Provide a practical, lightweight implementation of the blueprint workflow:
  plan → retrieve → draft → critique → final + sources

This module is intentionally dependency-light and relies on:
- NVIDIA cloud LLM (or local NIM later) via src.services.nvidia_llm
- NeMo Retriever "light RAG" via src.services.nemo_retriever
- NeMo Guardrails (heuristics today; can be swapped later) via src.services.nemo_guardrails
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from src.core.config import settings
from src.services.client_finetune_context import get_client_context_snippet
from src.services.nemo_guardrails import get_nemo_guardrails_service
from src.services.nemo_retriever import get_nemo_retriever_service
from src.services.nvidia_llm import LLMModel, llm_service

logger = logging.getLogger(__name__)


@dataclass
class CitationSource:
    """A human-readable source that can be cited in outputs."""

    id: str
    kind: str  # relational_db / historical_event / knowledge_graph / internal
    title: str
    snippet: str = ""
    url: Optional[str] = None


@dataclass
class AiqResult:
    text: str
    sources: List[CitationSource]
    debug: Optional[Dict[str, Any]] = None


def _is_complex_query(question: str) -> bool:
    """Heuristic: long or explicit request for steps/plan → use Nemotron if enabled."""
    q = (question or "").strip().lower()
    if len(q) > 300:
        return True
    triggers = [
        "по шагам", "пошагов", "план", "распиши план", "объясни по шагам",
        "step by step", "steps", "plan", "break down", "reasoning",
    ]
    return any(t in q for t in triggers)


def _safe_json_dumps(obj: Any, max_len: int = 15_000) -> str:
    try:
        s = json.dumps(obj, ensure_ascii=False, indent=2, default=str)
    except Exception:
        s = str(obj)
    if len(s) > max_len:
        return s[:max_len] + "\n…(truncated)…"
    return s


def _normalize_doc_to_source(doc: Dict[str, Any]) -> Optional[CitationSource]:
    """
    Convert heterogeneous retrieval docs into a standardized CitationSource.
    """
    if not isinstance(doc, dict):
        return None

    # Relational docs we emit in nemo_retriever
    if doc.get("source") == "relational_db":
        entity = doc.get("entity") or "entity"
        doc_id = doc.get("id") or ""
        title = doc.get("title") or doc.get("name") or f"{entity}:{doc_id}"
        return CitationSource(
            id=f"{entity}:{doc_id}",
            kind="relational_db",
            title=str(title),
            snippet=str(doc.get("snippet") or "")[:500],
            url=doc.get("url"),
        )

    # Historical events emitted in nemo_retriever._query_historical_events
    if "event_type" in doc and "description" in doc and doc.get("id"):
        return CitationSource(
            id=f"historical_event:{doc.get('id')}",
            kind="historical_event",
            title=str(doc.get("title") or doc.get("name") or doc.get("event_type") or "HistoricalEvent"),
            snippet=str(doc.get("description") or "")[:500],
            url=None,
        )

    # KG nodes/relationships are currently dict() of Neo4j records; keep minimal
    if "id" in doc and ("labels" in doc or "label" in doc):
        return CitationSource(
            id=f"kg:{doc.get('id')}",
            kind="knowledge_graph",
            title=str(doc.get("name") or doc.get("id")),
            snippet=str(doc.get("description") or "")[:500],
            url=None,
        )

    return None


class AiqResearchAssistant:
    """
    Minimal AI-Q orchestration.
    """

    def __init__(self):
        self.retriever = get_nemo_retriever_service()
        self.guardrails = get_nemo_guardrails_service()

    async def _plan(self, goal: str, context: Dict[str, Any]) -> List[str]:
        """
        Ask the LLM for a short retrieval plan. Returns a list of retrieval queries.
        """
        # If LLM isn't configured, fallback to a deterministic plan.
        if not getattr(llm_service, "is_available", False):
            return [goal]

        prompt = f"""You are an AI-Q style planner.
Return ONLY valid JSON with this schema:
{{
  "retrieval_queries": ["...","..."],
  "notes": "short"
}}

Goal: {goal}

Context (JSON, may be truncated):
{_safe_json_dumps(context, max_len=6000)}
"""
        resp = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_8B,
            max_tokens=300,
            temperature=0.2,
            system_prompt="You are a planning module. Output JSON only.",
        )
        try:
            data = json.loads(resp.content)
            queries = data.get("retrieval_queries") or []
            queries = [q.strip() for q in queries if isinstance(q, str) and q.strip()]
            return queries[:5] or [goal]
        except Exception:
            return [goal]

    async def _retrieve(self, queries: List[str], top_k: int = 6) -> Tuple[List[CitationSource], Dict[str, Any]]:
        sources: List[CitationSource] = []
        debug: Dict[str, Any] = {"queries": queries, "retrieval": []}

        # Collect candidates across queries, then dedupe sources
        for q in queries[:5]:
            res = await self.retriever.retrieve(q, top_k=top_k, sources=["relational_db", "historical_events", "knowledge_graph"])
            debug["retrieval"].append({"query": q, "total": res.total_results})
            for doc in res.retrieved_documents:
                src = _normalize_doc_to_source(doc)
                if src:
                    sources.append(src)

        # Deduplicate by id
        seen = set()
        uniq: List[CitationSource] = []
        for s in sources:
            if s.id in seen:
                continue
            seen.add(s.id)
            uniq.append(s)

        return uniq[:12], debug

    async def _draft(self, goal: str, context: Dict[str, Any], sources: List[CitationSource]) -> str:
        sources_block = "\n".join(
            [
                f"[{i+1}] {s.title} ({s.kind}, {s.id})" + (f" — {s.snippet}" if s.snippet else "")
                for i, s in enumerate(sources[:12])
            ]
        )
        policies = context.get("policies") or {}
        env_hint = policies.get("environment") or "unknown"
        prompt = f"""You are an AI system operator and risk platform overseer.
Write a concise executive summary answering the goal.

Hard requirements:
- Output plain text only. Do NOT use Markdown (no **bold**, no headings with #).
- 2-4 short sentences + a "Next actions:" list on new lines using "-" bullets (max 3 bullets).
- Use citations like [1], [2] that refer to the sources list below.
- If a statement is not supported by sources, phrase it as an observation of the provided snapshot.
- Do NOT recommend "fixing/enabling" services that are intentionally disabled by configuration.
- If a service is optional and disabled, mention it as "disabled by config" and don't list it as an action item.
- If asset_count is 0 in a development or fresh environment, treat it as "no assets yet" (not an ingestion failure). Suggest seeding or creating an asset only as an optional action.
- If Sentinel monitoring is stopped, state it neutrally and only propose enabling it if real-time alerting is desired.

Goal: {goal}

Snapshot/Context (JSON, may be truncated):
{_safe_json_dumps(context, max_len=9000)}

Service policies (JSON):
{_safe_json_dumps(policies, max_len=2000)}

Sources:
{sources_block if sources_block else "(no external sources)"}"""
        system_prompt = "Be concise and operational. Prefer concrete, verifiable statements."
        client_snippet = get_client_context_snippet()
        if client_snippet:
            system_prompt = client_snippet + "\n\n" + system_prompt
        resp = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=650,
            temperature=0.3,
            system_prompt=system_prompt,
        )
        return resp.content or ""

    async def _critique_and_rewrite(self, draft: str, context: Dict[str, Any]) -> str:
        if not draft:
            return draft

        try:
            result = await self.guardrails.validate(draft, context=context, agent_type="REPORTER")
        except Exception as e:
            logger.debug("Guardrails validate failed: %s", e)
            return draft

        # If only warnings, keep it; if any violations, rewrite with constraints.
        if result.passed:
            return draft

        prompt = f"""Rewrite the following text to address these violations: {', '.join(v.value for v in result.violations)}.
Keep it concise and operational. Preserve any citations like [1], [2] if present.

Text:
{draft}
"""
        resp = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=650,
            temperature=0.2,
            system_prompt="Fix issues; do not add speculative details.",
        )
        return resp.content or draft

    async def overseer_summary(self, snapshot: Dict[str, Any], system_alerts: List[Dict[str, Any]]) -> AiqResult:
        """
        Produce an executive summary for Overseer status, with citations.
        """
        # Minimal context to avoid token blow-ups + policy flags to avoid bad recommendations
        ctx = {
            "health": snapshot.get("health", {}),
            "platform": snapshot.get("platform", {}),
            "alerts": snapshot.get("alerts", {}),
            "nvidia": snapshot.get("nvidia", {}),
            "performance": snapshot.get("performance", {}),
            "system_alerts": system_alerts,
            "events_last_100": snapshot.get("events_last_100", [])[:20],
            "policies": {
                "environment": getattr(settings, "environment", "development"),
                "enable_neo4j": bool(getattr(settings, "enable_neo4j", False)),
                "enable_minio": bool(getattr(settings, "enable_minio", False)),
                "enable_timescale": bool(getattr(settings, "enable_timescale", False)),
                "use_local_nim": bool(getattr(settings, "use_local_nim", False)),
                "nvidia_mode": getattr(settings, "nvidia_mode", "cloud"),
                "oversee_use_llm": bool(getattr(settings, "oversee_use_llm", True)),
            },
        }

        goal = "Summarize current system state and what needs attention, in priority order."

        # Always include multiple internal sources to make citations meaningful.
        base_sources = [
            CitationSource(
                id="internal:overseer_health",
                kind="internal",
                title="Overseer health snapshot (db/redis/external/system)",
                snippet="Health checks: database, redis, external APIs, process metrics.",
                url=None,
            ),
            CitationSource(
                id="internal:overseer_endpoints",
                kind="internal",
                title="Overseer endpoint metrics (latency/error rate)",
                snippet="Aggregated API endpoint metrics (avg duration, error rate, totals).",
                url=None,
            ),
            CitationSource(
                id="internal:overseer_nvidia",
                kind="internal",
                title="Overseer NVIDIA status (LLM/NIM/PhysicsNeMo)",
                snippet="NVIDIA integration status derived from config + lightweight checks.",
                url=None,
            )
        ]

        debug: Dict[str, Any] = {}

        if not getattr(llm_service, "is_available", False):
            # LLM not configured: return deterministic fallback with internal source only.
            text = "LLM not configured. Set NVIDIA_API_KEY (or NVIDIA_LLM_API_KEY) to enable executive summaries with sources."
            return AiqResult(text=text, sources=base_sources, debug={"reason": "llm_not_available"})

        plan_queries = await self._plan(goal, ctx)
        retrieved_sources, retrieval_debug = await self._retrieve(plan_queries, top_k=6)
        debug.update(retrieval_debug)

        all_sources = base_sources + retrieved_sources
        draft = await self._draft(goal, ctx, all_sources)
        final = await self._critique_and_rewrite(draft, context=ctx)

        # Post-process to enforce "no markdown" and stable bullets.
        final = (final or "").replace("**", "")
        final = final.replace("•", "-")
        # Make sure "Next actions" is easy to scan
        final = final.replace("Next actions:", "Next actions:")

        # Ensure at least one citation exists (internal snapshot)
        if "[" not in final and "]" not in final:
            final = final.strip() + " [1]"

        return AiqResult(text=final.strip(), sources=all_sources[:12], debug=debug)

    async def answer_question(self, question: str, context: Optional[Dict[str, Any]] = None) -> AiqResult:
        """
        General-purpose question answering with citations (AI-Q style).
        Intended for UI "Explain / Ask" actions.
        """
        ctx_in = dict(context or {})

        policies = {
            "environment": getattr(settings, "environment", "development"),
            "enable_neo4j": bool(getattr(settings, "enable_neo4j", False)),
            "enable_minio": bool(getattr(settings, "enable_minio", False)),
            "enable_timescale": bool(getattr(settings, "enable_timescale", False)),
            "use_local_nim": bool(getattr(settings, "use_local_nim", False)),
            "nvidia_mode": getattr(settings, "nvidia_mode", "cloud"),
        }

        ctx = {
            "question": question,
            "context": ctx_in,
            "policies": policies,
        }

        base_sources: List[CitationSource] = [
            CitationSource(
                id="internal:request_context",
                kind="internal",
                title="Request context (UI + Overseer status if provided)",
                snippet="Includes provided context such as asset_id/project_id and optional overseer_status.",
                url=None,
            )
        ]

        if not getattr(llm_service, "is_available", False):
            text = "LLM not configured. Set NVIDIA_API_KEY (or NVIDIA_LLM_API_KEY) to enable AI answers with sources."
            return AiqResult(text=text, sources=base_sources, debug={"reason": "llm_not_available"})

        goal = "Answer the user's question accurately and concisely, using available sources and citing them."

        # Plan + retrieve (include question as a retrieval query)
        plan_queries = await self._plan(goal=question, context=ctx)
        queries = [question] + [q for q in plan_queries if q and q != question]
        retrieved_sources, retrieval_debug = await self._retrieve(queries, top_k=6)

        # Draft answer prompt
        sources_block = "\n".join(
            [f"[{i+1}] {s.title} ({s.kind}, {s.id})" + (f" — {s.snippet}" if s.snippet else "") for i, s in enumerate((base_sources + retrieved_sources)[:12])]
        )

        prompt = f"""You are an AI-Q assistant for a risk platform.
Answer the question in plain text, no Markdown.

Hard requirements:
- Be concise but specific.
- If optional services are disabled by config, do not suggest enabling them unless asked.
- Use citations like [1], [2] referring to the sources list below.

Question:
{question}

Context (JSON, may be truncated):
{_safe_json_dumps(ctx_in, max_len=9000)}

Policies (JSON):
{_safe_json_dumps(policies, max_len=2000)}

Sources:
{sources_block if sources_block else "(no sources)"}"""

        use_nemotron = getattr(settings, "use_nemotron_for_reasoning", False) and _is_complex_query(question)
        model = LLMModel.NEMOTRON_NANO_9B if use_nemotron else LLMModel.LLAMA_70B
        model_id_override = (getattr(settings, "nemotron_model_id", "") or "").strip() or None
        if use_nemotron and not model_id_override:
            model_id_override = None  # use enum value

        resp = await llm_service.generate(
            prompt=prompt,
            model=model,
            max_tokens=900,
            temperature=0.2,
            system_prompt="Prefer verifiable statements. Ask for missing inputs only if required.",
            model_id_override=model_id_override if use_nemotron else None,
        )

        draft = (resp.content or "").replace("**", "").replace("•", "-")
        final = await self._critique_and_rewrite(draft, context={"policies": policies, **ctx_in})

        if "[" not in final and "]" not in final:
            final = final.strip() + " [1]"

        all_sources = (base_sources + retrieved_sources)[:12]
        return AiqResult(text=final.strip(), sources=all_sources, debug=retrieval_debug)

    async def plan_steps(self, goal: str, context: Optional[Dict[str, Any]] = None) -> List[str]:
        """
        Break down a goal into ordered steps (for agentic orchestration).
        Returns a list of step descriptions. Uses Nemotron when use_nemotron_for_reasoning is True.
        """
        if not getattr(llm_service, "is_available", False):
            return [goal]
        ctx = context or {}
        prompt = f"""Given this goal, output a JSON array of 1–8 concrete steps to achieve it. Each step one short sentence.
Goal: {goal}
Context: {_safe_json_dumps(ctx, max_len=2000)}

Output only a JSON array of strings, e.g. ["Step 1", "Step 2"]. No markdown."""
        use_nemotron = getattr(settings, "use_nemotron_for_reasoning", False)
        model = LLMModel.NEMOTRON_NANO_9B if use_nemotron else LLMModel.LLAMA_70B
        model_id_override = (getattr(settings, "nemotron_model_id", "") or "").strip() or None
        resp = await llm_service.generate(
            prompt=prompt,
            model=model,
            max_tokens=600,
            temperature=0.2,
            system_prompt="Output only valid JSON array of strings.",
            model_id_override=model_id_override if use_nemotron else None,
        )
        raw = (resp.content or "").strip()
        # Strip markdown code block if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        try:
            steps = json.loads(raw)
            if isinstance(steps, list):
                return [str(s) for s in steps if s]
            return [goal]
        except Exception:
            logger.debug("plan_steps JSON parse failed, using goal as single step: %s", raw[:200])
            return [goal]


# Singleton
_aiq_assistant: Optional[AiqResearchAssistant] = None


def get_aiq_assistant() -> AiqResearchAssistant:
    global _aiq_assistant
    if _aiq_assistant is None:
        _aiq_assistant = AiqResearchAssistant()
    return _aiq_assistant

