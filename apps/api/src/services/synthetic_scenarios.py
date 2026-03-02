"""
Synthetic Scenario Generator - Black swans and training anomalies.

Generates plausible but unprecedented event combinations and
synthetic anomaly patterns for model training.
"""
import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


@dataclass
class SyntheticScenario:
    """Synthetic scenario with cascade and compound event info."""
    scenario_id: str
    name: str
    description: str
    probability_estimate: float
    affected_domains: List[str] = field(default_factory=list)
    cascade_path: List[str] = field(default_factory=list)
    compound_events: List[str] = field(default_factory=list)


class SyntheticScenarioGenerator:
    """
    Generates synthetic scenarios: black swans (unprecedented combinations)
    and training anomalies for monitoring models.
    """

    def __init__(self, llm_service=None):
        self._llm = llm_service

    def _get_llm(self):
        """Lazy load LLM service."""
        if self._llm is None:
            try:
                from src.services.nvidia_llm import llm_service
                self._llm = llm_service
            except ImportError as e:
                logger.warning(f"NVIDIA LLM unavailable: {e}")
        return self._llm

    async def generate_black_swans(
        self,
        portfolio_context: Dict[str, Any],
        count: int = 10,
    ) -> List[SyntheticScenario]:
        """
        Generate plausible but unprecedented event combinations.

        Examples: "Simultaneous Rhine flood + EU banking crisis + cyber attack on ports"

        Args:
            portfolio_context: Portfolio/asset context
            count: Number of scenarios to generate

        Returns:
            List of SyntheticScenario
        """
        llm = self._get_llm()
        if llm is None:
            logger.warning("LLM unavailable, returning empty black swans")
            return []

        try:
            prompt = _build_black_swan_prompt(portfolio_context, count)
            response = await llm.generate(
                prompt=prompt,
                temperature=0.95,
                max_tokens=4096,
            )
            return _parse_synthetic_scenarios(response, count)
        except Exception as e:
            logger.warning(f"Black swan generation failed: {e}")
            return []

    async def generate_training_anomalies(
        self,
        asset_type: str,
        count: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Generate synthetic anomaly patterns for training monitoring models.

        Args:
            asset_type: Type of asset (e.g. infrastructure, financial)
            count: Number of anomaly patterns to generate

        Returns:
            List of dicts with anomaly characteristics
        """
        llm = self._get_llm()
        if llm is None:
            logger.warning("LLM unavailable, returning empty anomalies")
            return []

        # Generate in batches to stay within token limits
        batch_size = 20
        all_anomalies: List[Dict[str, Any]] = []

        for batch_start in range(0, count, batch_size):
            batch_count = min(batch_size, count - batch_start)
            if batch_count <= 0:
                break

            try:
                prompt = _build_anomaly_prompt(asset_type, batch_count)
                response = await llm.generate(
                    prompt=prompt,
                    temperature=0.85,
                    max_tokens=2048,
                )
                anomalies = _parse_anomalies(response)
                all_anomalies.extend(anomalies)
            except Exception as e:
                logger.warning(f"Anomaly batch failed: {e}")
                break

        return all_anomalies[:count]


def _build_black_swan_prompt(portfolio_context: Dict[str, Any], count: int) -> str:
    """Build prompt for black swan generation."""
    ctx = "\n".join(f"- {k}: {v}" for k, v in (portfolio_context or {}).items())[:1200]
    return f"""Generate {count} plausible but unprecedented "black swan" event combinations.

Context:
{ctx}

Each scenario should combine 2-4 events that rarely occur together but could
(e.g. simultaneous Rhine flood + EU banking crisis + cyber attack on major ports).
Include:
- name: Short title
- description: 2-3 sentence scenario
- probability_estimate: 0-1 (low for black swans, e.g. 0.01-0.1)
- affected_domains: list e.g. [finance, infrastructure, climate]
- cascade_path: sequence of propagation
- compound_events: list of individual events

Format:
---SCENARIO---
name: ...
description: ...
probability_estimate: ...
affected_domains: [...]
cascade_path: [...]
compound_events: [...]
---
"""


def _build_anomaly_prompt(asset_type: str, count: int) -> str:
    """Build prompt for synthetic anomaly generation."""
    return f"""Generate {count} synthetic anomaly patterns for {asset_type} monitoring.

Each anomaly: signal_pattern (e.g. sudden spike, gradual drift), severity (0-1),
correlated_metrics, likely_cause, label (anomaly_type).

Output as JSON-like dicts, one per line:
{{"signal_pattern": "...", "severity": 0.X, "correlated_metrics": [...], "likely_cause": "...", "label": "..."}}
"""


def _parse_synthetic_scenarios(response: Any, max_count: int) -> List[SyntheticScenario]:
    """Parse LLM response into SyntheticScenario objects."""
    text = getattr(response, "content", str(response)) if response else ""
    scenarios: List[SyntheticScenario] = []
    blocks = re.split(r"---\s*SCENARIO\s*---", text, flags=re.I)

    for block in blocks:
        if len(scenarios) >= max_count:
            break
        block = block.strip()
        if not block or block.upper() == "---":
            continue

        name = ""
        description = ""
        probability_estimate = 0.05
        affected_domains: List[str] = []
        cascade_path: List[str] = []
        compound_events: List[str] = []

        for line in block.split("\n"):
            line = line.strip()
            if line.lower().startswith("name:"):
                name = line.split(":", 1)[1].strip()
            elif line.lower().startswith("description:"):
                description = line.split(":", 1)[1].strip()
            elif line.lower().startswith("probability_estimate:"):
                try:
                    probability_estimate = float(line.split(":", 1)[1].strip())
                except (ValueError, IndexError):
                    pass
            elif line.lower().startswith("affected_domains:"):
                val = line.split(":", 1)[1].strip() if ":" in line else "[]"
                try:
                    affected_domains = eval(val) if "[" in val else []
                except Exception:
                    pass
            elif line.lower().startswith("cascade_path:"):
                val = line.split(":", 1)[1].strip() if ":" in line else "[]"
                try:
                    cascade_path = eval(val) if "[" in val else []
                except Exception:
                    pass
            elif line.lower().startswith("compound_events:"):
                val = line.split(":", 1)[1].strip() if ":" in line else "[]"
                try:
                    compound_events = eval(val) if "[" in val else []
                except Exception:
                    pass

        if name:
            scenarios.append(SyntheticScenario(
                scenario_id=str(uuid.uuid4()),
                name=name,
                description=description,
                probability_estimate=min(1.0, max(0.0, probability_estimate)),
                affected_domains=affected_domains or [],
                cascade_path=cascade_path or [],
                compound_events=compound_events or [],
            ))

    return scenarios


def _parse_anomalies(response: Any) -> List[Dict[str, Any]]:
    """Parse anomaly patterns from LLM response."""
    text = getattr(response, "content", str(response)) if response else ""
    anomalies: List[Dict[str, Any]] = []
    for line in text.strip().split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            if "{" in line and "}" in line:
                start = line.index("{")
                end = line.rindex("}") + 1
                raw = line[start:end]
                try:
                    obj = json.loads(raw)
                except json.JSONDecodeError:
                    obj = json.loads(raw.replace("'", '"'))
                if isinstance(obj, dict):
                    obj["id"] = str(uuid.uuid4())
                    anomalies.append(obj)
        except Exception:
            pass
    return anomalies


# Module-level singleton
_synthetic_generator: "SyntheticScenarioGenerator | None" = None


def get_synthetic_scenario_generator(llm_service=None) -> SyntheticScenarioGenerator:
    """Get or create SyntheticScenarioGenerator instance."""
    global _synthetic_generator
    if _synthetic_generator is None:
        _synthetic_generator = SyntheticScenarioGenerator(llm_service=llm_service)
    return _synthetic_generator
