"""
Command intent detection for the AI Assistant.

Classifies user text (RU/EN) into: question, navigation actions,
diagnostics (read), or remediation (execute). Used by /api/v1/aiq/ask
to return answer + optional action or to run server-side actions.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# -----------------------------------------------------------------------------
# Phrase patterns (RU + EN) -> intent
# -----------------------------------------------------------------------------

NAVIGATION_PHRASES = {
    "open_stress_test": [
        "проведи стресс тест", "проведи стресс-тест", "стресс тест", "stress test",
        "открой стресс", "run stress", "запусти стресс", "stress planner",
    ],
    "open_agents": [
        "проверь работу агентов", "проверь агентов", "агенты", "agents",
        "открой агентов", "open agents", "мониторинг агентов", "agent monitoring",
    ],
    "open_action_plans": [
        "дай задания", "планы действий", "action plan", "action plans",
        "открой планы", "задания", "tasks",
    ],
    "open_alerts": [
        "проверь ошибки", "ошибки", "алерты", "alerts", "errors",
        "есть ли сбои", "сбои", "открой алерты",
    ],
}

DIAGNOSTICS_PHRASES = [
    "статус системы", "system status", "проверь систему", "check system",
    "диагностика", "diagnostics", "здоровье системы", "health",
]

REMEDIATION_PHRASES = {
    "run_oversee": [
        "запусти диагностику", "run diagnostics", "перезапусти мониторинг",
        "запусти oversee", "run oversee", "проверь систему полностью",
    ],
    "start_agents": [
        "включи агентов", "запусти агентов", "start agents",
        "включи мониторинг", "запусти мониторинг", "start monitoring",
    ],
    "stop_agents": [
        "останови агентов", "stop agents", "выключи агентов",
        "останови мониторинг", "stop monitoring",
    ],
}

# Circuit breaker: "сбрось circuit breaker X" / "reset circuit breaker X"
CB_RESET_PATTERN = re.compile(
    r"(?:сбрось|reset|сброс)\s+(?:circuit\s*breaker|cb)\s+(\w+)",
    re.IGNORECASE,
)
CB_RESET_RU = re.compile(
    r"сбрось\s+([a-z_0-9]+)\s*(?:circuit|breaker)?",
    re.IGNORECASE,
)


@dataclass
class IntentResult:
    intent: str  # "question" | "open_stress_test" | "open_agents" | ...
    action_type: Optional[str] = None
    action_label: Optional[str] = None
    action_path: Optional[str] = None
    action_payload: Optional[dict] = None
    # For reset_circuit_breaker
    circuit_breaker_name: Optional[str] = None


# Paths for navigation (frontend will navigate)
ACTION_PATHS = {
    "open_stress_test": "/stress-planner",
    "open_agents": "/agents",
    "open_action_plans": "/action-plans",
    "open_alerts": "/alert",
    "open_health": "/command",  # or a dedicated health page if exists
}


def _normalize(text: str) -> str:
    return " ".join(text.lower().strip().split())


def detect_intent(question: str) -> IntentResult:
    """
    Detect user intent from question text (RU/EN).
    Returns IntentResult with intent and optional action fields.
    """
    n = _normalize(question)
    if not n:
        return IntentResult(intent="question")

    # 1) Remediation: circuit breaker reset (with name)
    m = CB_RESET_PATTERN.search(n) or CB_RESET_RU.search(n)
    if m:
        name = m.group(1).strip()
        if name and len(name) < 80:
            return IntentResult(
                intent="remediation",
                action_type="reset_circuit_breaker",
                circuit_breaker_name=name,
            )

    # 2) Other remediation phrases
    for action_type, phrases in REMEDIATION_PHRASES.items():
        for p in phrases:
            if p in n or n in p:
                return IntentResult(
                    intent="remediation",
                    action_type=action_type,
                )

    # 3) Diagnostics (read-only: return status text + optional action)
    for p in DIAGNOSTICS_PHRASES:
        if p in n:
            return IntentResult(
                intent="diagnostics",
                action_type="open_health",
                action_label="Open status",
                action_path=ACTION_PATHS.get("open_health"),
            )

    # 4) Navigation
    for action_type, phrases in NAVIGATION_PHRASES.items():
        for p in phrases:
            if p in n:
                path = ACTION_PATHS.get(action_type)
                label = {
                    "open_stress_test": "Open stress test",
                    "open_agents": "Open agents",
                    "open_action_plans": "Action plans",
                    "open_alerts": "Open alerts",
                }.get(action_type, "Open")
                return IntentResult(
                    intent="navigation",
                    action_type=action_type,
                    action_label=label,
                    action_path=path,
                )

    # 5) Default: question (AIQ answer)
    return IntentResult(intent="question")
