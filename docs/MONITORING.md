# Monitoring and Alerting

Guidance for logging, metrics, and alerting in production.

**Краткая справка «Что · Где»:** [OPERATIONS_REFERENCE.md](OPERATIONS_REFERENCE.md) — логирование, алертинг, LPR, BigQuery, SLA.

## Logging

- **API logs:** On deploy, the API process writes to a log file (e.g. `/tmp/api.log` on the server). See [DEPLOY.md](../DEPLOY.md#logs) for how to tail logs.
- **Rotation:** Use logrotate to rotate `/tmp/api.log` (and optionally `/tmp/web.log`). A config file is in the repo: [infra/logrotate/pfrp-api.conf](../infra/logrotate/pfrp-api.conf).

  **Automatic setup on deploy:** Step 14 of [deploy-safe.sh](../deploy-safe.sh) runs [scripts/setup-logrotate-on-server.sh](../scripts/setup-logrotate-on-server.sh) on the server. If it fails (e.g. no sudo), install once manually:

  ```bash
  sudo cp infra/logrotate/pfrp-api.conf /etc/logrotate.d/pfrp-api
  ```

  Test: `sudo logrotate -d /etc/logrotate.d/pfrp-api`.

- **Structured logging:** The API uses structlog (JSON) for structured logs; ensure the log destination is suitable for aggregation if you use a central logging service later.

## Metrics

- **Lightweight metrics:** `GET /api/v1/platform/metrics` returns:
  - `uptime_seconds` — process uptime
  - `active_alerts_count` — number of active SENTINEL alerts
  - `sentinel_monitoring` — whether the monitoring loop is running
  - `neo4j`, `minio`, `timescale` — status of optional services (`connected`, `disabled`, `error`, `unavailable`)

- **Detailed health:** `GET /api/v1/health/detailed` returns database, Redis, Neo4j, external APIs, and system (memory, CPU) status.

- **Layer status:** `GET /api/v1/platform/layers` returns full platform layer metrics (Verified Truth, Digital Twins, Network Intelligence, Simulation, Agents, PARS).

## Alerting (API down / 5xx)

- **External monitoring:** Configure an external service (e.g. [UptimeRobot](https://uptimerobot.com), Pingdom, or your own) to:
  - Poll `GET /api/v1/health` (or your public API URL + `/api/v1/health`) every 1–5 minutes.
  - Alert when the response is non-200 or the body does not contain `"status":"healthy"`.

- **External monitoring:** Configure an external service (e.g. [UptimeRobot](https://uptimerobot.com), Pingdom, or your own) to poll `GET /api/v1/health` every 1–5 minutes and alert when the response is non-200 or the body does not contain `"status":"healthy"`.

- **Health check script + cron (on server):** The repo includes [scripts/check-api-health.sh](../scripts/check-api-health.sh). **Step 14 of deploy** runs [scripts/setup-health-check-cron.sh](../scripts/setup-health-check-cron.sh) on the server to add a cron job every 5 minutes. On failure (exit 1) you can wire cron mail (MAILTO) or an alerting wrapper.

  ```bash
  API_BASE_URL=https://risk.saa-alliance.com ./scripts/check-api-health.sh
  ```

  Optional env: `CHECK_BODY=1` to require `"status":"healthy"` in the JSON body; `HEALTH_CHECK_TIMEOUT=10` (seconds).

## References

- [DEPLOY.md](../DEPLOY.md) — deploy and logs
- [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) — pre-release checks
- After P1+ incident: [INCIDENT_POSTMORTEM_TEMPLATE.md](INCIDENT_POSTMORTEM_TEMPLATE.md). On-call steps: [RUNBOOK_ONCALL.md](RUNBOOK_ONCALL.md).
