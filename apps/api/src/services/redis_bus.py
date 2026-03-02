"""
Redis bus for real-time event distribution and dirty-city set.

When enable_redis=True:
- Event emitter publishes to Redis so other workers can broadcast to their WebSocket clients.
- Risk stream bus uses Redis SET for dirty city IDs (multi-worker safe).
- A subscriber task (started from main lifespan) receives events and broadcasts to in-process WS clients.
"""
from typing import Any, Callable, Dict, Optional
import asyncio
import json
import structlog

from src.core.config import settings

logger = structlog.get_logger()

REDIS_EVENTS_CHANNEL = "pfrp:events"
REDIS_DIRTY_CITIES_KEY = "pfrp:dirty_cities"

_redis_client: Optional[Any] = None
_subscriber_task: Optional[asyncio.Task] = None


def _is_redis_enabled() -> bool:
    if not getattr(settings, "enable_redis", False):
        return False
    url = (getattr(settings, "redis_url", "") or "").strip()
    return bool(url)


async def get_redis_client():
    """Return async Redis client when Redis is enabled, else None."""
    global _redis_client
    if not _is_redis_enabled():
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis
        url = (getattr(settings, "redis_url", "") or "").strip() or "redis://localhost:6379"
        _redis_client = aioredis.from_url(url, decode_responses=True)
        await _redis_client.ping()
        logger.info("Redis bus connected", url=url.split("@")[-1] if "@" in url else url)
        return _redis_client
    except Exception as e:
        logger.warning("Redis bus connection failed: %s", e)
        return None


async def close_redis_bus() -> None:
    """Close Redis client and stop subscriber."""
    global _redis_client, _subscriber_task
    if _subscriber_task and not _subscriber_task.done():
        _subscriber_task.cancel()
        try:
            await _subscriber_task
        except asyncio.CancelledError:
            pass
        _subscriber_task = None
    if _redis_client is not None:
        try:
            await _redis_client.close()
        except Exception as e:
            logger.warning("Redis bus close error: %s", e)
        _redis_client = None


async def publish_event(channel: str, payload: Dict[str, Any]) -> None:
    """Publish event to Redis so other workers (or subscriber) can broadcast."""
    client = await get_redis_client()
    if client is None:
        return
    try:
        message = json.dumps({"channel": channel, "payload": payload})
        await client.publish(REDIS_EVENTS_CHANNEL, message)
    except Exception as e:
        logger.warning("Redis publish_event failed: %s", e)


async def mark_city_dirty_redis(city_id: str) -> None:
    """Add city_id to Redis set of dirty cities."""
    if not city_id:
        return
    client = await get_redis_client()
    if client is None:
        return
    try:
        await client.sadd(REDIS_DIRTY_CITIES_KEY, str(city_id))
    except Exception as e:
        logger.warning("Redis mark_city_dirty failed: %s", e)


async def pop_dirty_city_redis() -> Optional[str]:
    """Pop one city_id from Redis set. Returns None if set is empty."""
    client = await get_redis_client()
    if client is None:
        return None
    try:
        return await client.spop(REDIS_DIRTY_CITIES_KEY)
    except Exception as e:
        logger.warning("Redis pop_dirty_city failed: %s", e)
        return None


async def run_events_subscriber(callback: Callable[[str, Dict[str, Any]], Any]) -> None:
    """
    Subscribe to pfrp:events and call callback(channel, payload) for each message.
    Runs until cancelled. Use a dedicated Redis connection for subscribe.
    """
    if not _is_redis_enabled():
        return
    try:
        import redis.asyncio as aioredis
        url = (getattr(settings, "redis_url", "") or "").strip() or "redis://localhost:6379"
        client = aioredis.from_url(url, decode_responses=True)
        pubsub = client.pubsub()
        await pubsub.subscribe(REDIS_EVENTS_CHANNEL)
        logger.info("Redis events subscriber started")
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("type") == "message":
                try:
                    data = json.loads(message.get("data") or "{}")
                    ch = data.get("channel", "dashboard")
                    payload = data.get("payload") or {}
                    await callback(ch, payload)
                except Exception as e:
                    logger.warning("Redis subscriber callback error: %s", e)
    except asyncio.CancelledError:
        logger.info("Redis events subscriber cancelled")
        raise
    except Exception as e:
        logger.warning("Redis events subscriber failed: %s", e)
