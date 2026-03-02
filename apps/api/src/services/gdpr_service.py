"""
GDPR — Data subject rights (Art. 15/17/20), DPO, DPIA, consent (Art. 7–8).

APIs for access, erasure, portability; DPO designation; DPIA records.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

# In-memory stubs (replace with DB/audit in production)
_dpo: Dict[str, Any] = {}
_dpia_records: List[Dict[str, Any]] = []
_erasure_requests: List[Dict[str, Any]] = []


def subject_access(subject_id: str) -> Dict[str, Any]:
    """GDPR Art. 15: Right of access — data held on the data subject."""
    return {
        "subject_id": subject_id,
        "article": "Art. 15",
        "categories_of_data": ["identity", "usage", "preferences", "audit_log"],
        "summary": "Data categories and processing purposes; full export available via portability.",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }


def subject_erasure_request(subject_id: str, reason: str = "") -> Dict[str, Any]:
    """GDPR Art. 17: Right to erasure — register request (actual deletion in backend)."""
    req = {
        "id": str(uuid4()),
        "subject_id": subject_id,
        "article": "Art. 17",
        "status": "registered",
        "reason": reason or "Data subject request",
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }
    _erasure_requests.append(req)
    return req


def subject_portability(subject_id: str, format: str = "json") -> Dict[str, Any]:
    """GDPR Art. 20: Right to data portability — machine-readable export."""
    return {
        "subject_id": subject_id,
        "article": "Art. 20",
        "format": format,
        "data": {
            "identity": {"id": subject_id, "exported_at": datetime.now(timezone.utc).isoformat()},
            "preferences": {},
            "consents": [],
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def get_or_set_dpo(name: str = "", contact: str = "", organization: str = "default") -> Dict[str, Any]:
    """GDPR Art. 37–39: Data Protection Officer — designation and contact."""
    key = organization or "default"
    if key not in _dpo:
        _dpo[key] = {
            "organization": key,
            "dpo_designated": True,
            "name": name or "DPO",
            "contact": contact or "dpo@example.com",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    if name or contact:
        if name:
            _dpo[key]["name"] = name
        if contact:
            _dpo[key]["contact"] = contact
        _dpo[key]["updated_at"] = datetime.now(timezone.utc).isoformat()
    return dict(_dpo[key])


def create_dpia(
    processing_activity: str,
    purpose: str,
    risk_level: str = "medium",
    mitigation: str = "",
    organization: str = "default",
) -> Dict[str, Any]:
    """GDPR Art. 35: Data Protection Impact Assessment — create record."""
    rec = {
        "id": str(uuid4()),
        "organization": organization,
        "processing_activity": processing_activity,
        "purpose": purpose,
        "risk_level": risk_level,
        "mitigation": mitigation,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _dpia_records.append(rec)
    return rec


def list_dpias(organization: str | None = None, limit: int = 50) -> List[Dict[str, Any]]:
    """List DPIA records."""
    items = _dpia_records
    if organization:
        items = [r for r in items if r.get("organization") == organization]
    return items[-limit:]
