"""
Twitter/X API v2 client for OSINT and threat intelligence.

Uses recent search API (last 7 days). Requires bearer token from X Developer Portal.
If twitter_bearer_token is not set, all methods return empty/skip.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

TWITTER_API_BASE = "https://api.twitter.com/2"
REQUEST_TIMEOUT = 15.0

# Risk-relevant search queries (each under 512 chars)
DEFAULT_QUERIES = [
    "natural disaster OR earthquake OR flood OR wildfire",
    "sanctions OR conflict OR geopolitical",
    "market crash OR financial crisis",
    "cyber attack OR data breach OR ransomware",
]


@dataclass
class TwitterPost:
    """Single tweet/post from search."""
    id: str
    text: str
    author_id: Optional[str] = None
    created_at: Optional[str] = None
    public_metrics: Optional[Dict[str, int]] = None
    query: str = ""


class TwitterClient:
    """Client for Twitter/X API v2 recent search."""

    def __init__(self, bearer_token: Optional[str] = None, timeout: float = REQUEST_TIMEOUT):
        self.bearer_token = (bearer_token or "").strip()
        self.timeout = timeout

    @property
    def is_configured(self) -> bool:
        return bool(self.bearer_token)

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.bearer_token}",
            "Content-Type": "application/json",
        }

    async def search_recent(
        self,
        query: str,
        max_results: int = 10,
        tweet_fields: str = "created_at,public_metrics,author_id",
    ) -> List[TwitterPost]:
        """
        Search recent tweets (last 7 days). Returns empty list if not configured or on error.
        """
        if not self.is_configured:
            logger.debug("Twitter client not configured (no bearer token)")
            return []

        url = f"{TWITTER_API_BASE}/tweets/search/recent"
        params: Dict[str, Any] = {
            "query": query[:512],
            "max_results": min(max_results, 100),
            "tweet.fields": tweet_fields,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params=params, headers=self._headers())
                if resp.status_code == 401:
                    logger.warning("Twitter API 401 Unauthorized — check bearer token")
                    return []
                if resp.status_code == 429:
                    logger.warning("Twitter API 429 Rate limit")
                    return []
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException:
            logger.warning("Twitter API timeout")
            return []
        except Exception as e:
            logger.warning("Twitter API error: %s", e)
            return []

        posts: List[TwitterPost] = []
        for raw in data.get("data", []):
            posts.append(TwitterPost(
                id=str(raw.get("id", "")),
                text=(raw.get("text") or "")[:500],
                author_id=raw.get("author_id"),
                created_at=raw.get("created_at"),
                public_metrics=raw.get("public_metrics"),
                query=query[:100],
            ))
        return posts

    async def fetch_risk_signals(self, queries: Optional[List[str]] = None, max_per_query: int = 20) -> List[TwitterPost]:
        """
        Fetch risk-relevant posts from multiple queries. Deduplicates by id.
        """
        if not self.is_configured:
            return []
        qs = queries or DEFAULT_QUERIES
        seen: set[str] = set()
        out: List[TwitterPost] = []
        for q in qs[:5]:
            posts = await self.search_recent(q, max_results=max_per_query)
            for p in posts:
                if p.id and p.id not in seen:
                    seen.add(p.id)
                    out.append(p)
        return out


def get_twitter_client(bearer_token: Optional[str] = None) -> TwitterClient:
    """Factory: use settings if token not passed."""
    if bearer_token is None:
        try:
            from src.core.config import settings
            bearer_token = getattr(settings, "twitter_bearer_token", "") or ""
        except Exception:
            bearer_token = ""
    return TwitterClient(bearer_token=bearer_token)
