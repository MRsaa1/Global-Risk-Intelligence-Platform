"""
ReflectionEngine — post-step self-check via LLM.

After every agent produces a result the ReflectionEngine sends it to the
LLM for review: internal contradictions, data support, severity
correctness, missing considerations.  Returns approved/revised result.
"""
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class ReflectionResult:
    verdict: str  # "approved" | "revised"
    original_result: Dict[str, Any]
    revised_result: Optional[Dict[str, Any]] = None
    reasoning: str = ""
    issues_found: list = field(default_factory=list)
    confidence_adjustment: float = 0.0


class ReflectionEngine:
    """LLM-powered reflection that reviews each agent step output."""

    SYSTEM_PROMPT = (
        "You are a quality-assurance reviewer for a multi-agent risk platform. "
        "Your role is to review agent outputs for: "
        "1) Internal contradictions, 2) Sufficient data support, "
        "3) Correct severity classification, 4) Missing considerations. "
        "Reply ONLY with valid JSON: "
        '{"verdict":"approved"|"revised","issues":[],"reasoning":"...","adjustments":{}}'
    )

    def __init__(self, llm_service=None):
        self._llm = llm_service

    @property
    def llm(self):
        if self._llm is None:
            try:
                from src.services.nvidia_llm import llm_service
                self._llm = llm_service
            except Exception:
                pass
        return self._llm

    async def reflect(
        self,
        agent_name: str,
        result: Dict[str, Any],
        context: Dict[str, Any],
    ) -> ReflectionResult:
        if not self.llm or not self.llm.is_available:
            return ReflectionResult(
                verdict="approved",
                original_result=result,
                reasoning="LLM unavailable — auto-approved",
            )

        safe_result = {k: v for k, v in result.items() if k != "llm_explanation"}
        prompt = (
            f"Agent: {agent_name}\n"
            f"Action: {result.get('action', 'unknown')}\n"
            f"Output (JSON):\n```json\n{json.dumps(safe_result, default=str)[:3000]}\n```\n\n"
            "Review this output. Reply with JSON only."
        )

        try:
            from src.services.nvidia_llm import LLMModel
            resp = await self.llm.generate(
                prompt=prompt,
                model=LLMModel.LLAMA_8B,
                max_tokens=512,
                temperature=0.3,
                system_prompt=self.SYSTEM_PROMPT,
            )
            parsed = self._parse_response(resp.content)
            verdict = parsed.get("verdict", "approved")
            issues = parsed.get("issues", [])
            reasoning = parsed.get("reasoning", "")
            adjustments = parsed.get("adjustments", {})

            revised = None
            if verdict == "revised" and adjustments:
                revised = {**result, **adjustments}

            return ReflectionResult(
                verdict=verdict,
                original_result=result,
                revised_result=revised,
                reasoning=reasoning,
                issues_found=issues,
            )
        except Exception as exc:
            logger.debug("Reflection failed: %s", exc)
            return ReflectionResult(
                verdict="approved",
                original_result=result,
                reasoning=f"Reflection error: {exc}",
            )

    @staticmethod
    def _parse_response(content: str) -> dict:
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            content = "\n".join(lines)
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {"verdict": "approved", "reasoning": content[:500]}


# Singleton (lazy LLM binding)
reflection_engine = ReflectionEngine()
