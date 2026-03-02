"""
Regulatory Compliance Layer for stress tests.

Maps entity type + jurisdiction to applicable regulations (NIS2, DORA, Solvency II,
EBA/TCFD, etc.) and returns required metrics and disclosure flags for reports.
Provides get_applicable_frameworks() for Compliance Dashboard and stress-test verification.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

# Entity type -> list of applicable regulation IDs
ENTITY_REGULATIONS: Dict[str, List[str]] = {
    "HEALTHCARE": ["MDR", "GDPR", "EU_Pharmacovigilance", "SGB_V", "Krankenhausfinanzierungsgesetz"],
    "FINANCIAL": ["CRD_V", "CRR_II", "Solvency_II", "DORA", "EBA_Climate", "TCFD", "Basel_IV", "KWG", "VAG", "MaRisk"],
    "INFRASTRUCTURE": ["NIS2", "EU_Cyber_Resilience_Act", "Critical_Infrastructure"],
    "AIRPORT": ["NIS2", "EU_Cyber_Resilience_Act", "Aviation_Regulation"],
    "GOVERNMENT": ["GDPR", "Public_Sector_Directive"],
    "REAL_ESTATE": ["TCFD", "CSRD", "Building_Codes"],
    "DEFENSE": ["NIS2", "Defense_Classification"],
    "ENTERPRISE": ["CSRD", "TCFD", "Supply_Chain_Due_Diligence"],
    "CITY_REGION": ["TCFD", "NGFS", "EBA_Climate"],
}

# Regulation ID -> short label and required metrics hint
REGULATION_LABELS: Dict[str, Dict[str, str]] = {
    "NIS2": {"label": "NIS2 Directive", "metrics": "incident reporting, resilience"},
    "DORA": {"label": "DORA (Digital Operational Resilience)", "metrics": "ICT risk, incident reporting"},
    "Solvency_II": {"label": "Solvency II", "metrics": "SCR, Solvency Ratio"},
    "EBA_Climate": {"label": "EBA Climate Risk", "metrics": "climate exposure, transition risk"},
    "TCFD": {"label": "TCFD", "metrics": "governance, strategy, risk, metrics"},
    "CRD_V": {"label": "CRD V", "metrics": "capital, liquidity"},
    "CRR_II": {"label": "CRR II", "metrics": "capital requirements"},
    "CSRD": {"label": "CSRD", "metrics": "sustainability reporting"},
    "GDPR": {"label": "GDPR", "metrics": "data protection"},
    "MDR": {"label": "Medical Device Regulation", "metrics": "device safety"},
    "Basel_IV": {"label": "Basel IV", "metrics": "capital, credit risk"},
    "KWG": {"label": "KWG (Germany)", "metrics": "banking supervision"},
    "VAG": {"label": "VAG (Germany)", "metrics": "insurance supervision"},
    "MaRisk": {"label": "MaRisk", "metrics": "risk management"},
    "NGFS": {"label": "NGFS Scenarios", "metrics": "climate scenarios"},
    # Japan
    "FSA_Japan": {"label": "FSA Japan", "metrics": "financial stability, disclosure"},
    "JFSA": {"label": "JFSA (Japan FSA)", "metrics": "banking/insurance supervision"},
    "BOJ": {"label": "BOJ (Bank of Japan)", "metrics": "financial system, stress tests"},
    # USA
    "SEC": {"label": "SEC", "metrics": "disclosure, climate"},
    "OCC": {"label": "OCC", "metrics": "banking supervision"},
    "FEMA": {"label": "FEMA", "metrics": "disaster preparedness, flood"},
    # Canada
    "OSFI_B15": {"label": "OSFI B-15", "metrics": "climate risk, disclosure"},
    "CSA_NI_51_107": {"label": "CSA NI 51-107", "metrics": "climate-related disclosure"},
}

# Regulation ID -> Compliance Dashboard framework_id (used by dashboard and compliance agent)
REGULATION_TO_DASHBOARD_FRAMEWORK: Dict[str, str] = {
    "Basel_IV": "basel",
    "CRR_II": "basel",
    "CRD_V": "basel",
    "Solvency_II": "solvency_ii",
    "TCFD": "tcfd",
    "EBA_Climate": "tcfd",
    "NGFS": "tcfd",
    "ISSB": "issb",
    "CSRD": "tcfd",
    "SEC_CLIMATE": "tcfd",
    "OSFI_B15": "tcfd",
    "CSA_NI_51_107": "tcfd",
    "DORA": "dora",
    "NIS2": "nis2",
    "EU_AI_ACT": "eu_ai_act",
    "GDPR": "gdpr",
}

# Dashboard framework_id -> display name and domain (for get_applicable_frameworks)
DASHBOARD_FRAMEWORK_META: Dict[str, Dict[str, str]] = {
    "basel": {"name": "Basel III / IV", "domain": "financial"},
    "solvency_ii": {"name": "Solvency II", "domain": "financial"},
    "tcfd": {"name": "TCFD", "domain": "climate"},
    "issb": {"name": "ISSB S1 / S2", "domain": "climate"},
    "dora": {"name": "DORA", "domain": "cyber"},
    "nis2": {"name": "NIS2", "domain": "cyber"},
    "eu_ai_act": {"name": "EU AI Act", "domain": "ai"},
    "gdpr": {"name": "GDPR", "domain": "privacy"},
}

# Jurisdiction -> regulations for CITY_REGION (override EU defaults)
JURISDICTION_CITY_REGION_REGULATIONS: Dict[str, List[str]] = {
    "Japan": ["FSA_Japan", "JFSA", "BOJ", "TCFD"],
    "USA": ["SEC", "OCC", "FEMA", "TCFD"],
    "UK": ["TCFD", "NGFS", "EBA_Climate"],
    "EU": ["TCFD", "NGFS", "EBA_Climate"],
    "Australia": ["TCFD", "NGFS"],
    "Canada": ["TCFD", "NGFS", "OSFI_B15", "CSA_NI_51_107"],
}


@dataclass
class RegulatoryContext:
    """Applicable regulations and disclosure requirements for an entity."""
    entity_type: str
    jurisdiction: str
    regulations: List[str]
    disclosure_required: bool
    required_metrics: List[str]
    labels: Dict[str, str] = field(default_factory=dict)


def get_applicable_regulations(
    entity_type: str,
    jurisdiction: str = "EU",
    severity: float = 0.0,
) -> RegulatoryContext:
    """
    Return applicable regulations for entity type and jurisdiction.
    disclosure_required is True when severity > 0.5 or entity is FINANCIAL/INFRASTRUCTURE.
    Japan -> FSA Japan, JFSA, BOJ; USA -> SEC, OCC, FEMA; EU -> TCFD, NGFS, EBA.
    """
    regulations = list(ENTITY_REGULATIONS.get(entity_type, []))
    if not regulations and entity_type == "CITY_REGION":
        jurisdiction_key = jurisdiction if jurisdiction in JURISDICTION_CITY_REGION_REGULATIONS else "EU"
        regulations = list(JURISDICTION_CITY_REGION_REGULATIONS.get(jurisdiction_key, ["TCFD", "NGFS", "EBA_Climate"]))
    labels = {rid: REGULATION_LABELS.get(rid, {}).get("label", rid) for rid in regulations}
    required_metrics = []
    for rid in regulations:
        m = REGULATION_LABELS.get(rid, {}).get("metrics")
        if m:
            required_metrics.append(f"{REGULATION_LABELS.get(rid, {}).get('label', rid)}: {m}")
    disclosure_required = severity > 0.5 or entity_type in ("FINANCIAL", "INFRASTRUCTURE", "HEALTHCARE")
    return RegulatoryContext(
        entity_type=entity_type,
        jurisdiction=jurisdiction,
        regulations=regulations,
        disclosure_required=disclosure_required,
        required_metrics=required_metrics[:10],
        labels=labels,
    )


def get_applicable_frameworks(
    entity_type: str,
    jurisdiction: str = "EU",
    severity: float = 0.0,
) -> List[Dict[str, Any]]:
    """
    Return list of Compliance Dashboard framework_ids applicable for this entity and jurisdiction.
    Each item: { "framework_id": str, "name": str, "domain": str }.
    """
    ctx = get_applicable_regulations(entity_type, jurisdiction, severity)
    seen: Dict[str, bool] = {}
    out: List[Dict[str, Any]] = []
    for rid in ctx.regulations:
        fw_id = REGULATION_TO_DASHBOARD_FRAMEWORK.get(rid)
        if not fw_id or seen.get(fw_id):
            continue
        seen[fw_id] = True
        meta = DASHBOARD_FRAMEWORK_META.get(fw_id, {"name": fw_id, "domain": "other"})
        out.append({
            "framework_id": fw_id,
            "name": meta["name"],
            "domain": meta["domain"],
        })
    return out


def validate_stress_test_results(
    entity_type: str,
    results: dict,
) -> Dict[str, any]:
    """
    Check stress test results against regulatory thresholds (e.g. Solvency II).
    Returns dict with violations list and compliance flag.
    """
    violations = []
    if entity_type == "FINANCIAL":
        solvency_ratio = results.get("solvency_ratio")
        if solvency_ratio is not None and float(solvency_ratio) < 1.0:
            violations.append({
                "regulation": "Solvency II",
                "threshold": 1.0,
                "actual": solvency_ratio,
                "message": "Solvency ratio below 100%",
            })
    return {
        "compliant": len(violations) == 0,
        "violations": violations,
        "entity_type": entity_type,
    }
