# Observability: Tracing, Prometheus, SLO

## Tracing (OpenTelemetry)

- **When enabled:** Set `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g. to your collector or backend).
- **Behaviour:** The API calls `setup_tracing()` and instruments FastAPI with OpenTelemetry. Structlog adds `trace_id` and `span_id` to log lines when a span is active.
- **Code:** `apps/api/src/core/tracing.py`, `apps/api/src/main.py` (lifespan / after app creation).

## Prometheus metrics

- **Endpoint:** `GET /metrics` (Prometheus text format).
- **Middleware:** Every request is recorded via `oversee_middleware` → `src.core.metrics.record_request()`.

### Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | method, path, status | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | method, path | Request duration (buckets 0.01–10s) |
| `data_source_last_refresh_timestamp_seconds` | Gauge | source_id | Last successful ingestion refresh (Unix time) per source |

- **Path cardinality:** Path is normalized (trailing slash stripped); path is used as-is (no per-ID paths) to keep cardinality low.
- **JSON metrics:** `GET /metrics/json` returns system/process metrics (CPU, memory, disk) for ad-hoc checks.

## SLO targets (targets for alerting and dashboards)

Use these as targets for Prometheus alerting and SLI dashboards. Adjust per environment.

| SLI | Target | Notes |
|-----|--------|------|
| **API availability** | 99.5% successful requests (2xx/3xx) over 5m | Exclude health/docs from error rate if desired |
| **Latency p95** | &lt; 2s for API (excluding known slow endpoints) | `/api/v1/stress/*`, `/api/v1/cascade/*` may be slower |
| **Latency p99** | &lt; 5s | Same exclusions |
| **Data freshness** | Ingestion sources refreshed within SLA | See `GET /api/v1/ingestion/sla-status`; alert on `status != ok` |
| **Incident MTTR** | &lt; 2h from detection to mitigation | Process target; track via incidents |

### Suggested Prometheus rules (examples)

```yaml
# Example: alert if 5xx rate > 1% over 5m
- alert: HighErrorRate
  expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.01
  for: 5m

# Example: alert if p95 latency > 3s
- alert: HighLatency
  expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path)) > 3
  for: 5m
```

## References

- **SLO панели и алерты:** [SLO_DASHBOARD.md](SLO_DASHBOARD.md) — определения панелей (Freshness, API latency, WS delivery, Alert lag) и правила алертов на данные и model drift.
- Prometheus metrics: `apps/api/src/core/metrics.py`
- Middleware: `apps/api/src/core/middleware/oversee_middleware.py`
- Tracing: `apps/api/src/core/tracing.py`
- Ingestion SLA: `apps/api/src/services/ingestion/pipeline.py` (`get_sla_status`, `SOURCE_SLA_MAX_AGE_SECONDS`)
