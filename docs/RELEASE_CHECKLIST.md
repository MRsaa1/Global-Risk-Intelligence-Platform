# Pre-Release Checklist

Use this checklist before every production deploy to avoid overwriting secrets or data and to verify the release is deployable.

## Before Deploy (local or CI)

- [ ] **Health** — API starts and `/api/v1/health` returns `{"status":"healthy"}` (run API locally or in CI).
- [ ] **Migrations** — From `apps/api`: `alembic upgrade head` runs without errors (or run in CI).
- [ ] **Frontend build** — From `apps/web`: `npm run build` succeeds with correct `VITE_API_URL` for target (e.g. `https://risk.saa-alliance.com` for prod).
- [ ] **No overwrite of .env** — Deploy script does not overwrite server `.env`. Use [deploy-safe.sh](../deploy-safe.sh) or [scripts/deploy-contabo-now.sh](../scripts/deploy-contabo-now.sh); they backup and restore `.env` from server only.
- [ ] **No overwrite of prod DB** — Deploy script backs up and restores `*.db` (e.g. `prod.db`) on the server; it never replaces them with local files. Same scripts as above guarantee this.

## Optional (CI)

- [ ] **Tests** — `pytest` (or project test command) passes in `apps/api`.
- [ ] **Linters** — Project linters/formatting pass (e.g. ruff, eslint) if configured in [.github/workflows/ci.yml](../.github/workflows/ci.yml).

## Production Environment

- [ ] **SECRET_KEY** — Set on server in `apps/api/.env` (never commit).
- [ ] **CORS_ORIGINS** — Set to production frontend origin(s).
- [ ] **ALLOW_SEED_IN_PRODUCTION** — `false` for production; `true` only for demo/staging if desired.

## References

- Deploy process: [DEPLOY.md](../DEPLOY.md), [DEPLOY_SAFE.md](../DEPLOY_SAFE.md).
- Safe deploy preserves server `.env` and `*.db`: [DEPLOY_SAFE.md](../DEPLOY_SAFE.md#что-делает-скрипт).
- After P1+ incident: complete [INCIDENT_POSTMORTEM_TEMPLATE.md](INCIDENT_POSTMORTEM_TEMPLATE.md) within agreed window (e.g. 3–5 business days).
