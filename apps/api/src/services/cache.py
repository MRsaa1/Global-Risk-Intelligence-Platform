"""
Caching Layer for Risk Calculator Services.

Provides in-memory caching with TTL for:
- USGS earthquake data (6 hours)
- Weather data (3 hours)
- Risk scores (24 hours)

Can be extended to use Redis for production.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Callable, TypeVar
from functools import wraps
import logging
import asyncio

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CacheEntry:
    """Cache entry with value and expiry."""
    
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
    """Simple in-memory cache with TTL support."""
    
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
    
    async def clear(self) -> None:
        """Clear all cache entries."""
        async with self._lock:
            self._cache.clear()
    
    async def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count of removed."""
        async with self._lock:
            expired_keys = [k for k, v in self._cache.items() if v.is_expired]
            for key in expired_keys:
                del self._cache[key]
            return len(expired_keys)
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        now = datetime.utcnow()
        entries = list(self._cache.values())
        valid_entries = [e for e in entries if not e.is_expired]
        
        return {
            "total_entries": len(self._cache),
            "valid_entries": len(valid_entries),
            "expired_entries": len(entries) - len(valid_entries),
            "oldest_entry_age": max((now - e.created_at).total_seconds() for e in entries) if entries else 0,
            "newest_entry_age": min((now - e.created_at).total_seconds() for e in entries) if entries else 0,
        }


# Cache TTL constants (in seconds)
CACHE_TTL = {
    "usgs_earthquakes": 6 * 3600,      # 6 hours
    "weather_current": 3 * 3600,        # 3 hours
    "weather_forecast": 6 * 3600,       # 6 hours
    "risk_scores": 24 * 3600,           # 24 hours
    "city_risk": 24 * 3600,             # 24 hours
    "geojson_hotspots": 1 * 3600,       # 1 hour
    "portfolio_summary": 1 * 3600,      # 1 hour
}


# Global cache instances
_usgs_cache: Optional[InMemoryCache] = None
_weather_cache: Optional[InMemoryCache] = None
_risk_cache: Optional[InMemoryCache] = None


def get_usgs_cache() -> InMemoryCache:
    """Get USGS data cache."""
    global _usgs_cache
    if _usgs_cache is None:
        _usgs_cache = InMemoryCache(CACHE_TTL["usgs_earthquakes"])
    return _usgs_cache


def get_weather_cache() -> InMemoryCache:
    """Get weather data cache."""
    global _weather_cache
    if _weather_cache is None:
        _weather_cache = InMemoryCache(CACHE_TTL["weather_current"])
    return _weather_cache


def get_risk_cache() -> InMemoryCache:
    """Get risk score cache."""
    global _risk_cache
    if _risk_cache is None:
        _risk_cache = InMemoryCache(CACHE_TTL["risk_scores"])
    return _risk_cache


def cached(cache_name: str, ttl_seconds: Optional[int] = None):
    """Decorator for caching async function results."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get appropriate cache
            if cache_name == "usgs":
                cache = get_usgs_cache()
            elif cache_name == "weather":
                cache = get_weather_cache()
            else:
                cache = get_risk_cache()
            
            # Generate cache key
            key = f"{func.__name__}:{args}:{sorted(kwargs.items())}"
            
            # Try to get from cache
            cached_value = await cache.get(key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {key}")
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            await cache.set(key, result, ttl_seconds)
            logger.debug(f"Cache miss, stored: {key}")
            
            return result
        return wrapper
    return decorator
