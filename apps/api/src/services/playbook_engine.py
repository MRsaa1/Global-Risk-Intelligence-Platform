"""
Playbook engine — «what to do now» for municipalities.

Returns 1–3 next recommended actions based on playbook steps, alerts, and municipality state.
Optional: record step completion for audit.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Static playbook definitions (id, name, steps with action_type and label)
PLAYBOOKS: List[Dict[str, Any]] = [
    {
        "id": "flood_response",
        "name": "Flood warning response",
        "description": "Assess → notify → recommend measures",
        "steps": [
            {"id": "assess_risk", "order": 1, "action_type": "assess_risk", "label": "Run risk assessment", "trigger": "flood_alert"},
            {"id": "send_alert", "order": 2, "action_type": "send_alert", "label": "Notify stakeholders", "trigger": None},
            {"id": "recommend_measures", "order": 3, "action_type": "recommend_measures", "label": "Recommend adaptation measures", "trigger": None},
            {"id": "generate_report", "order": 4, "action_type": "generate_report", "label": "Generate Insurability Report", "trigger": None},
        ],
    },
    {
        "id": "city_launch",
        "name": "City launch (6–12 weeks)",
        "description": "Onboarding to live checklist",
        "steps": [
            {"id": "onboarding_done", "order": 1, "action_type": "onboarding", "label": "Complete onboarding", "trigger": None},
            {"id": "risk_assessed", "order": 2, "action_type": "assess_risk", "label": "First risk assessment", "trigger": None},
            {"id": "first_report", "order": 3, "action_type": "generate_report", "label": "First Insurability Report (draft)", "trigger": None},
            {"id": "subscription", "order": 4, "action_type": "subscription", "label": "Sign subscription", "trigger": None},
        ],
    },
]


def list_playbooks() -> List[Dict[str, Any]]:
    """Return all playbooks (id, name, description, step count)."""
    return [
        {"id": p["id"], "name": p["name"], "description": p.get("description", ""), "steps_count": len(p.get("steps", []))}
        for p in PLAYBOOKS
    ]


def get_playbook(playbook_id: str) -> Optional[Dict[str, Any]]:
    """Return one playbook by id."""
    for p in PLAYBOOKS:
        if p["id"] == playbook_id:
            return p
    return None


async def get_next_actions(
    playbook_id: str,
    municipality_id: str,
    limit: int = 3,
) -> Dict[str, Any]:
    """
    Return 1–3 recommended «do now» actions for the municipality.
    Uses launch-checklist and optional alerts to prioritize.
    """
    playbook = get_playbook(playbook_id)
    if not playbook:
        return {"playbook_id": playbook_id, "next_actions": [], "error": "Playbook not found"}

    next_actions: List[Dict[str, Any]] = []
    steps = playbook.get("steps", [])

    # Optional: fetch launch checklist to see what's done (would need async HTTP or injected state)
    try:
        from src.api.v1.endpoints.cadapt import _community_for_request
        _community_for_request(municipality_id)
    except Exception:
        pass

    # For minimal version: suggest first N steps as "recommended"; in production would check
    # completed steps from DB or launch_checklist and suggest only pending ones.
    for step in sorted(steps, key=lambda s: s.get("order", 0))[:limit]:
        next_actions.append({
            "step_id": step["id"],
            "action_type": step.get("action_type", "unknown"),
            "label": step.get("label", step["id"]),
            "order": step.get("order"),
        })

    return {
        "playbook_id": playbook_id,
        "municipality_id": municipality_id,
        "next_actions": next_actions,
    }


def record_step_complete(
    playbook_id: str,
    step_id: str,
    municipality_id: str,
    actor: str = "api",
) -> Dict[str, Any]:
    """
    Record that a step was completed (for audit).
    Minimal: log and return success; full version would persist to DB.
    """
    logger.info("Playbook step complete: playbook=%s step=%s municipality=%s actor=%s", playbook_id, step_id, municipality_id, actor)
    return {
        "playbook_id": playbook_id,
        "step_id": step_id,
        "municipality_id": municipality_id,
        "completed": True,
        "actor": actor,
    }
