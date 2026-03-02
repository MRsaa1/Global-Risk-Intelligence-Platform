"""
NLP Sentiment and Entity Sentiment service.

Uses Google Cloud Natural Language API or AWS Comprehend when configured;
otherwise returns a fallback/demo response. Results are cached by text hash.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, Optional

from src.core.config import settings

logger = logging.getLogger(__name__)

# In-memory cache: hash -> result (TTL or size limit can be added later)
_sentiment_cache: Dict[str, Dict[str, Any]] = {}
_CACHE_MAX_SIZE = 1000


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


def _get_cached(h: str) -> Optional[Dict[str, Any]]:
    if h in _sentiment_cache:
        return _sentiment_cache[h]
    return None


def _set_cached(h: str, value: Dict[str, Any]) -> None:
    global _sentiment_cache
    if len(_sentiment_cache) >= _CACHE_MAX_SIZE:
        # Evict oldest (first key)
        first = next(iter(_sentiment_cache))
        del _sentiment_cache[first]
    _sentiment_cache[h] = value


async def _call_google_natural_language(text: str) -> Optional[Dict[str, Any]]:
    """Call Google Cloud Natural Language API for sentiment and entity sentiment."""
    try:
        from google.cloud import language_v1
        from google.oauth2 import service_account
    except ImportError:
        logger.debug("google-cloud-language not installed")
        return None

    project_id = getattr(settings, "gcloud_project_id", "") or ""
    sa_json = getattr(settings, "gcloud_service_account_json", "") or ""
    if not project_id and not sa_json:
        return None

    try:
        if sa_json:
            import json as _json
            creds = service_account.Credentials.from_service_account_info(_json.loads(sa_json))
        else:
            creds = None
        client = language_v1.LanguageServiceClient(credentials=creds)
        doc = language_v1.Document(content=text[:1000000], type_=language_v1.Document.Type.PLAIN_TEXT)
        sentiment_response = client.analyze_sentiment(request={"document": doc})
        sentiment = sentiment_response.document_sentiment
        entity_response = client.analyze_entity_sentiment(request={"document": doc})
        entities = [
            {
                "name": e.name,
                "type": e.type_.name,
                "salience": e.salience,
                "sentiment_score": e.sentiment.score if e.sentiment else 0,
                "sentiment_magnitude": e.sentiment.magnitude if e.sentiment else 0,
            }
            for e in entity_response.entities
        ]
        return {
            "score": sentiment.score,
            "magnitude": sentiment.magnitude,
            "entities": entities,
            "provider": "google",
        }
    except Exception as e:
        logger.warning("Google Natural Language API failed: %s", e)
        return None


async def _call_aws_comprehend(text: str) -> Optional[Dict[str, Any]]:
    """Call AWS Comprehend for sentiment and key phrases (entity-like)."""
    try:
        import boto3
    except ImportError:
        logger.debug("boto3 not installed")
        return None

    region = getattr(settings, "aws_region", None) or "us-east-1"
    try:
        client = boto3.client("comprehend", region_name=region)
        # Sentiment
        sent = client.detect_sentiment(Text=text[:5000], LanguageCode="en")
        # Key phrases as proxy for entities
        kp = client.detect_key_phrases(Text=text[:5000], LanguageCode="en")
        entities = [
            {"name": p["Text"], "score": p["Score"], "type": "KEY_PHRASE"}
            for p in kp.get("KeyPhrases", [])[:20]
        ]
        score_map = {"POSITIVE": 0.5, "NEGATIVE": -0.5, "NEUTRAL": 0.0, "MIXED": 0.0}
        return {
            "score": score_map.get(sent["Sentiment"], 0),
            "magnitude": abs(score_map.get(sent["Sentiment"], 0)),
            "sentiment_label": sent["Sentiment"],
            "entities": entities,
            "provider": "aws",
        }
    except Exception as e:
        logger.warning("AWS Comprehend failed: %s", e)
        return None


async def analyze_sentiment(
    text: str,
    use_cache: bool = True,
    prefer_google: bool = True,
) -> Dict[str, Any]:
    """
    Analyze sentiment and optional entity sentiment for the given text.
    Uses Google Natural Language API or AWS Comprehend when configured;
    otherwise returns a demo response. Results cached by text hash.
    """
    if not text or not text.strip():
        return {"score": 0.0, "magnitude": 0.0, "entities": [], "provider": "none", "cached": False}

    h = _text_hash(text)
    if use_cache:
        cached = _get_cached(h)
        if cached is not None:
            cached["cached"] = True
            return cached

    result: Optional[Dict[str, Any]] = None
    if prefer_google:
        result = await _call_google_natural_language(text)
    if result is None:
        result = await _call_aws_comprehend(text)
    if result is None and not prefer_google:
        result = await _call_google_natural_language(text)

    if result is None:
        # Demo fallback: simple heuristic
        low = text.lower()
        pos = sum(1 for w in ("good", "great", "positive", "growth", "gain") if w in low)
        neg = sum(1 for w in ("bad", "risk", "loss", "negative", "crisis", "fall") if w in low)
        score = 0.0
        if pos > neg:
            score = min(0.5, 0.1 * (pos - neg))
        elif neg > pos:
            score = max(-0.5, -0.1 * (neg - pos))
        result = {
            "score": score,
            "magnitude": abs(score),
            "entities": [],
            "provider": "demo",
        }

    result["cached"] = False
    if use_cache:
        _set_cached(h, dict(result))
    return result
