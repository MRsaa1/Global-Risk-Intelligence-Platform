"""
EU AI Act — risk tier (Annex III), conformity assessment, Art. 11 technical documentation, post-market monitoring.

Used by compliance dashboard and ASGI module.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4


RISK_TIERS = ("prohibited", "high", "limited", "minimal")


def classify_risk_tier(
    system_type: str = "",
    use_case: str = "",
    annex_iii_match: bool = False,
) -> Dict[str, Any]:
    """EU AI Act Art. 5/6, Annex III: Classify AI system risk tier (prohibited, high, limited, minimal)."""
    st = (system_type or "").lower()
    uc = (use_case or "").lower()
    if "biometric" in st or "real_time" in uc or "social_scoring" in uc:
        tier = "high" if "prohibited" not in uc else "prohibited"
    elif annex_iii_match or "safety" in st or "critical" in uc:
        tier = "high"
    elif "chatbot" in st or "transparency" in uc:
        tier = "limited"
    else:
        tier = "minimal"
    return {
        "risk_tier": tier,
        "system_type": system_type or "unspecified",
        "use_case": use_case or "unspecified",
        "annex_iii_reference": "EU AI Act Annex III" if tier == "high" else None,
    }


def get_conformity_status(system_id: str) -> Dict[str, Any]:
    """EU AI Act Art. 40–49: Conformity assessment (self-assessment or third-party)."""
    return {
        "system_id": system_id,
        "conformity_assessment": "self_assessed",
        "status": "compliant",
        "assessed_at": datetime.now(timezone.utc).isoformat(),
        "note": "Self-assessment for non-high-risk; high-risk may require third-party.",
    }


def get_art11_technical_doc(system_id: str, system_name: str = "") -> Dict[str, Any]:
    """EU AI Act Art. 11, Annex IV: Technical documentation template."""
    return {
        "system_id": system_id,
        "system_name": system_name or f"System {system_id}",
        "template": "EU_AI_ACT_ART11_ANNEX_IV",
        "sections": [
            {"id": "design", "title": "Design and development", "description": "Design choices, data, training"},
            {"id": "validation", "title": "Validation and testing", "description": "Testing, validation, performance"},
            {"id": "intended_purpose", "title": "Intended purpose and limitations", "description": "Scope and limitations"},
            {"id": "human_oversight", "title": "Human oversight", "description": "Measures for human oversight"},
            {"id": "accuracy_robustness", "title": "Accuracy and robustness", "description": "Accuracy, robustness, cybersecurity"},
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# In-memory post-market monitoring and incidents
_pmm_incidents: List[Dict[str, Any]] = []


def post_market_incident_report(
    system_id: str,
    description: str,
    severity: str = "serious",
    corrective_action: str = "",
) -> Dict[str, Any]:
    """EU AI Act Art. 61–62, 72: Post-market monitoring — serious incident reporting."""
    now = datetime.now(timezone.utc).isoformat()
    rec = {
        "id": str(uuid4()),
        "system_id": system_id,
        "description": description,
        "severity": severity,
        "corrective_action": corrective_action,
        "reported_at": now,
    }
    _pmm_incidents.append(rec)
    return rec


def list_pmm_incidents(system_id: str | None = None, limit: int = 50) -> List[Dict[str, Any]]:
    """List post-market monitoring incidents."""
    items = _pmm_incidents
    if system_id:
        items = [r for r in items if str(r.get("system_id")) == str(system_id)]
    return items[-limit:]
