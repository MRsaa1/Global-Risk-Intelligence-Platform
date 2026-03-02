"""
Scenario Library (SRO Phase 1.3).

Loads scenarios from config/sro_scenarios/*.yaml and runs Contagion Simulator.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import yaml
except ImportError:
    yaml = None

from .contagion_simulator import (
    ContagionSimulator,
    ShockDefinition,
    PolicyIntervention,
    get_contagion_simulator,
)

logger = logging.getLogger(__name__)

def _get_scenarios_dir() -> Path:
    """Resolve config/sro_scenarios from project root. Tries multiple locations."""
    # Build candidates from __file__ (always reliable)
    _file_root = Path(__file__).resolve().parents[5]  # …/global-risk-platform
    candidates = [
        _file_root / "config" / "sro_scenarios",
        Path(__file__).resolve().parents[4] / "config" / "sro_scenarios",
    ]
    # Path.cwd() may raise FileNotFoundError when the CWD was deleted/recreated
    # during deployment while uvicorn --reload keeps the process alive.
    try:
        cwd = Path.cwd()
        candidates.append(cwd / "config" / "sro_scenarios")
        candidates.append(cwd.parent / "config" / "sro_scenarios")
    except (FileNotFoundError, OSError):
        pass
    for d in candidates:
        try:
            if d.exists():
                return d
        except OSError:
            continue
    return candidates[0]  # default for load_scenario path construction


def list_scenarios() -> List[Dict[str, Any]]:
    """List all scenarios from YAML files."""
    scenarios = []
    scenarios_dir = _get_scenarios_dir()
    if not scenarios_dir.exists() or not yaml:
        return scenarios
    for p in scenarios_dir.glob("*.yaml"):
        try:
            with open(p, "r") as f:
                data = yaml.safe_load(f) or {}
            scenario_id = p.stem
            scenarios.append({
                "id": scenario_id,
                "name": data.get("name", scenario_id),
                "description": data.get("description", ""),
            })
        except Exception as e:
            logger.warning("Failed to load scenario %s: %s", p, e)
    return scenarios


def load_scenario(scenario_id: str) -> Optional[Dict[str, Any]]:
    """Load a single scenario by ID (filename without .yaml)."""
    if not yaml:
        return None
    path = _get_scenarios_dir() / f"{scenario_id}.yaml"
    if not path.exists():
        return None
    try:
        with open(path, "r") as f:
            return yaml.safe_load(f)
    except Exception as e:
        logger.warning("Failed to load scenario %s: %s", scenario_id, e)
        return None


def scenario_to_shock_and_interventions(data: Dict[str, Any]) -> tuple:
    """Convert YAML scenario to ShockDefinition and PolicyInterventions."""
    shocks = data.get("initial_shocks") or []
    first = shocks[0] if shocks else {}
    shock_type = first.get("type", "energy_price_spike")
    magnitude = float(first.get("magnitude", 2.0))
    shock = ShockDefinition(
        shock_type=shock_type,
        magnitude=magnitude,
        affected_region=first.get("affected_regions", [None])[0] if isinstance(first.get("affected_regions"), list) else None,
        duration_days=int(first.get("duration_days", 30)),
    )

    interventions = []
    for iv in data.get("interventions") or []:
        amt = iv.get("amount_usd")
        if amt is not None:
            try:
                amt = float(amt)
            except (TypeError, ValueError):
                amt = None
        interventions.append(PolicyIntervention(
            day=int(iv.get("day", 7)),
            intervention_type=str(iv.get("type", "emergency_liquidity")),
            amount_usd=amt,
            parameters=iv,
        ))
    return shock, interventions
