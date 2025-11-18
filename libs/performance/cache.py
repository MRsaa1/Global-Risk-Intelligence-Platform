"""
Advanced caching utilities with TTL and invalidation.
"""

import hashlib
import json
import time
from functools import wraps
from typing import Any, Callable, Dict, Optional, TypeVar
import structlog

logger = structlog.get_logger(__name__)

T = TypeVar("T")


class CacheManager:
    """Advanced cache manager with TTL and invalidation."""

    def __init__(
        self,
        default_ttl: int = 3600,
        max_size: int = 10000,
        redis_url: Optional[str] = None,
    ):
        """
        Initialize cache manager.

        Args:
            default_ttl: Default time-to-live in seconds
            max_size: Maximum cache size
            redis_url: Optional Redis URL for distributed cache
        """
        self.default_ttl = default_ttl
        self.max_size = max_size
        self.redis_url = redis_url
        self._cache: Dict[str, Dict[str, Any]] = {}

        if redis_url:
            try:
                import redis

                self.redis_client = redis.from_url(redis_url)
                self._use_redis = True
            except ImportError:
                logger.warning("Redis not available, using in-memory cache")
                self._use_redis = False
        else:
            self._use_redis = False

    def _make_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from arguments."""
        key_data = {
            "prefix": prefix,
            "args": args,
            "kwargs": sorted(kwargs.items()),
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return f"{prefix}:{hashlib.sha256(key_str.encode()).hexdigest()}"

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if self._use_redis:
            try:
                cached = self.redis_client.get(key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning("Redis get failed", error=str(e))

        # Fallback to in-memory cache
        if key in self._cache:
            entry = self._cache[key]
            if time.time() < entry["expires_at"]:
                return entry["value"]
            else:
                # Expired
                del self._cache[key]

        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache."""
        ttl = ttl or self.default_ttl
        expires_at = time.time() + ttl

        if self._use_redis:
            try:
                self.redis_client.setex(
                    key, ttl, json.dumps(value, default=str)
                )
                return
            except Exception as e:
                logger.warning("Redis set failed", error=str(e))

        # Fallback to in-memory cache
        # Evict if cache is full
        if len(self._cache) >= self.max_size:
            # Remove oldest entry
            oldest_key = min(
                self._cache.keys(),
                key=lambda k: self._cache[k]["expires_at"],
            )
            del self._cache[oldest_key]

        self._cache[key] = {
            "value": value,
            "expires_at": expires_at,
        }

    def invalidate(self, pattern: str) -> None:
        """Invalidate cache entries matching pattern."""
        if self._use_redis:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
            except Exception as e:
                logger.warning("Redis invalidate failed", error=str(e))

        # In-memory cache
        keys_to_delete = [k for k in self._cache.keys() if pattern in k]
        for key in keys_to_delete:
            del self._cache[key]

    def clear(self) -> None:
        """Clear all cache."""
        if self._use_redis:
            try:
                self.redis_client.flushdb()
            except Exception as e:
                logger.warning("Redis clear failed", error=str(e))

        self._cache.clear()


# Global cache manager instance
_default_cache = CacheManager()


def cached(
    ttl: int = 3600,
    key_prefix: Optional[str] = None,
    cache_manager: Optional[CacheManager] = None,
):
    """
    Decorator for caching function results.

    Args:
        ttl: Time-to-live in seconds
        key_prefix: Optional key prefix
        cache_manager: Optional cache manager instance
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        manager = cache_manager or _default_cache
        prefix = key_prefix or func.__name__

        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            cache_key = manager._make_key(prefix, *args, **kwargs)

            # Try cache
            cached_value = manager.get(cache_key)
            if cached_value is not None:
                logger.debug("Cache hit", function=func.__name__, key=cache_key[:16])
                return cached_value

            # Cache miss - compute
            logger.debug("Cache miss", function=func.__name__, key=cache_key[:16])
            result = func(*args, **kwargs)

            # Store in cache
            manager.set(cache_key, result, ttl)

            return result

        return wrapper

    return decorator

