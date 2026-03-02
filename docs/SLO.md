# Service Level Objectives (SLO)

This document defines target SLOs for the Physical-Financial Risk Platform API and how to alert on them.

## Metrics contract

The API exposes Prometheus metrics at `GET /metrics`:

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by `method`, `path`, `status` |
| `http_request_duration_seconds` | Histogram | Request duration in seconds by `method`, `path` (buckets: 0.01–10s) |
| `data_source_last_refresh_timestamp_seconds` | Gauge | Last successful refresh timestamp per `source_id` (see Data quality / ingestion) |

Tracing is available when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; span_id/trace_id are added to structlog when present.

---

## SLO targets

### 1. API latency

- **Target:** P95 latency of API requests **&lt; 2 seconds**.
- **Measurement:** Prometheus query on `http_request_duration_seconds` (e.g. `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`).
- **Alerting:** Fire an alert when P95 over a 5–10 minute window exceeds 2s (e.g. in Grafana Alertmanager or equivalent). Exclude health/docs/metrics paths if desired.

### 2. Data freshness (critical sources)

- **Target:** Critical ingestion sources have **last successful refresh &lt; 1 hour** (configurable per source).
- **Measurement:** Compare `data_source_last_refresh_timestamp_seconds{source_id="..."}` to current time; or use `GET /api/v1/ingestion/sla-status` (see Data quality contract).
- **Alerting:** Fire when `(time() - data_source_last_refresh_timestamp_seconds) > 3600` for critical source_ids (e.g. `market_data`, `natural_hazards`).

### 3. MTTR (Mean Time To Resolve) for alerts

- **Definition:** Time from alert creation (or first trigger) to resolution (ack + resolve).
- **Measurement:** Log or store `acknowledged_at` and `resolved_at` for alerts; export metric `alert_resolution_seconds` (e.g. histogram or gauge per alert id). Operational dashboard can show average MTTR over a window.
- **Target:** Define operationally (e.g. P90 MTTR &lt; 4 hours for high-severity alerts). Alerts in Grafana/Alertmanager when MTTR exceeds threshold for open alerts.

---

## How to alert

- **Stack:** Use Prometheus to scrape `GET /metrics`, Grafana for dashboards, and Alertmanager (or Grafana alerts) for notifications.
- **Latency:** Alert rule example (PromQL):  
  `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path)) > 2`
- **Freshness:** Alert when SLA status endpoint reports `stale` or `fail` for critical sources, or when `data_source_last_refresh_timestamp_seconds` is older than 1h.
- **MTTR:** Track in application logs or a dedicated metric; alert when open high-severity alerts exceed a target resolution time.

Keeping these metrics stable and documented ensures we can prove quality for city and insurer use cases.
