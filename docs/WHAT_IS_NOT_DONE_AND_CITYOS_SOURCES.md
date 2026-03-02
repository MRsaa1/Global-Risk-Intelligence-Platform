# Что не доделано и откуда брать digital twin городов для CityOS

## 0. Сверка: что из типичного списка уже сделано / что нет

Чтобы не дублировать — из часто упоминаемых пунктов **уже реализовано**:

- **Выплаты по грантам (payouts)** — сделано: таблица `grant_payouts`, CRUD `GET/POST/GET/PUT/DELETE /api/v1/cadapt/payouts`, UI во вкладке Commissions (таблица выплат, модалка «Add payout»). См. [NOT_IMPLEMENTED.md](NOT_IMPLEMENTED.md) (Гранты и комиссии).
- **Экспорт каскада в MP4** — сделано: `GET /api/v1/replay/cascade-animation/{decision_id}/mp4`, кнопка «Export MP4» на ReplayPage. Опционально: `pip install imageio imageio-ffmpeg`.
- **social_media_job** — зарегистрирован в scheduler (`register_jobs.py`, интервал 10 мин), есть в `SOURCE_TYPE_TO_JOB` и в `refresh_all_sources`.
- **Live Data Bar / per-source last refresh** — сделано: в store есть `lastRefreshBySource` и `lastSnapshotBySource`; `LiveDataIndicatorBar` и `DataSourcesPanel` (вкладки Natural Hazards, Weather, Biosecurity, Cyber, Infrastructure) показывают свежесть по источнику; обновление через WebSocket `DATA_REFRESH_COMPLETED` и каналы по источникам.

**Реально не сделано** (из того же списка) — см. разделы ниже и сводную таблицу в п. 4.

---

## 1. Что не доделано (по плану)

**Фаза C (Roadmap 2026)** — реализовано в рамках плана Phase C 10/10:

- **C2. NeMo Phase 3:** реализовано (nemo_customizer, nemo_rl_gym, config, script, документация).
- **C3. Fine-tuning под данные клиента:** реализовано (API datasets/run/settings, таблицы, client context в AI-Q).
- **C4. Multi-Agent / Agent OS (виток 2):** реализовано (workflow report/assessment/remediation, run-chain, agent_audit_log, GET /agents/audit).
- **C5. Регуляторика (ECB, Fed):** реализовано (REGULATORY_ENGAGEMENT_PLAN_ECB_FED.md, чеклист, FST regulatory_package).

Остаётся по плану (не в фокусе Phase C): **C1. Enterprise** (SSO, RBAC, audit export для SOC 2).

---

## 2. Источники данных CityOS (внутренние и внешние)

CityOS хранит «близнецы» городов в таблице `cityos_city_twins`. Записи создаются через сид, `POST /api/v1/cityos/cities` или **ingest из Overpass** (`POST /api/v1/cityos/ingest`).

### Внутренние источники (используются в сиде)

| Источник | Что даёт | Где в коде | Порядок в сиде |
|----------|----------|------------|----------------|
| **Demo communities (CADAPT)** | Сообщества с id, name, population, lat, lng. | `apps/api/src/data/demo_communities.py` | 1 (первым) |
| **CITIES_DATABASE** | 70+ городов с координатами, рисками. | `apps/api/src/data/cities.py` — `get_all_cities()` | 2 (после demo) |
| **cities-by-country.json** | Справочник городов по странам (опционально, с лимитом). | `apps/web/public/data/cities-by-country.json` | 3 (опция `use_cities_by_country`, лимит 500) |

- **Код сида:** `apps/api/src/modules/cityos/seed_cities.py` — `seed_cityos_cities(db, use_cities_database=True, use_cities_by_country=False, cities_by_country_limit=500)`.
- **Эндпоинт сида:** `POST /api/v1/seed/cityos` — заполняет из demo_communities и CITIES_DATABASE по умолчанию.

### Внешние источники

| Источник | Статус | Где |
|----------|--------|-----|
| **OpenStreetMap Overpass** | Реализован | Адаптер `apps/api/src/data_federation/adapters/overpass.py`; ingest `POST /api/v1/cityos/ingest` (bbox). Данные: node["place"="city"/"town"] в bbox → CityTwin с дедупликацией по (name, country_code). |
| **UN World Urbanization Prospects / UN-Habitat** | Документирован, интеграция запланирована | Данные: население, агломерации (CSV/Excel). Вариант интеграции: загрузка CSV по странам или API (если доступен); stub-адаптер с ссылкой на документацию при необходимости. См. [UN World Urbanization Prospects](https://population.un.org/wup/). |
| **Eurostat (Urban Audit)** | Документирован, интеграция запланирована | Данные: города ЕС, демография, индикаторы. Формат: bulk или API. Вариант интеграции: скрипт/эндпоинт импорта из CSV или Eurostat API; см. [Eurostat Urban Audit](https://ec.europa.eu/eurostat/web/cities). |

### Порядок сида и ingest

1. **Сид:** вызвать `POST /api/v1/seed/cityos` — последовательно: demo_communities → CITIES_DATABASE → (опционально) cities-by-country.json с лимитом.
2. **Ingest из Overpass:** вызвать `POST /api/v1/cityos/ingest` с телом `{"bbox": [min_lat, min_lon, max_lat, max_lon], "limit": 500}` — создаются CityTwin с cityos_id `CITYOS-OVERPASS-{country}-{slug(name)}`, дедуп по (name, country_code).

---

## 3. Сид CityOS из внутренних источников

- **Код сида:** `apps/api/src/modules/cityos/seed_cities.py` — функция `seed_cityos_cities(db, ...)`.
- **Эндпоинт:** `POST /api/v1/seed/cityos`.
- **Идемпотентность:** города с таким же `cityos_id` не дублируются.
- **Использование:** после деплоя вызвать `POST /api/v1/seed/cityos`; затем при необходимости `POST /api/v1/cityos/ingest` с bbox для выбранного региона (Overpass).

---

## 4. Strategic Modules — что не реализовано / заглушки / демо

По каждому **активному** модулю (Phase 1): что из заявленного функционала не наполнено, реализовано как stub или показывается как demo при недоступности API.

### CIP (Critical Infrastructure Protection)

- **Реализовано полностью:** Infrastructure Registration, Dependency Mapping, Cascade Simulation, Vulnerability Analysis — всё через API `/cip/*`, демо-заглушек нет.

### SCSS (Supply Chain Sovereignty System)

- **Sanctions screening** — stub. В UI: *"Demo list only (stub). Configure SCSS_OFAC_API_URL and SCSS_EU_SANCTIONS_URL for production."* Реальные OFAC/EU sanctions API не подключены.
- **Сценарий симуляции** — при ошибке/недоступности бэкенда может возвращаться `demo_fallback`, в UI показывается *(one supplier simulated as affected for demo)*.
- Остальное (цепочки, узкие места, суверенитет, альтернативные поставщики) — реализовано через API.

### SRO (Systemic Risk Observatory)

- Реализовано: регистр институтов, корреляции, системный риск, контагиозность, индикаторы, регуляторный дашборд. Явных заглушек нет.

### ERF (Existential Risk Framework)

- При недоступности API (`/erf/dashboard`, longtermist) фронт показывает **демо-данные**. Баннер: *"Demo data — API unavailable or returned non-OK. Showing fallback values for demonstration."*
- Бэкенд есть; наполнение данными и сценариями — отдельная задача.

### BIOSEC (Biosecurity & Pandemic)

- **BSL-4 Registry** — при недоступности API показывается демо-список лабораторий. Баннер: *"Demo data — API unavailable or returned non-OK. Showing fallback BSL-4 lab list."*
- **Airport Spread Network** — **реализовано**: API `GET /api/v1/biosec/spread-network` (узлы: аэропорты + BSL-4 лаборатории; рёбра: маршруты); во фронте вкладка «Spread Network» с графом (react-force-graph-2d), подписи и пояснения.
- **Pathogen Assessment** — **реализовано**: API `GET /api/v1/biosec/labs/{lab_id}/risk` (overall_risk, spread_risk_score, containment_rating, nearby_airports); во фронте вкладка «Pathogen risk» с таблицей по лабораториям (Lab, Overall risk, Spread risk, Containment, Nearby airports).
- Pandemic (SIR) и WHO Outbreaks — реализованы через API.

### ASM (Nuclear Safety & Monitoring)

- При недоступности API (`/asm/dashboard`) показывается демо: реакторы и арсеналы из запасного списка. Баннер: *"Demo data — API unavailable or returned non-OK. Showing fallback reactor and arsenal data."*
- Логика реакторов, nuclear winter, escalation ladder при работающем API реализованы.

### SRS (Sovereign Risk Shield)

- **Сценарии** (solvency, regime, digital sovereignty) — pilot/placeholder. В UI: *"Pilot / placeholder — scenario uses placeholder metrics. Not for regulatory use."* Бэкенд возвращает пилотный результат; полноценной логики сценариев нет.
- Фонды, депозиты, индикаторы — реализованы через API.

### CityOS (City Operating System)

- **Capacity Planning / Forecasts** — pilot/placeholder. В UI: *"Pilot: capacity planning and migration forecasts"* и *"Pilot forecast — full migration dynamics and capacity planning to be integrated."* Бэкенд `get_forecast` возвращает заглушку; полная динамика миграций и планирование мощностей не реализованы. **Полная динамика** = подключение внешних данных по миграциям и более детальная модель мощностей — в плане.
- Города и маршруты миграции — реализованы (в т.ч. демо-данные и демо-маршруты через кнопки).

### FST (Financial System Stress Test Engine)

- **Регуляторный отчёт / пакет** — сценарии и запуски реализованы; экспорт помечен как черновик: *"Draft / pilot content — not for regulatory submission without internal review"* и *"Report may contain pilot/placeholder content."* Контент отчёта не готов для подачи в регулятора без внутренней проверки.

### ASGI (AI Safety & Governance Infrastructure)

- **Compliance** — stub. В UI: *"Framework mapping only — status values (NOT_ASSESSED / COMPLIANT) are stub; full assessment logic is not yet implemented."* Полноценная логика оценки соответствия не реализована.
- При недоступности API по системам, алертам, анкорам показываются демо-данные и локальные/демо-хэши; баннеры типа *"API unavailable — showing demo data"*.
- AI Registry, Capability Emergence, Goal Drift, Audit Trail, Cyber (CISA KEV) при работающем API реализованы.

### Сводная таблица

| Модуль | Не реализовано / только заглушка или демо |
|--------|------------------------------------------|
| CIP | — |
| SCSS | Sanctions (OFAC/EU) — stub; симуляция может уходить в demo_fallback. |
| SRO | — |
| ERF | При падении API — демо-данные. |
| BIOSEC | Демо-лаборатории при падении API; Airport Spread Network и Pathogen Assessment в UI реализованы (вкладки Spread Network и Pathogen risk). |
| ASM | Демо-реакторы/арсеналы при падении API. |
| SRS | Сценарии — pilot/placeholder, не для регуляторного использования. |
| CityOS | Capacity planning и миграционные прогнозы — pilot/placeholder. |
| FST | Регуляторный отчёт — draft/pilot, не для подачи без внутренней проверки. |
| ASGI | Compliance — stub; при падении API — демо-данные. |
