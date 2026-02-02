"""
Fallback mechanisms for service degradation.
"""
import asyncio
import logging
from typing import Callable, Any, Optional, TypeVar
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


class FallbackStrategy:
    """Base class for fallback strategies."""
    
    async def execute(self, primary: Callable, fallback: Callable, *args, **kwargs) -> Any:
        """Execute primary, fallback to secondary on failure."""
        try:
            if asyncio.iscoroutinefunction(primary):
                return await primary(*args, **kwargs)
            else:
                return primary(*args, **kwargs)
        except Exception as e:
            logger.warning(f"Primary function failed, using fallback: {e}")
            if asyncio.iscoroutinefunction(fallback):
                return await fallback(*args, **kwargs)
            else:
                return fallback(*args, **kwargs)


async def with_fallback(
    primary: Callable,
    fallback: Callable,
    *args,
    **kwargs,
) -> Any:
    """
    Execute primary function, fallback to secondary on failure.
    
    Args:
        primary: Primary function to try
        fallback: Fallback function if primary fails
        *args, **kwargs: Arguments for functions
        
    Returns:
        Result from primary or fallback
    """
    try:
        if asyncio.iscoroutinefunction(primary):
            return await primary(*args, **kwargs)
        else:
            return primary(*args, **kwargs)
    except Exception as e:
        logger.warning(f"Primary function failed, using fallback: {e}")
        if asyncio.iscoroutinefunction(fallback):
            return await fallback(*args, **kwargs)
        else:
            return fallback(*args, **kwargs)


def fallback_to(fallback_func: Callable):
    """
    Decorator for fallback function.
    
    Usage:
        @fallback_to(mock_knowledge_graph_query)
        async def query_knowledge_graph():
            ...
    """
    def decorator(primary_func: Callable):
        @wraps(primary_func)
        async def wrapper(*args, **kwargs):
            return await with_fallback(primary_func, fallback_func, *args, **kwargs)
        return wrapper
    return decorator
