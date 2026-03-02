"""
NVIDIA Morpheus — optional agent output validation (data leak, hallucination detection).

When enable_morpheus=True and morpheus_validation_url is set, sends agent input/output
to the Morpheus service. On timeout or error, returns passed=True so production is not broken.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MorpheusResult:
    """Result of Morpheus validation."""
    passed: bool
    flags: list
    detail: str

    def __post_init__(self) -> None:
        if self.flags is None:
            self.flags = []


async def validate_agent_io(
    input_text: str,
    output_text: str,
    context: Dict[str, Any],
) -> MorpheusResult:
    """
    Validate agent input/output via Morpheus service.

    Request: POST JSON { "input", "output", "context" }.
    Response: { "passed": bool, "flags": list, "detail": str }.

    When Morpheus is disabled or URL is empty, returns MorpheusResult(passed=True).
    On timeout or network error, logs and returns passed=True.
    """
    if not getattr(settings, "enable_morpheus", False):
        return MorpheusResult(passed=True, flags=[], detail="")
    url = (getattr(settings, "morpheus_validation_url", "") or "").strip()
    if not url:
        return MorpheusResult(passed=True, flags=[], detail="")
    timeout = getattr(settings, "morpheus_timeout_sec", 10.0)
    payload = {
        "input": input_text or "",
        "output": output_text or "",
        "context": context or {},
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                logger.warning(
                    "Morpheus validation returned status %s: %s",
                    response.status_code,
                    response.text[:500],
                )
                return MorpheusResult(passed=True, flags=[], detail=f"HTTP {response.status_code}")
            data = response.json() if response.text else {}
            if not isinstance(data, dict):
                return MorpheusResult(passed=True, flags=[], detail="Invalid response")
            passed = data.get("passed", True)
            flags = data.get("flags", [])
            if not isinstance(flags, list):
                flags = []
            detail = str(data.get("detail", ""))[:1000]
            return MorpheusResult(passed=passed, flags=flags, detail=detail)
    except httpx.TimeoutException as e:
        logger.warning("Morpheus validation timeout: %s", e)
        return MorpheusResult(passed=True, flags=[], detail="timeout")
    except Exception as e:
        logger.warning("Morpheus validation error: %s", e)
        return MorpheusResult(passed=True, flags=[], detail=str(e)[:500])
