"""
Caching Layer for Risk Calculator Services.

Provides Redis-based caching with TTL for:
- USGS earthquake data (6 hours)
- Weather data (3 hours)
- Risk scores (24 hours)
- User preferences (permanent)
- Stress test results (24 hours)

Falls back to in-memory cache if Redis is unavailable.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Callable, TypeVar, Union
from functools import wraps
import logging
import asyncio
import json
import hashlib

logger = logging.getLogger(__name__)

T = TypeVar('T')

# Try to import Redis
try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    logger.warning("redis package not installed, using in-memory cache only")


# Cache TTL constants (in seconds)
CACHE_TTL = {
    "usgs_earthquakes": 6 * 3600,      # 6 hours
    "weather_current": 3 * 3600,        # 3 hours
    "weather_forecast": 6 * 3600,       # 6 hours
    "risk_scores": 24 * 3600,           # 24 hours
    "city_risk": 24 * 3600,             # 24 hours
    "geojson_hotspots": 1 * 3600,       # 1 hour
    "portfolio_summary": 1 * 3600,      # 1 hour
    "stress_test": 24 * 3600,           # 24 hours
    "user_preferences": 7 * 24 * 3600,  # 7 days
    "asset_data": 12 * 3600,            # 12 hours
    "climate_data": 24 * 3600,          # 24 hours
    "active_incidents": 60,              # 1 minute (live incidents layer)
}


class CacheEntry:
    """Cache entry with value and expiry (for in-memory fallback)."""
    
    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.created_at = datetime.utcnow()
        self.expires_at = self.created_at + timedelta(seconds=ttl_seconds)
    
    @property
    def is_expired(self) -> bool:
        return datetime.utcnow() >= self.expires_at
    
    @property
    def age_seconds(self) -> float:
        return (datetime.utcnow() - self.created_at).total_seconds()


class InMemoryCache:
    """Simple in-memory cache with TTL support (fallback)."""
    
    def __init__(self, default_ttl_seconds: int = 3600):
        self._cache: Dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl_seconds
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        entry = self._cache.get(key)
        if entry is None:
            return None
        if entry.is_expired:
            del self._cache[key]
            return None
        return entry.value
    
    async def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """Set value in cache with TTL."""
        ttl = ttl_seconds or self.default_ttl
        async with self._lock:
            self._cache[key] = CacheEntry(value, ttl)
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists and is not expired."""
        entry = self._cache.get(key)
        if entry is None:
            return False
        if entry.is_expired:
            del self._cache[key]
            return False
        return True
    
    async def clear(self) -> None:
        """Clear all cache entries."""
        async with self._lock:
            self._cache.clear()
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern."""
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if pattern.replace("*", "") in k]
            for key in keys_to_delete:
                del self._cache[key]
            return len(keys_to_delete)
    
    async def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count of removed."""
        async with self._lock:
            expired_keys = [k for k, v in self._cache.items() if v.is_expired]
            for key in expired_keys:
                del self._cache[key]
            return len(expired_keys)
    
    async def get_keys(self, pattern: str = "*") -> list:
        """Get all keys matching pattern."""
        if pattern == "*":
            return list(self._cache.keys())
        return [k for k in self._cache.keys() if pattern.replace("*", "") in k]
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        now = datetime.utcnow()
        entries = list(self._cache.values())
        valid_entries = [e for e in entries if not e.is_expired]
        
        return {
            "backend": "memory",
            "total_entries": len(self._cache),
            "valid_entries": len(valid_entries),
            "expired_entries": len(entries) - len(valid_entries),
            "oldest_entry_age": max((now - e.created_at).total_seconds() for e in entries) if entries else 0,
            "newest_entry_age": min((now - e.created_at).total_seconds() for e in entries) if entries else 0,
        }


class RedisCache:
    """Redis-based cache with TTL support."""
    
    def __init__(self, redis_url: str, default_ttl_seconds: int = 3600, prefix: str = "pfrp"):
        self.redis_url = redis_url
        self.default_ttl = default_ttl_seconds
        self.prefix = prefix
        self._client: Optional[aioredis.Redis] = None
        self._connected = False
        self._fallback = InMemoryCache(default_ttl_seconds)
    
    def _make_key(self, key: str) -> str:
        """Create prefixed cache key."""
        return f"{self.prefix}:{key}"
    
    async def connect(self) -> bool:
        """Connect to Redis."""
        if not HAS_REDIS:
            logger.warning("Redis not available, using in-memory fallback")
            return False
        
        try:
            self._client = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=False,
            )
            # Test connection
            await self._client.ping()
            self._connected = True
            logger.info(f"Connected to Redis at {self.redis_url}")
            return True
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Using in-memory fallback.")
            self._connected = False
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._client:
            await self._client.close()
            self._connected = False
    
    async def _ensure_connected(self) -> bool:
        """Ensure Redis is connected, or use fallback."""
        if self._connected:
            return True
        return await self.connect()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        full_key = self._make_key(key)
        
        if await self._ensure_connected():
            try:
                data = await self._client.get(full_key)
                if data is None:
                    return None
                return json.loads(data)
            except Exception as e:
                logger.warning(f"Redis get error: {e}")
        
        # Fallback to memory
        return await self._fallback.get(key)
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl_seconds: Optional[int] = None
    ) -> None:
        """Set value in cache with TTL."""
        full_key = self._make_key(key)
        ttl = ttl_seconds or self.default_ttl
        
        if await self._ensure_connected():
            try:
                data = json.dumps(value, default=str)
                await self._client.setex(full_key, ttl, data)
                return
            except Exception as e:
                logger.warning(f"Redis set error: {e}")
        
        # Fallback to memory
        await self._fallback.set(key, value, ttl)
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        full_key = self._make_key(key)
        
        if await self._ensure_connected():
            try:
                result = await self._client.delete(full_key)
                return result > 0
            except Exception as e:
                logger.warning(f"Redis delete error: {e}")
        
        return await self._fallback.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        full_key = self._make_key(key)
        
        if await self._ensure_connected():
            try:
                return await self._client.exists(full_key) > 0
            except Exception as e:
                logger.warning(f"Redis exists error: {e}")
        
        return await self._fallback.exists(key)
    
    async def clear(self) -> None:
        """Clear all cache entries with our prefix."""
        if await self._ensure_connected():
            try:
                keys = await self._client.keys(f"{self.prefix}:*")
                if keys:
                    await self._client.delete(*keys)
                return
            except Exception as e:
                logger.warning(f"Redis clear error: {e}")
        
        await self._fallback.clear()
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern."""
        full_pattern = self._make_key(pattern)
        
        if await self._ensure_connected():
            try:
                keys = await self._client.keys(full_pattern)
                if keys:
                    count = await self._client.delete(*keys)
                    return count
                return 0
            except Exception as e:
                logger.warning(f"Redis clear_pattern error: {e}")
        
        return await self._fallback.clear_pattern(pattern)
    
    async def get_keys(self, pattern: str = "*") -> list:
        """Get all keys matching pattern."""
        full_pattern = self._make_key(pattern)
        
        if await self._ensure_connected():
            try:
                keys = await self._client.keys(full_pattern)
                # Remove prefix from keys
                prefix_len = len(self.prefix) + 1
                return [k.decode()[prefix_len:] if isinstance(k, bytes) else k[prefix_len:] for k in keys]
            except Exception as e:
                logger.warning(f"Redis get_keys error: {e}")
        
        return await self._fallback.get_keys(pattern)
    
    async def incr(self, key: str, amount: int = 1) -> int:
        """Increment a counter."""
        full_key = self._make_key(key)
        
        if await self._ensure_connected():
            try:
                return await self._client.incrby(full_key, amount)
            except Exception as e:
                logger.warning(f"Redis incr error: {e}")
        
        # Fallback - simple counter in memory
        current = await self._fallback.get(key) or 0
        new_value = current + amount
        await self._fallback.set(key, new_value, 24 * 3600)
        return new_value
    
    async def get_ttl(self, key: str) -> int:
        """Get remaining TTL for a key in seconds."""
        full_key = self._make_key(key)
        
        if await self._ensure_connected():
            try:
                return await self._client.ttl(full_key)
            except Exception as e:
                logger.warning(f"Redis ttl error: {e}")
        
        return -1
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if self._connected:
            return {
                "backend": "redis",
                "url": self.redis_url,
                "connected": True,
                "prefix": self.prefix,
            }
        
        stats = self._fallback.stats()
        stats["redis_fallback"] = True
        return stats


# Global cache instances
_cache: Optional[Union[RedisCache, InMemoryCache]] = None
_usgs_cache: Optional[Union[RedisCache, InMemoryCache]] = None
_weather_cache: Optional[Union[RedisCache, InMemoryCache]] = None
_risk_cache: Optional[Union[RedisCache, InMemoryCache]] = None


def _get_redis_url() -> str:
    """Get Redis URL from settings."""
    try:
        from src.core.config import settings
        return (getattr(settings, "redis_url", "") or "").strip()
    except Exception:
        return ""


def _is_redis_enabled() -> bool:
    """True if Redis is enabled and URL is set."""
    try:
        from src.core.config import settings
        if not getattr(settings, "enable_redis", True):
            return False
        url = (getattr(settings, "redis_url", "") or "").strip()
        return bool(url)
    except Exception:
        return False


async def get_cache() -> Union[RedisCache, InMemoryCache]:
    """Get the main cache instance. Uses in-memory only when Redis is disabled or REDIS_URL is empty."""
    global _cache
    if _cache is None:
        if not _is_redis_enabled():
            logger.info("Redis disabled (enable_redis=False or REDIS_URL empty); using in-memory cache only.")
            _cache = InMemoryCache(default_ttl_seconds=3600)
        else:
            redis_url = _get_redis_url() or "redis://localhost:6379"
            _cache = RedisCache(redis_url, default_ttl_seconds=3600, prefix="pfrp")
            await _cache.connect()
    return _cache


def get_usgs_cache() -> InMemoryCache:
    """Get USGS data cache (legacy - use get_cache() for new code)."""
    global _usgs_cache
    if _usgs_cache is None:
        _usgs_cache = InMemoryCache(CACHE_TTL["usgs_earthquakes"])
    return _usgs_cache


def get_weather_cache() -> InMemoryCache:
    """Get weather data cache (legacy - use get_cache() for new code)."""
    global _weather_cache
    if _weather_cache is None:
        _weather_cache = InMemoryCache(CACHE_TTL["weather_current"])
    return _weather_cache


def get_risk_cache() -> InMemoryCache:
    """Get risk score cache (legacy - use get_cache() for new code)."""
    global _risk_cache
    if _risk_cache is None:
        _risk_cache = InMemoryCache(CACHE_TTL["risk_scores"])
    return _risk_cache


def _generate_cache_key(func_name: str, args: tuple, kwargs: dict) -> str:
    """Generate a stable cache key from function arguments."""
    # Convert args and kwargs to a stable string representation
    key_parts = [func_name]
    
    for arg in args:
        if hasattr(arg, '__dict__'):
            # For objects, use their dict representation
            key_parts.append(str(sorted(arg.__dict__.items())))
        else:
            key_parts.append(str(arg))
    
    if kwargs:
        key_parts.append(str(sorted(kwargs.items())))
    
    # Create a hash for long keys
    key_str = ":".join(key_parts)
    if len(key_str) > 200:
        key_hash = hashlib.md5(key_str.encode()).hexdigest()
        return f"{func_name}:{key_hash}"
    
    return key_str


def cached(cache_name: str, ttl_seconds: Optional[int] = None):
    """
    Decorator for caching async function results.
    
    Args:
        cache_name: Name of the cache category (for TTL lookup)
        ttl_seconds: Override TTL in seconds
    
    Example:
        @cached("risk_scores")
        async def calculate_risk(asset_id: str) -> float:
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get appropriate cache
            if cache_name == "usgs":
                cache = get_usgs_cache()
            elif cache_name == "weather":
                cache = get_weather_cache()
            elif cache_name in ("risk", "risk_scores"):
                cache = get_risk_cache()
            else:
                cache = await get_cache()
            
            # Generate cache key
            key = _generate_cache_key(func.__name__, args, kwargs)
            
            # Try to get from cache
            cached_value = await cache.get(key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {key}")
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            
            # Determine TTL
            ttl = ttl_seconds or CACHE_TTL.get(cache_name, 3600)
            
            await cache.set(key, result, ttl)
            logger.debug(f"Cache miss, stored: {key}")
            
            return result
        return wrapper
    return decorator


def cache_invalidate(pattern: str):
    """
    Decorator to invalidate cache entries matching pattern after function execution.
    
    Example:
        @cache_invalidate("asset:*")
        async def update_asset(asset_id: str, data: dict):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # Invalidate matching cache entries
            cache = await get_cache()
            count = await cache.clear_pattern(pattern)
            logger.debug(f"Invalidated {count} cache entries matching: {pattern}")
            
            return result
        return wrapper
    return decorator


# Utility functions for common cache operations
async def cache_get(key: str) -> Optional[Any]:
    """Get value from cache."""
    cache = await get_cache()
    return await cache.get(key)


async def cache_set(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    """Set value in cache."""
    cache = await get_cache()
    await cache.set(key, value, ttl_seconds)


async def cache_delete(key: str) -> bool:
    """Delete key from cache."""
    cache = await get_cache()
    return await cache.delete(key)


async def cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    cache = await get_cache()
    return cache.stats()
