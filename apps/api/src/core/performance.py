"""
Performance Optimization Utilities.

Provides:
- Query optimization helpers
- Lazy loading patterns
- Database connection pooling configuration
- Background task utilities
- Rate limiting
"""
import asyncio
import functools
import time
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, TypeVar
import logging

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

T = TypeVar('T')


# ==================== QUERY TIMING ====================

class QueryTimer:
    """Context manager for timing database queries."""
    
    def __init__(self, query_name: str = "query"):
        self.query_name = query_name
        self.start_time: float = 0
        self.duration_ms: float = 0
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.duration_ms = (time.perf_counter() - self.start_time) * 1000
        if self.duration_ms > 100:  # Log slow queries
            logger.warning(f"Slow query '{self.query_name}': {self.duration_ms:.2f}ms")
        elif self.duration_ms > 50:
            logger.debug(f"Query '{self.query_name}': {self.duration_ms:.2f}ms")


def timed_query(query_name: str = None):
    """
    Decorator to time async database queries.
    
    Example:
        @timed_query("get_assets")
        async def get_assets(db: AsyncSession):
            ...
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            name = query_name or func.__name__
            start_time = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration_ms = (time.perf_counter() - start_time) * 1000
                if duration_ms > 100:
                    logger.warning(f"Slow query '{name}': {duration_ms:.2f}ms")
        return wrapper
    return decorator


# ==================== LAZY LOADING ====================

class LazyLoader:
    """
    Lazy loading helper for expensive operations.
    
    Caches the result of an async function and refreshes it periodically.
    """
    
    def __init__(
        self,
        loader_func: Callable,
        ttl_seconds: int = 300,
        name: str = "lazy_loader",
    ):
        self.loader_func = loader_func
        self.ttl_seconds = ttl_seconds
        self.name = name
        self._cache: Optional[Any] = None
        self._loaded_at: Optional[datetime] = None
        self._loading: bool = False
        self._lock = asyncio.Lock()
    
    @property
    def is_stale(self) -> bool:
        """Check if cache is stale."""
        if self._loaded_at is None:
            return True
        return datetime.utcnow() - self._loaded_at > timedelta(seconds=self.ttl_seconds)
    
    async def get(self, force_refresh: bool = False) -> Any:
        """Get the cached value, loading if necessary."""
        if not force_refresh and not self.is_stale and self._cache is not None:
            return self._cache
        
        async with self._lock:
            # Double-check after acquiring lock
            if not force_refresh and not self.is_stale and self._cache is not None:
                return self._cache
            
            self._loading = True
            try:
                start_time = time.perf_counter()
                self._cache = await self.loader_func()
                self._loaded_at = datetime.utcnow()
                duration_ms = (time.perf_counter() - start_time) * 1000
                logger.debug(f"Loaded '{self.name}' in {duration_ms:.2f}ms")
                return self._cache
            finally:
                self._loading = False
    
    async def refresh(self) -> Any:
        """Force refresh the cache."""
        return await self.get(force_refresh=True)
    
    def invalidate(self) -> None:
        """Invalidate the cache."""
        self._cache = None
        self._loaded_at = None


# ==================== PAGINATION HELPERS ====================

class PaginationParams:
    """Standard pagination parameters."""
    
    def __init__(
        self,
        page: int = 1,
        page_size: int = 20,
        max_page_size: int = 100,
    ):
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), max_page_size)
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        return self.page_size


def paginate_query(query, page: int, page_size: int, max_size: int = 100):
    """Apply pagination to a SQLAlchemy query."""
    params = PaginationParams(page, page_size, max_size)
    return query.offset(params.offset).limit(params.limit)


# ==================== BATCH PROCESSING ====================

async def batch_process(
    items: List[T],
    processor: Callable[[T], Any],
    batch_size: int = 100,
    delay_between_batches: float = 0.1,
) -> List[Any]:
    """
    Process items in batches to avoid memory issues.
    
    Args:
        items: List of items to process
        processor: Async function to process each item
        batch_size: Number of items per batch
        delay_between_batches: Delay in seconds between batches
    
    Returns:
        List of results
    """
    results = []
    
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        batch_results = await asyncio.gather(
            *[processor(item) for item in batch],
            return_exceptions=True,
        )
        results.extend(batch_results)
        
        if i + batch_size < len(items):
            await asyncio.sleep(delay_between_batches)
    
    return results


async def chunked_fetch(
    fetch_func: Callable[[int, int], List[T]],
    total_count: int,
    chunk_size: int = 1000,
) -> List[T]:
    """
    Fetch large datasets in chunks to avoid memory issues.
    
    Args:
        fetch_func: Async function(offset, limit) -> List[T]
        total_count: Total number of records to fetch
        chunk_size: Number of records per chunk
    
    Returns:
        Combined list of all records
    """
    all_records = []
    
    for offset in range(0, total_count, chunk_size):
        chunk = await fetch_func(offset, chunk_size)
        all_records.extend(chunk)
    
    return all_records


# ==================== RATE LIMITING ====================

class RateLimiter:
    """
    Simple in-memory rate limiter.
    
    For production, use Redis-based rate limiting.
    """
    
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, List[datetime]] = {}
        self._lock = asyncio.Lock()
    
    async def is_allowed(self, key: str) -> bool:
        """Check if request is allowed for the given key."""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.window_seconds)
        
        async with self._lock:
            # Get or create request list
            if key not in self._requests:
                self._requests[key] = []
            
            # Remove old requests
            self._requests[key] = [
                req_time for req_time in self._requests[key]
                if req_time > window_start
            ]
            
            # Check limit
            if len(self._requests[key]) >= self.max_requests:
                return False
            
            # Add current request
            self._requests[key].append(now)
            return True
    
    async def get_remaining(self, key: str) -> int:
        """Get remaining requests for the key."""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.window_seconds)
        
        async with self._lock:
            if key not in self._requests:
                return self.max_requests
            
            valid_requests = [
                req_time for req_time in self._requests[key]
                if req_time > window_start
            ]
            return max(0, self.max_requests - len(valid_requests))


# ==================== CONNECTION POOL CONFIGURATION ====================

def configure_db_pool(
    pool_size: int = 20,
    max_overflow: int = 30,
    pool_timeout: int = 30,
    pool_recycle: int = 1800,
) -> Dict[str, Any]:
    """
    Get recommended database connection pool configuration.
    
    Args:
        pool_size: Number of connections to keep in the pool
        max_overflow: Maximum overflow connections beyond pool_size
        pool_timeout: Seconds to wait for a connection from pool
        pool_recycle: Recycle connections after this many seconds
    
    Returns:
        Dict of connection arguments for SQLAlchemy create_async_engine
    """
    return {
        "pool_size": pool_size,
        "max_overflow": max_overflow,
        "pool_timeout": pool_timeout,
        "pool_recycle": pool_recycle,
        "pool_pre_ping": True,  # Verify connections before use
        "echo": False,  # Set to True for SQL debugging
    }


# ==================== RESPONSE OPTIMIZATION ====================

def slim_response(
    data: Dict[str, Any],
    include_fields: Optional[List[str]] = None,
    exclude_fields: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Create a slimmed-down response with only necessary fields.
    
    Args:
        data: Original response data
        include_fields: Only include these fields (if specified)
        exclude_fields: Exclude these fields
    
    Returns:
        Filtered dictionary
    """
    if include_fields:
        return {k: v for k, v in data.items() if k in include_fields}
    
    if exclude_fields:
        return {k: v for k, v in data.items() if k not in exclude_fields}
    
    return data


# ==================== GLOBAL INSTANCES ====================

# Rate limiters for common endpoints
api_rate_limiter = RateLimiter(max_requests=100, window_seconds=60)
stress_test_rate_limiter = RateLimiter(max_requests=10, window_seconds=60)
export_rate_limiter = RateLimiter(max_requests=5, window_seconds=60)
