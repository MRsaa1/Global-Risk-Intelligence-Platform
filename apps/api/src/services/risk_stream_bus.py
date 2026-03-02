"""
Risk stream bus (in-process or Redis-backed).

Purpose:
- Allow write-side operations (sensor updates, asset risk changes) to "nudge" the
  streaming loop so the affected city is pushed to clients quickly.

When enable_redis=True, uses Redis SET for dirty city IDs (multi-worker safe).
Otherwise in-memory set.
"""

import asyncio

_dirty_city_ids: set[str] = set()
_lock = asyncio.Lock()


def _redis_enabled() -> bool:
    try:
        from src.core.config import settings
        if not getattr(settings, "enable_redis", False):
            return False
        return bool((getattr(settings, "redis_url", "") or "").strip())
    except Exception:
        return False


async def mark_city_dirty(city_id: str) -> None:
    """Mark a city as needing an immediate stream update."""
    if not city_id:
        return
    if _redis_enabled():
        try:
            from src.services.redis_bus import mark_city_dirty_redis
            await mark_city_dirty_redis(str(city_id))
            return
        except Exception:
            pass
    async with _lock:
        _dirty_city_ids.add(str(city_id))


async def pop_dirty_city() -> str | None:
    """Pop one dirty city id, if any."""
    if _redis_enabled():
        try:
            from src.services.redis_bus import pop_dirty_city_redis
            out = await pop_dirty_city_redis()
            if out is not None:
                return out
        except Exception:
            pass
    async with _lock:
        if not _dirty_city_ids:
            return None
        return _dirty_city_ids.pop()

