"""
Social media ingestion job: Twitter, Reddit, Telegram + NLP sentiment.

Schedule: every 10 min. Runs only when enable_social_media=True.
"""
from typing import Any, Dict, List

from src.core.config import settings
from src.services.ingestion.pipeline import run_ingestion_job
from src.services.nlp.sentiment_analyzer import analyze_sentiment
from src.services.external.twitter_client import get_twitter_client
from src.services.external.reddit_client import get_reddit_client
from src.services.external.telegram_client import get_telegram_client


def _serialize(obj: Any) -> Any:
    if hasattr(obj, "__dict__") and not isinstance(obj, type):
        return {k: _serialize(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
    if isinstance(obj, (list, tuple)):
        return [_serialize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


async def _fetch_social_media() -> Dict[str, Any]:
    if not getattr(settings, "enable_social_media", False):
        return {"data": {"signals": [], "sources": []}, "affected_city_ids": None, "summary": {"count": 0}, "channel": "threat_intelligence"}

    signals: List[Dict[str, Any]] = []
    twitter_client = get_twitter_client()
    reddit_client = get_reddit_client()
    telegram_client = get_telegram_client()

    if twitter_client.is_configured:
        posts = await twitter_client.fetch_risk_signals(max_per_query=15)
        for p in posts:
            sent = analyze_sentiment(p.text)
            signals.append({
                "source": "twitter",
                "id": p.id,
                "text": (p.text or "")[:500],
                "created_at": p.created_at,
                "sentiment_score": sent.sentiment_score,
                "threat_level": sent.threat_level,
                "entities": sent.entities,
            })

    reddit_posts = await reddit_client.fetch_risk_signals(limit_per_sub=10)
    for p in reddit_posts:
        text = f"{p.title} {p.selftext}".strip()[:1000]
        sent = analyze_sentiment(text)
        signals.append({
            "source": "reddit",
            "id": p.id,
            "subreddit": p.subreddit,
            "title": (p.title or "")[:300],
            "text": text[:500],
            "created_utc": p.created_utc,
            "sentiment_score": sent.sentiment_score,
            "threat_level": sent.threat_level,
            "entities": sent.entities,
        })

    if telegram_client.is_configured:
        msgs = await telegram_client.fetch_risk_signals(max_messages=20)
        for m in msgs:
            if not m.text:
                continue
            sent = analyze_sentiment(m.text)
            signals.append({
                "source": "telegram",
                "id": str(m.update_id),
                "text": (m.text or "")[:500],
                "sentiment_score": sent.sentiment_score,
                "threat_level": sent.threat_level,
                "entities": sent.entities,
            })

    data = {"signals": signals, "sources": ["twitter", "reddit", "telegram"]}
    summary = {"count": len(signals)}
    return {"data": data, "affected_city_ids": None, "summary": summary, "channel": "threat_intelligence"}


async def run_social_media_job() -> Dict[str, Any]:
    return await run_ingestion_job(
        source_id="social_media",
        fetch_fn=_fetch_social_media,
        channel="threat_intelligence",
    )
