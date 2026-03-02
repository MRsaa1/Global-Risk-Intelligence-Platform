"""
Compliance Agent — runs regulatory verification against loaded norms (RAG chunks),
records result in compliance_verifications and audit log. Used after stress tests and for dashboard.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_audit_log import AgentAuditLog
from src.models.compliance_verification import ComplianceVerification
from src.services.regulatory_engine import get_applicable_frameworks
from src.services.regulatory_norms_loader import retrieve_regulatory_chunks

logger = logging.getLogger(__name__)

AGENT_ID = "compliance_agent"
ACTION_VERIFY = "compliance_verify"


def _rule_based_check(
    framework_id: str,
    context: Dict[str, Any],
) -> tuple[str, List[Dict[str, Any]]]:
    """
    Rule-based check for known frameworks (Basel, Solvency II). Returns (status, requirements_checked).
    status: passed | failed | partial
    """
    requirements_checked: List[Dict[str, Any]] = []
    if framework_id == "basel":
        cet1 = context.get("cet1_ratio_pct") or context.get("cet1_ratio")
        lcr = context.get("lcr_pct") or context.get("lcr_ratio")
        nsfr = context.get("nsfr_pct") or context.get("nsfr_ratio")
        if cet1 is not None:
            met = float(cet1) >= 4.5
            requirements_checked.append({"id": "basel_cet1", "ref": "CRR Art. 92", "met": met, "actual": cet1, "threshold": 4.5})
        if lcr is not None:
            met = float(lcr) >= 100
            requirements_checked.append({"id": "basel_lcr", "ref": "CRR Art. 411-428", "met": met, "actual": lcr, "threshold": 100})
        if nsfr is not None:
            met = float(nsfr) >= 100
            requirements_checked.append({"id": "basel_nsfr", "ref": "CRR2 Art. 428a", "met": met, "actual": nsfr, "threshold": 100})
        if not requirements_checked:
            requirements_checked.append({"id": "basel_impl", "ref": "Basel III/IV", "met": True, "note": "No metrics in context; implementation present"})
        failed = sum(1 for r in requirements_checked if r.get("met") is False)
        if failed == 0:
            return "passed", requirements_checked
        if failed < len(requirements_checked):
            return "partial", requirements_checked
        return "failed", requirements_checked

    if framework_id == "solvency_ii":
        ratio = context.get("solvency_ratio") or context.get("solvency_ratio_pct")
        if ratio is not None:
            met = float(ratio) >= 100
            requirements_checked.append({"id": "sii_scr", "ref": "Solvency II Dir. Art. 100", "met": met, "actual": ratio, "threshold": 100})
        if not requirements_checked:
            requirements_checked.append({"id": "sii_impl", "ref": "Solvency II", "met": True, "note": "No metrics in context"})
        failed = sum(1 for r in requirements_checked if r.get("met") is False)
        if failed == 0:
            return "passed", requirements_checked
        return "failed", requirements_checked

    requirements_checked.append({"id": f"{framework_id}_impl", "ref": framework_id, "met": True, "note": "Framework implemented; no numeric thresholds in context"})
    return "passed", requirements_checked


async def run_verification(
    db: AsyncSession,
    entity_type: str,
    jurisdiction: str,
    entity_id: Optional[str] = None,
    stress_test_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
    framework_ids: Optional[List[str]] = None,
) -> List[ComplianceVerification]:
    """
    Run compliance verification for the given entity/jurisdiction (and optional stress test).
    Uses get_applicable_frameworks, retrieves norms from RAG, runs rule-based checks,
    saves ComplianceVerification rows and an AgentAuditLog entry.
    Returns list of ComplianceVerification records created.
    """
    context = context or {}
    frameworks = get_applicable_frameworks(entity_type, jurisdiction, context.get("severity", 0.0))
    if framework_ids:
        frameworks = [f for f in frameworks if f["framework_id"] in framework_ids]
    if not frameworks:
        return []

    evidence_snapshot: List[Dict[str, Any]] = []
    results: List[ComplianceVerification] = []

    for fw in frameworks:
        fw_id = fw["framework_id"]
        chunks = await retrieve_regulatory_chunks(db, fw_id, jurisdiction, query=None, top_k=5)
        for c in chunks:
            evidence_snapshot.append({"chunk_id": c["id"], "article_id": c.get("article_id"), "framework_id": fw_id})

        status, requirements_checked = _rule_based_check(fw_id, context)
        req_json = json.dumps(requirements_checked) if requirements_checked else None
        ev_json = json.dumps(evidence_snapshot[-len(chunks):]) if chunks else json.dumps(evidence_snapshot)

        verification = ComplianceVerification(
            entity_id=entity_id,
            entity_type=entity_type,
            stress_test_id=stress_test_id,
            framework_id=fw_id,
            jurisdiction=jurisdiction,
            status=status,
            checked_by_agent_id=AGENT_ID,
            evidence_snapshot=ev_json,
            requirements_checked=req_json,
        )
        db.add(verification)
        results.append(verification)
        evidence_snapshot = evidence_snapshot[-10:]

    await db.flush()

    audit = AgentAuditLog(
        source="compliance_agent",
        agent_id=AGENT_ID,
        action_type=ACTION_VERIFY,
        input_summary=json.dumps({"entity_type": entity_type, "jurisdiction": jurisdiction, "stress_test_id": stress_test_id}),
        result_summary=json.dumps({"verifications": len(results), "frameworks": [f["framework_id"] for f in frameworks]}),
        timestamp=datetime.now(timezone.utc),
        meta=json.dumps({"entity_id": entity_id, "verification_ids": [v.id for v in results]}),
    )
    db.add(audit)
    await db.flush()
    for v in results:
        v.audit_log_id = audit.id
    await db.flush()
    return results
