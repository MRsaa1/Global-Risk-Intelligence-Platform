"""
What-If Scenario Generator - LLM-driven diverse scenario generation.

Generates diverse parameter combinations and runs them through CascadeEngine.
Identifies unexpected vulnerabilities via LLM analysis.
"""
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class WhatIfScenario:
    """What-if scenario definition with CascadeEngine parameter overrides."""
    scenario_id: str
    name: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    severity: float = 0.5
    description: str = ""


@dataclass
class WhatIfResult:
    """Result of what-if scenario with cascade and findings."""
    scenario: WhatIfScenario
    cascade_result: Dict[str, Any] = field(default_factory=dict)
    unexpected_findings: List[str] = field(default_factory=list)


class WhatIfGenerator:
    """
    Generates diverse what-if scenarios using LLM and optionally
    runs them through CascadeEngine.
    """

    def __init__(self, llm_service=None, cascade_engine=None):
        self._llm = llm_service
        self._cascade = cascade_engine

    def _get_llm(self):
        """Lazy load LLM service."""
        if self._llm is None:
            try:
                from src.services.nvidia_llm import llm_service
                self._llm = llm_service
            except ImportError as e:
                logger.warning(f"NVIDIA LLM unavailable: {e}")
        return self._llm

    def _get_cascade(self):
        """Lazy load CascadeEngine."""
        if self._cascade is None:
            try:
                from src.layers.simulation.cascade_engine import CascadeEngine
                self._cascade = CascadeEngine()
            except ImportError as e:
                logger.warning(f"CascadeEngine unavailable: {e}")
        return self._cascade

    async def generate_scenarios(
        self,
        asset_id: str,
        context: Dict[str, Any],
        num_scenarios: int = 20,
    ) -> List[WhatIfResult]:
        """
        Generate diverse what-if scenarios, run through CascadeEngine when
        available, and analyze for unexpected vulnerabilities.

        Args:
            asset_id: Asset to analyze
            context: Context dict (asset details, risk data, etc.)
            num_scenarios: Number of scenarios to generate

        Returns:
            List of WhatIfResult with cascade results and findings
        """
        llm = self._get_llm()
        cascade = self._get_cascade()
        scenarios: List[WhatIfScenario] = []

        if llm is None:
            logger.warning("LLM unavailable, returning empty scenarios")
            return []

        try:
            prompt = _build_scenario_prompt(asset_id, context, num_scenarios)
            response = await llm.generate(
                prompt=prompt,
                temperature=0.9,
                max_tokens=4096,
            )
            scenarios = _parse_scenarios(response, num_scenarios)
        except Exception as e:
            logger.warning(f"Scenario generation failed: {e}")
            return []

        results: List[WhatIfResult] = []
        for scenario in scenarios:
            cascade_result: Dict[str, Any] = {}
            if cascade is not None:
                try:
                    sim = await cascade.simulate(
                        trigger_node_id=asset_id,
                        trigger_severity=scenario.severity,
                        graph=context.get("graph"),
                        failure_threshold=scenario.parameters.get("failure_threshold", 0.8),
                        recovery_rate=scenario.parameters.get("recovery_rate", 0.1),
                    )
                    cascade_result = {
                        "mean_exposure": getattr(sim, "mean_exposure", 0),
                        "max_exposure": getattr(sim, "max_exposure", 0),
                        "hidden_risk_multiplier": getattr(sim, "hidden_risk_multiplier", 1.0),
                        "mean_failures": getattr(sim, "mean_failures", 0),
                    }
                except Exception as e:
                    logger.debug(f"Cascade simulation failed for {scenario.scenario_id}: {e}")

            unexpected_findings: List[str] = []
            if llm is not None and cascade_result:
                try:
                    findings_prompt = _build_findings_prompt(scenario, cascade_result)
                    findings_resp = await llm.generate(
                        prompt=findings_prompt,
                        temperature=0.3,
                        max_tokens=1024,
                    )
                    unexpected_findings = _parse_findings(findings_resp)
                except Exception as e:
                    logger.debug(f"Findings analysis failed: {e}")

            results.append(WhatIfResult(
                scenario=scenario,
                cascade_result=cascade_result,
                unexpected_findings=unexpected_findings,
            ))

        return results

    async def generate_quick_scenarios(
        self,
        context: Dict[str, Any],
        count: int = 5,
    ) -> List[WhatIfScenario]:
        """
        Faster version without cascade simulation.
        Generates scenario definitions only.
        """
        llm = self._get_llm()
        if llm is None:
            logger.warning("LLM unavailable, returning empty scenarios")
            return []

        try:
            prompt = _build_quick_scenario_prompt(context, count)
            response = await llm.generate(
                prompt=prompt,
                temperature=0.8,
                max_tokens=2048,
            )
            return _parse_scenarios(response, count)
        except Exception as e:
            logger.warning(f"Quick scenario generation failed: {e}")
            return []


def _build_scenario_prompt(asset_id: str, context: Dict[str, Any], count: int) -> str:
    """Build LLM prompt for diverse scenario generation."""
    ctx_str = "\n".join(f"- {k}: {v}" for k, v in (context or {}).items() if k != "graph")[:1000]
    return f"""Generate {count} diverse what-if scenarios for asset {asset_id}.

Context:
{ctx_str}

For each scenario provide:
1. name: Short descriptive name
2. parameters: dict with failure_threshold (0.5-1.0), recovery_rate (0.0-0.3), trigger_severity (0.0-1.0)
3. severity: 0-1
4. description: One sentence

Format each scenario as:
---SCENARIO---
name: <name>
parameters: {{"failure_threshold": X, "recovery_rate": Y, "trigger_severity": Z}}
severity: <0-1>
description: <text>
---
"""


def _build_quick_scenario_prompt(context: Dict[str, Any], count: int) -> str:
    """Build prompt for quick scenario generation."""
    ctx_str = "\n".join(f"- {k}: {v}" for k, v in (context or {}).items())[:800]
    return f"""Generate {count} what-if scenarios based on:

{ctx_str}

Each scenario: name, parameters (dict), severity (0-1), description.
Format:
---SCENARIO---
name: ...
parameters: {{...}}
severity: ...
description: ...
---
"""


def _build_findings_prompt(scenario: WhatIfScenario, cascade_result: Dict[str, Any]) -> str:
    """Build prompt for unexpected vulnerability analysis."""
    return f"""Scenario: {scenario.name}
Description: {scenario.description}

Cascade results: {cascade_result}

List 0-3 unexpected vulnerabilities or non-obvious risks revealed by this scenario.
One per line, or "NONE" if none.
"""


def _parse_scenarios(response: Any, max_count: int) -> List[WhatIfScenario]:
    """Parse LLM response into WhatIfScenario objects."""
    text = getattr(response, "content", str(response)) if response else ""
    scenarios: List[WhatIfScenario] = []
    blocks = re.split(r"---\s*SCENARIO\s*---", text, flags=re.I)

    for block in blocks:
        if len(scenarios) >= max_count:
            break
        block = block.strip()
        if not block or block.upper() == "---":
            continue

        name = ""
        params: Dict[str, Any] = {}
        severity = 0.5
        description = ""

        for line in block.split("\n"):
            line = line.strip()
            if line.lower().startswith("name:"):
                name = line.split(":", 1)[1].strip()
            elif line.lower().startswith("parameters:"):
                try:
                    val = line.split(":", 1)[1].strip()
                    params = eval(val) if val.startswith("{") else {}
                except Exception:
                    pass
            elif line.lower().startswith("severity:"):
                try:
                    severity = float(line.split(":", 1)[1].strip())
                except (ValueError, IndexError):
                    pass
            elif line.lower().startswith("description:"):
                description = line.split(":", 1)[1].strip()

        if name:
            scenarios.append(WhatIfScenario(
                scenario_id=str(uuid.uuid4()),
                name=name,
                parameters=params,
                severity=min(1.0, max(0.0, severity)),
                description=description,
            ))

    return scenarios


def _parse_findings(response: Any) -> List[str]:
    """Parse findings from LLM response."""
    text = getattr(response, "content", str(response)) if response else ""
    findings = []
    for line in text.strip().split("\n"):
        line = line.strip()
        if line and line.upper() != "NONE" and not line.startswith("-"):
            findings.append(line)
        elif line.startswith("- ") and "NONE" not in line.upper():
            findings.append(line[2:].strip())
    return findings[:5]


# Module-level singletons
_whatif_generator: Optional[WhatIfGenerator] = None


def get_whatif_generator(llm_service=None, cascade_engine=None) -> WhatIfGenerator:
    """Get or create WhatIfGenerator instance."""
    global _whatif_generator
    if _whatif_generator is None:
        _whatif_generator = WhatIfGenerator(
            llm_service=llm_service,
            cascade_engine=cascade_engine,
        )
    return _whatif_generator
