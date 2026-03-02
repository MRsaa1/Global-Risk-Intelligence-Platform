# Не выполненное (Gaps vs Master Plan & ClimateShield Local)

Сводный список того, что запланировано в Unified Platform Master Plan и видении ClimateShield Local / AI Platform, но ещё не реализовано в кодовой базе.

---

## Важные приоритеты (план)

- **[Высокий приоритет] Расширение базы городов и стран; согласованность метрик с городом/страной**  
  В дальнейшем необходимо: (1) расширить базу городов и стран (не только «первый город на страну» из `cities-by-country.json`, но и дополнительные города на страну, при необходимости — внешние справочники или БД); (2) обеспечить, чтобы **все метрики** на Municipal Dashboard и в API (риск, алерты, дедлайны, финансирование, заявки, комиссии, слой затоплений, 3D и т.д.) были **согласованы с выбранным городом и страной** — один выбор города/страны должен однозначно определять контекст для всех виджетов и эндпоинтов. Текущее состояние: первый город на страну (246 стран) + 5 пилотных городов Техаса в `src/data/demo_communities.py`; метрики уже привязаны к выбранному городу, но расширение базы и полная консистентность по всем модулям — в плане.

---

## Spatial Core

- **Cesium Ion + 3D Tiles** — подключено: в `CesiumGlobe` и `DigitalTwinPanel` используется Cesium Ion World Terrain (asset 1) для потокового террейна; 3D Tiles зданий — OSM (96188), Google Photorealistic (2275207) и премиум-ассеты по городам. Токен задаётся в коде (`CESIUM_TOKEN`).
- **TimescaleDB** как основное хранилище временных рядов риска — реализовано: при `ENABLE_TIMESCALE=true` и `TIMESCALE_URL` timeline и risk-at-time читаются/пишутся в hypertable `risk_snapshots`; эндпоинты H3 `/timeline/{h3_index}` и `/risk-at-time` используют TimescaleDB; при assign риска снимок записывается в БД. Схема: `apps/api/scripts/init_timescale.sql`.
- **H3 Zone Risk Vector на глобусе** — реализовано: кнопка «Zone Risk Vector» в Command Center; выбор риска (AGI / Bio / Nuclear / Climate / Financial) и зоны (resolution 3–9), затем «Show on Globe»; гексагоны окрашиваются по выбранной компоненте вектора вероятностей (`p_agi`, `p_bio`, …).
- **Cascade на глобусе** — реализовано и выведено на фронт: **Сайдбар → Scenario Replay** (`/replay`) → ввести или выбрать Decision ID → кнопка **Cascade Animation** → ссылка **View on Globe** (переход на `/command?czmlDecisionId=...`). На Command Center глобус получает `czmlUrl` и загружает CZML (`Cesium.CzmlDataSource.load`). API: `GET /api/v1/replay/cascade-animation/{id}/czml`. Контент — демо по инфраструктуре (power_grid → …). Сценарий «AGI lab → Bioweapon → global spread» не делался (опционально).
- **Дорожная карта Cesium → Omniverse** — см. [docs/architecture/CESIUM_OMNIVERSE_ROADMAP.md](architecture/CESIUM_OMNIVERSE_ROADMAP.md). Phase 1 (CZML + Replay на глобусе) выполнена; Phase 2–8 (слои на террейне, активные инциденты, Bathymetry, Cesium for Unreal, Omniverse extension, ion Self-Hosted) — запланированы.

---

## ARIN / Ethicist (раздел 9 Master Plan) — реализовано

- **NeMo Guardrails** — конфиг `config/guardrails.yml`; при установке `NEMO_GUARDRAILS_URL` Ethicist может вызывать Colang flows. Логика ethics_rails применяется rule-based из YAML.
- **NIM для Ethicist** — интегрированы опциональные микросервисы: `ethicist_bias_detector_nim_url`, `ethicist_content_safety_nim_url`, `ethicist_pii_detection_nim_url`; пайплайн в `src/services/ethicist_nim.py`, вызов из Ethicist agent.
- **Конфиг ethics_rails** — добавлен `config/ethics_rails/` (harm_prevention.yml, fairness.yml, protect_pii.yml); загрузка в `src/services/ethics_rails.py`.
- **Матрица проверок по модулям** — реализована в `ethics_rails.py`: MODULE_ETHICS_MATRIX для ERF, ASGI, BIOSEC, ASM, SRO, CIP, CADAPT, stress_test, scss; для каждого модуля задан список rails (harm_prevention, fairness, protect_pii).
- **Аудит Ethicist** — запись в immutable log: таблица `ethicist_audit_log` (cryptographic_signature, prev_hash, payload_hash, immutable_log_reference); сервис `src/services/ethicist_audit.py` (hash chain); при каждом POST /arin/assess оценка Ethicist пишется в лог.
- **Human-in-the-loop** — реализовано: при CRITICAL / financial_impact_eur ≥ ethicist_escalation_threshold_eur / life_safety выставляются verdict.human_confirmation_required и verdict.escalation_reason; создаётся запись в `human_review_requests`; API GET /arin/human-reviews, POST /arin/human-reviews/{decision_id}/resolve (approve/reject).

---

## Track B (CADAPT / Local)

- **Малые города 5K–50K** — реализовано: полоса населения Track B (5K–50K), список городов `GET /api/v1/cadapt/track-b-cities` (из TEXAS_COMMUNITIES и DEMO_COMMUNITIES), пилотные города Техаса (Bastrop, Lockhart, Gonzales, Smithville, La Grange) и малые города из других стран в этом диапазоне.
- **Онбординг муниципалитетов** — реализовано: таблица `municipal_onboarding_requests`, API `GET/POST /api/v1/cadapt/onboarding-requests`, `PUT /api/v1/cadapt/onboarding-requests/{id}` (статусы: pending, in_review, onboarded, declined).
- **Подрядчики (Track B)** — реализовано: таблица `municipal_contractors`, CRUD API `GET/POST/GET/PUT/DELETE /api/v1/cadapt/contractors` (привязка к tenant_id, тип подрядчика, контакты).
- Bastrop TX как демо-город — есть в TEXAS_COMMUNITIES и на Municipal Dashboard по умолчанию.
- **SaaS Track B $1K–2K/мес** — реализовано: тарифы `track_b_small` ($12K/год = $1K/мес), `track_b_standard` ($24K/год = $2K/мес) в `GET /api/v1/cadapt/subscriptions/tiers`; продукты Custom Report и Decision Support в `GET /api/v1/cadapt/products`.
- **Custom Report $15–30K** — оформлен как продукт: `GET /api/v1/cadapt/products` возвращает `custom_report` с price_min 15000, price_max 30000 (USD).
- Пилот «5 городов в Техасе» — данные есть; онбординг через onboarding-requests.
- Остальное по Track B — см. выше (карты уязвимости, AEL, план адаптации, дашборд эффективности, алерты и т.д.).
- **Карты уязвимости инфраструктуры** — реализовано: слой «Infrastructure at risk» на Municipal (чекбокс включает H3 hex risk на глобусе); карточка «Critical infrastructure at risk» (buildings_at_risk.critical).
- **AEL / 100-year loss на уровень муниципалитета** — реализовано: в Municipal Overview и Risk — явные карточки AEL (Annual Expected Loss) и 100-year loss из `financial_exposure`; API `/community/risk` возвращает `financial_exposure.annual_expected_loss_m`, `loss_100_year_m`.
- **Персонализированный план адаптации** — реализовано: в CADAPT вкладка «Adaptation Plan» — оптимизатор портфеля (constraint: budget), таймлайн по срочности (сортировка мер по implementation_months).
- Подбор подрядчиков — реализовано: сущность municipal_contractors, CRUD API `/cadapt/contractors`. Готовые проекты «под ключ» (каталог типовых решений) — нет.
- **Дашборд эффективности реализованных мер** — реализовано: страница `/effectiveness` (MeasuresEffectivenessPage) и API `GET /api/v1/cadapt/effectiveness`; KPIs: measures_implemented, risk_reduction_pct, ael_before/after, savings_annual_m, by_measure (помимо CrossTrack observations).
- **48–72h алерты под конкретное сообщество** — реализовано: в Municipal вкладка Alerts — блок «72-Hour Risk Forecast» с подзаголовком «Community-specific 48–72h outlook»; API `/community/alerts` возвращает `forecast_72h`.
- **Раннее предупреждение на мобильном** — в Alerts добавлена заметка «Early warning on mobile: PWA and native app coming soon»; полноценное мобильное приложение не реализовано.
- **SaaS подписка $5K–20K/год** — реализовано: таблица `municipal_subscriptions`, тарифы standard/professional/enterprise, API `GET/POST/PUT /cadapt/subscriptions`, `GET /cadapt/subscriptions/tiers`; для Track B добавлены тарифы $1K–2K/мес (см. выше).
- **H3 в CADAPT / Risk Dashboard** — реализовано: в CADAPT вкладка Plan — ссылка «View risk by H3 hex on globe» → Command Center; в Risk Zones Analysis — ссылка «View risk by H3 hex on globe» → `/command`; на Municipal слой «Infrastructure at risk» включает showH3Layer на глобусе.
- TimescaleDB/Neo4j как ядро для CADAPT — не используются как core.
- **FLOOD, HEAT, DROUGHT, GRANT, ALERT как отдельные продуктовые модули/страницы** — реализовано: маршруты `/flood`, `/heat`, `/drought`, `/grant`, `/alert` (редирект на Municipal с нужным tab/hazard); пункты навигации в Layout.

---

## Гранты и комиссии

- **200+ источников грантов** — реализовано: база GRANT_DATABASE_FULL = 25 базовых + 180+ сгенерированных (US штаты, EU, международные), итого 200+. API `GET /grants` и `POST /grants/match` возвращают из полной базы.
- **AI для заявок** — реализовано: `POST /api/v1/cadapt/grants/draft` (grant_program_id, municipality, city_risks, population) — генерирует черновик заявки через LLM (NVIDIA); при недоступности LLM — текстовый fallback.
- **Commission tracker** с реальными заявками — реализован: сводка (total/approved/pending, by_status), `GET /applications` (список заявок с названием гранта), создание заявки из вкладки Grants (кнопка «Create application», модалка с municipality и requested_amount_m), таблица заявок во вкладке Commissions со сменой статуса (draft → submitted → under_review → approved/denied). **Выплаты (payouts)** реализованы как отдельная сущность: таблица `grant_payouts` (id, application_id, payout_date, amount, currency, status, notes), API `GET/POST/GET/PUT/DELETE /api/v1/cadapt/payouts` и UI во вкладке Commissions (таблица выплат с датой/суммой/статусом, модалка «Add payout»). Агрегат `approved_commission_m` — потенциальная комиссия по одобренным заявкам; фактически выплаченная сумма доступна в `GET /commissions` как `paid_out_m` и `payouts_count` (сумма и количество выплат со статусом paid).

---

## Экспорт и коммуникация

- **Экспорт каскада в MP4** — реализовано: API `GET /api/v1/replay/cascade-animation/{decision_id}/mp4` (frames, duration_s, fps), пайплайн каскад → кадры → кодирование в MP4; UI: ReplayPage кнопка «Export MP4». Для работы нужны опциональные зависимости: `pip install imageio imageio-ffmpeg`; при их отсутствии API возвращает 503 с сообщением об установке.

---

## Регуляторика

- **Полное выравнивание под OSFI B-15 / EBA Climate** — реализовано по чеклисту [docs/OSFI_EBA_CLIMATE_CHECKLIST.md](OSFI_EBA_CLIMATE_CHECKLIST.md): disclosure packages (OSFI_B15, EBA) с секциями Governance, Risk Management, Scenario Analysis, Disclosure, **Transition Plan**, **Scope 1 & 2 GHG**, **Scope 3 GHG**, **Metrics and Targets**; для EBA добавлены **Materiality Assessment** и **Transition Planning**. Реализован **OSFI B-15 Readiness self-assessment**: API `GET/POST /audit-ext/osfi-b15/readiness-questions|readiness-submit`, вкладка «OSFI B-15 Readiness» на странице Regulatory Export — опросник, счёт и список gaps. Оставшееся по желанию: отдельный модуль ICAAP/risk appetite; подключение GHG inventory для подстановки реальных данных вместо placeholder.

---

## UE5 Disaster Visualization

- **Backend API для UE5** — верифицировано в коде: в `climate.py` — `GET /climate/flood-forecast`, `GET /climate/wind-forecast`, `GET /climate/high-fidelity/scenarios`, `GET /climate/high-fidelity/flood`, `GET /climate/high-fidelity/wind`, `GET /climate/high-fidelity/metadata`; в `ue5.py` — `GET /ue5/scenario-bundle`, `GET /ue5/building-damage-grid`, WebSocket `/ue5/ws/stream`. Достаточно для подстановки сценариев в UE5.
- **Скрипт выгрузки сценариев** — верифицировано: `scripts/ue5_fetch_scenario.py` (аргументы `--scenario-id`, `--api-url`, `--output-dir`) выгружает flood, wind, metadata в JSON для импорта в UE5. Запуск: `python scripts/ue5_fetch_scenario.py --scenario-id wrf_nyc_202501`.
- **Документация** — есть: [docs/UE5_INTEGRATION_GUIDE.md](UE5_INTEGRATION_GUIDE.md) (Online/Offline, маппинг API→UE5, troubleshooting), [docs/UE5_VFX_VISUALIZATION.md](UE5_VFX_VISUALIZATION.md), [docs/RUN_ON_MAC.md](RUN_ON_MAC.md).
- **Верификация в UE5** — не выполнена: запуск API и скрипта в среде разработки выполнены; интеграция в проект UE5 (Blueprint/VaRest, привязка к FluidFlux/Wind), прогон в редакторе и запись гайда по шагам в UE5 не верифицированы.

---

## ClimateShield Local / AI Platform

### Flood Risk Model (полный цикл)

Где смотреть на фронте и чеклист готовности: [docs/FLOOD_RISK_UI_GUIDE.md](FLOOD_RISK_UI_GUIDE.md).

- **Единый продукт по городу:** реализовано: `POST /api/v1/cadapt/flood-risk-product` — вход «только город» (или lat/lon) → city_info, data_sources, scenarios (10/50/100 yr), economic_impact (разбивка по компонентам), ael_usd, опционально flood_grid. `GET /api/v1/cadapt/flood-scenarios?city=` подключён к тому же движку (FloodHydrologyEngine + FloodEconomicModel).
- **Вход «только название города»** — единый пайплайн оформлен: город → сценарии (глубина, extent, duration) + экономические убытки по компонентам + AEL; опция include_grid даёт массив ячеек depth для визуализации на глобусе. Карты по улицам (построчно) — нет.
- **Гидрологическая модель уровня города:** реализована упрощённая модель в духе HEC-RAS: SCS Curve Number (runoff) + Manning (velocity). Файл `flood_hydrology_engine.py`; полный HEC-RAS/LISFLOOD-FP не подключался.
- **Три сценария:** 10-year, 50-year, 100-year flood — оформлены как продукт с выходами: flood_depth_m, extent_area_km2, velocity_ms, duration_hours, economic breakdown и total_loss_usd.
- **Входные данные:** USGS 3DEP (elevation) — `usgs_elevation_client.py`; USGS WaterWatch (streamflow) — `usgs_waterwatch_client.py`; NASA SMAP (soil moisture) — `nasa_smap_client.py` (fallback antecedent precip); drainage (OSM Overpass) — `osm_drainage_client.py`. Интегрированы как входы FloodHydrologyEngine при run_city_flood_model. Подробнее об источниках USGS (3DEP, Circular 1553, EPQS, NWIS, WaterWatch) — см. [docs/USGS_SOURCES.md](USGS_SOURCES.md).
- **Выход:** карта затопления — опциональный flood_grid (массив lat, lon, depth_m) для рендера на глобусе; вероятность по зданиям — нет. Почему гидромодель упрощённая и как реализовать карту/вероятность по зданиям на digital twin — см. [docs/FLOOD_RISK_UI_GUIDE.md](FLOOD_RISK_UI_GUIDE.md#почему-не-реализовано-и-можно-ли-на-digital-twin).
- **Экономический Impact Model:** реализован в `flood_economic_model.py`: FEMA HAZUS depth-damage кривые (residential, commercial, infrastructure), формула Total Loss = Residential + Commercial + Infrastructure + Business interruption + Emergency. Property inventory выводится из population (или конфигурируется).
- **Валидация по историческим событиям:** реализовано: каталог 12 исторических наводнений в `flood_historical_events.py`; `POST /api/v1/cadapt/flood-model/validate-batch` — прогон модели по каждому событию, сравнение model_loss_usd vs actual_loss_usd, error_pct, флаг при расхождении >20%; в ответе accuracy_pct, passed_count, avg_error_pct. UI: Municipal Dashboard → Risk — бейдж «Validated: X% accuracy».

### Engineering Solutions Matcher

- **Реализовано:** каталог **80+ инженерных решений** (дамбы, drainage, seawalls, levees, green infrastructure) с кейсами и источниками (FEMA Mitigation Best Practices, USACE Case Studies, EPA Green Infrastructure). API: `GET /api/v1/cadapt/engineering-solutions` (каталог с фильтрами), `POST /api/v1/cadapt/engineering-solutions/match` — вход «тип риска + глубина (m) + площадь (ha)» → топ 3–5 решений с ценами и кейсами. UI: блок «Engineering Solutions Matcher» во вкладке **Risk** Municipal Dashboard (выбор risk type, depth, area, кнопка Match, список решений с case study и estimated cost).
- **Расширение до 500+** — в плане: загрузка из открытых источников (FEMA, USACE, EPA, USAspending.gov); текущий каталог — синтетические кейсы в стиле этих источников.

### Grant Matching (до видения)

- **200+ грантов** — реализовано: база 25 + 180+ сгенерированных (см. раздел «Гранты и комиссии»); API `GET /grants`, `POST /grants/match`.
- **Eligibility + ranking по вероятности успеха** (в т.ч. success rate для похожих городов) — реализовано: в `POST /grants/match` передаётся `municipality`; в ответе для каждого гранта: `eligibility` (population_eligible, risk_eligible, country_eligible, notes), `success_probability_pct` (смесь program rate + similar cities), `similar_cities_success_rate_pct` (по региону из SIMILAR_CITIES_OUTCOMES). Сортировка по success_probability. UI: Municipal Dashboard → Grants — колонки «Success prob.» и «Similar cities», блок Eligibility.

### Grant Writing Assistant

- **AI-черновик заявки на основе успешных примеров (FOIA) и требований гранта (парсинг PDF guides)** — реализовано: каталог FOIA_EXAMPLES по программам и секциям; API `GET /grants/foia-examples`, `POST /grants/parse-guide` (upload PDF → pypdf, секции и requirements); при генерации секции LLM получает FOIA excerpts и guide sections.
- **Workflow «AI draft + human expert» и выход «готовая 200-стр заявка»** — реализовано: `POST /grants/draft-project` (создание проекта), `GET/PUT /grants/draft-project/{id}` и `/section`, `POST .../generate-section` (AI по FOIA + guide), `POST .../export` (конкатенация секций, word_count). UI: Municipal → Grants → кнопка «Full application» по гранту → панель Grant Writing Assistant: Upload PDF guide, генерация секций (executive_summary, objectives, activities, timeline, budget, community_engagement), Export full document.
- Базовый краткий черновик по-прежнему: `POST /api/v1/cadapt/grants/draft`.

### Валидация и пилот

- **Ретроспективный анализ для пилота (модель vs факт по историческому наводнению), accuracy для города** — реализовано: каталог 12 исторических наводнений (US) в `flood_historical_events.py`; `events_near_city(lat, lon, radius_km=120)` для привязки к выбранному городу; `GET /api/v1/cadapt/flood-model/retrospective?city=...` — прогон модели по событиям в радиусе 120 км от города, сравнение model_loss_usd vs actual_loss_usd, error_pct, pass при ≤20%; в ответе accuracy_pct, passed_count, avg_error_pct, events[]. UI: Municipal Dashboard → Risk — бейдж «Accuracy for this city: X% (N/M events)», таблица событий (model vs fact), при отсутствии событий рядом — сообщение и общая валидация (validate-batch).
- **Презентация «10 кейсов, accuracy 90%+» и первый клиент** — не реализовано: нет готовой презентации и сценария «бесплатный ретро → сделем для будущих рисков».

### SaaS / продуктовая модель

- **Risk Assessment Dashboard (SaaS) $1,000–2,000/месяц** — оформлено: тарифы Track B `track_b_small` ($1K/мес), `track_b_standard` ($2K/мес) в API `GET /api/v1/cadapt/subscriptions/tiers` и на UI Municipal → Subscription; отображаются как amount_monthly и метка «Track B (5K–50K)».
- **Custom Analysis Report $15,000–30,000** — оформлено: продукт `custom_report` в API `GET /api/v1/cadapt/products` (price_min 15000, price_max 30000 USD) и блок «One-off products» на вкладке Subscription.
- **Decision Support Consulting $5,000–10,000** — оформлено: продукт `decision_support` в том же API и UI (price_min 5000, price_max 10000 USD).
- Сводная таблица продуктов и тарифов: [docs/PRODUCT_PRICING.md](PRODUCT_PRICING.md).

---

*Документ обновлён по состоянию обсуждения в чате. Ссылка на этот файл: [docs/NOT_IMPLEMENTED.md](NOT_IMPLEMENTED.md).*
