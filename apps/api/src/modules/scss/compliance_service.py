"""
SCSS Phase 6: Compliance — sanctions screening (OFAC/EU), match review.

- Sanctions lists: stub built-in list; when SCSS_OFAC_API_URL / SCSS_EU_SANCTIONS_URL are set, fetches real lists
- Screen all suppliers on schedule or on-demand
- Match review: pending → reviewed/cleared, notes, reviewed_by
"""
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Supplier, SanctionsMatch

logger = logging.getLogger(__name__)

# Stub: built-in list for demo when no API is configured
_BUILTIN_SANCTIONS_STUB_NAMES = frozenset({
    "sanctions demo",
    "test sanctioned",
    "ofac sample",
    "eu list sample",
})


def _normalize_name(name: str) -> str:
    """Normalize for fuzzy match (lowercase, collapse spaces)."""
    if not name:
        return ""
    return " ".join(re.split(r"\s+", name.lower().strip()))


async def _fetch_ofac_list() -> Tuple[Set[str], str]:
    """
    Fetch OFAC SDN (or mirror) list. Expects API to return JSON with names or aliases.
    Config: SCSS_OFAC_API_URL, SCSS_OFAC_API_KEY (optional).
    Returns (set of normalized names, list_source label).
    """
    try:
        from src.core.config import get_settings
        settings = get_settings()
        url = (settings.scss_ofac_api_url or "").strip()
        if not url:
            return set(), ""
        import httpx
        headers = {"Accept": "application/json"}
        if (settings.scss_ofac_api_key or "").strip():
            headers["Authorization"] = f"Bearer {settings.scss_ofac_api_key.strip()}"
            if settings.scss_ofac_api_key.strip().startswith("Basic "):
                headers["Authorization"] = settings.scss_ofac_api_key.strip()
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            data = r.json()
        # Common shapes: { "sdn": [ { "firstName", "lastName", "aliases" } ] } or { "names": [...] }
        names: Set[str] = set()
        for item in data.get("sdn", data.get("names", data) if isinstance(data, list) else []):
            if isinstance(item, str):
                names.add(_normalize_name(item))
                continue
            if isinstance(item, dict):
                full = " ".join(filter(None, [item.get("firstName"), item.get("lastName")]))
                if full:
                    names.add(_normalize_name(full))
                for alias in item.get("aliases", item.get("aka", [])):
                    if isinstance(alias, str):
                        names.add(_normalize_name(alias))
                    elif isinstance(alias, dict) and alias.get("name"):
                        names.add(_normalize_name(alias["name"]))
        return names, "OFAC"
    except Exception as e:
        logger.exception("OFAC list fetch failed: %s", e)
        return set(), ""


async def _fetch_eu_list() -> Tuple[Set[str], str]:
    """
    Fetch EU Consolidated sanctions list. Expects JSON with name/names.
    Config: SCSS_EU_SANCTIONS_URL, SCSS_EU_SANCTIONS_API_KEY (optional).
    """
    try:
        from src.core.config import get_settings
        settings = get_settings()
        url = (settings.scss_eu_sanctions_url or "").strip()
        if not url:
            return set(), ""
        import httpx
        headers = {"Accept": "application/json"}
        if (settings.scss_eu_sanctions_api_key or "").strip():
            headers["X-API-Key"] = settings.scss_eu_sanctions_api_key.strip()
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            data = r.json()
        names: Set[str] = set()
        for item in data.get("results", data.get("entities", data) if isinstance(data, list) else []):
            if isinstance(item, str):
                names.add(_normalize_name(item))
            elif isinstance(item, dict):
                for key in ("name", "fullName", "firstName", "lastName"):
                    if item.get(key):
                        names.add(_normalize_name(str(item[key])))
        return names, "EU"
    except Exception as e:
        logger.exception("EU sanctions list fetch failed: %s", e)
        return set(), ""


def _match_score(name: str, sanctioned_names: Set[str]) -> float:
    """Return 1.0 if exact match, 0.85 if partial (substring), else 0.0."""
    n = _normalize_name(name)
    if n in sanctioned_names:
        return 1.0
    for entry in sanctioned_names:
        if entry in n or n in entry:
            return 0.85
    return 0.0


class SCSSComplianceService:
    """Phase 6: Sanctions screening and match review."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def run_sanctions_scan(self) -> Dict[str, Any]:
        """
        Screen all active suppliers against sanctions lists.
        Uses OFAC/EU APIs when SCSS_OFAC_API_URL / SCSS_EU_SANCTIONS_URL are set; else stub list.
        Creates scss_sanctions_matches for each match with status=pending.
        """
        # Build combined list: stub + OFAC + EU (when configured)
        sanctioned_ofac: Set[str] = set()
        sanctioned_eu: Set[str] = set()
        ofac_label, eu_label = "OFAC", "EU"
        ofac_names, ofac_src = await _fetch_ofac_list()
        if ofac_src:
            sanctioned_ofac = ofac_names
            ofac_label = "OFAC SDN"
        else:
            sanctioned_ofac = set(_BUILTIN_SANCTIONS_STUB_NAMES)  # stub
        eu_names, eu_src = await _fetch_eu_list()
        if eu_src:
            sanctioned_eu = eu_names
        else:
            sanctioned_eu = set(_BUILTIN_SANCTIONS_STUB_NAMES)

        r = await self.db.execute(select(Supplier).where(Supplier.is_active == True))
        suppliers = list(r.scalars().all())
        new_matches = 0
        for s in suppliers:
            name = (s.name or "").strip()
            score_ofac = _match_score(name, sanctioned_ofac)
            score_eu = _match_score(name, sanctioned_eu)
            score = max(score_ofac, score_eu)
            list_name = "OFAC SDN" if score_ofac >= score_eu else "EU Consolidated"
            list_source = "OFAC" if score_ofac >= score_eu else "EU"
            if score <= 0:
                continue
            existing = await self.db.execute(
                select(SanctionsMatch).where(
                    SanctionsMatch.supplier_id == s.id,
                    SanctionsMatch.list_source == list_source,
                    SanctionsMatch.status == "pending",
                ).limit(1)
            )
            if existing.scalar_one_or_none():
                continue
            match = SanctionsMatch(
                id=str(uuid4()),
                supplier_id=s.id,
                list_name=list_name,
                list_source=list_source,
                matched_name=name,
                match_score=score,
                status="pending",
            )
            self.db.add(match)
            new_matches += 1
        await self.db.flush()
        sources = []
        if ofac_src:
            sources.append("OFAC API")
        else:
            sources.append("OFAC (stub)")
        if eu_src:
            sources.append("EU API")
        else:
            sources.append("EU (stub)")
        return {
            "total_screened": len(suppliers),
            "new_matches": new_matches,
            "sources_used": sources,
            "message": f"Screened {len(suppliers)} suppliers; {new_matches} new matches.",
        }

    async def get_sanctions_status(self) -> Dict[str, Any]:
        """Status for GET /scss/compliance/sanctions-status."""
        # Last scan: latest sanctions match created_at across all
        r = await self.db.execute(
            select(SanctionsMatch).order_by(SanctionsMatch.created_at.desc()).limit(1)
        )
        last = r.scalar_one_or_none()
        last_scan = last.created_at.isoformat() if last and last.created_at else None

        count_r = await self.db.execute(select(SanctionsMatch))
        all_matches = list(count_r.scalars().all())
        total = len(all_matches)
        pending = sum(1 for m in all_matches if m.status == "pending")

        try:
            from src.core.config import get_settings
            settings = get_settings()
            ofac_configured = bool((settings.scss_ofac_api_url or "").strip())
            eu_configured = bool((settings.scss_eu_sanctions_url or "").strip())
        except Exception:
            ofac_configured = eu_configured = False
        production_ready = ofac_configured or eu_configured
        return {
            "last_scan": last_scan,
            "total_screened": None,
            "total_matches": total,
            "pending_review": pending,
            "ofac_configured": ofac_configured,
            "eu_configured": eu_configured,
            "production_ready": production_ready,
            "matches": [
                {
                    "id": m.id,
                    "supplier_id": m.supplier_id,
                    "list_name": m.list_name,
                    "list_source": m.list_source,
                    "matched_name": m.matched_name,
                    "match_score": m.match_score,
                    "status": m.status,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in all_matches[:50]
            ],
            "message": "Sanctions screening active. Run POST /scss/compliance/sanctions-scan to scan."
            + (" Using real OFAC/EU lists." if production_ready else " Using built-in demo list; set SCSS_OFAC_API_URL and/or SCSS_EU_SANCTIONS_URL for production."),
        }

    async def list_sanctions_matches(
        self,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List sanctions matches with optional status filter."""
        query = select(SanctionsMatch).order_by(SanctionsMatch.created_at.desc())
        if status:
            query = query.where(SanctionsMatch.status == status)
        query = query.limit(limit).offset(offset)
        r = await self.db.execute(query)
        matches = list(r.scalars().all())
        return [
            {
                "id": m.id,
                "supplier_id": m.supplier_id,
                "list_name": m.list_name,
                "list_source": m.list_source,
                "matched_name": m.matched_name,
                "match_score": m.match_score,
                "status": m.status,
                "reviewed_by": m.reviewed_by,
                "reviewed_at": m.reviewed_at.isoformat() if m.reviewed_at else None,
                "notes": m.notes,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in matches
        ]

    async def update_match_status(
        self,
        match_id: str,
        status: str,
        reviewed_by: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Optional[SanctionsMatch]:
        """Update match status to reviewed or cleared."""
        r = await self.db.execute(select(SanctionsMatch).where(SanctionsMatch.id == match_id))
        match = r.scalar_one_or_none()
        if not match:
            return None
        if status not in ("pending", "reviewed", "cleared"):
            return None
        match.status = status
        match.reviewed_by = reviewed_by or match.reviewed_by
        match.reviewed_at = datetime.utcnow()
        if notes is not None:
            match.notes = notes
        await self.db.flush()
        return match
