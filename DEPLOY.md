# Deploy — Global Risk Platform

## Pre-Release Checklist

Before each production deploy, verify: health (`/api/v1/health`), migrations (`alembic upgrade head`), frontend build with correct `VITE_API_URL`, and that the deploy script does **not** overwrite server `.env` or production databases. Full checklist: [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md). **Plan verification:** [docs/FULL_IMPLEMENTATION_LAUNCH_VERIFICATION.md](docs/FULL_IMPLEMENTATION_LAUNCH_VERIFICATION.md) maps the full implementation and launch plan to the codebase.

## Quick Deploy (Contabo)

```bash
./deploy.sh
```

That's it. The script handles everything safely:

| What | How |
|------|-----|
| `.env` (API keys, secrets) | **Never overwritten** — backed up and restored from server |
| Databases (`*.db`) | **Never overwritten** — backed up and restored |
| Backend deps | Auto-installed in venv |
| DB migrations | Alembic `upgrade head` (non-blocking on failure) |
| Frontend | `npm run build` with `VITE_API_URL=https://risk.saa-alliance.com` |
| Dashboard / API calls | All dashboard, analytics, data sources, overseer, and ingestion requests use `getApiV1Base()` (from `VITE_API_URL` or same origin), so they work on server and with tunnel (`?api=...`) |
| Services | Restarted (API on 9002, frontend on 5180, nginx on 80/443) |
| Health check | Waits for API, verifies key endpoints |
| Demo seed | Auto-seeds if `ALLOW_SEED_IN_PRODUCTION=true` |

## What's Deployed

- **Frontend**: https://risk.saa-alliance.com (nginx serves `dist/`)
- **API**: https://risk.saa-alliance.com/api/v1/health
- **WebSocket**: wss://risk.saa-alliance.com/api/v1/streaming/ws/stream

## Custom Server

```bash
DEPLOY_HOST=my-server DEPLOY_PORT=22 DEPLOY_USER=ubuntu ./deploy.sh
```

Or with a specific SSH key:

```bash
SSH_KEY=~/.ssh/my_key ./deploy.sh
```

## Environment Variables

All API keys live in `apps/api/.env` **on the server only**. They are never sent from your local machine.

On first deploy, a `.env` is auto-created with a generated `SECRET_KEY`. Edit on the server:

```bash
ssh -p 32769 arin@contabo
nano /home/arin/global-risk-platform/apps/api/.env
```

Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | Auto-generated on first deploy; change to `openssl rand -hex 32` |
| `DATABASE_URL` | Yes | Default: `sqlite:///./prod.db` |
| `CORS_ORIGINS` | Yes | Auto-set to `["https://risk.saa-alliance.com"]` |
| `NVIDIA_API_KEY` | No | NVIDIA NIM / LLM API key |
| `NOAA_API_TOKEN` | No | Weather data |
| `FIRMS_MAP_KEY` | No | NASA wildfire data |
| `ENABLE_REDIS` | No | `true` to enable Redis |
| `ENABLE_NEO4J` | No | `false` (default) — set `true` only if Neo4j is running |
| `RISK_CACHE_TTL_HOURS` | No | `24` (default) — cache for risk scores so levels don't flicker; set 24 on server for stable display |
| `USE_SQLITE` | No | `true` — API and Alembic use same DB (prod.db then dev.db) |

## Stable risk display (как часы — без скачков critical↔high)

Чтобы на сервере уровни риска не прыгали между critical и high, как в локальной среде:

1. **Одна БД для API и миграций**  
   Не перезаписывайте серверный `.env`: в нём должен быть тот же путь к БД, что и при запуске Alembic (см. [docs/RISK_EVENTS_SETUP.md](docs/RISK_EVENTS_SETUP.md)). По умолчанию API использует `prod.db`, затем `dev.db` — как и Alembic.

2. **Долгий кэш рисков**  
   В `apps/api/.env` на сервере задайте:
   ```bash
   RISK_CACHE_TTL_HOURS=24
   ```
   Так кэш городских и агрегированных рисков живёт 24 часа, уровни не пересчитываются при каждом запросе и не дёргаются из-за мелких колебаний данных.

3. **Гистерезис**  
   В коде уже включён гистерезис для country risk и city risk: переход вниз (critical→high, high→medium) происходит только когда score падает ниже порога выхода (0.75, 0.55, 0.35). После деплоя с этими настройками поведение на сервере совпадает с локальным.

4. **Один воркер API (рекомендуется)**  
   При одном процессе uvicorn кэш и гистерезис общие. Несколько воркеров — каждый со своим кэшем; для стабильности лучше один воркер или общий Redis (если добавите кэш в Redis).

После изменений перезапустите API и при необходимости выполните sync реестра и USGS (см. [docs/RISK_EVENTS_SETUP.md](docs/RISK_EVENTS_SETUP.md)).

## Docker (Alternative)

If you prefer Docker instead of direct deploy:

```bash
# Build and run
docker compose -f docker-compose.prod.yml up -d --build

# Check logs
docker compose -f docker-compose.prod.yml logs -f api
```

Prerequisites: SSL certificates in `/etc/letsencrypt/`, frontend built locally (`npm run build` in `apps/web`).

## Rollback

If something goes wrong:

```bash
ssh -p 32769 arin@contabo
cd /home/arin/global-risk-platform/apps/api

# Restore database and env from backup
cp ~/pfrp-preserve/db/prod.db .
cp ~/pfrp-preserve/.env .

# Restart API
source .venv/bin/activate
pkill -f uvicorn
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
```

Full project backups are kept at `~/global-risk-platform-backup-*.tar.gz` (last 3).

## Logs

See [docs/MONITORING.md](docs/MONITORING.md) for logging, metrics (`/api/v1/platform/metrics`), and alerting (API down / 5xx).

```bash
# API logs
ssh -p 32769 arin@contabo 'tail -f /tmp/api.log'

# Frontend logs
ssh -p 32769 arin@contabo 'tail -f /tmp/web.log'

# Nginx logs (if using Docker)
docker compose -f docker-compose.prod.yml logs -f nginx
```

## Troubleshooting

### DNS resolution on server

```bash
echo 'nameserver 1.1.1.1' | sudo tee /etc/resolv.conf
```

### Migration "table already exists"

```bash
cd /home/arin/global-risk-platform/apps/api
source .venv/bin/activate
alembic stamp head
alembic upgrade head
```

### API not starting

```bash
tail -50 /tmp/api.log
# Common: missing package → pip install <package>
# Common: port in use → kill -9 $(lsof -i :9002 -t)
```

### Risk level jumping between critical and high

Ensure on the server: same database as local (see [docs/RISK_EVENTS_SETUP.md](docs/RISK_EVENTS_SETUP.md)), `RISK_CACHE_TTL_HOURS=24` in `apps/api/.env`, and a single API process. Restart the API after changing `.env`.
