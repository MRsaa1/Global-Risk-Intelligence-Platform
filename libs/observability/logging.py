"""
Structured logging setup with structlog.
"""

import logging
import sys
from typing import Any, Dict

import structlog
from structlog.stdlib import LoggerFactory


def setup_logging(level: str = "INFO", json_output: bool = False):
    """
    Setup structured logging.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR)
        json_output: Output logs as JSON (for production)
    """
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, level.upper()),
    )

    # Configure structlog
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if json_output:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.extend([
            structlog.dev.ConsoleRenderer(),
        ])

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = None) -> structlog.BoundLogger:
    """
    Get logger instance.

    Args:
        name: Logger name (default: calling module)

    Returns:
        Logger instance
    """
    return structlog.get_logger(name)


def add_context(**kwargs: Any) -> Dict[str, Any]:
    """
    Add context to all subsequent log messages.

    Args:
        **kwargs: Context key-value pairs

    Returns:
        Context dict
    """
    return structlog.contextvars.bind_contextvars(**kwargs)

