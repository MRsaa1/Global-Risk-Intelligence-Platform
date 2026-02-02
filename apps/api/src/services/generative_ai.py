"""
Generative AI use cases for the platform.

Maps product directions to LLM-backed endpoints:
- Reports & summaries: executive summary (existing), zone/scenario conclusions
- Explain scenarios: "Why is this zone at risk?", "What does NGFS SSP5 mean?"
- Recommendations: mitigation text, next steps, zone priorities
- Documents & regulation: draft disclosures (EBA/Fed/NGFS)
- Chat & Q&A: via AIQ /ask (existing)
- Agent explanations: short alert/recommendation summaries (used by agents)
- Data synthesis: weather + geo + historical → one coherent summary
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from src.services.nvidia_llm import LLMModel, llm_service

logger = logging.getLogger(__name__)

SYSTEM_RISK = (
    "You are an expert in physical-financial risk, climate scenarios, and regulatory disclosure. "
    "Answer in clear, concise prose. Use neutral tone. Cite specifics when given."
)


async def explain_zone(
    zone_data: Dict[str, Any],
    question: Optional[str] = None,
) -> str:
    """
    Explain why a zone is at risk or answer a specific question about it.
    E.g. "Why is this zone in the flood risk area?" or custom question.
    """
    q = question or "Why is this zone at risk? What are the main factors?"
    ctx = _format_dict(zone_data)
    prompt = f"""Given this risk zone data:

{ctx}

Question: {q}

Provide a short, coherent answer (2–4 sentences). Focus on causes and implications."""
    try:
        r = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=512,
            temperature=0.4,
            system_prompt=SYSTEM_RISK,
        )
        return r.content.strip()
    except Exception as e:
        logger.warning("explain_zone LLM failed: %s", e)
        return "Explanation is temporarily unavailable."


async def explain_scenario(
    scenario_name: str,
    scenario_context: Optional[Dict[str, Any]] = None,
    portfolio_context: Optional[str] = None,
) -> str:
    """
    Explain what a scenario means (e.g. NGFS SSP5, San Francisco +0.5m).
    Optional portfolio context for "what does this mean for the portfolio?"
    """
    ctx = scenario_context or {}
    ctx_str = _format_dict(ctx) if ctx else "(no extra context)"
    portfolio = f"\nPortfolio/entity context: {portfolio_context}" if portfolio_context else ""
    prompt = f"""Scenario: {scenario_name}
{ctx_str}{portfolio}

Explain in 3–5 sentences: what this scenario represents, key assumptions, and what it means for risk and disclosure. Use plain language."""
    try:
        r = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=600,
            temperature=0.4,
            system_prompt=SYSTEM_RISK,
        )
        return r.content.strip()
    except Exception as e:
        logger.warning("explain_scenario LLM failed: %s", e)
        return "Scenario explanation is temporarily unavailable."


async def recommendations_text(
    stress_result: Optional[Dict[str, Any]] = None,
    scenario_name: Optional[str] = None,
    zones_summary: Optional[str] = None,
) -> str:
    """
    Generate short textual recommendations: mitigation, next steps, zone priorities.
    Used after a stress test or for a given scenario.
    """
    parts = []
    if scenario_name:
        parts.append(f"Scenario: {scenario_name}")
    if stress_result:
        parts.append(_format_dict(stress_result, max_items=20))
    if zones_summary:
        parts.append(f"Zones summary: {zones_summary}")
    ctx = "\n".join(parts) if parts else "No specific context."
    prompt = f"""Based on the following stress test / scenario context:

{ctx}

Provide 4–6 short, actionable recommendations: mitigation, next steps, and zone priorities. Use bullet points or numbered list. Be specific where data is given."""
    try:
        r = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=800,
            temperature=0.5,
            system_prompt=SYSTEM_RISK,
        )
        return r.content.strip()
    except Exception as e:
        logger.warning("recommendations_text LLM failed: %s", e)
        return "Recommendations are temporarily unavailable."


async def disclosure_draft(
    context: Dict[str, Any],
    framework: str = "NGFS",
) -> str:
    """
    Draft disclosure or explanatory note for stress tests under EBA, Fed, or NGFS.
    """
    frameworks = {"EBA": "EBA stress testing", "Fed": "Federal Reserve / US stress testing", "NGFS": "NGFS climate scenarios"}
    fw_desc = frameworks.get(framework.upper(), framework)
    ctx = _format_dict(context)
    prompt = f"""Context for stress test disclosure:

{ctx}

Draft a short disclosure or explanatory note suitable for {fw_desc}. Use formal tone, 2–4 paragraphs. Include: scenario description, key metrics, limitations, and forward-looking statement where appropriate."""
    try:
        r = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=1024,
            temperature=0.35,
            system_prompt=SYSTEM_RISK,
        )
        return r.content.strip()
    except Exception as e:
        logger.warning("disclosure_draft LLM failed: %s", e)
        return "Draft disclosure is temporarily unavailable."


async def synthesize_sources(
    sources: List[Dict[str, Any]],
) -> str:
    """
    Synthesize multiple sources (weather, geodata, historical events) into one coherent short summary.
    """
    if not sources:
        return "No sources provided."
    parts = []
    for i, s in enumerate(sources[:10], 1):
        kind = s.get("kind", "source")
        data = s.get("data") or s.get("snippet") or str(s)
        parts.append(f"[{i}] {kind}:\n{_format_dict(data) if isinstance(data, dict) else str(data)[:2000]}")
    block = "\n\n".join(parts)
    prompt = f"""Synthesize the following sources into one short, coherent summary (3–6 sentences). Focus on risk-relevant facts and avoid repetition.

{block}"""
    try:
        r = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=600,
            temperature=0.4,
            system_prompt=SYSTEM_RISK,
        )
        return r.content.strip()
    except Exception as e:
        logger.warning("synthesize_sources LLM failed: %s", e)
        return "Synthesis is temporarily unavailable."


async def alert_explanation(
    alert_title: str,
    alert_message: str,
    alert_type: str = "",
    severity: str = "",
) -> str:
    """
    Short explanation of an alert for SENTINEL / UI: what it means and why it matters.
    """
    prompt = f"""Alert: {alert_title}
Type: {alert_type or 'risk'}
Severity: {severity or 'N/A'}
Message: {alert_message}

In 2–3 sentences, explain what this alert means and why it matters for the user. Plain language."""
    try:
        r = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_8B,
            max_tokens=256,
            temperature=0.3,
            system_prompt="You are a risk analyst. Provide brief, clear explanations of alerts.",
        )
        return r.content.strip()
    except Exception as e:
        logger.warning("alert_explanation LLM failed: %s", e)
        return ""


def _format_dict(d: Any, indent: int = 0, max_items: Optional[int] = None) -> str:
    if not isinstance(d, dict):
        return str(d)[:1500]
    lines = []
    for i, (k, v) in enumerate(d.items()):
        if max_items is not None and i >= max_items:
            lines.append("  " * indent + "... (truncated)")
            break
        prefix = "  " * indent
        if isinstance(v, dict):
            lines.append(f"{prefix}{k}:")
            lines.append(_format_dict(v, indent + 1, max_items=None))
        else:
            lines.append(f"{prefix}{k}: {v}")
    return "\n".join(lines)
