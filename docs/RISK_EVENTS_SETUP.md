# Risk Events: миграции и синхронизация (как швейцарские часы)

Пошаговая настройка канонических таблиц внешних рисков и первого источника (USGS).

## Применить всё одной командой (после запуска API)

**Из корня репо** (каталог `global-risk-platform`, не `apps/api`):

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
./scripts/risk_events_apply_all.sh
```

Если вы уже в `apps/api`, то скрипт — на уровень выше:
```bash
cd .. && ./scripts/risk_events_apply_all.sh
```

Свой хост или порт:
```bash
BASE_URL=http://localhost:9002 ./scripts/risk_events_apply_all.sh
# или другой хост:
BASE_URL=https://your-api-host:9002 ./scripts/risk_events_apply_all.sh
```

Скрипт напоминает про миграции → вызывает `POST /api/v1/risk/events/sync?...` → проверяет GET events и GET sources.

---

## 1. Миграции

Выполнять **из каталога `apps/api`** (не из домашней папки и не из корня репо):

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
alembic upgrade head
```

**Вариант B — таблицы уже есть** (например через `Base.metadata.create_all`):
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
alembic stamp head
```

После этого в БД есть: `raw_source_records`, `normalized_events`, `event_entities`, и т.д.

## 2. Запуск API

Из каталога `apps/api`, с виртуальным окружением и портом 9002:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

Скрипт `risk_events_apply_all.sh` по умолчанию обращается к `http://localhost:9002`. Если API на другом порту: `BASE_URL=http://localhost:ПОРТ ./scripts/risk_events_apply_all.sh`.

## 3. Реестр источников + первая выгрузка USGS

**Способ 1 — через API** (в другом терминале; сервер уже запущен на порту 9002):

```bash
curl -X POST "http://localhost:9002/api/v1/risk/events/sync?source=usgs&days=365&min_magnitude=5&seed_registry=true"
```

**Способ 2 — скрипт из корня репо** (API должен быть запущен):
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
./scripts/risk_events_apply_all.sh
```

Один раз заполняется `source_registry` (usgs, emdat, noaa, fema, sigma, laeven_valencia, veris_dbir, ucdp, acled, seed) и выполняется ETL USGS: extract → normalize → event_entities.

## 3. Проверка

- **Список событий (для расчёта онлайном):**  
  `GET /api/v1/risk/events`  
  Фильтры: `?country=US&event_type=seismic&from=2024-01-01&to=2025-12-31`

- **Деталь события:**  
  `GET /api/v1/risk/events/{event_uid}`

- **Откуда тянем данные:**  
  `GET /api/v1/risk/sources`  
  (домен: `?domain=seismic` или `?domain=climate`)

## 4. Что включено сейчас

- **Реально работает:** USGS (землетрясения M5+ за год) → raw → normalized → event_entities.
- **В реестре (для будущей интеграции):** EM-DAT, sigma, NOAA, FEMA, Laeven & Valencia, VERIS/DBIR, UCDP, ACLED, seed.

Добавление нового источника: клиент → extract в `raw_source_records` → normalize → при необходимости materialize в `event_entities` (как в `external_risk_etl.py` для USGS).
