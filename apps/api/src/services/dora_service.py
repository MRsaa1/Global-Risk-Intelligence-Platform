"""
DORA (Digital Operational Resilience Act) — ICT risk and incident reporting.

Art. 5–14: ICT risk management framework; Art. 15–20: incident classification and reporting.
In-memory store for MVP; can be backed by DB later.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List
from uuid import uuid4


class DORAIncidentSeverity(str, Enum):
    """Major ICT incident severity (DORA Art. 16)."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ICTRiskFramework:
    """ICT risk management framework (DORA Art. 5–14): governance, identification, protection, detection, response, recovery."""
    entity_id: str
    governance_in_place: bool = True
    risk_identification_done: bool = True
    protection_measures: bool = True
    detection_capabilities: bool = True
    response_plan: bool = True
    recovery_plan: bool = True
    last_assessment: str = ""


@dataclass
class DORAIncidentReport:
    """ICT incident report (Art. 16): classification and notification."""
    id: str
    entity_id: str
    severity: str
    description: str
    detected_at: str
    initial_notification_sent: bool
    root_cause_analysis_done: bool
    created_at: str


# In-memory store (replace with DB in production)
_ict_frameworks: Dict[str, ICTRiskFramework] = {}
_incident_reports: List[DORAIncidentReport] = []


def get_or_create_ict_framework(entity_id: str = "default") -> ICTRiskFramework:
    """Get or create ICT risk framework for entity (DORA Art. 5–14)."""
    if entity_id not in _ict_frameworks:
        _ict_frameworks[entity_id] = ICTRiskFramework(
            entity_id=entity_id,
            last_assessment=datetime.now(timezone.utc).isoformat(),
        )
    return _ict_frameworks[entity_id]


def submit_ict_framework(entity_id: str, **kwargs: Any) -> Dict[str, Any]:
    """Submit or update ICT risk management framework."""
    fw = get_or_create_ict_framework(entity_id)
    for k, v in kwargs.items():
        if hasattr(fw, k):
            setattr(fw, k, v)
    fw.last_assessment = datetime.now(timezone.utc).isoformat()
    return {
        "entity_id": fw.entity_id,
        "governance_in_place": fw.governance_in_place,
        "risk_identification_done": fw.risk_identification_done,
        "protection_measures": fw.protection_measures,
        "detection_capabilities": fw.detection_capabilities,
        "response_plan": fw.response_plan,
        "recovery_plan": fw.recovery_plan,
        "last_assessment": fw.last_assessment,
    }


def report_incident(
    entity_id: str,
    severity: str,
    description: str,
    detected_at: str | None = None,
    initial_notification_sent: bool = False,
    root_cause_analysis_done: bool = False,
) -> Dict[str, Any]:
    """Register an ICT incident (DORA Art. 16). Returns the created report."""
    now = datetime.now(timezone.utc).isoformat()
    report = DORAIncidentReport(
        id=str(uuid4()),
        entity_id=entity_id,
        severity=severity.lower(),
        description=description,
        detected_at=detected_at or now,
        initial_notification_sent=initial_notification_sent,
        root_cause_analysis_done=root_cause_analysis_done,
        created_at=now,
    )
    _incident_reports.append(report)
    return {
        "id": report.id,
        "entity_id": report.entity_id,
        "severity": report.severity,
        "description": report.description,
        "detected_at": report.detected_at,
        "initial_notification_sent": report.initial_notification_sent,
        "root_cause_analysis_done": report.root_cause_analysis_done,
        "created_at": report.created_at,
    }


def list_incidents(entity_id: str | None = None, limit: int = 50) -> List[Dict[str, Any]]:
    """List ICT incident reports, optionally filtered by entity."""
    items = _incident_reports
    if entity_id:
        items = [r for r in items if r.entity_id == entity_id]
    return [
        {
            "id": r.id,
            "entity_id": r.entity_id,
            "severity": r.severity,
            "description": r.description,
            "detected_at": r.detected_at,
            "initial_notification_sent": r.initial_notification_sent,
            "root_cause_analysis_done": r.root_cause_analysis_done,
            "created_at": r.created_at,
        }
        for r in items[-limit:]
    ]
