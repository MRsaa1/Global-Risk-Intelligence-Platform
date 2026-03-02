# Полный деплой на сервер — базы, ключи, чеклист

Пошаговый гайд для развёртывания Physical-Financial Risk Platform на сервере с учётом **всех баз данных** и **всех ключей**.

---

## Критически важные особенности

- **Локальный `.env` на сервер не отправляется** — ключи и базы хранятся только на сервере (скрипт сохраняет их в `~/pfrp-preserve/` и восстанавливает после распаковки). Никогда не перезаписывайте `.env` с машины разработки.
- **Базы (`prod.db`, `dev.db`)** — при каждом деплое бэкапятся в `~/pfrp-preserve/` и восстанавливаются; без этого данные теряются.
- **Risk Flow / Visualizations** — выпадающий список стресс-тестов на сервере должен быть таким же, как локально (15–20+ сценариев). Скрипт `deploy-safe.sh` после подъёма API вызывает **POST /api/v1/stress-tests/admin/seed** (Step 11). Если после деплоя в блоке «Risk Flow Analysis» в селекторе только 4 теста — вручную выполните на сервере: `curl -X POST http://localhost:9002/api/v1/stress-tests/admin/seed`.
- **Фронт запрашивает стресс-тесты с `limit=100`** — чтобы на сервере отображался полный список, как локально.
- **Миграции:** при ошибке «table X already exists» не прерывайте деплой; на сервере выполните `alembic stamp <revision>` и `alembic upgrade head` (см. DEPLOY_SAFE.md).
- **Overseer / Sentinel:** в production при необходимости включите автостарт SENTINEL (`auto_start_sentinel` или `ENVIRONMENT=production`). System Overseer сам пытается исправить БД/Redis/Sentinel (автофикс при Refresh).

---

## 1. Режимы развёртывания

| Режим | База данных | Когда использовать |
|-------|-------------|--------------------|
| **Минимальный (по умолчанию)** | SQLite (`prod.db`) | Один сервер, демо, пилот. Не требует PostgreSQL. |
| **Полный (Docker)** | PostgreSQL + PostGIS, TimescaleDB, Neo4j, Redis, MinIO | Production с геоданными, таймлайном, графом, кэшем, хранилищем файлов. |

Скрипт **`deploy-safe.sh`** по умолчанию использует **SQLite** и не трогает ключи/базы на сервере.

---

## 2. Базы данных — полный список

### 2.1 Основная БД (обязательно одна из двух)

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `USE_SQLITE` | `true` = SQLite, `false` = PostgreSQL | `true` |
| `DATABASE_URL` | URL основной БД | `sqlite:///./prod.db` или `postgresql://pfrp_user:pfrp_secret_2024@localhost:5432/physical_financial_risk` |

- **SQLite:** файл `apps/api/prod.db` (создаётся автоматически). Сохраняется в `~/pfrp-preserve/` при деплое.
- **PostgreSQL:** поднять контейнер `postgres` (docker-compose), выполнить миграции. Инициализация PostGIS: `infra/docker/init-db.sql` (расширения uuid-ossp, postgis, postgis_topology, fuzzystrmatch).

### 2.2 TimescaleDB (опционально)

Хранилище временных рядов: timeline, risk-at-time, H3 risk snapshots.

| Переменная | Описание |
|------------|----------|
| `ENABLE_TIMESCALE` | `true` — включать клиент TimescaleDB |
| `TIMESCALE_URL` | URL. Пример: `postgresql+asyncpg://pfrp_user:pfrp_secret_2024@localhost:5433/timeseries` |

**Инициализация:** после первого запуска контейнера TimescaleDB выполнить на сервере:

```bash
psql "$TIMESCALE_URL" -f apps/api/scripts/init_timescale.sql
```

Скрипт создаёт расширение `timescaledb`, таблицу `risk_snapshots` (hypertable) и индекс.

### 2.3 Neo4j (опционально)

Knowledge Graph — узлы и связи для каскадов, инфраструктуры, RAG.

| Переменная | Значение по умолчанию |
|------------|------------------------|
| `ENABLE_NEO4J` | `false` |
| `NEO4J_URI` | `bolt://localhost:7687` |
| `NEO4J_USER` | `neo4j` |
| `NEO4J_PASSWORD` | задать в .env (в docker-compose: `pfrp_graph_2024`) |

Включить только если поднят контейнер Neo4j и нужен граф.

### 2.4 Redis (опционально)

Кэш и очереди (Celery). Без Redis приложение использует in-memory fallback (данные теряются при рестарте).

| Переменная | Описание |
|------------|----------|
| `ENABLE_REDIS` | `true` — использовать Redis |
| `REDIS_URL` | `redis://localhost:6379` |

### 2.5 MinIO (опционально)

Объектное хранилище: BIM, отчёты, загруженные файлы.

| Переменная | По умолчанию |
|------------|--------------|
| `ENABLE_MINIO` | `false` |
| `MINIO_ENDPOINT` | `localhost:9000` |
| `MINIO_ACCESS_KEY` | задать в .env |
| `MINIO_SECRET_KEY` | задать в .env |
| `MINIO_BUCKET_ASSETS` | `assets` |
| `MINIO_BUCKET_REPORTS` | `reports` |

---

## 3. Ключи и секреты — полный список

### 3.1 Обязательные для продакшена

| Переменная | Где взять | Файл |
|------------|-----------|------|
| `SECRET_KEY` | `openssl rand -hex 32` | `apps/api/.env` |
| `CORS_ORIGINS` | JSON-массив доменов фронта, напр. `["https://risk.saa-alliance.com"]` | `apps/api/.env` |

### 3.2 Приложение

| Переменная | Описание |
|------------|----------|
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |
| `ALLOW_SEED_IN_PRODUCTION` | `true` — разрешить кнопку «Load demo data» (для демо-серверов). |

### 3.3 Внешние API (опционально, но улучшают данные)

| Переменная | Назначение | Где взять |
|------------|------------|-----------|
| `OPENWEATHER_API_KEY` | Погода, flood risk по осадкам | https://openweathermap.org/api |
| `NOAA_API_TOKEN` | NOAA NCDC (исторические события, штормы) | https://www.ncdc.noaa.gov/cdo-web/token |
| `CDS_API_KEY` | Climate Data Store (CMIP6, климат) | https://cds.climate.copernicus.eu/ |
| `NEWSAPI_API_KEY` | Новости для сценариев | https://newsapi.org/ |
| `OPENCORPORATES_API_TOKEN` | Entity resolution (компании) | OpenCorporates |

USGS (Earthquake, 3DEP Elevation, WaterWatch), FEMA NRI — **без ключей**, публичные API.

### 3.4 NVIDIA (LLM, Earth-2, симуляции)

| Переменная | Назначение |
|------------|------------|
| `NVIDIA_API_KEY` или `NVIDIA_LLM_API_KEY` | NVIDIA NGC / Integrate API — чат, генерация отчётов, executive summary. Без ключа — шаблонные тексты. |
| `NVIDIA_MODE` | `cloud` — облачный API; с локальным NIM — `local` и `USE_LOCAL_NIM=true`. |
| `NVIDIA_LLM_API_URL` | По умолчанию `https://integrate.api.nvidia.com/v1`. |
| `NGC_API_KEY` | Для локальных NIM (FourCastNet, CorrDiff) при развёртывании контейнеров. |
| `NVIDIA_CORRDIFF_API_KEY`, `NVIDIA_FOURCASTNET_API_KEY` | При использовании облачных NIM. |
| `NVIDIA_FLUX_API_KEY` | FLUX (генерация изображений). |

### 3.5 Модули (SCSS, ARIN, Overseer)

| Переменная | Назначение |
|------------|------------|
| **SCSS (Phase 5–6)** | |
| `SCSS_SAP_BASE_URL`, `SCSS_SAP_TOKEN` | SAP ERP/PLM синхронизация. |
| `SCSS_ORACLE_BASE_URL`, `SCSS_ORACLE_TOKEN` | Oracle ERP. |
| `SCSS_EDI_ENDPOINT_URL`, `SCSS_EDI_API_KEY` | EDI gateway. |
| `SCSS_OFAC_API_URL`, `SCSS_OFAC_API_KEY` | OFAC санкции. |
| `SCSS_EU_SANCTIONS_URL`, `SCSS_EU_SANCTIONS_API_KEY` | EU санкции. |
| **ARIN** | |
| `ARIN_EXPORT_URL` | URL экспорта в ARIN (напр. `https://arin.saa-alliance.com/api/v1/unified/export`). |
| `ARIN_API_KEY` | Ключ авторизации ARIN (если нужен). |
| **Overseer** | |
| `OVERSEER_CRITICAL_ROUTES_BASE_URL` | Базовый URL API для проверки маршрутов (напр. `http://127.0.0.1:9002`). |

### 3.6 Прочее

| Переменная | Описание |
|------------|----------|
| `E2CC_BASE_URL` | URL Earth-2 Command Center для кнопки «Open in Omniverse». |
| `HIGH_FIDELITY_STORAGE_PATH` | Локальный путь к сценариям WRF/ADCIRC (flood/wind JSON). |
| `HIGH_FIDELITY_S3_BUCKET` | Либо S3 bucket вместо локального пути. |

---

## 4. Фронт (Web) — переменные при сборке

Сборка `npm run build` в `apps/web` подхватывает переменные `VITE_*`. Их нужно задать **на сервере перед сборкой** (или в `apps/web/.env` на сервере, который не в гите).

| Переменная | Назначение |
|------------|------------|
| `VITE_API_URL` | Базовый URL API. Например `https://risk.saa-alliance.com` или `https://risk.saa-alliance.com/api` (если фронт и API на одном домене с прокси — можно пусто). |
| `VITE_CESIUM_ION_TOKEN` | Cesium Ion Access Token (глобус, 3D Tiles). По умолчанию в коде есть демо-токен; для прода лучше свой: https://cesium.com/ion/tokens. |
| `VITE_MAPBOX_TOKEN` | Mapbox (карты поставщиков в SCSS). Опционально. |
| `VITE_WS_URL` | WebSocket URL (если отличный от same-origin). Опционально. |

**Важно:** после изменения `VITE_*` на сервере нужно заново выполнить `npm run build` и перезапустить раздачу статики.

---

## 5. Порядок деплоя (кратко)

1. **Подготовка сервера:** SSH, каталог проекта, (опционально) Docker для PostgreSQL/Timescale/Neo4j/Redis/MinIO.
2. **Запуск из корня репозитория:** `./deploy-safe.sh`. По умолчанию: Contabo (host, port, user, project dir и SSH-ключ задаются переменными, см. DEPLOY_SAFE.md).
3. **Первый запуск:** создаётся `apps/api/.env` из шаблона; при следующих деплоях базы и ключи **не перезаписываются** (бэкап в `~/pfrp-preserve/`).
4. **На сервере вручную:** заполнить в `apps/api/.env` все нужные ключи (см. разделы 3–4); при необходимости создать `apps/web/.env` с `VITE_API_URL` и т.д.
5. **При использовании PostgreSQL:** поднять контейнер, выполнить `infra/docker/init-db.sql`, в .env выставить `USE_SQLITE=false`, `DATABASE_URL=postgresql://...`, затем миграции.
6. **При использовании TimescaleDB:** поднять контейнер, выполнить `apps/api/scripts/init_timescale.sql`, в .env выставить `ENABLE_TIMESCALE=true`, `TIMESCALE_URL=...`.
7. **Миграции:** на сервере `cd apps/api && source .venv/bin/activate && alembic upgrade head`. При конфликтах «table already exists» — см. DEPLOY_SAFE.md (alembic stamp).
8. **Скрипт автоматически:** после сборки фронта и перезапуска API выполняет **Step 11 — seed стресс-тестов** (POST /api/v1/stress-tests/admin/seed), чтобы в Risk Flow Analysis выпадающий список был полным (как локально).
9. **Повторная сборка фронта** (если правили VITE_*): на сервере `cd apps/web && npm run build`, затем перезапуск serve/nginx.
10. **Перезапуск API и веб:** `./restart-api.sh` или вручную uvicorn + serve.

---

## 6. Чеклист перед go-live

- [ ] `apps/api/.env` на сервере: `SECRET_KEY`, `CORS_ORIGINS`, `ENVIRONMENT=production`, `DEBUG=false`.
- [ ] Если демо-режим: `ALLOW_SEED_IN_PRODUCTION=true`.
- [ ] База: либо SQLite (`USE_SQLITE=true`, файл `prod.db` в preserve), либо PostgreSQL (init-db.sql выполнен, миграции применены).
- [ ] При использовании TimescaleDB: init_timescale.sql выполнен, `ENABLE_TIMESCALE=true`, `TIMESCALE_URL` задан.
- [ ] При использовании Redis/Neo4j/MinIO: контейнеры запущены, в .env включены флаги и URL/ключи.
- [ ] Ключи внешних API (OpenWeather, NOAA, NVIDIA и т.д.) прописаны в .env при необходимости.
- [ ] Фронт собран с нужным `VITE_API_URL` (и при необходимости `VITE_CESIUM_ION_TOKEN`, `VITE_MAPBOX_TOKEN`).
- [ ] Миграции Alembic: `alembic upgrade head` без ошибок.
- [ ] Health check: `curl -s http://localhost:9002/api/v1/health` возвращает healthy.
- [ ] **Стресс-тесты для Risk Flow:** после деплоя в Visualizations / Risk Flow Analysis выпадающий список «Stress test» должен содержать 15–20+ сценариев. Если только 4 — выполнить на сервере: `curl -X POST http://localhost:9002/api/v1/stress-tests/admin/seed`.
- [ ] Логи: при проблемах смотреть `tail -f /tmp/api.log`, `tail -f /tmp/web.log`.

Подробности сохранения баз и ключей при деплое — в **DEPLOY_SAFE.md** и скрипте **deploy-safe.sh**.
