"""
Prometheus metrics for API observability.

Exposed at GET /metrics in Prometheus text format.
"""
from prometheus_client import Counter, Histogram, Gauge, REGISTRY

# Request count by method, path, status
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
    registry=REGISTRY,
)

# Request duration in seconds by method and path
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0),
    registry=REGISTRY,
)

# Last successful refresh Unix timestamp per ingestion source (set when /metrics is scraped)
DATA_SOURCE_LAST_REFRESH = Gauge(
    "data_source_last_refresh_timestamp_seconds",
    "Last successful refresh Unix timestamp per source_id",
    ["source_id"],
    registry=REGISTRY,
)


def record_request(method: str, path: str, status: int, duration_seconds: float) -> None:
    """Record one HTTP request for Prometheus."""
    # Normalize path for cardinality: strip trailing slash, use path as-is (no IDs in path by default)
    path_label = path.rstrip("/") or "/"
    HTTP_REQUESTS_TOTAL.labels(method=method, path=path_label, status=status).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path_label).observe(duration_seconds)
