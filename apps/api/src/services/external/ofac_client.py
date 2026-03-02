"""
OFAC SDN List and UN Consolidated Sanctions List Client.

Parses OFAC SDN XML and UN consolidated XML to build country-level sanctions
indicator for risk scoring. Free, official sources. Cache 24h, daily refresh.
"""
import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Set

import httpx

logger = logging.getLogger(__name__)

OFAC_SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.xml"
UN_CONSOLIDATED_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
REQUEST_TIMEOUT = 60.0
CACHE_TTL = timedelta(hours=24)
MAX_RETRIES = 2


@dataclass
class SanctionsCountrySnapshot:
    """Sanctions status for a country."""
    country_iso2: str
    is_sanctioned: bool
    sanctions_score: float  # 0.0-1.0
    programs: list = field(default_factory=list)
    source: str = "OFAC+UN"
    fetched_at: datetime = field(default_factory=datetime.utcnow)


class OFACClient:
    """
    Client for OFAC SDN and UN Consolidated sanctions lists.
    Builds set of sanctioned country codes and optional score.
    """

    def __init__(self, timeout: float = REQUEST_TIMEOUT, cache_ttl: timedelta = CACHE_TTL):
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}
        self._cache_ttl = cache_ttl
        self._country_programs: Dict[str, Set[str]] = {}
        self._last_fetch: Optional[datetime] = None

    def _cache_key(self) -> str:
        return "ofac_un_sanctions"

    def _get_cached(self) -> Optional[Dict[str, Set[str]]]:
        key = self._cache_key()
        if key not in self._cache:
            return None
        data, expiry = self._cache[key]
        if datetime.utcnow() > expiry:
            del self._cache[key]
            return None
        return data

    def _set_cached(self, data: Dict[str, Set[str]]) -> None:
        self._cache[self._cache_key()] = (data, datetime.utcnow() + self._cache_ttl)

    async def _fetch_ofac_sdn(self) -> Dict[str, Set[str]]:
        """Fetch OFAC SDN XML and return country_iso2 -> set of program names."""
        country_programs: Dict[str, Set[str]] = {}
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(OFAC_SDN_URL)
                if resp.status_code != 200:
                    logger.warning("OFAC SDN HTTP %s", resp.status_code)
                    return country_programs
                root = ET.fromstring(resp.content)
        except Exception as e:
            logger.warning("OFAC SDN fetch/parse error: %s", e)
            return country_programs

        # Legacy format: <sdnList><sdnEntry> with <programList><program>, <addressList><address><country>
        def local_tag(t: Any) -> str:
            return (t or "").split("}")[-1] if t and "}" in str(t) else (t or "")

        for entry in root.iter():
            if local_tag(entry.tag) != "sdnEntry":
                continue
            programs: Set[str] = set()
            countries: Set[str] = set()
            for elem in entry.iter():
                tag = local_tag(elem.tag)
                if tag == "program" and (elem.text or "").strip():
                    programs.add((elem.text or "").strip())
                if tag == "country" and (elem.text or "").strip():
                    countries.add((elem.text or "").strip()[:2].upper())
            if not countries and programs:
                countries.add("")  # global entry
            for c in countries:
                if c:
                    country_programs.setdefault(c, set()).update(programs)
        return country_programs

    async def _fetch_un_consolidated(self) -> Dict[str, Set[str]]:
        """Fetch UN consolidated XML and return country_iso2 -> set of sources."""
        country_programs: Dict[str, Set[str]] = {}
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(UN_CONSOLIDATED_URL)
                if resp.status_code != 200:
                    logger.warning("UN Consolidated HTTP %s", resp.status_code)
                    return country_programs
                root = ET.fromstring(resp.content)
        except Exception as e:
            logger.warning("UN Consolidated fetch/parse error: %s", e)
            return country_programs

        # UN format varies; look for Country, country, ListType, etc.
        for elem in root.iter():
            tag = (elem.tag or "").split("}")[-1]
            if tag in ("Country", "country", "NATIONALITY", "Nationality") and elem.text:
                c = (elem.text or "").strip()[:2].upper()
                if c:
                    country_programs.setdefault(c, set()).add("UN")
        return country_programs

    async def refresh(self) -> None:
        """Fetch OFAC and UN lists and merge into country -> programs."""
        ofac = await self._fetch_ofac_sdn()
        un = await self._fetch_un_consolidated()
        merged: Dict[str, Set[str]] = {}
        for c, progs in ofac.items():
            merged.setdefault(c, set()).update(progs)
        for c, progs in un.items():
            merged.setdefault(c, set()).update(progs)
        self._country_programs = merged
        self._last_fetch = datetime.utcnow()
        self._set_cached(merged)
        logger.info("OFAC/UN sanctions refresh: %s countries", len(merged))

    async def get_country_snapshot(self, country_iso2: str) -> SanctionsCountrySnapshot:
        """
        Return sanctions status for country (ISO2).
        sanctions_score: 0.9 if sanctioned, 0.5 if partial/related, 0.05 if none.
        """
        key = self._cache_key()
        cached = self._get_cached()
        if cached is not None:
            self._country_programs = cached
        elif not self._country_programs:
            await self.refresh()
        programs = self._country_programs.get((country_iso2 or "").strip().upper()[:2], set())
        is_sanctioned = len(programs) > 0
        if is_sanctioned:
            score = min(0.95, 0.5 + 0.1 * len(programs))
        else:
            score = 0.05
        return SanctionsCountrySnapshot(
            country_iso2=(country_iso2 or "")[:2].upper(),
            is_sanctioned=is_sanctioned,
            sanctions_score=score,
            programs=sorted(programs),
            source="OFAC+UN",
            fetched_at=self._last_fetch or datetime.utcnow(),
        )

    def clear_cache(self) -> None:
        self._cache.clear()
        self._country_programs = {}


ofac_client = OFACClient()
