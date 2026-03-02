"""
GDELT 2.0 API Client.

- DOC API: full-text search for news (conflict, political, logistics, infrastructure).
  Free, no auth, 15-min rolling data. Used for conflict/political/logistics/infra risk signals.
- Events: optional CSV ingestion (CAMEO codes, GoldsteinScale) for conflict/political aggregation.

All methods use cache (15 min TTL), retry, and timeout. Quality tracking for aggregator.
"""
import logging
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

GDELT_DOC_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_LAST_UPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
REQUEST_TIMEOUT = 10.0
CACHE_TTL_MINUTES = 15
MAX_RETRIES = 0  # 1 attempt only; GDELT often slow/unavailable — fail fast to avoid log flood

# CAMEO root codes: 14=protest, 17=coerce, 18=assault, 19=fight, 20=mass violence, 163=impose sanctions
CAMEO_CONFLICT_ROOTS = (14, 17, 18, 19, 20)
CAMEO_POLITICAL_ROOTS = (10, 11, 12, 13, 14)
CAMEO_SANCTIONS = 163


@dataclass
class GDELTArticle:
    """Single article from DOC API."""
    title: str
    url: Optional[str] = None
    published_at: Optional[str] = None
    tone: Optional[float] = None
    source: Optional[str] = None
    language: Optional[str] = None


@dataclass
class GDELTDocSearchResult:
    """Result of a DOC API search."""
    articles: List[GDELTArticle] = field(default_factory=list)
    total_estimate: int = 0
    query: str = ""
    success: bool = True
    error: Optional[str] = None
    fetched_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class GDELTEventRow:
    """Parsed row from GDELT Events CSV (tab-separated)."""
    event_code: str
    goldstein_scale: float
    num_mentions: int
    action_geo_country_code: Optional[str] = None
    action_geo_lat: Optional[float] = None
    action_geo_lng: Optional[float] = None
    sql_date: Optional[str] = None


class GDELTClient:
    """
    Client for GDELT 2.0 DOC API and optional Events CSV.
    Free tier: no API key, 15-min cache, retry on failure.
    """

    def __init__(
        self,
        timeout: float = REQUEST_TIMEOUT,
        cache_ttl_minutes: int = CACHE_TTL_MINUTES,
    ):
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}  # key -> (result, expiry)
        self._cache_ttl = timedelta(minutes=cache_ttl_minutes)

    def _cache_key(self, prefix: str, query: str, **kwargs: Any) -> str:
        parts = [prefix, query]
        for k, v in sorted(kwargs.items()):
            parts.append(f"{k}={v}")
        return "|".join(str(p) for p in parts)

    def _get_cached(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        data, expiry = self._cache[key]
        if datetime.utcnow() > expiry:
            del self._cache[key]
            return None
        return data

    def _set_cached(self, key: str, data: Any) -> None:
        self._cache[key] = (data, datetime.utcnow() + self._cache_ttl)

    async def doc_search(
        self,
        query: str,
        mode: str = "artlist",
        max_records: int = 50,
        timespan: str = "7days",
        format: str = "json",
        sort: str = "datedesc",
        request_timeout: Optional[float] = None,
    ) -> GDELTDocSearchResult:
        """
        Full-text search via GDELT DOC API.
        Returns list of articles matching the query (conflict, logistics, etc.).
        request_timeout: optional override (e.g. 3.0 for dashboard to fail fast).
        """
        cache_key = self._cache_key("doc", query, mode=mode, max=max_records, timespan=timespan)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        params = {
            "query": query[:200],
            "mode": mode,
            "maxrecords": min(max_records, 250),
            "timespan": timespan,
            "format": format,
            "sort": sort,
        }

        timeout = request_timeout if request_timeout is not None else self.timeout
        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=timeout,
                    follow_redirects=True,
                    headers={
                        "User-Agent": "global-risk-platform/1.0",
                        "Accept": "application/json,text/plain,*/*",
                    },
                ) as client:
                    resp = await client.get(GDELT_DOC_API_URL, params=params)
                    if resp.status_code != 200:
                        return GDELTDocSearchResult(
                            query=query,
                            success=False,
                            error=f"HTTP {resp.status_code}",
                            fetched_at=datetime.utcnow(),
                        )
                    body = (resp.text or "").strip()
                    try:
                        data = resp.json() if body else None
                    except Exception:
                        data = None
                    if data is None and body:
                        if body.startswith(")]}'"):
                            body = body[4:].strip()
                        if body:
                            try:
                                data = json.loads(body)
                            except json.JSONDecodeError:
                                pass
                    if data is None:
                        return GDELTDocSearchResult(
                            query=query,
                            success=False,
                            error="empty or invalid JSON response",
                            fetched_at=datetime.utcnow(),
                        )
                    try:
                        articles = self._parse_doc_artlist(data)
                        total = len(articles)
                        if isinstance(data, dict) and "articles" in data:
                            total = data.get("total_records", total)
                        result = GDELTDocSearchResult(
                            articles=articles,
                            total_estimate=total,
                            query=query,
                            success=True,
                            fetched_at=datetime.utcnow(),
                        )
                        self._set_cached(cache_key, result)
                        return result
                    except Exception as parse_err:
                        logger.debug("GDELT DOC API parse error (attempt %s): %s", attempt + 1, parse_err)
            except httpx.TimeoutException as e:
                logger.debug("GDELT DOC API timeout (attempt %s): %s", attempt + 1, e)
            except Exception as e:
                logger.debug("GDELT DOC API error (attempt %s): %s", attempt + 1, e)

        return GDELTDocSearchResult(
            query=query,
            success=False,
            error="timeout or request failed after retries",
            fetched_at=datetime.utcnow(),
        )

    def _parse_doc_artlist(self, data: Any) -> List[GDELTArticle]:
        """Parse DOC API artlist JSON response into list of GDELTArticle."""
        articles: List[GDELTArticle] = []
        raw: Any = None
        if isinstance(data, list):
            raw = data
        elif isinstance(data, dict):
            raw = data.get("articles") or data.get("article") or data.get("results") or data.get("docs")
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict):
                    articles.append(self._article_from_dict(item))
        return articles

    def _article_from_dict(self, item: Dict) -> GDELTArticle:
        return GDELTArticle(
            title=(item.get("title") or item.get("seendate") or "").strip() or "No title",
            url=item.get("url") or item.get("socialimage") or item.get("seendate"),
            published_at=item.get("seendate") or item.get("date") or item.get("published"),
            tone=self._safe_float(item.get("tone") or item.get("tonescore") or item.get("score")),
            source=item.get("domain") or item.get("source") or item.get("sourcecountry"),
            language=item.get("language") or item.get("sourcelang"),
        )

    @staticmethod
    def _safe_float(v: Any) -> Optional[float]:
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    async def get_conflict_signals_for_region(
        self,
        region_name: str,
        country_iso2: Optional[str] = None,
        days: int = 7,
    ) -> Dict[str, Any]:
        """
        Query DOC API for conflict-related coverage in region.
        Returns article count, average tone, and quality (1.0 if success).
        """
        query = f'"{region_name}" (conflict OR violence OR attack OR military OR war OR terrorism)'
        timespan = "1day" if days <= 1 else "7days" if days <= 7 else "1month"
        result = await self.doc_search(query=query, max_records=100, timespan=timespan)
        return self._signals_from_result(result, "conflict")

    async def get_political_signals_for_region(
        self,
        region_name: str,
        days: int = 7,
    ) -> Dict[str, Any]:
        """Query DOC API for political instability (protests, coups, unrest)."""
        query = f'"{region_name}" (protest OR unrest OR coup OR political crisis OR demonstration)'
        timespan = "1day" if days <= 1 else "7days" if days <= 7 else "1month"
        result = await self.doc_search(query=query, max_records=100, timespan=timespan)
        return self._signals_from_result(result, "political")

    async def get_logistics_signals_for_region(
        self,
        region_name: str,
        days: int = 7,
    ) -> Dict[str, Any]:
        """Query DOC API for supply chain / logistics disruption."""
        query = (
            f'"{region_name}" (port closure OR supply chain disruption OR fuel shortage '
            'OR blockade OR shipping delay OR logistics)'
        )
        timespan = "1day" if days <= 1 else "7days" if days <= 7 else "1month"
        result = await self.doc_search(query=query, max_records=100, timespan=timespan)
        return self._signals_from_result(result, "logistics")

    async def get_infrastructure_signals_for_region(
        self,
        region_name: str,
        days: int = 7,
    ) -> Dict[str, Any]:
        """Query DOC API for infrastructure disruption (power, water, transport)."""
        query = (
            f'"{region_name}" (power outage OR water shortage OR internet blackout '
            'OR infrastructure damage OR blackout)'
        )
        timespan = "1day" if days <= 1 else "7days" if days <= 7 else "1month"
        result = await self.doc_search(query=query, max_records=100, timespan=timespan)
        return self._signals_from_result(result, "infrastructure")

    def _signals_from_result(
        self,
        result: GDELTDocSearchResult,
        factor: str,
    ) -> Dict[str, Any]:
        """Build risk signals dict from DOC search result."""
        if not result.success or not result.articles:
            return {
                "factor": factor,
                "article_count": 0,
                "avg_tone": 0.0,
                "quality": 0.0,
                "success": result.success,
                "error": result.error,
                "fetched_at": result.fetched_at.isoformat() if result.fetched_at else None,
            }
        tones = [a.tone for a in result.articles if a.tone is not None]
        avg_tone = sum(tones) / len(tones) if tones else 0.0
        return {
            "factor": factor,
            "article_count": len(result.articles),
            "total_estimate": result.total_estimate,
            "avg_tone": round(avg_tone, 4),
            "quality": 1.0,
            "success": True,
            "fetched_at": result.fetched_at.isoformat() if result.fetched_at else None,
            "sample_titles": [a.title[:80] for a in result.articles[:5]],
        }

    @staticmethod
    def parse_events_csv_line(line: str) -> Optional[GDELTEventRow]:
        """
        Parse one tab-separated line from GDELT 2.0 Events CSV.
        Column indices per GDELT Event Codebook: 1=SQLDATE, 26=EventCode, 27=GoldsteinScale,
        28=NumMentions, 54=ActionGeo_CountryCode, 56=ActionGeo_Lat, 57=ActionGeo_Long.
        """
        parts = line.split("\t")
        if len(parts) < 28:
            return None
        try:
            event_code = (parts[26] or "").strip()
            goldstein = float(parts[27]) if parts[27] else 0.0
            num_mentions = int(parts[28]) if parts[28] else 0
            country = (parts[54] or "").strip() or None if len(parts) > 54 else None
            lat = float(parts[56]) if len(parts) > 56 and parts[56] else None
            lng = float(parts[57]) if len(parts) > 57 and parts[57] else None
            sql_date = (parts[1] or "").strip() or None if len(parts) > 1 else None
            return GDELTEventRow(
                event_code=event_code,
                goldstein_scale=goldstein,
                num_mentions=num_mentions,
                action_geo_country_code=country,
                action_geo_lat=lat,
                action_geo_lng=lng,
                sql_date=sql_date,
            )
        except (ValueError, IndexError):
            return None

    @staticmethod
    def is_conflict_event(event_code: str) -> bool:
        """True if CAMEO code is conflict-related (17-20, 14 protest)."""
        if not event_code or len(event_code) < 2:
            return False
        try:
            root = int(event_code[:2])
            return root in CAMEO_CONFLICT_ROOTS
        except ValueError:
            return False

    @staticmethod
    def is_political_event(event_code: str) -> bool:
        """True if CAMEO code is political (10-14)."""
        if not event_code or len(event_code) < 2:
            return False
        try:
            root = int(event_code[:2])
            return root in CAMEO_POLITICAL_ROOTS
        except ValueError:
            return False

    def clear_cache(self) -> None:
        """Clear all cached DOC search results."""
        self._cache.clear()


# Singleton for dependency injection
gdelt_client = GDELTClient()
