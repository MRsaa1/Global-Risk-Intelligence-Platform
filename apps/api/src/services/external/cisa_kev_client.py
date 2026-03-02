"""
CISA KEV & MITRE ATT&CK Client (P3c)
======================================

Fetches cyber threat intelligence from:
1. CISA Known Exploited Vulnerabilities (KEV) catalog — actively exploited CVEs
2. MITRE ATT&CK TAXII feed — adversary techniques and mitigations
3. NVD (National Vulnerability Database) — CVE details

Used by the AI/Cyber risk module and ASGI for threat monitoring.
Cache: 6 hours TTL (KEV updated ~daily, ATT&CK quarterly).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# CISA KEV — JSON catalog of actively exploited CVEs
CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
# NVD CVE API 2.0
NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
# MITRE ATT&CK STIX via CDN
ATTACK_ENTERPRISE_URL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"

REQUEST_TIMEOUT = 45.0
CACHE_TTL_HOURS = 6


@dataclass
class ExploitedVulnerability:
    """A known exploited vulnerability from CISA KEV."""
    cve_id: str
    vendor: str
    product: str
    name: str
    description: str
    date_added: str  # when CISA added it
    due_date: str  # remediation deadline
    known_ransomware: bool = False
    severity: str = ""  # critical, high, medium, low
    cvss_score: float = 0.0
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cve_id": self.cve_id,
            "vendor": self.vendor,
            "product": self.product,
            "name": self.name,
            "description": self.description[:300],
            "date_added": self.date_added,
            "due_date": self.due_date,
            "known_ransomware": self.known_ransomware,
            "severity": self.severity,
            "cvss_score": self.cvss_score,
        }


@dataclass
class CyberThreatSummary:
    """Summary of current cyber threat landscape."""
    total_kev_count: int
    recent_kev_count: int  # last 30 days
    critical_count: int
    ransomware_count: int
    top_vendors: List[Dict[str, Any]]
    recent_vulnerabilities: List[ExploitedVulnerability]
    threat_level: str  # low, moderate, elevated, high, critical
    fetched_at: str = ""
    success: bool = True
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_kev_count": self.total_kev_count,
            "recent_kev_count": self.recent_kev_count,
            "critical_count": self.critical_count,
            "ransomware_count": self.ransomware_count,
            "top_vendors": self.top_vendors,
            "recent_vulnerabilities": [v.to_dict() for v in self.recent_vulnerabilities[:20]],
            "threat_level": self.threat_level,
            "fetched_at": self.fetched_at,
            "success": self.success,
            "error": self.error,
        }


@dataclass
class AttackTechnique:
    """MITRE ATT&CK technique."""
    technique_id: str
    name: str
    tactic: str
    description: str = ""
    platforms: List[str] = field(default_factory=list)
    detection: str = ""
    mitigations: List[str] = field(default_factory=list)


# In-memory cache
_cache: Dict[str, Any] = {}
_cache_ts: Dict[str, datetime] = {}


def _cache_get(key: str) -> Optional[Any]:
    ts = _cache_ts.get(key)
    if ts and (datetime.utcnow() - ts).total_seconds() < CACHE_TTL_HOURS * 3600:
        return _cache.get(key)
    return None


def _cache_set(key: str, value: Any):
    _cache[key] = value
    _cache_ts[key] = datetime.utcnow()


async def fetch_cisa_kev(days_back: int = 90) -> CyberThreatSummary:
    """
    Fetch CISA Known Exploited Vulnerabilities catalog.

    Args:
        days_back: Filter to vulnerabilities added in the last N days
    """
    cache_key = f"cisa_kev:{days_back}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(CISA_KEV_URL)
            resp.raise_for_status()
            data = resp.json()

        catalog = data.get("vulnerabilities", [])
        cutoff = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")

        all_vulns: List[ExploitedVulnerability] = []
        recent_vulns: List[ExploitedVulnerability] = []
        vendor_counts: Dict[str, int] = {}

        for item in catalog:
            vuln = ExploitedVulnerability(
                cve_id=item.get("cveID", ""),
                vendor=item.get("vendorProject", ""),
                product=item.get("product", ""),
                name=item.get("vulnerabilityName", ""),
                description=item.get("shortDescription", ""),
                date_added=item.get("dateAdded", ""),
                due_date=item.get("dueDate", ""),
                known_ransomware=item.get("knownRansomwareCampaignUse", "Unknown") == "Known",
                notes=item.get("notes", ""),
            )
            all_vulns.append(vuln)
            vendor_counts[vuln.vendor] = vendor_counts.get(vuln.vendor, 0) + 1

            if vuln.date_added >= cutoff:
                recent_vulns.append(vuln)

        # Sort recent by date (newest first)
        recent_vulns.sort(key=lambda v: v.date_added, reverse=True)

        # Classify severity based on ransomware usage and recency
        critical_count = sum(1 for v in recent_vulns if v.known_ransomware)
        ransomware_total = sum(1 for v in all_vulns if v.known_ransomware)

        # Top vendors
        top_vendors = [
            {"vendor": v, "count": c}
            for v, c in sorted(vendor_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        # Threat level based on recent activity
        if len(recent_vulns) >= 30 or critical_count >= 10:
            threat_level = "critical"
        elif len(recent_vulns) >= 20 or critical_count >= 5:
            threat_level = "high"
        elif len(recent_vulns) >= 10:
            threat_level = "elevated"
        elif len(recent_vulns) >= 5:
            threat_level = "moderate"
        else:
            threat_level = "low"

        summary = CyberThreatSummary(
            total_kev_count=len(all_vulns),
            recent_kev_count=len(recent_vulns),
            critical_count=critical_count,
            ransomware_count=ransomware_total,
            top_vendors=top_vendors,
            recent_vulnerabilities=recent_vulns,
            threat_level=threat_level,
            fetched_at=datetime.utcnow().isoformat(),
        )

        _cache_set(cache_key, summary)
        return summary

    except Exception as e:
        logger.warning("CISA KEV fetch failed: %s", e)
        return CyberThreatSummary(
            total_kev_count=0, recent_kev_count=0, critical_count=0,
            ransomware_count=0, top_vendors=[], recent_vulnerabilities=[],
            threat_level="unknown", fetched_at=datetime.utcnow().isoformat(),
            success=False, error=str(e),
        )


async def fetch_attack_techniques(tactic: Optional[str] = None) -> List[AttackTechnique]:
    """
    Fetch MITRE ATT&CK Enterprise techniques.

    Args:
        tactic: Optional filter by tactic name (e.g. 'initial-access', 'execution')
    """
    cache_key = f"attack_techniques:{tactic}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(ATTACK_ENTERPRISE_URL)
            resp.raise_for_status()
            data = resp.json()

        techniques: List[AttackTechnique] = []
        objects = data.get("objects", [])

        for obj in objects:
            if obj.get("type") != "attack-pattern":
                continue
            if obj.get("revoked", False) or obj.get("x_mitre_deprecated", False):
                continue

            ext_refs = obj.get("external_references", [])
            technique_id = ""
            for ref in ext_refs:
                if ref.get("source_name") == "mitre-attack":
                    technique_id = ref.get("external_id", "")
                    break

            kill_chain = obj.get("kill_chain_phases", [])
            tactics = [kc.get("phase_name", "") for kc in kill_chain]
            tactic_str = ", ".join(tactics)

            if tactic and tactic.lower() not in tactic_str.lower():
                continue

            techniques.append(AttackTechnique(
                technique_id=technique_id,
                name=obj.get("name", ""),
                tactic=tactic_str,
                description=(obj.get("description", "") or "")[:500],
                platforms=obj.get("x_mitre_platforms", []),
            ))

        techniques.sort(key=lambda t: t.technique_id)
        _cache_set(cache_key, techniques)
        return techniques

    except Exception as e:
        logger.warning("MITRE ATT&CK fetch failed: %s", e)
        return []
