"""
Circuit Breaker pattern for external services and APIs.

Prevents cascading failures by stopping requests to failing services
and allowing them to recover.
"""
import asyncio
import time
import logging
from enum import Enum
from typing import Callable, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5  # Open circuit after N failures
    timeout: int = 60  # Seconds before trying half-open
    success_threshold: int = 2  # Close circuit after N successes in half-open
    expected_exception: type = Exception  # Exception type to catch


class CircuitBreaker:
    """
    Circuit Breaker for protecting external services.
    
    Usage:
        breaker = CircuitBreaker("redis", failure_threshold=5, timeout=60)
        
        try:
            result = await breaker.call(redis_client.ping)
        except CircuitBreakerOpenError:
            # Use fallback
            pass
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        timeout: int = 60,
        success_threshold: int = 2,
        expected_exception: type = Exception,
    ):
        self.name = name
        self.config = CircuitBreakerConfig(
            failure_threshold=failure_threshold,
            timeout=timeout,
            success_threshold=success_threshold,
            expected_exception=expected_exception,
        )
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[float] = None
        self.last_success_time: Optional[float] = None
        self._lock = asyncio.Lock()
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection.
        
        Args:
            func: Async function to call
            *args, **kwargs: Arguments for function
            
        Returns:
            Function result
            
        Raises:
            CircuitBreakerOpenError: If circuit is open
            Exception: Original exception from function
        """
        async with self._lock:
            # Check if we should transition from OPEN to HALF_OPEN
            if self.state == CircuitState.OPEN:
                if self.last_failure_time and (time.time() - self.last_failure_time) > self.config.timeout:
                    logger.info(f"Circuit breaker {self.name}: OPEN → HALF_OPEN (testing recovery)")
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                else:
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker {self.name} is OPEN. "
                        f"Last failure: {self.last_failure_time}. "
                        f"Retry after {self.config.timeout}s"
                    )
        
        # Try to execute function
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            # Success - update state
            async with self._lock:
                self.last_success_time = time.time()
                
                if self.state == CircuitState.HALF_OPEN:
                    self.success_count += 1
                    if self.success_count >= self.config.success_threshold:
                        logger.info(f"Circuit breaker {self.name}: HALF_OPEN → CLOSED (recovered)")
                        self.state = CircuitState.CLOSED
                        self.failure_count = 0
                        self.success_count = 0
                elif self.state == CircuitState.CLOSED:
                    # Reset failure count on success
                    self.failure_count = 0
            
            return result
            
        except self.config.expected_exception as e:
            # Failure - update state
            async with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.state == CircuitState.HALF_OPEN:
                    # Failed during test - go back to OPEN
                    logger.warning(f"Circuit breaker {self.name}: HALF_OPEN → OPEN (test failed)")
                    self.state = CircuitState.OPEN
                    self.success_count = 0
                elif self.state == CircuitState.CLOSED:
                    if self.failure_count >= self.config.failure_threshold:
                        logger.warning(
                            f"Circuit breaker {self.name}: CLOSED → OPEN "
                            f"(failure_count={self.failure_count} >= threshold={self.config.failure_threshold})"
                        )
                        self.state = CircuitState.OPEN
            
            raise
    
    def get_state(self) -> dict:
        """Get current circuit breaker state."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure_time": self.last_failure_time,
            "last_success_time": self.last_success_time,
        }
    
    async def reset(self):
        """Manually reset circuit breaker to CLOSED state."""
        async with self._lock:
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            self.success_count = 0
            self.last_failure_time = None
            logger.info(f"Circuit breaker {self.name}: manually reset to CLOSED")


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is OPEN and rejects request."""
    pass


# Global circuit breakers for common services
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str, **kwargs) -> CircuitBreaker:
    """Get or create circuit breaker for a service."""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name, **kwargs)
    return _circuit_breakers[name]


def get_all_circuit_breakers() -> dict[str, dict]:
    """Get state of all circuit breakers."""
    return {name: cb.get_state() for name, cb in _circuit_breakers.items()}
