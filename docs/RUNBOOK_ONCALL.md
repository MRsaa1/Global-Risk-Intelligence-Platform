# Runbook for on-call (operator and engineer)

Step-by-step actions for common incidents. Keep this document short; link to MONITORING and DEPLOY for details.

---

## 1. API not responding / 5xx

1. **Check:** Open `GET /api/v1/health` in browser or `curl`. If non-200 or no `"status":"healthy"`, proceed.
2. **Logs:** On server, `tail -n 200 /tmp/api.log` (or path from [DEPLOY.md](../DEPLOY.md#logs)). Look for tracebacks, OOM, or repeated errors.
3. **Process:** `ps aux | grep uvicorn`. If process is missing, restart (see “Restart services” below).
4. **Escalate:** If unclear or data corruption suspected → hand off to engineer; share logs and timeline.

---

## 2. Database unavailable

1. **Check:** `GET /api/v1/health/detailed` — look at `database` (or DB section) in response.
2. **SQLite:** If using SQLite, check disk space and file permissions on `prod.db` / `dev.db`. Restore from backup if file corrupted.
3. **PostgreSQL:** Verify `DATABASE_URL` and that Postgres is running; check connection from app host. Restore from backup if needed.
4. **Escalate:** DB restore or migration issues → engineer.

---

## 3. Redis / queues

1. **Check:** `GET /api/v1/health/detailed` — Redis status. If Redis is optional (`ENABLE_REDIS=false`), app may run without it.
2. **If required:** Restart Redis; check `REDIS_URL`. Clear or inspect queues only with engineer guidance.

---

## 4. WebSocket disconnections

1. **Check:** Frontend or clients report WS drops; check nginx/proxy timeouts and `GET /api/v1/health`.
2. **Logs:** Search API logs for WebSocket errors or connection resets.
3. **Restart:** Restart API (and proxy if applicable). Ensure WS endpoint URL and proxy config match (see DEPLOY).

---

## 5. Data degradation (sla-status red)

1. **Check:** `GET /api/v1/ingestion/sla-status` — any source `stale` or `fail`.
2. **Action:** Usually no immediate restart; ingestion runs on schedule. Note which source and last refresh time; escalate to engineer if persistent. See [DATA_QUALITY.md](DATA_QUALITY.md), [OBSERVABILITY_SLO.md](OBSERVABILITY_SLO.md).

---

## 6. Viewing logs

- **API:** structlog JSON; path on server from [DEPLOY.md](../DEPLOY.md) (e.g. `/tmp/api.log`). Rotate via [infra/logrotate/pfrp-api.conf](../infra/logrotate/pfrp-api.conf).
- **Frontend:** Browser devtools console and network; server logs for static serving (nginx).

---

## 7. Restarting services

On server (paths may vary; see DEPLOY and deploy script):

```bash
# Example (adjust to your setup)
cd /path/to/global-risk-platform/apps/api && source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 9002
# Or use systemd/supervisor if configured:
# sudo systemctl restart pfrp-api
```

Frontend: restart the process serving `dist/` (e.g. nginx reload or Node server).

---

## 8. Escalation

- **Operator:** Run this runbook; collect logs, health output, and timeline; open incident and notify engineer if unresolved or data/security impact.
- **Engineer:** Root cause, code/config fixes, restore from backup, postmortem. Use [INCIDENT_POSTMORTEM_TEMPLATE.md](INCIDENT_POSTMORTEM_TEMPLATE.md) after P1+ incidents.

---

## References

- [MONITORING.md](MONITORING.md) — logging, metrics, external checks
- [DEPLOY.md](../DEPLOY.md) — deploy and logs
- [INCIDENT_POSTMORTEM_TEMPLATE.md](INCIDENT_POSTMORTEM_TEMPLATE.md) — post-incident template
