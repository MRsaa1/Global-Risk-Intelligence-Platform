# Agent Self-Healing (Overseer)

The platform has an **Overseer** agent that **automatically detects and fixes** common infrastructure issues.

## How it works

1. **Background loop** (see `apps/api/src/main.py`):
   - Every `oversee_interval_sec` seconds (default **300** = 5 minutes), the Overseer runs a full cycle:
     - Collects health snapshot (DB, Redis, Neo4j, external APIs, SENTINEL, etc.)
     - Evaluates rules → produces `system_alerts`
     - **Runs `auto_resolve_issues(system_alerts)`** → takes actions to fix what it can
     - Re-collects snapshot so status reflects the fix
     - Optionally generates an LLM executive summary and broadcasts via WebSocket

2. **What the agent fixes automatically** (`apps/api/src/services/oversee.py` → `auto_resolve_issues`):
   - **SENTINEL stopped** → auto-starts monitoring
   - **Database (PostgreSQL/SQLite) down** → resets circuit breaker, retries connection
   - **Redis down** → resets circuit breaker, reconnects (or falls back to in-memory)
   - **Neo4j down** → resets circuit breaker, retries
   - **Minio/Timescale circuit breaker open** → resets so next request can retry
   - **High memory** → cache cleanup / clear old entries
   - **Performance issues** → logged for analysis

3. **On-demand when user asks** (AI Assistant):
   - When the user asks about errors, health, or "fix" (e.g. "system is broken", "run diagnostics"), and the current status is **degraded** or **critical**, the backend **runs one Overseer cycle** before answering. So the agent self-heals first, then the answer reflects the new status and any `auto_resolution_actions`.

## Configuration

- **`OVERSEER_INTERVAL_SEC`** (default `300`): how often the background loop runs. Lower = more frequent self-healing (e.g. `60` for every minute).
- **`OVERSEE_USE_LLM`**: if `true`, each cycle also produces an LLM executive summary (uses NVIDIA LLM).

## Manual trigger

- **POST /api/v1/oversee/run** — run one cycle immediately (e.g. from UI "Run diagnostics" or from the AI assistant remediation intent).
- **GET /api/v1/oversee/status** — returns last status and **`auto_resolution_actions`** (list of what the agent did in the last cycle).

## Summary

The agent **already fixes problems by itself** in the background every 5 minutes and when you ask the assistant about health/errors. To make it react faster, set `OVERSEER_INTERVAL_SEC=60` (or lower) in `apps/api/.env`.
