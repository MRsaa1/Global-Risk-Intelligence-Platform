# Запуск платформы и UE5 на Mac (Apple Silicon)

Краткий чеклист для запуска **Physical-Financial Risk Platform** и пайплайна **UE5 + Cesium + API** на вашем Mac (например MacBook Pro M1 Max).

---

## 0. Один запуск (одна команда)

Из **корня проекта** выполните:

```bash
./run-on-mac.sh
```

Скрипт поднимает Docker (postgres, redis, neo4j, minio), при необходимости выполняет seed high-fidelity сценария `wrf_nyc_001`, запускает API в фоне на порту 9002. Логи: `.services-logs/api.log`, `.services-logs/seed.log`.

**С веб-интерфейсом в фоне:**

```bash
./run-on-mac.sh --web
```

или `RUN_WEB=1 ./run-on-mac.sh`

**Остановка:** убить процесс API и остановить Docker:

```bash
kill $(cat .services-logs/api.pid) 2>/dev/null
docker compose down
```

Если переменные окружения не заданы, API по умолчанию подключается к БД на `localhost:5432`. Если вы используете Postgres из Docker (порт 5433), задайте перед запуском: `export DATABASE_URL=postgresql://pfrp_user:pfrp_secret_2024@localhost:5433/physical_financial_risk`

---

## 1. Запуск платформы локально (вручную, три терминала)

Все команды — из **корня проекта** (`global-risk-platform`).

### Терминал 1: инфраструктура (Docker)

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
docker compose up -d postgres redis neo4j minio
```

Или используйте `./start-local.sh` — он поднимет те же сервисы и выведет следующие шаги.

### Терминал 2: API (порт 9002)

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate   # или: python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'   # если ещё не установлено
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

**Проверка:** откройте в браузере [http://localhost:9002/docs](http://localhost:9002/docs).

### Терминал 3: веб-интерфейс (опционально)

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/web
npm install
npm run dev
```

**Проверка:** откройте [http://127.0.0.1:5180](http://127.0.0.1:5180) (или порт из вывода `npm run dev`). Command Center: `/command`.

---

## 2. Базовый URL API для UE5

Когда API запущен на этом же Mac:

| Назначение | URL |
|------------|-----|
| Базовый префикс | `http://localhost:9002/api/v1` |
| Flood (Open-Meteo) | `GET http://localhost:9002/api/v1/climate/flood-forecast?latitude=40.71&longitude=-74.01&days=7` |
| Wind | `GET http://localhost:9002/api/v1/climate/wind-forecast?latitude=40.71&longitude=-74.01&days=7` |
| High-fidelity сценарии | `GET http://localhost:9002/api/v1/climate/high-fidelity/scenarios` |
| High-fidelity flood | `GET http://localhost:9002/api/v1/climate/high-fidelity/flood?scenario_id=<id>` |

В Blueprint или C++ в UE5 используйте эти URL (или `127.0.0.1` вместо `localhost`, если так надёжнее).

---

## 3. UE5 на Mac (Apple Silicon)

1. **Установить Unreal Engine 5.3+** для Apple Silicon через Epic Games Launcher (сборка под Metal).
2. **Установить Cesium for Unreal** из Epic Marketplace (поддерживается Mac).
3. **FluidFlux:** проверить на [Fab](https://www.fab.com) наличие сборки для Mac/Apple Silicon.
4. В проекте UE5 настроить запросы к API на `http://localhost:9002/api/v1` (см. [UE5_VFX_VISUALIZATION.md](UE5_VFX_VISUALIZATION.md) — раздел «Data pipeline» и «Running on Mac»).

---

## 4. Быстрая проверка API из терминала

```bash
# Список high-fidelity сценариев
curl -s "http://localhost:9002/api/v1/climate/high-fidelity/scenarios"

# Flood-forecast (Нью-Йорк)
curl -s "http://localhost:9002/api/v1/climate/flood-forecast?latitude=40.71&longitude=-74.01&days=7"
```

Если API запущен, оба запроса вернут JSON.

---

## 5. Остановка

- В каждом терминале (API, web): `Ctrl+C`.
- Docker: `docker compose down` из корня проекта.

---

См. также: [UE5_VFX_VISUALIZATION.md](UE5_VFX_VISUALIZATION.md), [QUICK_START.md](../QUICK_START.md).
