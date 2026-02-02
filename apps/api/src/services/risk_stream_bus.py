"""
Risk stream bus (in-process).

Purpose:
- Allow write-side operations (sensor updates, asset risk changes) to "nudge" the
  streaming loop so the affected city is pushed to clients quickly, rather than
  waiting for random/round-robin selection.

This is intentionally lightweight and in-memory. For multi-worker deployments,
replace with Redis/pubsub or a DB-backed outbox.
"""

import asyncio

_dirty_city_ids: set[str] = set()
_lock = asyncio.Lock()


async def mark_city_dirty(city_id: str) -> None:
    """Mark a city as needing an immediate stream update."""
    if not city_id:
        return
    async with _lock:
        _dirty_city_ids.add(str(city_id))


async def pop_dirty_city() -> str | None:
    """Pop one dirty city id, if any."""
    async with _lock:
        if not _dirty_city_ids:
            return None
        return _dirty_city_ids.pop()

