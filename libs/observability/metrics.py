"""
Prometheus metrics collection.
"""

from typing import Dict, Any
import structlog
from prometheus_client import Counter, Histogram, Gauge, generate_latest, REGISTRY

logger = structlog.get_logger(__name__)


class MetricsCollector:
    """Prometheus metrics collector."""

    def __init__(self):
        """Initialize metrics collector."""
        self._metrics: Dict[str, Any] = {}

    def register_metric(self, name: str, metric_type: str, description: str, labels: list[str] = None):
        """Register a metric."""
        labels = labels or []

        if metric_type == "counter":
            metric = Counter(name, description, labels)
        elif metric_type == "histogram":
            metric = Histogram(name, description, labels)
        elif metric_type == "gauge":
            metric = Gauge(name, description, labels)
        else:
            raise ValueError(f"Unknown metric type: {metric_type}")

        self._metrics[name] = metric
        return metric

    def increment_counter(self, name: str, labels: Dict[str, str] = None, value: float = 1.0):
        """Increment a counter."""
        if name in self._metrics:
            metric = self._metrics[name]
            if labels:
                metric.labels(**labels).inc(value)
            else:
                metric.inc(value)

    def observe_histogram(self, name: str, value: float, labels: Dict[str, str] = None):
        """Observe a histogram value."""
        if name in self._metrics:
            metric = self._metrics[name]
            if labels:
                metric.labels(**labels).observe(value)
            else:
                metric.observe(value)

    def set_gauge(self, name: str, value: float, labels: Dict[str, str] = None):
        """Set a gauge value."""
        if name in self._metrics:
            metric = self._metrics[name]
            if labels:
                metric.labels(**labels).set(value)
            else:
                metric.set(value)

    def get_metrics(self) -> str:
        """Get metrics in Prometheus format."""
        return generate_latest(REGISTRY).decode('utf-8')


# Global metrics collector
_metrics_collector = MetricsCollector()


def register_metrics():
    """Register default metrics."""
    # Calculation metrics
    _metrics_collector.register_metric(
        "calculations_total",
        "counter",
        "Total number of calculations",
        ["status", "scenario_type"],
    )

    _metrics_collector.register_metric(
        "calculation_duration_seconds",
        "histogram",
        "Calculation duration in seconds",
        ["scenario_type"],
    )

    # API metrics
    _metrics_collector.register_metric(
        "api_requests_total",
        "counter",
        "Total API requests",
        ["method", "endpoint", "status"],
    )

    _metrics_collector.register_metric(
        "api_request_duration_seconds",
        "histogram",
        "API request duration",
        ["method", "endpoint"],
    )

    # System metrics
    _metrics_collector.register_metric(
        "active_calculations",
        "gauge",
        "Number of active calculations",
    )

    _metrics_collector.register_metric(
        "cache_hits_total",
        "counter",
        "Total cache hits",
    )

    _metrics_collector.register_metric(
        "cache_misses_total",
        "counter",
        "Total cache misses",
    )


def get_metrics_collector() -> MetricsCollector:
    """Get global metrics collector."""
    return _metrics_collector

