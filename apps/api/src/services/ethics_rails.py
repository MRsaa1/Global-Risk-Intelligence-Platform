"""
Ethics Rails — Config loader and module check matrix.

Loads config/ethics_rails (harm_prevention, fairness, protect_pii) and defines
which rails apply to which source module (ERF, ASGI, BIOSEC, ASM, SRO, CIP, CADAPT, stress_test).
Compatible with NeMo Guardrails Colang flows when nemo_guardrails_url is set.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

import yaml

from src.core.config import settings

logger = logging.getLogger(__name__)

# Module check matrix: which ethics rails apply to which source_module
# Per Master Plan: ERF, ASGI, BIOSEC, ASM, SRO, CIP, CADAPT, Stress Test
MODULE_ETHICS_MATRIX: Dict[str, List[str]] = {
    "erf": ["harm_prevention", "fairness"],
    "asgi": ["harm_prevention", "fairness", "protect_pii"],
    "biosec": ["harm_prevention", "fairness"],
    "asm": ["harm_prevention", "fairness"],
    "sro": ["harm_prevention", "fairness", "protect_pii"],
    "cip": ["harm_prevention", "fairness"],
    "cadapt": ["harm_prevention", "fairness"],
    "stress_test": ["harm_prevention", "fairness"],
    "scss": ["harm_prevention", "fairness", "protect_pii"],
    "default": ["harm_prevention", "fairness", "protect_pii"],
}


def get_rails_for_module(source_module: str) -> List[str]:
    """Return list of rail names to apply for the given source_module."""
    key = (source_module or "").strip().lower()
    return MODULE_ETHICS_MATRIX.get(key, MODULE_ETHICS_MATRIX["default"]).copy()


def load_ethics_rails_config() -> Dict[str, Dict[str, Any]]:
    """
    Load all YAML configs from config/ethics_rails.
    Returns dict keyed by rail name (e.g. harm_prevention, fairness, protect_pii).
    """
    out: Dict[str, Dict[str, Any]] = {}
    path = getattr(settings, "ethics_rails_config_path", "config/ethics_rails")
    base = Path(path)
    if not base.is_absolute():
        # Resolve relative to project root (repo root or apps/api)
        for root in [Path.cwd(), Path(__file__).resolve().parents[2]]:
            candidate = root / path
            if candidate.exists():
                base = candidate
                break
    if not base.exists():
        logger.warning("ethics_rails config path does not exist: %s", base)
        return out
    for f in base.glob("*.yml"):
        try:
            with open(f, "r", encoding="utf-8") as fp:
                data = yaml.safe_load(fp)
            if data and isinstance(data, dict) and "name" in data:
                out[data["name"]] = data
        except Exception as e:
            logger.warning("Failed to load ethics rail %s: %s", f, e)
    return out


def apply_rail_rules(
    rail_config: Dict[str, Any],
    context: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Apply rule-based logic from a rail config to context.
    Returns list of triggered rules with action/message.
    """
    triggered = []
    rules = rail_config.get("rules") or []
    for rule in rules:
        rule_id = rule.get("id", "")
        condition = rule.get("condition", "")
        action = rule.get("action", "flag")
        message = rule.get("message", "")
        # Simple condition evaluation (extensible)
        if condition == "affected_population_above_threshold":
            pop = context.get("affected_population") or 0
            th = rule.get("threshold", 10000)
            if pop >= th:
                triggered.append({"rule_id": rule_id, "action": action, "message": message})
        elif condition == "reversibility_eq_irreversible AND severity_above_threshold":
            rev = (context.get("reversibility") or "").lower()
            sev = float(context.get("severity", 0))
            th = rule.get("severity_threshold", 0.5)
            if rev == "irreversible" and sev >= th:
                triggered.append({"rule_id": rule_id, "action": action, "message": message})
        elif condition == "scenario_type_in_existential":
            st = (context.get("scenario_type") or "").lower()
            kws = rule.get("existential_keywords") or []
            if any(k in st for k in kws):
                triggered.append({"rule_id": rule_id, "action": action, "message": message})
        elif condition == "vulnerable_groups_non_empty AND severity_above_threshold":
            vg = context.get("vulnerable_groups") or []
            sev = float(context.get("severity", 0))
            th = rule.get("severity_threshold", 0.4)
            if vg and sev >= th:
                triggered.append({"rule_id": rule_id, "action": action, "message": message})
        elif condition == "high_impact_decision":
            sev = float(context.get("severity", 0))
            th = rule.get("impact_threshold", 0.6)
            if sev >= th:
                triggered.append({"rule_id": rule_id, "action": action, "message": message})
    return triggered
