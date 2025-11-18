"""
Observability - OpenTelemetry, Prometheus, structured logging.

Provides comprehensive observability for the platform including
metrics, tracing, and structured logging.
"""

from libs.observability.metrics import MetricsCollector, register_metrics
from libs.observability.tracing import setup_tracing, get_tracer
from libs.observability.logging import setup_logging, get_logger

__all__ = [
    "MetricsCollector",
    "register_metrics",
    "setup_tracing",
    "get_tracer",
    "setup_logging",
    "get_logger",
]

__version__ = "1.0.0"

