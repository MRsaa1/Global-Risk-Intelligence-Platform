"""
NIM microservices for Ethicist pipeline.

Optional HTTP clients for:
- bias-detector: detect bias in text/decisions
- content-safety: harmful content detection
- pii-detection: PII detection and redaction

When URLs are not set, returns empty results (no external calls).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)


async def _post_nim(url: str, payload: Dict[str, Any], timeout: float = 5.0) -> Optional[Dict[str, Any]]:
    """POST to NIM endpoint; return JSON or None on failure."""
    if not url or not url.strip():
        return None
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(url.strip().rstrip("/") + "/process", json=payload)
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        logger.debug("NIM call to %s failed: %s", url, e)
    return None


async def bias_detector(text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Call bias-detector NIM if configured.
    Expected response: { "biased": bool, "score": 0-1, "categories": [...] }
    """
    url = getattr(settings, "ethicist_bias_detector_nim_url", "") or ""
    if not url:
        return {"biased": False, "score": 0.0, "categories": [], "source": "none"}
    out = await _post_nim(url, {"text": text, "context": context or {}})
    if out is None:
        return {"biased": False, "score": 0.0, "categories": [], "source": "unavailable"}
    out["source"] = "nim"
    return out


async def content_safety(text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Call content-safety NIM if configured.
    Expected response: { "safe": bool, "categories": {...}, "severity": ... }
    """
    url = getattr(settings, "ethicist_content_safety_nim_url", "") or ""
    if not url:
        return {"safe": True, "categories": {}, "severity": "none", "source": "none"}
    out = await _post_nim(url, {"text": text, "context": context or {}})
    if out is None:
        return {"safe": True, "categories": {}, "severity": "none", "source": "unavailable"}
    out["source"] = "nim"
    return out


async def pii_detection(text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Call PII-detection NIM if configured.
    Expected response: { "has_pii": bool, "redacted_text": str, "categories": [...] }
    """
    url = getattr(settings, "ethicist_pii_detection_nim_url", "") or ""
    if not url:
        return {"has_pii": False, "redacted_text": text, "categories": [], "source": "none"}
    out = await _post_nim(url, {"text": text, "context": context or {}})
    if out is None:
        return {"has_pii": False, "redacted_text": text, "categories": [], "source": "unavailable"}
    out["source"] = "nim"
    return out


async def run_ethicist_nim_pipeline(
    input_snapshot: Dict[str, Any],
    reasoning: str = "",
    recommendations: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Run bias-detector, content-safety, and PII-detection on relevant text.
    Returns combined results for Ethicist to use.
    """
    # Build text to check (summary of input + reasoning + recommendations)
    import json
    text_parts = []
    if input_snapshot:
        text_parts.append(json.dumps(input_snapshot, default=str)[:2000])
    if reasoning:
        text_parts.append(reasoning[:2000])
    if recommendations:
        text_parts.append(" ".join(recommendations)[:1000])
    text = "\n".join(text_parts) or ""

    bias = await bias_detector(text, input_snapshot)
    safety = await content_safety(text, input_snapshot)
    pii = await pii_detection(text, input_snapshot)

    return {
        "bias_detector": bias,
        "content_safety": safety,
        "pii_detection": pii,
        "pii_redacted_used": pii.get("has_pii") and pii.get("source") == "nim",
    }
