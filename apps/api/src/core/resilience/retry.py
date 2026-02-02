"""
Retry logic with exponential backoff.
"""
import asyncio
import logging
import random
from typing import Callable, Any, Optional, Type, Tuple
from functools import wraps

logger = logging.getLogger(__name__)


class RetryConfig:
    """Configuration for retry logic."""
    
    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
        retry_on: Tuple[Type[Exception], ...] = (Exception,),
    ):
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.retry_on = retry_on


async def retry_with_backoff(
    func: Callable,
    config: Optional[RetryConfig] = None,
    *args,
    **kwargs,
) -> Any:
    """
    Retry function with exponential backoff.
    
    Args:
        func: Async function to retry
        config: Retry configuration
        *args, **kwargs: Arguments for function
        
    Returns:
        Function result
        
    Raises:
        Last exception if all retries fail
    """
    if config is None:
        config = RetryConfig()
    
    last_exception = None
    
    for attempt in range(1, config.max_attempts + 1):
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
                
        except config.retry_on as e:
            last_exception = e
            
            if attempt == config.max_attempts:
                logger.warning(
                    f"Retry failed after {attempt} attempts for {func.__name__}: {e}"
                )
                raise
            
            # Calculate delay with exponential backoff
            delay = min(
                config.initial_delay * (config.exponential_base ** (attempt - 1)),
                config.max_delay,
            )
            
            # Add jitter to prevent thundering herd
            if config.jitter:
                delay = delay * (0.5 + random.random() * 0.5)
            
            logger.debug(
                f"Retry attempt {attempt}/{config.max_attempts} for {func.__name__} "
                f"after {delay:.2f}s: {e}"
            )
            
            await asyncio.sleep(delay)
    
    # Should never reach here, but just in case
    if last_exception:
        raise last_exception
    raise Exception("Retry failed without exception")


def retryable(
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    retry_on: Tuple[Type[Exception], ...] = (Exception,),
):
    """
    Decorator for retry with exponential backoff.
    
    Usage:
        @retryable(max_attempts=3, initial_delay=1.0)
        async def my_function():
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            config = RetryConfig(
                max_attempts=max_attempts,
                initial_delay=initial_delay,
                max_delay=max_delay,
                retry_on=retry_on,
            )
            return await retry_with_backoff(func, config, *args, **kwargs)
        return wrapper
    return decorator
