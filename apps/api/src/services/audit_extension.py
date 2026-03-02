"""
Decision-Grade Audit Extension.

Extends the existing crypto audit chain (ASGI module) to cover all strategic modules.
Provides:
1. Tamper-evident logging for stress test inputs/outputs
2. Cross-module audit trail with cryptographic hash chain
3. Regulatory disclosure package export (TCFD, OSFI B-15, EBA)
4. One-click export for compliance reporting
"""
from __future__ import annotations

import hashlib
import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


@dataclass
class AuditEntry:
    """Tamper-evident audit entry with hash chain."""
    id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    module: str = ""
    action: str = ""
    actor: str = "system"
    object_type: str = ""
    object_id: str = ""
    input_hash: str = ""
    output_hash: str = ""
    previous_hash: str = ""
    entry_hash: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    severity: str = "info"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "module": self.module,
            "action": self.action,
            "actor": self.actor,
            "object_type": self.object_type,
            "object_id": self.object_id,
            "input_hash": self.input_hash,
            "output_hash": self.output_hash,
            "previous_hash": self.previous_hash,
            "entry_hash": self.entry_hash,
            "details": self.details,
            "severity": self.severity,
        }


# Regulatory frameworks for disclosure packages
REGULATORY_FRAMEWORKS = {
    "TCFD": {
        "name": "Task Force on Climate-related Financial Disclosures",
        "sections": [
            {"id": "governance", "name": "Governance", "description": "Board and management oversight of climate risks"},
            {"id": "strategy", "name": "Strategy", "description": "Climate-related risks, opportunities, and scenario analysis"},
            {"id": "risk_management", "name": "Risk Management", "description": "Processes for identifying and managing climate risks"},
            {"id": "metrics", "name": "Metrics and Targets", "description": "Climate-related metrics, targets, and performance"},
        ],
    },
    "OSFI_B15": {
        "name": "OSFI Guideline B-15: Climate Risk Management",
        "sections": [
            {"id": "governance", "name": "Governance and Strategy", "description": "Board-level climate governance"},
            {"id": "risk_management", "name": "Risk Management", "description": "Climate risk integration into ERM"},
            {"id": "scenario_analysis", "name": "Scenario Analysis", "description": "Climate stress testing results"},
            {"id": "disclosure", "name": "Disclosure", "description": "Climate risk disclosure requirements"},
            {"id": "transition_plan", "name": "Climate Transition Plan", "description": "Plans addressing financial risks from transition to low-GHG economy (B-15 Ch.2)"},
            {"id": "ghg_scope_1_2", "name": "Scope 1 & 2 GHG Emissions", "description": "Direct and indirect GHG emissions disclosure (B-15)"},
            {"id": "ghg_scope_3", "name": "Scope 3 GHG Emissions", "description": "Value chain GHG emissions (B-15; implementation from FY2028)"},
            {"id": "metrics_and_targets", "name": "Metrics and Targets", "description": "Climate-related metrics, targets, and performance (TCFD-aligned)"},
        ],
    },
    "EBA": {
        "name": "EBA Guidelines on Management of ESG Risks",
        "sections": [
            {"id": "identification", "name": "Risk Identification", "description": "ESG risk identification processes"},
            {"id": "measurement", "name": "Risk Measurement", "description": "ESG risk quantification"},
            {"id": "monitoring", "name": "Monitoring and Reporting", "description": "Ongoing ESG risk monitoring"},
            {"id": "stress_testing", "name": "Stress Testing", "description": "Climate scenario stress testing"},
            {"id": "materiality_assessment", "name": "Materiality Assessment", "description": "Exposure/portfolio/sector/scenario-based ESG materiality"},
            {"id": "transition_plan", "name": "Transition Planning", "description": "Plans for financial risks from transition to ESG objectives"},
            {"id": "metrics_and_targets", "name": "Metrics and Targets", "description": "Climate-related metrics and targets (10-year+ horizon)"},
        ],
    },
    "CSA_NI_51_107": {
        "name": "CSA National Instrument 51-107: Disclosure of Climate-related Matters",
        "sections": [
            {"id": "governance", "name": "Governance", "description": "Climate governance disclosure"},
            {"id": "strategy", "name": "Strategy", "description": "Climate strategy and resilience"},
            {"id": "risk_management", "name": "Risk Management", "description": "Climate risk management processes"},
            {"id": "ghg_emissions", "name": "GHG Emissions", "description": "Scope 1, 2, 3 emissions reporting"},
        ],
    },
    "SEC_CLIMATE": {
        "name": "SEC Climate Disclosure Rules",
        "sections": [
            {"id": "risk_factors", "name": "Climate Risk Factors", "description": "Material climate risk factor disclosure"},
            {"id": "financial_impact", "name": "Financial Impact", "description": "Climate-related financial statement impacts"},
            {"id": "ghg_emissions", "name": "GHG Emissions", "description": "Scope 1 and 2 emissions"},
            {"id": "targets", "name": "Climate Targets", "description": "Climate-related targets and transition plans"},
        ],
    },
    "MUNICIPAL_INSURABILITY": {
        "name": "Municipal Climate Insurability (sub-sovereign)",
        "sections": [
            {"id": "governance", "name": "Governance", "description": "Municipal governance of climate risk and insurability"},
            {"id": "exposure", "name": "Exposure & Stress Scenarios", "description": "Hazard exposure, AEL, 100-year loss, stress test results"},
            {"id": "disclosure", "name": "Disclosure", "description": "Climate risk disclosure for insurers/regulators"},
        ],
    },
    "ISSB": {
        "name": "IFRS S1 General Requirements & IFRS S2 Climate-related Disclosures",
        "sections": [
            {"id": "s1_governance", "name": "IFRS S1 — Governance", "description": "Governance of sustainability-related risks and opportunities"},
            {"id": "s1_strategy", "name": "IFRS S1 — Strategy", "description": "Strategy for sustainability-related risks and opportunities"},
            {"id": "s1_risk_management", "name": "IFRS S1 — Risk Management", "description": "Processes to identify, assess and manage sustainability risks"},
            {"id": "s1_metrics", "name": "IFRS S1 — Metrics and Targets", "description": "Metrics and targets used to manage sustainability matters"},
            {"id": "s2_climate", "name": "IFRS S2 — Climate-related Disclosures", "description": "Climate risks, opportunities, GHG Scope 1/2/3, transition plans"},
            {"id": "s2_industry", "name": "Industry-based Metrics (SASB)", "description": "Industry-specific sustainability metrics where applicable"},
        ],
    },
}


class AuditExtensionService:
    """Extended audit service covering all strategic modules."""

    def __init__(self):
        self._chain: List[AuditEntry] = []
        self._last_hash = "genesis"

    def log_action(
        self,
        module: str,
        action: str,
        object_type: str = "",
        object_id: str = "",
        input_data: Optional[Dict] = None,
        output_data: Optional[Dict] = None,
        actor: str = "system",
        severity: str = "info",
        details: Optional[Dict] = None,
    ) -> AuditEntry:
        """Log a tamper-evident audit entry with hash chain."""
        input_hash = self._hash_data(input_data) if input_data else ""
        output_hash = self._hash_data(output_data) if output_data else ""

        entry = AuditEntry(
            module=module,
            action=action,
            actor=actor,
            object_type=object_type,
            object_id=object_id,
            input_hash=input_hash,
            output_hash=output_hash,
            previous_hash=self._last_hash,
            details=details or {},
            severity=severity,
        )
        # Compute entry hash (includes previous hash for chain integrity)
        entry.entry_hash = self._compute_entry_hash(entry)
        self._last_hash = entry.entry_hash
        self._chain.append(entry)
        return entry

    def verify_chain_integrity(self) -> Dict[str, Any]:
        """Verify the entire audit chain is tamper-free."""
        if not self._chain:
            return {"valid": True, "entries_checked": 0}

        expected_prev = "genesis"
        broken_at = None

        for i, entry in enumerate(self._chain):
            if entry.previous_hash != expected_prev:
                broken_at = i
                break
            recomputed = self._compute_entry_hash(entry)
            if recomputed != entry.entry_hash:
                broken_at = i
                break
            expected_prev = entry.entry_hash

        return {
            "valid": broken_at is None,
            "entries_checked": len(self._chain),
            "broken_at_index": broken_at,
            "chain_length": len(self._chain),
            "genesis_hash": self._chain[0].entry_hash if self._chain else None,
            "latest_hash": self._chain[-1].entry_hash if self._chain else None,
        }

    def get_module_audit_trail(
        self,
        module: str,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get audit trail for a specific module."""
        entries = [e for e in self._chain if e.module.lower() == module.lower()]
        return [e.to_dict() for e in entries[-limit:]]

    def generate_disclosure_package(
        self,
        framework: str,
        organization: str = "Organization",
        reporting_period: str = "2025-01-01 to 2025-12-31",
    ) -> Dict[str, Any]:
        """Generate a regulatory disclosure package for compliance reporting."""
        fw = REGULATORY_FRAMEWORKS.get(framework)
        if not fw:
            return {"error": f"Unknown framework: {framework}. Available: {list(REGULATORY_FRAMEWORKS.keys())}"}

        # Gather audit evidence
        relevant_entries = [e for e in self._chain if e.severity in ("info", "warning", "critical")]

        # GHG inventory (real data replaces placeholder when set)
        ghg = get_ghg_inventory(organization, reporting_period)

        # Build disclosure sections
        sections = []
        for section in fw["sections"]:
            sid = section["id"]
            # Find relevant audit entries for this section
            section_entries = [
                e for e in relevant_entries
                if any(kw in e.action.lower() or kw in e.object_type.lower()
                       for kw in [sid, section["name"].lower().split()[0]])
            ]

            # Use real GHG inventory for Scope 1/2, Scope 3, or combined ghg_emissions (CSA, SEC) when available
            if sid == "ghg_emissions" and ghg:
                content = _format_ghg_scope_1_2(ghg) + " " + _format_ghg_scope_3(ghg)
                sections.append({
                    "section_id": sid,
                    "section_name": section["name"],
                    "description": section["description"],
                    "evidence_count": 1,
                    "status": "populated",
                    "audit_references": [],
                    "auto_generated_content": content,
                    "ghg_inventory": ghg,
                })
            elif sid == "ghg_scope_1_2" and ghg:
                content = _format_ghg_scope_1_2(ghg)
                sections.append({
                    "section_id": sid,
                    "section_name": section["name"],
                    "description": section["description"],
                    "evidence_count": 1,
                    "status": "populated",
                    "audit_references": [],
                    "auto_generated_content": content,
                    "ghg_inventory": ghg,
                })
            elif sid == "ghg_scope_3" and ghg:
                content = _format_ghg_scope_3(ghg)
                sections.append({
                    "section_id": sid,
                    "section_name": section["name"],
                    "description": section["description"],
                    "evidence_count": 1 if (ghg.get("scope_3_tonnes_co2e") is not None) else 0,
                    "status": "populated" if ghg.get("scope_3_tonnes_co2e") is not None else "requires_input",
                    "audit_references": [],
                    "auto_generated_content": content,
                    "ghg_inventory": ghg,
                })
            else:
                sections.append({
                    "section_id": sid,
                    "section_name": section["name"],
                    "description": section["description"],
                    "evidence_count": len(section_entries),
                    "status": "populated" if section_entries else "requires_input",
                    "audit_references": [e.id for e in section_entries[:5]],
                    "auto_generated_content": self._auto_generate_section(sid, section_entries),
                })

        # Validation: mandatory sections must be populated (plan step 5)
        try:
            from src.core.regulatory_document_templates import get_mandatory_section_ids
            mandatory_ids = get_mandatory_section_ids(framework)
            section_id_to_status = {s["section_id"]: s["status"] for s in sections}
            missing_mandatory = [sid for sid in mandatory_ids if section_id_to_status.get(sid) != "populated"]
            all_mandatory_populated = len(missing_mandatory) == 0
        except Exception:
            mandatory_ids = []
            missing_mandatory = []
            all_mandatory_populated = False

        return {
            "framework": framework,
            "framework_name": fw["name"],
            "organization": organization,
            "reporting_period": reporting_period,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "sections": sections,
            "total_audit_evidence": len(relevant_entries),
            "chain_integrity": self.verify_chain_integrity(),
            "export_format": "JSON",
            "compliance_score": sum(1 for s in sections if s["status"] == "populated") / max(1, len(sections)),
            "validation": {
                "all_mandatory_populated": all_mandatory_populated,
                "missing_mandatory": missing_mandatory,
            },
        }

    def get_available_frameworks(self) -> List[Dict[str, str]]:
        """Get list of available regulatory frameworks for disclosure."""
        return [
            {"id": k, "name": v["name"], "sections": len(v["sections"])}
            for k, v in REGULATORY_FRAMEWORKS.items()
        ]

    def get_stats(self) -> Dict[str, Any]:
        """Get audit extension statistics."""
        by_module = defaultdict(int)
        by_severity = defaultdict(int)
        for e in self._chain:
            by_module[e.module] += 1
            by_severity[e.severity] += 1

        return {
            "total_entries": len(self._chain),
            "by_module": dict(by_module),
            "by_severity": dict(by_severity),
            "chain_valid": self.verify_chain_integrity()["valid"],
            "available_frameworks": len(REGULATORY_FRAMEWORKS),
        }

    def _hash_data(self, data: Any) -> str:
        """SHA-256 hash of data."""
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode()).hexdigest()[:16]

    def _compute_entry_hash(self, entry: AuditEntry) -> str:
        """Compute hash for an entry (chain link)."""
        content = f"{entry.id}|{entry.timestamp.isoformat()}|{entry.module}|{entry.action}|{entry.input_hash}|{entry.output_hash}|{entry.previous_hash}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _auto_generate_section(self, section_id: str, entries: List[AuditEntry]) -> str:
        """Auto-generate disclosure section content from audit evidence or framework placeholder."""
        if entries:
            actions = set(e.action for e in entries)
            modules = set(e.module for e in entries)
            return (
                f"Based on {len(entries)} audit records across modules ({', '.join(modules)}), "
                f"the following activities were recorded: {', '.join(actions)}. "
                f"All actions are cryptographically attested in the platform audit chain."
            )
        # Placeholders for OSFI B-15 / EBA disclosure (no evidence yet)
        placeholders = {
            "ghg_scope_1_2": (
                "Scope 1 (direct) and Scope 2 (indirect) GHG emissions: data to be populated from "
                "organizational inventory. Platform supports stress-test and climate scenario outputs; "
                "emissions inventory should be linked or uploaded for full B-15 compliance."
            ),
            "ghg_scope_3": (
                "Scope 3 (value chain) GHG emissions: disclosure expected from FY2028 per B-15 alignment "
                "with Canadian Sustainability Standards Board. Placeholder for future inventory linkage."
            ),
            "transition_plan": (
                "Climate transition plan: description of how the organization addresses financial risks "
                "from the transition to a low-GHG economy. Integrate with scenario analysis (NGFS/EBA "
                "stress tests) and strategic targets. Manual narrative or link to strategic document required."
            ),
            "metrics_and_targets": (
                "Metrics and targets: climate-related KPIs (e.g. exposure at risk, AEL, stress test "
                "outputs, portfolio alignment). Platform provides stress test metrics, AEL and 100-year "
                "loss (CADAPT), and scenario-based capital impact; aggregate here for disclosure."
            ),
            "materiality_assessment": (
                "Materiality assessment: ESG risks assessed by exposure, portfolio, sector and scenario. "
                "Platform supports scenario-based and portfolio stress tests; formal materiality matrix "
                "or assessment narrative to be completed by management."
            ),
        }
        return placeholders.get(
            section_id,
            "No audit evidence available for this section. Manual input required.",
        )


# OSFI B-15 official document (in base for reference)
OSFI_B15_OFFICIAL_URL = "https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/climate-risk-management"
OSFI_B15_OFFICIAL_TITLE = "OSFI Guideline B-15: Climate Risk Management"

# OSFI B-15 Readiness Self-Assessment (aligned with OSFI questionnaire themes; each item links to official doc)
OSFI_B15_READINESS_QUESTIONS = [
    {"id": "q_governance", "category": "Governance", "question": "Board and management have assigned oversight of climate-related risks.", "weight": 1.0, "reference": "B-15 Governance and Strategy", "official_url": OSFI_B15_OFFICIAL_URL},
    {"id": "q_strategy", "category": "Strategy", "question": "Climate risks and opportunities are integrated into strategy and financial planning.", "weight": 1.0, "reference": "B-15 Governance and Strategy", "official_url": OSFI_B15_OFFICIAL_URL},
    {"id": "q_erm", "category": "Risk Management", "question": "Climate risk is integrated into the enterprise risk management framework.", "weight": 1.0, "reference": "B-15 Risk Management", "official_url": OSFI_B15_OFFICIAL_URL},
    {"id": "q_scenario", "category": "Scenario Analysis", "question": "Climate scenario analysis and stress testing are conducted (e.g. NGFS, transition paths).", "weight": 1.0, "reference": "B-15 Scenario Analysis", "official_url": OSFI_B15_OFFICIAL_URL},
    {"id": "q_disclosure", "category": "Disclosure", "question": "Climate-related disclosures meet B-15 disclosure expectations (governance, strategy, risk, metrics).", "weight": 1.0, "reference": "B-15 Ch.2 Disclosure Expectations", "official_url": OSFI_B15_OFFICIAL_URL},
    {"id": "q_transition", "category": "Transition Plan", "question": "A climate transition plan addressing transition risks is in place or in development.", "weight": 1.0, "reference": "B-15 Ch.2 Transition Plans", "official_url": OSFI_B15_OFFICIAL_URL},
    {"id": "q_scope12", "category": "GHG", "question": "Scope 1 and Scope 2 GHG emissions are measured and disclosed (or process is in place).", "weight": 1.0, "reference": "B-15 Ch.2 Scope 1 & 2 GHG", "official_url": OSFI_B15_OFFICIAL_URL},
    {"id": "q_scope3", "category": "GHG", "question": "Scope 3 emissions are assessed or planned (B-15 implementation from FY2028).", "weight": 0.5, "reference": "B-15 Ch.2 Scope 3 (FY2028)", "official_url": OSFI_B15_OFFICIAL_URL},
]


def get_osfi_b15_readiness_questions() -> List[Dict[str, Any]]:
    """Return OSFI B-15 readiness self-assessment questions."""
    return list(OSFI_B15_READINESS_QUESTIONS)


def submit_osfi_b15_readiness(answers: Dict[str, str]) -> Dict[str, Any]:
    """
    Submit OSFI B-15 readiness responses. answers: { question_id: 'yes' | 'no' | 'partial' }.
    Returns score 0–100 and list of gaps (questions answered no or partial).
    """
    score_map = {"yes": 1.0, "partial": 0.5, "no": 0.0}
    total_weight = sum(q["weight"] for q in OSFI_B15_READINESS_QUESTIONS)
    weighted_sum = 0.0
    gaps = []
    for q in OSFI_B15_READINESS_QUESTIONS:
        qid = q["id"]
        val = (answers.get(qid) or "").strip().lower()
        s = score_map.get(val, 0.0)
        weighted_sum += s * q["weight"]
        if s < 1.0:
            gaps.append({"question_id": qid, "category": q["category"], "question": q["question"], "response": val or "not_answered", "score": s})
    score_pct = round(100.0 * weighted_sum / total_weight, 1) if total_weight else 0.0
    return {
        "score_pct": score_pct,
        "total_questions": len(OSFI_B15_READINESS_QUESTIONS),
        "gaps": gaps,
        "ready": score_pct >= 75.0,
    }


# ---------------------------------------------------------------------------
# GHG Inventory (real data for disclosure — replaces placeholder when set)
# Key: (organization, reporting_period) -> { scope_1_tonnes_co2e, scope_2_tonnes_co2e, scope_3_tonnes_co2e, unit, source, updated_at }
# ---------------------------------------------------------------------------
_ghg_inventory: Dict[tuple, Dict[str, Any]] = {}


def get_ghg_inventory(organization: str, reporting_period: str) -> Optional[Dict[str, Any]]:
    """Get stored GHG inventory for organization and reporting period."""
    key = (organization.strip(), reporting_period.strip())
    return _ghg_inventory.get(key)


def set_ghg_inventory(
    organization: str,
    reporting_period: str,
    scope_1_tonnes_co2e: float,
    scope_2_tonnes_co2e: float,
    scope_3_tonnes_co2e: Optional[float] = None,
    unit: str = "tCO2e",
    source: Optional[str] = None,
) -> Dict[str, Any]:
    """Store or update GHG inventory for disclosure (OSFI B-15, EBA, TCFD)."""
    key = (organization.strip(), reporting_period.strip())
    now = datetime.now(timezone.utc)
    entry = {
        "organization": key[0],
        "reporting_period": key[1],
        "scope_1_tonnes_co2e": round(scope_1_tonnes_co2e, 2),
        "scope_2_tonnes_co2e": round(scope_2_tonnes_co2e, 2),
        "scope_3_tonnes_co2e": round(scope_3_tonnes_co2e, 2) if scope_3_tonnes_co2e is not None else None,
        "unit": unit or "tCO2e",
        "source": source or "Platform GHG inventory",
        "updated_at": now.isoformat(),
    }
    _ghg_inventory[key] = entry
    return entry


def list_ghg_inventory_keys() -> List[Dict[str, str]]:
    """List stored (organization, reporting_period) keys for UI."""
    return [
        {"organization": k[0], "reporting_period": k[1]}
        for k in sorted(_ghg_inventory.keys(), key=lambda x: (x[0], x[1]))
    ]


def _format_ghg_scope_1_2(ghg: Dict[str, Any]) -> str:
    """Format Scope 1 & 2 for disclosure content."""
    u = ghg.get("unit", "tCO2e")
    s1 = ghg.get("scope_1_tonnes_co2e")
    s2 = ghg.get("scope_2_tonnes_co2e")
    source = ghg.get("source", "Platform GHG inventory")
    parts = []
    if s1 is not None:
        parts.append(f"Scope 1 (direct): {s1:,.2f} {u}")
    if s2 is not None:
        parts.append(f"Scope 2 (indirect): {s2:,.2f} {u}")
    total = (s1 or 0) + (s2 or 0)
    if parts:
        parts.append(f"Total Scope 1+2: {total:,.2f} {u}")
    parts.append(f"Source: {source}. Updated: {ghg.get('updated_at', 'N/A')}.")
    return " ".join(parts)


def _format_ghg_scope_3(ghg: Dict[str, Any]) -> str:
    """Format Scope 3 for disclosure content."""
    s3 = ghg.get("scope_3_tonnes_co2e")
    u = ghg.get("unit", "tCO2e")
    source = ghg.get("source", "Platform GHG inventory")
    if s3 is not None:
        return f"Scope 3 (value chain): {s3:,.2f} {u}. Source: {source}. Updated: {ghg.get('updated_at', 'N/A')}. B-15 implementation from FY2028."
    return (
        "Scope 3 (value chain) GHG emissions: disclosure expected from FY2028 per B-15 alignment "
        "with Canadian Sustainability Standards Board. Inventory record exists for this period; "
        "Scope 3 value not yet reported. Link or upload when available."
    )


# Global instance
audit_extension_service = AuditExtensionService()
