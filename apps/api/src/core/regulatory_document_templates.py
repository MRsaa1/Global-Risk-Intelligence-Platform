"""
Regulatory document templates — single source of truth for section order, official titles,
mandatory flags, and legal citation per framework. Used by disclosure packages and PDF generation.
"""
from __future__ import annotations

from typing import Any, Dict, List

# Template: framework_id -> legal_citation, sections (id, title, mandatory), optional opening/closing
REGULATORY_DOCUMENT_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "TCFD": {
        "legal_citation": "TCFD Recommendations (2017), Final Report of the Task Force on Climate-related Financial Disclosures",
        "name": "Task Force on Climate-related Financial Disclosures",
        "sections": [
            {"id": "governance", "title": "Governance", "mandatory": True, "description": "Board and management oversight of climate risks"},
            {"id": "strategy", "title": "Strategy", "mandatory": True, "description": "Climate-related risks, opportunities, and scenario analysis"},
            {"id": "risk_management", "title": "Risk Management", "mandatory": True, "description": "Processes for identifying and managing climate risks"},
            {"id": "metrics", "title": "Metrics and Targets", "mandatory": True, "description": "Climate-related metrics, targets, and performance"},
        ],
        "opening_statement": "This disclosure has been prepared in accordance with the recommendations of the Task Force on Climate-related Financial Disclosures (TCFD).",
        "closing_statement": None,
    },
    "OSFI_B15": {
        "legal_citation": "OSFI Guideline B-15: Climate Risk Management",
        "name": "OSFI Guideline B-15: Climate Risk Management",
        "sections": [
            {"id": "governance", "title": "Governance and Strategy", "mandatory": True, "description": "Board-level climate governance"},
            {"id": "risk_management", "title": "Risk Management", "mandatory": True, "description": "Climate risk integration into ERM"},
            {"id": "scenario_analysis", "title": "Scenario Analysis", "mandatory": True, "description": "Climate stress testing results"},
            {"id": "disclosure", "title": "Disclosure", "mandatory": True, "description": "Climate risk disclosure requirements"},
            {"id": "transition_plan", "title": "Climate Transition Plan", "mandatory": True, "description": "Plans addressing financial risks from transition to low-GHG economy (B-15 Ch.2)"},
            {"id": "ghg_scope_1_2", "title": "Scope 1 & 2 GHG Emissions", "mandatory": True, "description": "Direct and indirect GHG emissions disclosure (B-15)"},
            {"id": "ghg_scope_3", "title": "Scope 3 GHG Emissions", "mandatory": False, "description": "Value chain GHG emissions (B-15; implementation from FY2028)"},
            {"id": "metrics_and_targets", "title": "Metrics and Targets", "mandatory": True, "description": "Climate-related metrics, targets, and performance (TCFD-aligned)"},
        ],
        "opening_statement": "This report has been prepared in accordance with OSFI Guideline B-15 (Climate Risk Management).",
        "closing_statement": None,
    },
    "EBA": {
        "legal_citation": "EBA Guidelines on management and supervision of ESG risks (EBA/GL/2022/06)",
        "name": "EBA Guidelines on Management of ESG Risks",
        "sections": [
            {"id": "identification", "title": "Risk Identification", "mandatory": True, "description": "ESG risk identification processes"},
            {"id": "measurement", "title": "Risk Measurement", "mandatory": True, "description": "ESG risk quantification"},
            {"id": "monitoring", "title": "Monitoring and Reporting", "mandatory": True, "description": "Ongoing ESG risk monitoring"},
            {"id": "stress_testing", "title": "Stress Testing", "mandatory": True, "description": "Climate scenario stress testing"},
            {"id": "materiality_assessment", "title": "Materiality Assessment", "mandatory": True, "description": "Exposure/portfolio/sector/scenario-based ESG materiality"},
            {"id": "transition_plan", "title": "Transition Planning", "mandatory": True, "description": "Plans for financial risks from transition to ESG objectives"},
            {"id": "metrics_and_targets", "title": "Metrics and Targets", "mandatory": True, "description": "Climate-related metrics and targets (10-year+ horizon)"},
        ],
        "opening_statement": "This document has been prepared in accordance with the EBA Guidelines on management and supervision of ESG risks (EBA/GL/2022/06).",
        "closing_statement": None,
    },
    "CSA_NI_51_107": {
        "legal_citation": "CSA National Instrument 51-107: Disclosure of Climate-related Matters",
        "name": "CSA National Instrument 51-107",
        "sections": [
            {"id": "governance", "title": "Governance", "mandatory": True, "description": "Climate governance disclosure"},
            {"id": "strategy", "title": "Strategy", "mandatory": True, "description": "Climate strategy and resilience"},
            {"id": "risk_management", "title": "Risk Management", "mandatory": True, "description": "Climate risk management processes"},
            {"id": "ghg_emissions", "title": "GHG Emissions", "mandatory": True, "description": "Scope 1, 2, 3 emissions reporting"},
        ],
        "opening_statement": "This disclosure has been prepared in accordance with CSA National Instrument 51-107 (Disclosure of Climate-related Matters).",
        "closing_statement": None,
    },
    "MUNICIPAL_INSURABILITY": {
        "legal_citation": "Municipal / sub-sovereign climate risk disclosure (Platform standard)",
        "name": "Municipal Climate Insurability",
        "sections": [
            {"id": "governance", "title": "Governance", "mandatory": True, "description": "Municipal governance of climate risk and insurability"},
            {"id": "exposure", "title": "Exposure & Stress Scenarios", "mandatory": True, "description": "Hazard exposure, AEL, 100-year loss, stress test results"},
            {"id": "disclosure", "title": "Disclosure", "mandatory": True, "description": "Climate risk disclosure requirements for insurers/regulators"},
        ],
        "opening_statement": "This Municipal Climate Insurability Report has been prepared in accordance with platform standards for sub-sovereign climate risk disclosure.",
        "closing_statement": None,
    },
    "SEC_CLIMATE": {
        "legal_citation": "SEC Climate Disclosure Rules (17 CFR 229.1500 et seq.)",
        "name": "SEC Climate Disclosure Rules",
        "sections": [
            {"id": "risk_factors", "title": "Climate Risk Factors", "mandatory": True, "description": "Material climate risk factor disclosure"},
            {"id": "financial_impact", "title": "Financial Impact", "mandatory": True, "description": "Climate-related financial statement impacts"},
            {"id": "ghg_emissions", "title": "GHG Emissions", "mandatory": True, "description": "Scope 1 and 2 emissions"},
            {"id": "targets", "title": "Climate Targets", "mandatory": True, "description": "Climate-related targets and transition plans"},
        ],
        "opening_statement": "This disclosure has been prepared in accordance with the SEC rules on climate-related disclosures.",
        "closing_statement": None,
    },
}


def get_template(framework_id: str) -> Dict[str, Any] | None:
    """Return the document template for a framework, or None if unknown."""
    return REGULATORY_DOCUMENT_TEMPLATES.get(framework_id)


def get_sections_in_order(framework_id: str) -> List[Dict[str, Any]]:
    """Return sections in the order required by the regulation."""
    t = get_template(framework_id)
    if not t:
        return []
    return t.get("sections", [])


def get_mandatory_section_ids(framework_id: str) -> List[str]:
    """Return list of section IDs that are mandatory for this framework."""
    sections = get_sections_in_order(framework_id)
    return [s["id"] for s in sections if s.get("mandatory", True)]


def get_legal_citation(framework_id: str) -> str:
    """Return short legal citation for the framework."""
    t = get_template(framework_id)
    return t.get("legal_citation", framework_id) if t else framework_id


def get_opening_statement(framework_id: str) -> str | None:
    """Return canonical opening statement for the framework."""
    t = get_template(framework_id)
    return t.get("opening_statement") if t else None
