"""
BCP Generator — sector and scenario configuration.

Aligns sector/scenario keys with stressPlannerConfig and universal_stress_engine
for "Link to Stress Test" prefill. Used by bcp_prompts and bcp endpoint.
"""
from __future__ import annotations

from typing import Any

# Sector key -> critical_functions (name, rto, rpo, mtd), regulations by jurisdiction, key_roles
SECTOR_BCP_CONFIG: dict[str, dict[str, Any]] = {
    "insurance": {
        "critical_functions": [
            {"name": "Claims Processing", "rto": "4h", "rpo": "1h", "mtd": "24h"},
            {"name": "Policy Administration", "rto": "24h", "rpo": "4h", "mtd": "72h"},
            {"name": "Reinsurance Communication", "rto": "4h", "rpo": "1h", "mtd": "24h"},
            {"name": "Regulatory Reporting", "rto": "24h", "rpo": "8h", "mtd": "48h"},
            {"name": "Customer Service", "rto": "2h", "rpo": "0h", "mtd": "8h"},
        ],
        "regulations": {
            "EU": ["Solvency II", "DORA", "EIOPA Guidelines"],
            "Germany": ["MaRisk", "VAG", "BaFin Circulars"],
            "USA": ["State Insurance Regulations", "NAIC Guidelines"],
            "UK": ["PRA/FCA", "Solvency II", "Operational Resilience"],
            "Japan": ["FSA", "Insurance Business Act"],
        },
        "key_roles": ["Chief Risk Officer", "Claims Director", "IT Director", "Communications Lead"],
    },
    "healthcare": {
        "critical_functions": [
            {"name": "Emergency Care", "rto": "0h", "rpo": "0h", "mtd": "0h"},
            {"name": "ICU Operations", "rto": "0h", "rpo": "0h", "mtd": "0h"},
            {"name": "Surgical Services", "rto": "2h", "rpo": "0h", "mtd": "24h"},
            {"name": "Pharmacy Services", "rto": "1h", "rpo": "0h", "mtd": "4h"},
            {"name": "Patient Records Access", "rto": "15min", "rpo": "0h", "mtd": "1h"},
        ],
        "regulations": {
            "EU": ["MDR", "GDPR", "EU Health Threats Regulation"],
            "Germany": ["SGB V", "KHZG", "RKI Guidelines"],
            "USA": ["HIPAA", "Joint Commission", "CMS CoP"],
            "UK": ["CQC", "NHS Standards", "GDPR"],
            "Japan": ["MHLW", "Medical Care Act"],
        },
        "key_roles": ["Hospital Administrator", "Chief Medical Officer", "Emergency Director", "IT Director"],
    },
    "financial": {
        "critical_functions": [
            {"name": "Trading Continuity", "rto": "4h", "rpo": "0h", "mtd": "24h"},
            {"name": "Payment Systems", "rto": "2h", "rpo": "0h", "mtd": "8h"},
            {"name": "Customer Access", "rto": "4h", "rpo": "1h", "mtd": "24h"},
            {"name": "Regulatory Notification", "rto": "24h", "rpo": "4h", "mtd": "48h"},
            {"name": "Settlement", "rto": "24h", "rpo": "4h", "mtd": "72h"},
        ],
        "regulations": {
            "EU": ["DORA", "NIS2", "CRR/CRD", "EBA Guidelines"],
            "Germany": ["MaRisk", "BaFin", "KWG"],
            "USA": ["FFIEC", "SOX", "SEC", "Fed"],
            "UK": ["FCA/PRA", "Operational Resilience", "PSR"],
            "Japan": ["FSA", "JFSA Guidelines", "Payment Services Act"],
        },
        "key_roles": ["CRO", "COO", "CISO", "Head of Operations"],
    },
    "real_estate": {
        "critical_functions": [
            {"name": "Property Management", "rto": "24h", "rpo": "8h", "mtd": "72h"},
            {"name": "Tenant Services", "rto": "8h", "rpo": "2h", "mtd": "24h"},
            {"name": "Facilities & Safety", "rto": "4h", "rpo": "0h", "mtd": "24h"},
            {"name": "Financial Reporting", "rto": "48h", "rpo": "24h", "mtd": "72h"},
        ],
        "regulations": {
            "EU": ["GDPR", "Critical Entities Directive", "Environmental"],
            "Germany": ["BauGB", "EnEG", "Local zoning"],
            "USA": ["State regulations", "ADA", "EPA"],
            "UK": ["FCA", "Building Safety", "Fire Safety"],
            "Japan": ["Building Standards Act", "Real Estate Act"],
        },
        "key_roles": ["Property Director", "Facilities Manager", "Finance Director", "Risk Manager"],
    },
    "enterprise": {
        "critical_functions": [
            {"name": "Core Operations", "rto": "8h", "rpo": "4h", "mtd": "24h"},
            {"name": "Supply Chain", "rto": "24h", "rpo": "8h", "mtd": "72h"},
            {"name": "Customer Facing", "rto": "4h", "rpo": "1h", "mtd": "24h"},
            {"name": "Finance & Payroll", "rto": "48h", "rpo": "24h", "mtd": "72h"},
        ],
        "regulations": {
            "EU": ["GDPR", "NIS2", "CSDD"],
            "Germany": ["GDPR", "Local laws", "Labor"],
            "USA": ["SOX", "State laws", "Labor"],
            "UK": ["UK GDPR", "Companies Act", "Health & Safety"],
            "Japan": ["APPI", "Companies Act", "Labor Standards"],
        },
        "key_roles": ["COO", "CRO", "IT Director", "Head of Supply Chain"],
    },
    "defense": {
        "critical_functions": [
            {"name": "Command & Control", "rto": "0h", "rpo": "0h", "mtd": "0h"},
            {"name": "Logistics", "rto": "4h", "rpo": "2h", "mtd": "24h"},
            {"name": "Communications", "rto": "2h", "rpo": "0h", "mtd": "8h"},
            {"name": "Procurement", "rto": "72h", "rpo": "24h", "mtd": "1w"},
        ],
        "regulations": {
            "EU": ["Export control", "Critical entities", "Classified"],
            "Germany": ["ITAR compliance", "VS-NfD", "Procurement"],
            "USA": ["ITAR", "NISPOM", "DFARS"],
            "UK": ["UK Security", "Export Control", "Defence standards"],
            "Japan": ["Defense guidelines", "Export control", "Security"],
        },
        "key_roles": ["Crisis Commander", "Logistics Director", "Security Director", "Procurement Lead"],
    },
    "infrastructure": {
        "critical_functions": [
            {"name": "Service Continuity", "rto": "4h", "rpo": "0h", "mtd": "24h"},
            {"name": "Safety Systems", "rto": "0h", "rpo": "0h", "mtd": "0h"},
            {"name": "Maintenance & Repair", "rto": "24h", "rpo": "8h", "mtd": "72h"},
            {"name": "Public Communication", "rto": "1h", "rpo": "0h", "mtd": "4h"},
        ],
        "regulations": {
            "EU": ["NIS2", "Critical Entities Directive", "Safety"],
            "Germany": ["KRITIS", "BBK", "BNetzA"],
            "USA": ["FEMA", "NERC", "DHS"],
            "UK": ["NIS", "Civil Contingencies", "Sector regulators"],
            "Japan": ["Critical Infrastructure", "MLIT", "METI"],
        },
        "key_roles": ["Operations Director", "Safety Officer", "Maintenance Lead", "Communications"],
    },
    "government": {
        "critical_functions": [
            {"name": "Emergency Response", "rto": "0h", "rpo": "0h", "mtd": "0h"},
            {"name": "Citizen Services", "rto": "8h", "rpo": "4h", "mtd": "48h"},
            {"name": "Critical Records", "rto": "24h", "rpo": "8h", "mtd": "72h"},
            {"name": "Public Communication", "rto": "30min", "rpo": "0h", "mtd": "2h"},
        ],
        "regulations": {
            "EU": ["EU Civil Protection", "Critical Entities", "GDPR"],
            "Germany": ["ZSKG", "BBK", "Landeskatastrophenschutz"],
            "USA": ["FEMA", "Stafford Act", "NRF", "State laws"],
            "UK": ["Civil Contingencies Act", "NRF", "Cabinet Office"],
            "Japan": ["Disaster Countermeasures", "Cabinet Office", "Local gov"],
        },
        "key_roles": ["Emergency Director", "Department Heads", "Communications", "IT Director"],
    },
    "energy": {
        "critical_functions": [
            {"name": "Grid Stability", "rto": "0h", "rpo": "0h", "mtd": "0h"},
            {"name": "Generation", "rto": "4h", "rpo": "0h", "mtd": "24h"},
            {"name": "Distribution", "rto": "4h", "rpo": "0h", "mtd": "24h"},
            {"name": "Customer Billing", "rto": "72h", "rpo": "24h", "mtd": "1w"},
        ],
        "regulations": {
            "EU": ["NIS2", "REMIT", "Clean energy"],
            "Germany": ["EnWG", "BNetzA", "KRITIS"],
            "USA": ["FERC", "NERC", "State PUCs"],
            "UK": ["Ofgem", "NIS", "Energy Act"],
            "Japan": ["METI", "OCCTO", "Safety standards"],
        },
        "key_roles": ["Operations Director", "Grid Control", "Safety", "Communications"],
    },
    "manufacturing": {
        "critical_functions": [
            {"name": "Production", "rto": "24h", "rpo": "8h", "mtd": "72h"},
            {"name": "Supply Chain", "rto": "48h", "rpo": "24h", "mtd": "1w"},
            {"name": "Quality & Safety", "rto": "4h", "rpo": "0h", "mtd": "24h"},
            {"name": "Shipping & Logistics", "rto": "48h", "rpo": "8h", "mtd": "72h"},
        ],
        "regulations": {
            "EU": ["Machinery Directive", "REACH", "GDPR"],
            "Germany": ["ArbSchG", "BetrSichV", "Local"],
            "USA": ["OSHA", "EPA", "State"],
            "UK": ["HSE", "UK CA", "Export"],
            "Japan": ["Industrial Safety", "METI", "Labor"],
        },
        "key_roles": ["Plant Manager", "Supply Chain Director", "Quality", "Safety Officer"],
    },
    "technology": {
        "critical_functions": [
            {"name": "Platform Uptime", "rto": "4h", "rpo": "1h", "mtd": "24h"},
            {"name": "Data Integrity", "rto": "4h", "rpo": "0h", "mtd": "8h"},
            {"name": "Customer Access", "rto": "2h", "rpo": "0h", "mtd": "8h"},
            {"name": "Security & IR", "rto": "1h", "rpo": "0h", "mtd": "4h"},
        ],
        "regulations": {
            "EU": ["NIS2", "GDPR", "DORA", "AI Act"],
            "Germany": ["BSI", "GDPR", "KRITIS"],
            "USA": ["State privacy", "SOC2", "Sector-specific"],
            "UK": ["UK GDPR", "NIS", "NCSC"],
            "Japan": ["APPI", "ISC", "METI"],
        },
        "key_roles": ["CISO", "CTO", "SRE Lead", "Incident Commander"],
    },
    "city_region": {
        "critical_functions": [
            {"name": "Emergency Services (911)", "rto": "0h", "rpo": "0h", "mtd": "0h"},
            {"name": "Public Safety", "rto": "0h", "rpo": "0h", "mtd": "0h"},
            {"name": "Utilities Coordination", "rto": "1h", "rpo": "0h", "mtd": "4h"},
            {"name": "Public Communication", "rto": "30min", "rpo": "0h", "mtd": "2h"},
            {"name": "Transportation", "rto": "4h", "rpo": "1h", "mtd": "24h"},
        ],
        "regulations": {
            "EU": ["EU Civil Protection", "Critical Entities Directive"],
            "Germany": ["ZSKG", "BBK Guidelines", "Landeskatastrophenschutz"],
            "USA": ["FEMA Guidelines", "Stafford Act", "NRF"],
            "UK": ["Civil Contingencies", "NRF", "Local resilience"],
            "Japan": ["Disaster Countermeasures", "Cabinet Office", "Local"],
        },
        "key_roles": ["Mayor/Emergency Director", "Police Chief", "Fire Chief", "Public Works Director"],
    },
}

# Scenario key -> activation_criteria, immediate_actions, resources_needed, special_considerations
SCENARIO_BCP_SPECIFICS: dict[str, dict[str, Any]] = {
    "flood": {
        "activation_criteria": [
            "River level exceeds 4.5m warning threshold",
            "Weather service issues flood warning",
            "Dam/levee breach reported",
            "Significant rainfall (>100mm/24h) forecast",
        ],
        "immediate_actions": [
            "Activate flood barriers and sandbags",
            "Evacuate basement and ground floor",
            "Elevate critical equipment above flood level",
            "Activate pumping systems",
            "Secure hazardous materials",
            "Protect electrical systems",
        ],
        "resources_needed": ["Sandbags", "Pumps", "Generators", "Evacuation transport", "Emergency shelters"],
        "special_considerations": ["Water contamination", "Mold risk", "Structural assessment post-flood"],
    },
    "cyber": {
        "activation_criteria": [
            "Confirmed ransomware detection",
            "Unauthorized access to critical systems",
            "Data exfiltration detected",
            "DDoS attack affecting operations",
        ],
        "immediate_actions": [
            "Isolate affected systems from network",
            "Activate Security Operations Center (SOC)",
            "Preserve evidence for forensics",
            "Notify CISO and legal team",
            "Assess scope of compromise",
            "Activate offline backup systems",
        ],
        "resources_needed": ["Incident response team", "Forensic tools", "Offline backups", "Clean hardware"],
        "special_considerations": ["Regulatory notification (72h GDPR)", "Law enforcement coordination", "PR management"],
    },
    "pandemic": {
        "activation_criteria": [
            "WHO declares PHEIC",
            "National health emergency declared",
            "Confirmed cases among employees",
            "Supply chain disruption due to pandemic",
        ],
        "immediate_actions": [
            "Activate remote work protocols",
            "Implement health screening",
            "Increase cleaning/sanitation",
            "Assess critical on-site personnel",
            "Secure essential supplies (PPE, sanitizers)",
            "Update travel policies",
        ],
        "resources_needed": ["Remote work infrastructure", "PPE stockpile", "Health screening equipment", "Backup personnel"],
        "special_considerations": ["Employee health privacy", "Vaccination policies", "Long-term remote work sustainability"],
    },
    "seismic": {
        "activation_criteria": [
            "Earthquake magnitude threshold exceeded",
            "Tsunami warning issued",
            "Structural damage reported",
            "Utility outages (gas, water, power)",
        ],
        "immediate_actions": [
            "Drop, cover, hold; then evacuate if unsafe",
            "Account for all personnel",
            "Shut off gas if damaged",
            "Assess building integrity",
            "Activate backup communications",
            "Coordinate with emergency services",
        ],
        "resources_needed": ["Emergency kits", "Backup power", "Structural engineers", "Shelter", "Medical supplies"],
        "special_considerations": ["Aftershocks", "Tsunami follow-on", "Infrastructure damage", "Supply chain"],
    },
    "financial": {
        "activation_criteria": [
            "Liquidity stress above threshold",
            "Major counterparty default",
            "Market circuit breakers triggered",
            "Regulatory capital breach",
        ],
        "immediate_actions": [
            "Convene crisis treasury committee",
            "Activate liquidity contingency",
            "Notify regulator per timeline",
            "Secure funding lines",
            "Pause non-critical trading",
            "Communicate to investors",
        ],
        "resources_needed": ["Liquidity buffer", "Legal", "Communications", "Regulatory liaison"],
        "special_considerations": ["Market confidence", "Regulatory disclosure", "Cross-border coordination"],
    },
    "supply_chain": {
        "activation_criteria": [
            "Critical supplier disruption",
            "Key route blocked (e.g. canal, port)",
            "Raw material shortage",
            "Labor shortage at key node",
        ],
        "immediate_actions": [
            "Activate alternate suppliers",
            "Prioritize critical product lines",
            "Communicate with customers on lead times",
            "Secure buffer inventory",
            "Engage logistics alternatives",
        ],
        "resources_needed": ["Alternate suppliers", "Buffer stock", "Logistics partners", "Contract flexibility"],
        "special_considerations": ["Customer commitments", "Contractual penalties", "Long lead time items"],
    },
    "geopolitical": {
        "activation_criteria": [
            "Sanctions affecting operations",
            "Conflict in key region",
            "Trade barriers imposed",
            "Expropriation or asset freeze risk",
        ],
        "immediate_actions": [
            "Sanctions screening and compliance",
            "Diversify supply and sales",
            "Secure local legal advice",
            "Evacuate personnel if required",
            "Communicate with regulators and stakeholders",
        ],
        "resources_needed": ["Legal", "Compliance", "Insurance", "Government relations"],
        "special_considerations": ["Sanctions compliance", "Reputational risk", "Insurance coverage"],
    },
    "climate": {
        "activation_criteria": [
            "Extreme heat/cold warning",
            "Drought or water shortage",
            "Wildfire proximity",
            "Sea-level or coastal flood risk",
        ],
        "immediate_actions": [
            "Activate climate response plan",
            "Protect workforce (heat/cold protocols)",
            "Secure water and energy",
            "Coordinate with local authorities",
            "Assess physical asset exposure",
        ],
        "resources_needed": ["Cooling/heating", "Water", "Insurance", "Alternative sites"],
        "special_considerations": ["Long-term adaptation", "Disclosure (TCFD)", "Insurance availability"],
    },
    "regulatory": {
        "activation_criteria": [
            "New regulation effective",
            "Enforcement action or finding",
            "Capital or compliance shortfall",
            "Deadline for disclosure",
        ],
        "immediate_actions": [
            "Convene compliance and legal",
            "Assess gap and remediation plan",
            "Notify regulator if required",
            "Implement temporary controls",
            "Communicate to board and auditors",
        ],
        "resources_needed": ["Legal", "Compliance", "Audit", "Consultants"],
        "special_considerations": ["Deadlines", "Penalties", "Reputational impact"],
    },
    "energy": {
        "activation_criteria": [
            "Grid outage or blackout",
            "Fuel shortage",
            "Price spike affecting operations",
            "Critical facility power loss",
        ],
        "immediate_actions": [
            "Activate backup power",
            "Reduce non-essential load",
            "Coordinate with utility",
            "Protect critical systems",
            "Communicate to staff and customers",
        ],
        "resources_needed": ["Generators", "Fuel", "Batteries", "Alternative sites"],
        "special_considerations": ["Cascade failures", "Cold start", "Regulatory reporting"],
    },
    "fire": {
        "activation_criteria": [
            "Fire on site or adjacent",
            "Wildfire evacuation order",
            "Smoke or hazardous fumes",
            "Sprinkler/ suppression activation",
        ],
        "immediate_actions": [
            "Evacuate per plan",
            "Account for personnel",
            "Call fire services",
            "Shut down critical systems if safe",
            "Activate backup site if needed",
        ],
        "resources_needed": ["Evacuation routes", "Backup site", "Fire suppression", "Insurance"],
        "special_considerations": ["Air quality", "Rebuild timeline", "Data recovery"],
    },
    "political": {
        "activation_criteria": [
            "Election or regime change",
            "Policy shift affecting operations",
            "Expropriation risk",
            "Travel or visa restrictions",
        ],
        "immediate_actions": [
            "Monitor and assess impact",
            "Engage government relations",
            "Diversify exposure",
            "Secure legal advice",
            "Update stakeholder communication",
        ],
        "resources_needed": ["Government relations", "Legal", "Insurance", "Scenario planning"],
        "special_considerations": ["Reputation", "Contract stability", "Exit options"],
    },
    "military": {
        "activation_criteria": [
            "Conflict in operating region",
            "Military escalation",
            "Evacuation order",
            "Asset or personnel at risk",
        ],
        "immediate_actions": [
            "Evacuate personnel",
            "Secure assets and data",
            "Comply with sanctions",
            "Activate crisis team",
            "Communicate with home country and insurers",
        ],
        "resources_needed": ["Evacuation plan", "Insurance", "Legal", "Diplomatic support"],
        "special_considerations": ["Personnel safety", "Asset recovery", "Sanctions"],
    },
    "social": {
        "activation_criteria": [
            "Civil unrest in region",
            "Strike affecting operations",
            "Community opposition",
            "Labor shortage or dispute",
        ],
        "immediate_actions": [
            "Ensure personnel safety",
            "Engage community and labor",
            "Secure sites",
            "Adjust operations as needed",
            "Communicate with stakeholders",
        ],
        "resources_needed": ["Security", "HR", "Community relations", "Legal"],
        "special_considerations": ["Reputation", "Labor law", "Long-term relations"],
    },
    "protest": {
        "activation_criteria": [
            "Protest at or near site",
            "Blockade of access",
            "Threat to personnel or property",
            "Media attention",
        ],
        "immediate_actions": [
            "Ensure safety of staff",
            "Avoid escalation",
            "Coordinate with law enforcement",
            "Secure premises",
            "Communicate with media and stakeholders",
        ],
        "resources_needed": ["Security", "Legal", "Communications", "Alternative access"],
        "special_considerations": ["Reputation", "De-escalation", "Legal liability"],
    },
    "civil_unrest": {
        "activation_criteria": [
            "Widespread unrest in region",
            "Curfew or movement restrictions",
            "Violence or looting",
            "Government instability",
        ],
        "immediate_actions": [
            "Evacuate non-essential personnel",
            "Secure assets and data",
            "Activate backup site",
            "Communicate with staff and home office",
            "Comply with local orders",
        ],
        "resources_needed": ["Evacuation", "Security", "Backup site", "Insurance"],
        "special_considerations": ["Personnel safety", "Asset protection", "Insurance claims"],
    },
    "uprising": {
        "activation_criteria": [
            "Regime change or attempted",
            "Armed conflict",
            "Breakdown of order",
            "Evacuation order",
        ],
        "immediate_actions": [
            "Evacuate personnel",
            "Secure critical data and assets",
            "Comply with sanctions",
            "Activate crisis team and home office",
            "Communicate with insurers and regulators",
        ],
        "resources_needed": ["Evacuation", "Security", "Legal", "Insurance"],
        "special_considerations": ["Personnel safety", "Asset recovery", "Sanctions compliance"],
    },
}


def get_sector_bcp_config(sector: str) -> dict[str, Any] | None:
    """Return BCP config for sector key (e.g. insurance, city_region)."""
    key = (sector or "").strip().lower().replace("-", "_")
    return SECTOR_BCP_CONFIG.get(key)


def get_scenario_bcp_specifics(scenario: str) -> dict[str, Any] | None:
    """Return scenario-specific BCP config (e.g. flood, cyber)."""
    key = (scenario or "").strip().lower().replace(" ", "_")
    return SCENARIO_BCP_SPECIFICS.get(key)
