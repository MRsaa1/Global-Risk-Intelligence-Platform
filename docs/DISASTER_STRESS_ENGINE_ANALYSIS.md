# Анализ: Disaster Simulation Engine в контексте платформы

## Вывод: да, добавлять в этом контексте имеет смысл

Описанный use case (Natural Disaster → Infrastructure Impact → Economic Loss → Financial Stress → Portfolio) **уже на 60–70% покрыт** существующими модулями. Оставшееся — связать их в единый сценарий и усилить данными (в т.ч. Earth Engine). Ниже — что есть, чего не хватает и как встроить.

---

## 1. Соответствие видению по слоям

| Слой из описания | Что уже есть в платформе | Пробел |
|------------------|--------------------------|--------|
| **Disaster Event** | USGS (earthquakes), FEMA NRI, NASA FIRMS (fire), flood: `flood_hydrology_engine`, Open-Meteo, Sentinel Hub NDWI; stress_test_seed (исторические сценарии); NOAA в конфиге | Нет единого каталога сценариев (tokyo_7.5, miami_cat5); нет hurricane tracks/tsunami как готовых фидов; **Earth Engine не подключён** (flood/fire extent, exposure) |
| **Infrastructure Vulnerability** | Assets, demo_communities, OSM (drainage), risk zones; `physics_engine`: flood/earthquake/wind damage curves по активу | Нет массового building inventory (100k+ зданий) с типами и replacement value; нет явных HAZUS-style fragility curves (есть упрощённые формулы в physics_engine) |
| **Physical Impact Simulation** | `physics_engine`: flood (depth→damage), earthquake (PGA→damage_grade), wind; опционально PhysicsNeMo; `risk_zone_calculator`: зоны, потери, метрики | Нет Monte Carlo по **инвентарю зданий** (10k прогонов × 100k зданий); earthquake — упрощённая формула PGA, не полный GMPE + fragility по типам |
| **Economic Loss Model** | `flood_economic_model`: residential/commercial/infra/BI/emergency по сценариям 10/50/100 yr; `stress_report_metrics`: stakeholder_impacts, insurance, loan defaults, CET1; `contagion_matrix`: financial contagion | Нет явного шага «supply_chain_losses = $20B» из одного сценария; BI и indirect — частично в метриках отчёта |
| **Financial Stress Test** | `universal_stress_engine`: Monte Carlo 10k, Master Loss Equation, VaR/CVaR; `stress_testing`: portfolio stress, cascade; SRO `contagion_simulator`: n_monte_carlo, cascade; `whatif_simulator`: сценарии, severity, exposure; отчёты PDF, liquidity, solvency | Нет одного пайплайна «disaster scenario → physical loss → economic → portfolio VaR» в одном вызове |
| **Portfolio / Dashboard** | Portfolios, stress tests, risk zones, Command Center, Analytics, PDF reports, risk posture | Готово для отображения; нужен один «Disaster Stress Test» продукт, который заполняет эти экраны из end-to-end сценария |

---

## 2. Где именно встраивать Earth Engine

- **Disaster / exposure данные:**  
  Flood extent, wildfire perimeters, историческая частота наводнений (GLOBAL/FLOOD_DB и т.п.) — в качестве **входа** в расчёт зон и уязвимости (например, маска/вес для risk_zone_calculator или для выбора зон затопления).
- **Верификация и обогащение:**  
  После симуляции — сравнение с текущими/историческими снимками (NDWI/NDVI/FIRMS) для отчётов и валидации.
- **Building footprint / land cover (опционально):**  
  Для городов, где нет OSM/demo_communities, можно подтягивать инвентарь из GEE (как в ASSET_DATA_SOURCES_FULL.md).

То есть Earth Engine в этом контексте — **слой данных для Disaster Event и Infrastructure**, а не замена физики или финансовой модели.

---

## 3. Рекомендация по подписке Earth Engine

- **Сейчас (MVP, первые 1–3 месяца):** **Limited (FREE)**  
  - Хватает для: 10–20 городов, одного-двух end-to-end сценариев (например Tokyo earthquake + flood), демо для клиентов.  
  - Ограничения: 20 concurrent requests, нет batch credits — для MVP приемлемо.  
  - Ориентир по cost: $0 абонентская плата + usage (порядка $50–200/мес при умеренном использовании).

- **После первого платящего клиента (≈ месяц 4+):** **Basic ($500/мес)**  
  - Когда есть контракт $25K+ и нужны регулярные стресс-тесты, batch и стабильный лимит.  
  - 100 EECU-hour batch даёт порядка 20 полных симуляций в месяц в рамках кредита.  
  - ROI: при одном клиенте $50K/год выручка минус $500×12 и прочая инфра — маржа остаётся высокой.

- **Масштабирование (6–12+ месяцев):** **Professional ($2K/мес)** — когда >5 enterprise клиентов, >100 стресс-тестов/мес, нужен SLA и 500 concurrent requests.

Итого: в контексте «добавить этот use case» — **старт с FREE**, переход на Basic при первом платящем клиенте.

---

## 4. Как добавить в платформу (поэтапно)

### Фаза 1: Один end-to-end сценарий без нового железа

- Ввести **каталог сценариев** (как в примере: `tokyo_earthquake_7.5`, `miami_category_5_hurricane`, `california_atmospheric_river`) в конфиге или БД.
- Для одного сценария (например, **Tokyo 7.5**):  
  - **Event:** параметры из каталога (magnitude, epicenter, depth).  
  - **Physical:** для активов в радиусе вызывать существующий `physics_engine.simulate_earthquake`; для зон — `risk_zone_calculator.calculate_risk_zones` с `event_id` типа earthquake.  
  - **Economic:** агрегировать по зонам/активам (по аналогии с `flood_economic_model` или `stress_report_metrics` — residential/commercial/infra/BI).  
  - **Financial:** передать суммарный удар в `universal_stress_engine` или `stress_testing.run_portfolio_stress_test` (exposure, severity из сценария).  
- Один API: например `POST /api/v1/stress-tests/disaster/run` с `scenario_id` и `portfolio_id`; ответ — те же структуры, что уже отдаёт stress report (zones, losses, VaR, report_id для PDF).

Никакого BigQuery и массового инвентаря на этом шаге: используем **текущие assets + risk zones**.

### Фаза 2: Earth Engine как источник данных

- Реализовать клиент GEE (как в плане [EARTH_ENGINE_SETUP](docs/EARTH_ENGINE_SETUP.md)): flood layers, wildfire/FIRMS-подобные данные.
- В сценариях типа flood: опционально брать маску/частоту из GEE для границ зон или весов уязвимости.
- Кэшировать результаты (как в примере с Redis в твоём документе), чтобы уложиться в FREE tier.

### Фаза 3: Усиление физики и инвентаря (по желанию)

- Добавить явный модуль **fragility curves** (HAZUS-style) и вызывать его из `physics_engine` вместо только упрощённой формулы PGA.
- При необходимости — building-level Monte Carlo: выборка PGA по прогонам, повреждения по fragility, агрегация в economic loss. Это уже ближе к полному видению из описания.

---

## 5. Итог

- **Добавлять описанный Disaster Simulation Engine в этом контексте — да.**  
  Платформа уже закрывает большую часть цепочки; не хватает единого сценария «event → physical → economic → financial» и данных (в т.ч. Earth Engine).
- **Earth Engine** — уместен как слой данных для disaster/exposure и, при росте, для инвентаря; подписка: **сначала FREE, затем Basic** при первом клиенте.
- **Практичный первый шаг:** один сценарий (например, Tokyo 7.5), один API, склеивающий `physics_engine` + `risk_zone_calculator` + economic aggregation + существующий stress/portfolio; затем подключить GEE для flood/fire и вынести сценарии в каталог.

Если нужно, могу следующим шагом расписать конкретные файлы и сигнатуры API для Фазы 1 (один end-to-end disaster stress test).
