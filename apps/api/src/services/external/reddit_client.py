"""
Reddit OSINT client for threat intelligence.

Fetches recent posts from public subreddits via Reddit JSON API.
No auth required for public subreddits (rate limit ~60 req/min with User-Agent).
Optional: reddit_client_id + reddit_client_secret for higher rate limits (OAuth).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

REDDIT_JSON_URL = "https://www.reddit.com/r/{subreddit}/new.json"
REQUEST_TIMEOUT = 15.0
USER_AGENT = "GlobalRiskPlatform/1.0 (OSINT; contact@saa-alliance.com)"

# Risk-relevant subreddits
DEFAULT_SUBREDDITS = ["worldnews", "geopolitics", "cybersecurity", "economics", "collapse"]


@dataclass
class RedditPost:
    """Single Reddit post."""
    id: str
    title: str
    selftext: str
    subreddit: str
    author: str
    created_utc: float
    url: str
    score: int
    num_comments: int


class RedditClient:
    """Client for Reddit public JSON API."""

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        timeout: float = REQUEST_TIMEOUT,
    ):
        self.client_id = (client_id or "").strip()
        self.client_secret = (client_secret or "").strip()
        self.timeout = timeout
        self._access_token: Optional[str] = None

    @property
    def is_oauth(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def _headers(self) -> Dict[str, str]:
        h = {"User-Agent": USER_AGENT}
        if self._access_token:
            h["Authorization"] = f"bearer {self._access_token}"
        return h

    async def _ensure_token(self) -> bool:
        if not self.is_oauth or self._access_token:
            return True
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(
                    "https://www.reddit.com/api/v1/access_token",
                    data={"grant_type": "client_credentials"},
                    auth=(self.client_id, self.client_secret),
                    headers={"User-Agent": USER_AGENT},
                )
                if r.status_code == 200:
                    data = r.json()
                    self._access_token = data.get("access_token")
                    return True
        except Exception as e:
            logger.warning("Reddit OAuth failed: %s", e)
        return False

    async def get_subreddit_new(self, subreddit: str, limit: int = 25) -> List[RedditPost]:
        """Fetch recent posts from a subreddit (new listing)."""
        if self.is_oauth:
            await self._ensure_token()
        url = REDDIT_JSON_URL.format(subreddit=subreddit)
        params = {"limit": min(limit, 100)}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params=params, headers=self._headers())
                if resp.status_code == 429:
                    logger.warning("Reddit rate limit")
                    return []
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning("Reddit API error for r/%s: %s", subreddit, e)
            return []

        posts: List[RedditPost] = []
        for child in data.get("data", {}).get("children", []):
            d = child.get("data", {})
            if not d:
                continue
            posts.append(RedditPost(
                id=d.get("id", ""),
                title=(d.get("title") or "")[:500],
                selftext=(d.get("selftext") or "")[:1000],
                subreddit=d.get("subreddit", subreddit),
                author=d.get("author", ""),
                created_utc=float(d.get("created_utc", 0)),
                url=d.get("url", ""),
                score=int(d.get("score", 0)),
                num_comments=int(d.get("num_comments", 0)),
            ))
        return posts

    async def fetch_risk_signals(self, subreddits: Optional[List[str]] = None, limit_per_sub: int = 25) -> List[RedditPost]:
        """Fetch recent posts from risk-relevant subreddits."""
        subs = subreddits or DEFAULT_SUBREDDITS
        out: List[RedditPost] = []
        for sub in subs[:10]:
            posts = await self.get_subreddit_new(sub, limit=limit_per_sub)
            out.extend(posts)
        return out


def get_reddit_client(client_id: Optional[str] = None, client_secret: Optional[str] = None) -> RedditClient:
    if client_id is None or client_secret is None:
        try:
            from src.core.config import settings
            client_id = client_id or getattr(settings, "reddit_client_id", "") or ""
            client_secret = client_secret or getattr(settings, "reddit_client_secret", "") or ""
        except Exception:
            client_id = client_id or ""
            client_secret = client_secret or ""
    return RedditClient(client_id=client_id, client_secret=client_secret)
