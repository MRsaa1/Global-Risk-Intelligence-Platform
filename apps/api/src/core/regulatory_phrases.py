"""
Mandatory regulatory phrases per framework: opening/closing statements and definitions.
Used in PDF headers and disclosure exports so wording is legally consistent.
"""
from __future__ import annotations

from typing import Dict, List

# Opening statement template: "This document has been prepared in accordance with [citation]. It is for [use]."
OPENING_TEMPLATE = (
    "This document has been prepared in accordance with {legal_citation}. "
    "It is for {use}."
)
USE_INTERNAL = "internal risk management and disclosure purposes; not for regulatory submission without separate review"
USE_REGULATORY = "regulatory submission as required by applicable law"

# Per-framework opening (overrides template when present)
FRAMEWORK_OPENING: Dict[str, str] = {
    "TCFD": "This disclosure has been prepared in accordance with the recommendations of the Task Force on Climate-related Financial Disclosures (TCFD).",
    "OSFI_B15": "This report has been prepared in accordance with OSFI Guideline B-15 (Climate Risk Management).",
    "EBA": "This document has been prepared in accordance with the EBA Guidelines on management and supervision of ESG risks (EBA/GL/2022/06).",
    "CSA_NI_51_107": "This disclosure has been prepared in accordance with CSA National Instrument 51-107 (Disclosure of Climate-related Matters).",
    "SEC_CLIMATE": "This disclosure has been prepared in accordance with the SEC rules on climate-related disclosures.",
}

# Definitions (e.g. TCFD glossary) — key -> definition text
DEFINITIONS: Dict[str, Dict[str, str]] = {
    "TCFD": {
        "physical_risk": "Physical risk: Risks related to the physical impacts of climate change (acute and chronic), including on operations, supply chains, and assets.",
        "transition_risk": "Transition risk: Risks related to the transition to a lower-carbon economy, including policy, legal, technology, and market changes.",
        "governance": "Governance: The organization's governance around climate-related risks and opportunities.",
        "strategy": "Strategy: The actual and potential impacts of climate-related risks and opportunities on strategy and financial planning.",
        "risk_management": "Risk management: How the organization identifies, assesses, and manages climate-related risks.",
        "metrics_and_targets": "Metrics and targets: Metrics and targets used to assess and manage climate-related risks and opportunities.",
    },
    "EBA": {
        "esg_risks": "ESG risks: Environmental, Social and Governance risks that may impact the risk profile of institutions.",
    },
}

# Closing / regulatory submission disclaimer when document is marked "final" for submission
CLOSING_FOR_SUBMISSION = (
    "This document is intended for regulatory submission as required. "
    "It has been prepared in good faith; the organization remains responsible for its accuracy and completeness."
)
CLOSING_DRAFT = (
    "Draft document. Not for regulatory submission until all mandatory sections are complete and reviewed."
)


def get_opening_phrase(framework_id: str, for_regulatory_submission: bool = False) -> str:
    """Return the opening phrase for a document under the given framework."""
    if framework_id in FRAMEWORK_OPENING:
        base = FRAMEWORK_OPENING[framework_id]
        use = USE_REGULATORY if for_regulatory_submission else USE_INTERNAL
        return f"{base} It is for {use}."
    from src.core.regulatory_document_templates import get_legal_citation
    citation = get_legal_citation(framework_id)
    use = USE_REGULATORY if for_regulatory_submission else USE_INTERNAL
    return OPENING_TEMPLATE.format(legal_citation=citation, use=use)


def get_definitions(framework_id: str) -> List[str]:
    """Return list of definition strings to include when needed (e.g. appendix)."""
    defs = DEFINITIONS.get(framework_id, {})
    return list(defs.values())


def get_closing_phrase(for_regulatory_submission: bool = False, is_draft: bool = False) -> str:
    """Return closing phrase: draft vs final for submission."""
    if is_draft:
        return CLOSING_DRAFT
    if for_regulatory_submission:
        return CLOSING_FOR_SUBMISSION
    return CLOSING_DRAFT
