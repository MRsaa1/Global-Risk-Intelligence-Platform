"""
NIS2 Directive — entity classification (essential/important), Art. 21 risk measures, Art. 23 incident notification.

In-memory for MVP; can be backed by CIP DB.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

# NIS2 Annex I/II sectors mapping to essential vs important
NIS2_ESSENTIAL_SECTORS = {
    "energy", "transport", "banking", "financial_market", "health", "drinking_water",
    "waste_water", "digital_infrastructure", "ict_management", "space", "postal",
    "waste_management", "chemicals", "food", "manufacturing", "digital_providers",
    "research", "public_administration", "critical_entities",
}
NIS2_IMPORTANT_SECTORS = {
    "postal", "waste_management", "chemicals", "food", "manufacturing",
    "digital_providers", "research", "waste_management", "railways", "airports",
}


@dataclass
class NIS2EntityClassification:
    """NIS2 Art. 3: essential or important entity."""
    entity_id: str
    sector: str
    nis2_class: str  # essential | important
    size_medium_upper: bool  # medium or upper size undertaking
    notes: str = ""


@dataclass
class NIS2IncidentReport:
    """NIS2 Art. 23: early warning 24h, notification 72h, final report 1 month."""
    id: str
    entity_id: str
    description: str
    detected_at: str
    early_warning_24h: bool
    notification_72h: bool
    final_report_submitted: bool
    created_at: str


_nis2_risk_measures: Dict[str, Dict[str, Any]] = {}
_nis2_incidents: List[NIS2IncidentReport] = []


def classify_entity(
    entity_id: str,
    sector: str,
    size_medium_upper: bool = True,
) -> Dict[str, Any]:
    """NIS2 Art. 3: Classify entity as essential or important (Annex I/II)."""
    sector_lower = (sector or "other").lower().replace(" ", "_")
    is_essential = sector_lower in NIS2_ESSENTIAL_SECTORS or "critical" in sector_lower
    is_important = sector_lower in NIS2_IMPORTANT_SECTORS or is_essential
    nis2_class = "essential" if is_essential else ("important" if is_important else "other")
    return {
        "entity_id": entity_id,
        "sector": sector,
        "nis2_class": nis2_class,
        "size_medium_upper": size_medium_upper,
        "notes": "Classification per NIS2 Dir. Art. 3, Annex I/II",
    }


def get_or_set_risk_measures(entity_id: str, **kwargs: Any) -> Dict[str, Any]:
    """NIS2 Art. 21: Risk management measures (policies on risk analysis, incident handling, BCP, supply chain, etc.)."""
    if entity_id not in _nis2_risk_measures:
        _nis2_risk_measures[entity_id] = {
            "entity_id": entity_id,
            "risk_analysis_policy": True,
            "incident_handling": True,
            "business_continuity": True,
            "supply_chain_security": True,
            "access_control_encryption": True,
            "last_assessment": datetime.now(timezone.utc).isoformat(),
        }
    for k, v in kwargs.items():
        if k in _nis2_risk_measures[entity_id]:
            _nis2_risk_measures[entity_id][k] = v
    _nis2_risk_measures[entity_id]["last_assessment"] = datetime.now(timezone.utc).isoformat()
    return dict(_nis2_risk_measures[entity_id])


def report_nis2_incident(
    entity_id: str,
    description: str,
    detected_at: str | None = None,
    early_warning_24h: bool = False,
    notification_72h: bool = False,
    final_report_submitted: bool = False,
) -> Dict[str, Any]:
    """NIS2 Art. 23: Register significant incident (24h early warning, 72h notification, 1 month final report)."""
    now = datetime.now(timezone.utc).isoformat()
    report = NIS2IncidentReport(
        id=str(uuid4()),
        entity_id=entity_id,
        description=description,
        detected_at=detected_at or now,
        early_warning_24h=early_warning_24h,
        notification_72h=notification_72h,
        final_report_submitted=final_report_submitted,
        created_at=now,
    )
    _nis2_incidents.append(report)
    return {
        "id": report.id,
        "entity_id": report.entity_id,
        "description": report.description,
        "detected_at": report.detected_at,
        "early_warning_24h": report.early_warning_24h,
        "notification_72h": report.notification_72h,
        "final_report_submitted": report.final_report_submitted,
        "created_at": report.created_at,
    }


def list_nis2_incidents(entity_id: str | None = None, limit: int = 50) -> List[Dict[str, Any]]:
    """List NIS2 incident reports."""
    items = _nis2_incidents
    if entity_id:
        items = [r for r in items if r.entity_id == entity_id]
    return [
        {
            "id": r.id,
            "entity_id": r.entity_id,
            "description": r.description,
            "detected_at": r.detected_at,
            "early_warning_24h": r.early_warning_24h,
            "notification_72h": r.notification_72h,
            "final_report_submitted": r.final_report_submitted,
            "created_at": r.created_at,
        }
        for r in items[-limit:]
    ]
