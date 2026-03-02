# ClimateShield Local — Статус и План Реализации

## ЧАСТЬ 1: ЧТО ВНЕДРЕНО / ЧТО НЕТ

### ✅ ВНЕДРЕНО

| Компонент | Реализация | Где |
|-----------|------------|-----|
| **Оценка рисков (Risk Assessment)** | Частично | `ClimateService`, `AssetRiskCalculator`, `CityRiskCalculator`, `GeoDataService`, `ClimateStressPipeline` — композитный климатический скор (flood, heat, wind, wildfire, drought, sea_level), FEMA NRI, CMIP6, Open-Meteo |
| **Карты рисков на 3D глобусе** | Да | `CesiumGlobe` — flood, heat, drought, wind, heavy rain, UV, earthquake (M5–M9), metro flood; hotspot-маркеры, полигоны, халos; двойной клик → Digital Twin |
| **Адаптационные меры (каталог)** | Да | `CADAPTService` — 12 мер (зелёная инфраструктура, дамбы, cooling centers, Early Warning System и др.) с cost_per_capita, effectiveness_pct, roi_multiplier |
| **Grant Matching** | Да | `CADAPTService` — 25+ грантов (FEMA BRIC, HMGP, EPA WIFIA, HUD CDBG-DR, GCF, Adaptation Fund, TX TWDB, Canada, EU, UK, Australia и др.); match по city_risks, country; 7% комиссия |
| **CADAPT Dashboard** | Да | `CADAPTModule` — вкладки Overview, Measures, Grants, Commission Tracker; рекомендованные меры; подбор грантов |
| **Municipal Dashboard** | Да | `MunicipalDashboard` — обёртка над CADAPT |
| **Early Warning (базово)** | Частично | `Sentinel` agent — 48–72h lookback для climate; `TimelinePredictionsPanel`, `PredictivePanel` — SRO Early Warning; `usePredictions` — `/api/v1/predictions/early-warning`; алерты в CommandCenter |
| **Финансовая модель (ROI, NPV)** | Частично | `FinancialModelService.calculate_climate_adjusted_dcf`, `WhatIfSimulator.optimize_mitigation`, `AdvisorAgent._generate_climate_adaptation_recommendation` — опции Do Nothing / Physical Adaptation / Insurance с ROI, NPV, payback |
| **Данные** | Частично | NOAA, USGS, Open-Meteo, CMIP6, FEMA (NRI), Census (GeoData), Sentinel-2 упомянуты; data federation pipelines (climate_stress, geodata_risk) |
| **Связь Track A ↔ Track B** | Да | `CrossTrackPage`, `cross_track_service` — field observations (flood_event, heat_event, adaptation_performance) для калибровки моделей |
| **PDF отчёты** | Да | `pdf_report` — BCP, stress reports; early warning recommendations в тексте |

### ❌ НЕ ВНЕДРЕНО ИЛИ ТОЛЬКО ЗАГОТОВКИ

| Компонент | Статус |
|-----------|--------|
| **Фокус на малые города 5K–50K** | Нет — платформа для глобальных hotspot-городов и портфелей, не специализирована под малые муниципалитеты |
| **Карты уязвимости инфраструктуры** | Частично — GeoData, OSM; нет отдельного слоя «инфраструктура под риском» |
| **Прогноз финансовых потерь (Annual Expected Loss, 100-year)** | Частично — `FinancialModelService`, stress tests; нет явного AEL/100-year loss для муниципалитета |
| **Персонализированный план адаптации с ROI по каждой мере** | Частично — CADAPT recommend + каталог; нет оптимизатора портфеля (constraint optimization), нет timeline по срочности |
| **Готовые проекты «под ключ»** | Нет |
| **Подбор подрядчиков** | Нет |
| **Мониторинг эффективности реализованных мер** | Частично — CrossTrack observations; нет dedicated dashboard |
| **48–72h алерты для конкретного сообщества** | Sentinel мониторит общие контексты; нет community-specific 72h forecast dashboard |
| **Мобильный Early Warning (wireframe)** | Нет |
| **SaaS подписка $5K–20K/год для муниципалитетов** | Нет (только концепция комиссии 7% за гранты) |
| **Пилот «5 городов в Техасе»** | Нет — нет onboarding flow для муниципалитетов |
| **H3 hexagonal grid для рисков** | Есть H3 API, но не интегрирован в CADAPT/Risk Dashboard |
| **PostGIS + TimescaleDB + Neo4j** | PostGIS через GeoData; TimescaleDB и Neo4j упомянуты, не как core для CADAPT |
| **Bastrop TX как демо-город** | Нет — используются глобальные hotspots |

---

## City launch 6–12 weeks

Чёткий процесс от заявки до работающего города за 6–12 недель:

| Недели | Фаза | Цели |
|--------|------|------|
| 1–2 | Onboarding | Заявка, проверка, создание tenant/municipality; география и hazards (flood, heat) |
| 3–6 | First assessment | Community Risk API, первый Municipal Climate Insurability Report (черновик), алерты по региону |
| 7–12 | Go-live | План адаптации (measures + grants), disclosure export, подписание подписки/контракта |

API: `GET /api/v1/cadapt/launch-checklist?municipality_id=...` — список шагов и флаги выполнения. Подробнее: [CITY_LAUNCH_PLAYBOOK.md](../../CITY_LAUNCH_PLAYBOOK.md).

---

## ЧАСТЬ 2: РАЗВЁРНУТЫЙ ПЛАН РЕАЛИЗАЦИИ

### Фаза 0: Подготовка (2–3 недели)

1. **Определение пилотных городов**
   - Выбрать 5 малых городов в Техасе (напр. Bastrop, Lockhart, Gonzales, Smithville, La Grange) — 5K–30K жителей
   - Завести `Community` / `Municipality` сущности в БД: id, name, state, country, population, boundaries (GeoJSON), lat/lng

2. **Расширение CADAPT под municipality_id**
   - Добавить `municipality_id` в `match_grants`, `recommend_measures`, `get_dashboard`
   - Хранить риск-профиль на уровне сообщества (из ClimateService/GeoData по центроиду)

3. **Документирование текущего стека**
   - Текущие API, данные, ограничения
   - Gap analysis vs ClimateShield spec

---

### Фаза 1: Risk Dashboard для муниципалитета (4–6 недель)

#### 1.1 Community Risk API

```
POST /api/v1/cadapt/community/{municipality_id}/assess
GET  /api/v1/cadapt/community/{municipality_id}/risk
```

- Использовать `ClimateService.get_climate_assessment` по центроиду
- Добавить FEMA NRI по FIPS (если US)
- Структура ответа:
  - `hazards`: flood, heat, drought, wildfire, storm — score 0–100, trend
  - `financial_exposure`: annual_expected_loss, 100_year_loss, projected_2050
  - `vulnerability_factors`: aging_infra, tree_canopy_pct, elderly_pct, single_access_roads
  - `buildings_at_risk`, `critical_infrastructure_count`

#### 1.2 Risk Dashboard UI

- Новая страница `/municipal/risk/:municipalityId` или режим в CADAPT
- Верх: Summary — 6 hazard-карточек (Flood 78, Heat 65, …) + Community Status (population, buildings at risk, est. annual loss)
- Середина: Hazard breakdown — progress bars с historical events, trend
- Середина: Financial exposure — AEL, 100-year, without adaptation 2050
- Середина: Vulnerability factors — checklist + composite score
- Низ: Climate projections chart — historical + SSP2-4.5, SSP5-8.5 до 2080
- Кнопки: Download PDF Report, Request Updated Assessment

#### 1.3 Интеграция карты

- CesiumGlobe с фокусом на `municipality.boundaries`
- Слои: Flood zones (FEMA NFHL если есть), Buildings, Evacuation routes (OSM)
- H3 heatmap риска по hexagonам внутри boundaries

---

### Фаза 2: Adaptation Planner с ROI и Timeline (4–6 недель)

#### 2.1 Adaptation Engine — оптимизация портфеля

- Расширить `CADAPTService.recommend_measures`:
  - Вход: `risk` (CommunityRisk), `budget_constraint`, `priority_hazards`
  - Для каждой меры: ROI, NPV, payback_years (на основе financial_exposure)
  - Оптимизатор: maximize risk_reduction при budget_constraint
  - Выход: `AdaptationPlan` — measures, total_cost, combined_risk_reduction, roi, timeline

#### 2.2 Adaptation Planner UI

- Slider бюджета $0 – $10M
- Список мер с чекбоксами: Cost, Risk Reduction %, ROI, Payback, Funding Match
- Portfolio Summary: Total Investment, Combined Risk Reduction, Portfolio ROI, Break-even
- Implementation Timeline: Gantt по годам (2026–2028)
- Кнопки: Find Funding for Selected, Export Plan (PDF)

#### 2.3 PDF Adaptation Plan

- Титульная страница: ClimateShield Local, город, population, risk score, recommended investment, expected ROI
- Детали мер с ROI и timeline
- Ссылка на Grant Finder

---

### Фаза 3: Grant Finder — полный цикл (3–4 недели)

#### 3.1 Улучшение match_grants

- Учитывать `municipality_id` → population, boundaries, FIPS
- Eligibility parser: population brackets, NFIP status, disaster-declared
- `recommended_ask` — оптимизация по success_probability
- `expected_value` = recommended_ask × success_probability
- Сортировка по expected_value

#### 3.2 Grant Finder UI (по wireframe)

- Your Grant Portfolio: Total Potential, Expected Value, Applications Active
- Карточки грантов: Award Range, Match Score, Success Probability, Expected Value
- Eligible Measures (чекбоксы из плана)
- Recommended Ask
- Our Fee (7%)
- Кнопки: Start Application, View Requirements
- Application Status: Submitted, Under Review, Approved

#### 3.3 Application workflow

- `create_application` уже есть
- Добавить шаги: draft → submitted → under_review → approved / rejected
- Уведомления при смене статуса
- Commission tracking при approved

---

### Фаза 4: Early Warning Center (4–5 недель)

#### 4.1 Community-specific 72h monitoring

- `EarlyWarningService`:
  - Для `municipality_id` — boundaries, thresholds (flood_stage_ft, heat_advisory_F, …)
  - Периодически (каждый час): Open-Meteo 72h forecast
  - Сравнение с thresholds → threat level (GREEN/AMBER/RED/BLACK)
  - Персонализированные рекомендации (из response_plan — эвакуация, охлаждающие центры)

#### 4.2 Early Warning API

```
GET /api/v1/cadapt/community/{municipality_id}/alerts
GET /api/v1/cadapt/community/{municipality_id}/forecast/72h
```

#### 4.3 Early Warning UI

- Текущие условия: Temp, Rain 24h, River level, Fire risk, Wind
- Thresholds: Flood Stage, Heat Advisory, Fire Weather, Storm Warning
- 72h forecast — risk bars по времени (Flood risk 12%, Heat risk 65% …)
- Календарь на 3 дня с рисками
- Alert history (30 дней)
- Notification settings: Email, SMS, Push
- Emergency contacts
- Mobile-first layout (по wireframe A.1)

---

### Фаза 5: Визуализация дашборда (2–3 недели)

#### 5.1 Единый Municipal Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ClimateShield Local        [Overview][Risk][Adaptation][Grants][Alerts]  Profile
├─────────────────────────────────────────────────────────────────┤
│  [Community Selector: Bastrop, TX ▾]    Last updated: 2h ago    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ Risk Summary        │  │ Community Status    │               │
│  │ Flood 78 │ Heat 65  │  │ Pop: 12,847         │               │
│  │ Storm 42 │ …        │  │ Buildings: 234      │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Cesium 3D Map                             ││
│  │  Layers: [✓] Flood  [✓] Buildings  [ ] Heat  [✓] Evac       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ Funding Opportunities│  │ Upcoming Deadlines  │               │
│  │ FEMA BRIC 85%  $2-8M│  │ FEMA BRIC Mar 15    │               │
│  │ TX TWDB 72%   $1-3M │  │ TX TWDB  Apr 1      │               │
│  └─────────────────────┘  └─────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2 Design System

- Цвета риска: Critical #dc2626, High #ea580c, Medium #ca8a04, Low #16a34a
- Шрифты: системный stack, headings — четкие
- Карточки: фон slate-900/95, бордер subtle
- Cesium: dark theme, контрастные полигоны

#### 5.3 Responsive

- Desktop: полный layout
- Tablet: колонки 1+1, карта на всю ширину
- Mobile: stacked, карта компактная, Alerts — приоритет

---

### Фаза 6: Пилот и монетизация (ongoing)

1. **Onboarding муниципалитетов**
   - Форма: название, штат, население, контакты
   - Бесплатная оценка рисков (lead magnet)
   - Подключение Grant Finder и плана адаптации

2. **Commission tracking**
   - Уже есть в CADAPT
   - Дашборд: potential, pending, approved

3. **SaaS подписка (опционально)**
   - Роли: Viewer, Planner, Admin
   - Лимиты: количество оценок, алертов, экспортов
   - Billing (Stripe): $5K–20K/год

---

## ЧАСТЬ 3: ТЕХНОЛОГИИ И ИНТЕГРАЦИИ

| Компонент | Рекомендация | Текущее |
|-----------|--------------|---------|
| API | FastAPI | ✅ FastAPI |
| Spatial | PostGIS + H3 | GeoData, H3 API есть |
| Time-series | TimescaleDB (опционально) | — |
| Grant graph | Neo4j (опционально) | — |
| Frontend | React + TypeScript | ✅ |
| Maps | CesiumJS | ✅ |
| Charts | Recharts | ✅ |
| Data | NOAA, USGS, Open-Meteo, FEMA, Census | Частично |
| CMIP6 | Climate projections | Есть в ClimateService |

---

## ЧАСТЬ 4: ПРИОРИТЕТЫ MVP

1. **Must have (MVP)**
   - Community risk assessment API + UI
   - Adaptation Planner с ROI и бюджетом
   - Grant Finder (уже есть, улучшить match)
   - Базовый Early Warning (72h forecast + thresholds)
   - Один пилотный город (Bastrop)

2. **Should have**
   - PDF Risk + Adaptation reports
   - Application workflow
   - Notification settings
   - Mobile Early Warning layout

3. **Nice to have**
   - H3 heatmap на карте
   - Подрядчики
   - Мониторинг эффективности мер
   - SaaS billing

---

*Документ создан: 2026-02-05. Статус: ПЛАН.*
