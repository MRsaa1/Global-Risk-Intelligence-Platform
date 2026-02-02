# План доработок: стратегия 3D + ИИ в финтехе → 10/10

> Цель: довести соответствие платформы PFRP шести направлениям [PRODUCT_MODEL_3D_FINTECH.md](PRODUCT_MODEL_3D_FINTECH.md) до уровня 10/10.

---

## Принципы плана

- **Приоритет:** сначала (1) и (5) — ядро продукта; затем (2), (3); затем (4), (6).
- **Инкрементальность:** каждая фаза даёт измеримый прирост по стратегии.
- **Переиспользование:** опираться на существующие `financial_models`, `physics_engine`, `cascade_gnn`, `provenance`, BIM, CIP/SCSS/SRO.

---

## Фаза 0: Фундамент (общее для 1–6)

Универсальные сущности и API, на которые опираются все направления.

| # | Задача | Файлы / компоненты | Критерий готовности |
|---|--------|---------------------|----------------------|
| 0.1 | **Financial product type на активе** | `Asset`: поля `financial_product` (enum: mortgage, property_insurance, project_finance, infra_bond, credit_facility, lease, other), `insurance_product_type`, `credit_facility_id` | Asset API принимает и возвращает тип продукта; фильтрация в Assets/portfolio по продукту |
| 0.2 | **Связка PD/LGD → кредитный лимит и премия** | `financial_models`: `calculate_credit_limit(pd, lgd, ead, collateral_value, tenure)`, `calculate_insurance_premium(base_rate, risk_score, sum_insured, deductible)`; `Asset`: `suggested_credit_limit`, `suggested_premium_annual` (опционально, кэш) | Endpoint `POST /api/v1/simulations/credit-limit` и `.../insurance-premium`; в отчёте по активу — «рекомендуемый лимит / премия» |
| 0.3 | **Расширение provenance под верификацию ущерба** | `DataProvenance`: `verification_type` (measurement \| damage_claim \| before_after), `linked_claim_id`, `geometry_hash`; `VerificationRecord`: `comparison_result` (match \| mismatch \| inconclusive) | Модели и миграция; API создания/верификации с `verification_type=damage_claim` |

---

## 1. Оценка и управление рисками по физическим активам → 10/10

*Текущий уровень: высокий. Доработки: явная привязка к продуктам, скоринг, премии.*

| # | Задача | Файлы / компоненты | Критерий готовности |
|---|--------|---------------------|----------------------|
| 1.1 | Типы финансовых продуктов в скоринге | Использовать `financial_product` из 0.1 в `asset_risk_calculator` и `financial_models.calculate_pd/lgd` (разные веса: ипотека vs страхование vs инфраоблигация) | В `AssetDetail` и отчёте: «Скоринг для продукта: ипотека», PD/LGD с учётом продукта |
| 1.2 | Расчёт страховой премии по 3D+климат | Сервис `insurance_scoring`: на входе asset_id, sum_insured; внутри — climate_risk, physical_risk, `physics_engine` (flood/fire damage_ratio), `calculate_insurance_premium` | `POST /api/v1/insurance/quote` → premium, breakdown (climate, physical, zone); в BIM/Digital Twin panel — блок «Insurance quote» |
| 1.3 | Риск-профиль кредита по Digital Twin | `POST /api/v1/credit/risk-profile`: asset_id, product=mortgage|project_finance; использует PD, LGD, `physics_engine`, cascade; выход: `credit_limit`, `spread_bps`, `collateral_adequacy` | В `AssetDetail` и Digital Twin — «Credit risk profile»: лимит, ставка, достаточность залога |
| 1.4 | Симуляция износа (degradation) | `physics_engine`: `simulate_degradation(asset_id, horizon_years)` — remaining useful life, failure probability, recommended_capex; вызов из `simulations` | Endpoint и/или пункт в stress/asset report: «Износ через 5/10/20 лет», рекомендованные CAPEX |

---

## 2. Кредитование и страхование сложных пространственных объектов → 10/10

*Текущий уровень: средний. Доработки: LiDAR/спутник, скоринг по продукту, связь геометрии с лимитом/премией.*

| # | Задача | Файлы / компоненты | Критерий готовности |
|---|--------|---------------------|----------------------|
| 2.1 | **Модель и API point cloud / LiDAR** | Модель `PointCloudCapture`: asset_id, source=lar | satellite | drone, file_path, captured_at, crs, bounds; `POST /api/v1/assets/{id}/point-cloud` upload; `GET /api/v1/assets/{id}/point-cloud` metadata | Загрузка и хранение; `point_cloud_path` в Asset уже есть — связать с новой сущностью |
| 2.2 | **Спутниковые снимки (метаданные + ссылка)** | Модель `SatelliteImage`: asset_id, provider, scene_id, captured_at, resolution_m, coverage_wkt; API `POST/GET /api/v1/assets/{id}/satellite` | Регистрация снимка «до»/«после»; использование в provenance и в отчётах |
| 2.3 | **Специфичный скоринг по типу актива** | `AssetRiskCalculator` или отдельный `ComplexAssetScoring`: для `DATA_CENTER` — uptime, cooling, redundancy; `LOGISTICS` — throughput, chokepoints; `TRANSPORTATION_PORT` — draft, berths, hurricane exposure; `ENERGY_*` — capacity factor, grid connection | В карточке актива для data_center, logistics, port, energy — отдельные блоки «Operational risk», «Downtime risk» |
| 2.4 | **Кредитный лимит и премия в API актива** | `GET /api/v1/assets/{id}` и `GET /api/v1/assets/{id}/summary`: при наличии `financial_product` — `suggested_credit_limit`, `suggested_premium_annual` (через 0.2) | В UI Assets и Command Center — отображение лимита/премии для отобранных по продукту активов |
| 2.5 | **Прогноз аварий и downtime** | Сервис `downtime_forecast`: на основе `physics_engine` (failure probability), `climate_service`, `knowledge_graph` (cascade); выход: `expected_downtime_hours_per_year`, `worst_case_days` | `GET /api/v1/assets/{id}/downtime-forecast`; в карточке сложного объекта — «Expected downtime», «Worst case» |

---

## 3. REIT и портфели недвижимости → 10/10

*Текущий уровень: средний. Доработки: 3D-портфель, REIT-сущности, доходность и ликвидность.*

| # | Задача | Файлы / компоненты | Критерий готовности |
|---|--------|---------------------|----------------------|
| 3.1 | **Сущность Portfolio / REIT** | Модель `Portfolio`: id, name, type=fund | reit | custom, owner_id, base_currency; `PortfolioAsset`: portfolio_id, asset_id, share_pct, acquisition_date, target_irr. API: CRUD ` /api/v1/portfolios`, ` /api/v1/portfolios/{id}/assets` | Создание портфеля и привязка активов с долей; отображение в UI |
| 3.2 | **REIT-метрики** | `Portfolio`: nav, ffo, yield_pct, debt_to_equity, occupancy; сервис `reit_metrics_service`: расчёт NAV, yield, debt/equity по активам и структуре; `GET /api/v1/portfolios/{id}/reit-metrics` | В карточке портфеля типа REIT — NAV, FFO, yield, D/E |
| 3.3 | **3D-портфель на глобусе** | Компонент `PortfolioGlobeView`: на Cesium — все активы выбранного портфеля (маркеры/кластеры), цвет по risk/yield; фильтры risk, region, product. Страница или режим ` /portfolios/{id}/map` | Глобус с объектами портфеля, цвет = риск или доходность; клик — переход к активу |
| 3.4 | **Визуализация доходности, риска, ликвидности** | `Portfolio` dashboard: чарты «Yield vs Risk» (scatter по активам), «Liquidity» (по регионам/типам); `GET /api/v1/portfolios/{id}/analytics` — `yield_by_asset`, `risk_by_region`, `liquidity_score` | В UI портфеля — scatter, карта ликвидности, таблица по активам |
| 3.5 | **Сценарии по портфелю: ставки, климат, зонирование** | Расширить `stress_scenario_registry` и `stress_testing`: сценарии `rate_rise_100bp`, `rezone_restrictive`, `climate_ssp2050`; `POST /api/v1/portfolios/{id}/stress-test` с `scenario_id` | Запуск стресс-теста по портфелю; отчёт: VaR, delta NAV, наиболее пострадавшие активы |
| 3.6 | **Оптимизация структуры REIT (MVP)** | `reit_optimizer`: на входе portfolio_id, целевой D/E или target yield; выход: рекомендуемые продажи/покупки (по asset_id, delta share). Эвристика или простой оптимизатор | `POST /api/v1/portfolios/{id}/optimize` → `suggested_sales`, `suggested_acquisitions`; отображение в UI как «Рекомендации» |

---

## 4. Борьба с мошенничеством → 10/10

*Текущий уровень: низкий. Доработки: 3D до/после, верификация ущерба, связь с заявлением.*

| # | Задача | Файлы / компоненты | Критерий готовности |
|---|--------|---------------------|----------------------|
| 4.1 | **Модель заявления об ущербе (claim)** | Модель `DamageClaim`: asset_id, claim_type=insurance | collateral, description, claimed_loss_amount, claimed_damage_type, reported_at, status; `DamageClaimEvidence`: claim_id, evidence_type=photo | point_cloud | bim | satellite, file_path, captured_at, is_before | is_after; API CRUD ` /api/v1/fraud/claims` | Создание claim, привязка доказательств «до»/«после» |
| 4.2 | **3D-реконструкция сцены (MVP)** | Сервис `damage_reconstruction`: на входе claim_id; загрузка фото/point cloud; выход: `reconstruction_3d_path` (или ссылка на mesh), `detected_damage_zones`, `estimated_volume_damage`; можно начать с заглушки, возвращающей «на очереди» + сохранение meta | `POST /api/v1/fraud/claims/{id}/reconstruct` → job; `GET .../reconstruct/status` → `reconstruction_3d_path`, `detected_damage_zones` |
| 4.3 | **Сравнение «до / после»** | `DamageClaim`: `before_evidence_ids`, `after_evidence_ids`; сервис `before_after_comparison`: геометрия/характеристики до и после, `geometry_hash` (из 0.3); результат `comparison_result`, `discrepancy_score`, `flags` (overstated, understated, inconsistent) | `POST /api/v1/fraud/claims/{id}/compare` → `comparison_result`, `discrepancy_score`, `flags`; запись в `VerificationRecord` с `verification_type=damage_claim` |
| 4.4 | **Выявление несоответствий геометрии и заявленных потерь** | Расширение `before_after_comparison`: сопоставление `claimed_loss_amount` и `estimated_volume_damage` / `damage_ratio` от 3D; правило: если `claimed / estimated > threshold` → flag `potentially_overstated` | В ответе `compare` и в отчёте по claim — «Соответствие заявлению: да/нет», «Рекомендация: запросить дополнительную экспертизу» |
| 4.5 | **Проверка на повторное страхование** | При создании `DamageClaim` с `claim_type=insurance`: проверка по `asset_id` + `claimed_damage_type` + `reported_at` в окне ±N дней — есть ли другой claim с overlapping периодом; `GET /api/v1/fraud/claims/duplicate-check?asset_id=&period=` | При дубликате — предупреждение в API и в UI; логирование для аудита |
| 4.6 | **UI: модуль Fraud / Claims** | Страница ` /fraud` или ` /claims`: список claims, фильтры; карточка claim: доказательства до/после, 3D (если есть), результат сравнения, вердикт. Кнопки: Reconstruct, Compare | Полный цикл: создать claim → привязать до/после → Reconstruct → Compare → просмотр вердикта |

---

## 5. Project Finance → 10/10

*Текущий уровень: низкий. Доработки: CAPEX/OPEX, IRR, график строительства, связка с 3D.*

| # | Задача | Файлы / компоненты | Критерий готовности |
|---|--------|---------------------|----------------------|
| 5.1 | **Сущность Project (инфра-проект)** | Модель `Project`: id, name, asset_id (опционально — один проект может агрегировать несколько активов), type=road | renewable | industrial, status=development | construction | operation, currency | `ProjectPhase`: project_id, name, start_date, end_date, phase_type=development | construction | commissioning | operation, capex_planned, capex_actual, opex_annual_planned | API CRUD ` /api/v1/projects`, ` /api/v1/projects/{id}/phases` | Проект и фазы с CAPEX/OPEX по фазам |
| 5.2 | **CAPEX / OPEX по фазам** | `ProjectPhase`: `capex_planned`, `capex_actual`, `opex_annual_planned`, `opex_annual_actual`; `Project`: `total_capex_planned`, `total_capex_actual`, `annual_opex_planned` | В карточке проекта — таблица фаз, CAPEX/OPEX planned vs actual; `GET /api/v1/projects/{id}/financials` |
| 5.3 | **График строительства (Gantt)** | `ProjectPhase`: `start_date`, `end_date`, `completion_pct`; API `GET /api/v1/projects/{id}/schedule`; фронт: компонент `ProjectGantt` (или интеграция с lib) | Визуализация фаз во времени; сдвиги по сравнению с планом |
| 5.4 | **IRR и NPV проекта** | Сервис `project_finance_service`: на входе project_id, discount_rate; расчёт по фазам CAPEX/OPEX и (если есть) cashflows от `Asset`/внешних данных; выход: `irr`, `npv`, `payback_period` | `GET /api/v1/projects/{id}/irr` или в ` /financials`: irr, npv, payback; в карточке проекта — «IRR», «NPV» |
| 5.5 | **Связь 3D (Digital Twin) с проектом** | `Project`: `linked_asset_ids` (массив) или `primary_asset_id`; в `AssetDetail` и Digital Twin для актива, входящего в проект — блок «Project»: название, фаза, CAPEX/OPEX, IRR; обратная ссылка в ` /projects/{id}` — «3D-модели» (ссылки на assets) | Двусторонняя навигация проект ↔ актив/3D; в 3D-view — overlay «Project: Phase X, CAPEX Y» |
| 5.6 | **Эксплуатационные сценарии** | `Project`: сценарии `operational_scenario` (JSON или отдельная таблица): name, opex_mult, availability_pct, incident_rate; `project_finance_service`: пересчёт IRR/NPV при выбранном сценарии | `GET /api/v1/projects/{id}/irr?scenario=low_availability`; в UI — выбор сценария и отображение IRR/NPV |
| 5.7 | **Отчёт для кредитного комитета** | `GET /api/v1/projects/{id}/credit-committee-report` или `exports/project-pdf`; содержание: проект, фазы, CAPEX/OPEX, IRR, NPV, риски (из `asset_risk`, `physics_engine`, climate), 3D-ссылки | PDF/страница: «Project Finance: [name]», всё в одном для комитета |

---

## 6. Иммерсивная аналитика (VR / 3D) → 10/10

*Текущий уровень: средний. Доработки: VR-режим, совместная работа, сценарии в 3D.*

| # | Задача | Файлы / компоненты | Критерий готовности |
|---|--------|---------------------|----------------------|
| 6.1 | **VR-режим (WebXR) для Viewer3D и BIMViewer** | В `Viewer3D` и `BIMViewer`: опция `vr={true}`; `session.requestSession('immersive-vr')`, render loop для XR; кнопка «Enter VR» в UI | На десктопе с VR-шлемом — переход в иммерсивный просмотр актива/модели |
| 6.2 | **Интерактивные сценарии «что если» в 3D** | В 3D-сцене: overlay «Apply scenario: Flood 100y»; вызов `physics_engine` или `stress` по зоне; визуализация: цвет/подсветка повреждённых зон, flood level, огонь. `WhatIfSimulator` или новый `SceneScenarioOverlay` | В 3D: выбор сценария → пересчёт и визуализация последствий на модели |
| 6.3 | **Аннотации и маркеры в 3D** | Модель `SceneAnnotation`: asset_id | project_id, author, type=marker | note | issue, position_3d (x,y,z или lat,lon,height), text, created_at; API CRUD; в `Viewer3D`/`BIMViewer`: рендер маркеров, клик — попап | В 3D — точки с комментариями; сохранение и отображение для других пользователей |
| 6.4 | **Совместная работа: просмотр с общим состоянием** | WebSocket-события: `viewer.position`, `viewer.focus_asset`, `annotation.add`; `platformStore` или отдельный `collaborationStore`: `peers`, `shared_camera` (опционально); UI: «User X viewing [Asset]», «User Y added note» | В одной «комнате» несколько пользователей видят смену камеры/фокуса и новые аннотации в реальном времени |
| 6.5 | **Режим «для инвесткомитета»** | Страница или режим ` /present/asset/{id}` / ` /present/project/{id}`: полноэкранный 3D, минимальный HUD, кнопки «Previous/Next asset», «Apply scenario», «Show IRR»; управление с клавиатуры/кликера | Режим презентации: пошаговый показ активов/проектов с 3D и ключевыми цифрами |
| 6.6 | **Экспорт 3D-сцены для офлайн** | `GET /api/v1/assets/{id}/scene-export` или `viewer.export()`: упакованная сцена (glb + метаданные риска) или ссылка на USD/glTF; инструкция для загрузки в Unreal/Omniverse (как в IDENTITY) | Для enterprise: выгрузка сцены для внешнего рендеринга/VR |

---

## Порядок выполнения (дорожная карта)

```
Фаза 0 (2–3 нед.)     → 0.1, 0.2, 0.3
       │
Фаза 1 (3–4 нед.)     → 1.1, 1.2, 1.3, 1.4  [направление 1 → 10/10]
       │
Фаза 2a (2–3 нед.)   → 2.1, 2.2, 2.3, 2.4, 2.5  [направление 2 → 10/10]
Фаза 2b (3 нед.)     → 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7  [направление 5 → 10/10]
       │
Фаза 3 (4–5 нед.)    → 3.1–3.6  [направление 3 → 10/10]
       │
Фаза 4 (3–4 нед.)    → 4.1–4.6  [направление 4 → 10/10]
       │
Фаза 5 (3–4 нед.)    → 6.1–6.6  [направление 6 → 10/10]
```

**Параллель:** 2a и 2b можно вести разными командами после 0 и 1.

---

## Чек-лист «10/10» по направлениям

| Направление | Критерий 10/10 |
|-------------|-----------------|
| **1** | Есть явные финансовые продукты (ипотека, страхование, инфра), расчёт премии и риск-профиля кредита по 3D+климат, симуляция износа. |
| **2** | Поддержка LiDAR/point cloud и спутника, специфичный скоринг по data center/port/energy, лимит и премия в API, прогноз downtime. |
| **3** | Сущность Portfolio/REIT, REIT-метрики, 3D-портфель на глобусе, сценарии по портфелю, оптимизация структуры REIT. |
| **4** | Модель Damage Claim и доказательств, 3D-реконструкция (или внятный MVP), сравнение до/после, проверка на дубликаты, UI модуля Fraud. |
| **5** | Модель Project и фаз с CAPEX/OPEX, график (Gantt), расчёт IRR/NPV, связь 3D↔проект, сценарии, отчёт для кредитного комитета. |
| **6** | VR-режим (WebXR), сценарии «что если» в 3D, аннотации, совместный просмотр в реальном времени, режим для инвесткомитета, экспорт сцены. |

---

## Зависимости между фазами

- **0** → 1, 2, 3, 4, 5: product type, credit/insurance расчёты, provenance.
- **1** → 2: `insurance_scoring` и `credit/risk-profile` используются в 2.4.
- **5.1–5.5** → 5.7: отчёт для комитета опирается на проектные данные и IRR.
- **6.3** (аннотации) → 6.4 (совместная работа): общие объекты в 3D.

---

*Документ: план доработок для соответствия стратегии 3D+ИИ в финтехе на 10/10. Ссылка: [PRODUCT_MODEL_3D_FINTECH.md](PRODUCT_MODEL_3D_FINTECH.md).*

*Обновлено: январь 2026*
