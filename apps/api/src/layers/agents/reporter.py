"""
REPORTER Agent - Synthesize workflow results into structured reports.

Fifth agent in the ARIN council. Gathers all outputs from prior workflow
steps (SENTINEL alerts, ANALYST analysis, ADVISOR recommendations,
ETHICIST verdict) and produces an executive-level summary via
nvidia_llm.reporter_summary().
"""
import logging
import time
from typing import Any, Dict

logger = logging.getLogger(__name__)


class ReporterAgent:
    """Synthesizes multi-agent workflow results into readable reports."""

    AGENT_ID = "reporter"
    AGENT_TYPE = "REPORTER"

    async def execute(self, action: str, params: dict, context: dict) -> dict:
        start = time.time()

        if action in ("generate_report", "synthesize", "action_plan", "generate_stress_report"):
            return await self._synthesize(action, params, context, start)

        return {
            "agent": self.AGENT_TYPE,
            "action": action,
            "status": "completed",
            "output": f"REPORTER action '{action}' completed",
            "duration_ms": int((time.time() - start) * 1000),
        }

    async def _synthesize(
        self, action: str, params: dict, context: dict, start: float
    ) -> dict:
        all_results = self._collect_prior_results(context)

        audience = params.get("audience", "executive")
        report_type = {
            "generate_report": "risk_assessment_report",
            "synthesize": "full_assessment_summary",
            "action_plan": "remediation_action_plan",
            "generate_stress_report": "stress_test_report",
        }.get(action, "general_report")

        llm_report = ""
        try:
            from src.services.nvidia_llm import llm_service
            llm_report = await llm_service.reporter_summary(
                report_type=report_type,
                data=all_results,
                audience=audience,
            )
        except Exception as exc:
            logger.debug("LLM reporter_summary failed: %s", exc)
            llm_report = self._fallback_summary(all_results)

        return {
            "agent": self.AGENT_TYPE,
            "action": action,
            "status": "completed",
            "report_type": report_type,
            "report": llm_report,
            "sections": list(all_results.keys()),
            "duration_ms": int((time.time() - start) * 1000),
        }

    @staticmethod
    def _collect_prior_results(context: dict) -> Dict[str, Any]:
        """Gather results from all prior workflow steps stored in SharedContext."""
        collected: Dict[str, Any] = {}
        for key, value in context.items():
            if key.startswith("step_") and key.endswith("_result"):
                step_id = key.replace("step_", "").replace("_result", "")
                agent = value.get("agent", "unknown") if isinstance(value, dict) else "unknown"
                collected[f"{agent}_{step_id}"] = value
        if not collected:
            collected["raw_context_keys"] = list(context.keys())
        return collected

    @staticmethod
    def _fallback_summary(results: dict) -> str:
        lines = ["# Workflow Report (generated without LLM)", ""]
        for section, data in results.items():
            lines.append(f"## {section}")
            if isinstance(data, dict):
                for k, v in data.items():
                    if k not in ("duration_ms",):
                        lines.append(f"- **{k}**: {v}")
            else:
                lines.append(str(data))
            lines.append("")
        return "\n".join(lines)


# Global instance
reporter_agent = ReporterAgent()
