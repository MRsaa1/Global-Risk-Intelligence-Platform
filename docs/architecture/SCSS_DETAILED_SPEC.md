# Supply Chain Sovereignty System (SCSS) — детальный разбор задач

## Главная миссия модуля

SCSS защищает организации от геополитических и структурных рисков в цепочках поставок, обеспечивая суверенитет (независимость) от критических зависимостей.

**Текущая реализация в платформе:** модуль `src.modules.scss`, эндпоинты `/api/v1/scss/*`, модели `scss_suppliers`, `scss_supply_routes`, сид `strategic_modules_seed.scss`, агент SCSS_ADVISOR (см. STRATEGIC_MODULES_MATRIX.md).

---

## 1. Основные задачи (Core Problems)

### 1.1 Проблема: «Черный ящик» цепочек поставок

**Что решает SCSS**

- **Проблема клиента:** «Мы производим автомобили, но не знаем: откуда на самом деле берутся микрочипы, сколько у нас критических single-source suppliers, что будет, если Китай введет экспортные ограничения».
- **Решение SCSS:** полная карта цепочки от руды до готового продукта, визуализация Tier 0–5, идентификация скрытых зависимостей.

**Задача 1.1.1: Картирование многоуровневых supply chains**

- **Input:** конечный продукт (например, «Tesla Model 3»), известные Tier 1 (Panasonic, NVIDIA и т.д.).
- **Process:** запрос поставщиков Tier 2 → углубление (кто поставляет литий и т.д.) → построение графа: рудник → переработка → cathode → battery cell → OEM.
- **Output:** граф supply chain 5+ уровней, список 200+ suppliers, географическое распределение (например, 50% зависимость от Китая).

**Пример UI:**

```
Supply Chain: Tesla Model 3 Battery
Tier 0 (Raw Material):   Lithium Mine (Chile), Cobalt Mine (DRC)
Tier 1 (Processing):     Lithium Refinery (China)
Tier 2 (Components):     Cathode Producer (Japan)
Tier 3 (Assembly):       Panasonic Battery Factory
Tier 4 (Final):          Tesla Gigafactory

Alert: 67% of supply chain passes through China
Alert: Single source for Cobalt (DRC only)
```

---

### 1.2 Проблема: Невидимые узкие места (Hidden Bottlenecks)

**Что решает SCSS**

- **Проблема клиента:** «10 поставщиков микрочипов, но все они используют один foundry (TSMC) — скрытая single point of failure».
- **Решение SCSS:** анализ вглубь (кто производит чипы для ваших suppliers), обнаружение concentration risk на Tier 2–3.

**Задача 1.2.1: Идентификация Single Point of Failure (SPOF)**

- Алгоритм: для каждого узла проверить, есть ли путь от raw material до product при удалении этого узла; если нет — узел является SPOF.
- **Output:** список bottlenecks с `supplier_name`, `tier`, `risk_type`, `affected_products`, `dependency_score`, `estimated_disruption_cost_usd`, `recommended_action` (например, диверсификация на Samsung/Intel).

**Задача 1.2.2: Обнаружение географической концентрации**

- Пример: Supplier A (Германия), B (Франция), C (Италия) — все три используют один raw material source в Китае → 100% geographic concentration на Tier 0.
- **Alert:** «Despite European supplier diversity, 100% of critical materials sourced from China. Geopolitical risk: HIGH».

---

### 1.3 Проблема: Геополитическая хрупкость

**Что решает SCSS**

- Симуляция сценариев (торговая война, санкции, нестабильность), оценка impact (cost, delays, stockouts), рекомендации по альтернативным поставщикам.

**Задача 1.3.1: Геополитическая симуляция (Scenario Planning)**

- **Сценарий 1 — Торговая война:** например, «USA 100% tariffs on Chinese semiconductors» → идентификация suppliers в Китае, вклад в BOM, применение тарифа, каскад (месяцы 1–6), revenue loss / market share / churn.
- **Сценарий 2 — Санкции:** например, «EU sanctions Russia — gas cut» → supplier пластика в Германии зависит от Russian gas → capacity reduction, delays, рекомендация переключиться на US-based supplier.
- **Сценарий 3 — Политическая нестабильность:** например, конфликт в Taiwan Strait → 78% semiconductor suppliers затронуты → рекомендация URGENT квалифицировать Samsung/Intel.

**Задача 1.3.2: Continuous Geopolitical Risk Monitoring**

- Агент SCSS (или SCSS_ADVISOR) мониторит: sanctions, natural disasters, политическая нестабильность; при совпадении с регионами поставщиков — алерт и/или автоматический запуск симуляции impact.
- Примеры алертов: CRITICAL (earthquake Taiwan, 12 suppliers, delays 30–60 days), WARNING (South China Sea tensions, 67 suppliers), INFO (new USA–Vietnam trade agreement, opportunity 8–12% cost savings).

---

### 1.4 Проблема: Медленная реакция на кризисы

**Что решает SCSS**

- Real-time мониторинг suppliers, early warning, автоматические рекомендации альтернатив, предрассчитанные contingency plans.

**Задача 1.4.1: Early Warning System**

- Мониторинг: supplier health (financial, operational, quality, labor), external risk (weather, political, economic, regulatory), market signals (commodity prices, shipping costs, lead times).
- Пример: за 7 дней до кризиса — рост ставок контейнеров, рост задержек поставщика, прогноз тайфуна → оценка stockout risk, рекомендации (срочные заказы, альтернативный supplier, уведомление клиентов), сравнение cost of action vs inaction.

**Задача 1.4.2: Automated Alternative Supplier Finder**

- При риске по Supplier A: поиск по material, capacity, quality cert, geographic diversification; ранжирование по geopolitical_risk, cost, lead_time, quality_history, capacity_margin; топ-5 альтернатив с pros/cons, transition_timeline, transition_cost, recommendation (например, dual-source 70% Samsung, 30% current).

---

### 1.5 Проблема: ESG и Compliance риски в supply chain

**Что решает SCSS**

- Аудит suppliers на ESG, мониторинг sanction lists (OFAC, EU, UN), отслеживание нарушений прав человека, автоматические алерты.

**Задача 1.5.1: ESG Risk Monitoring**

- Проверки: labor (forced labor, child labor, safety), environment (emissions, deforestation, water), governance (corruption, sanctions, conflict minerals).
- Пример алерта: supplier с нарушениями безопасности (заблокированные выходы, переполнение) → reputational/regulatory risk, рекомендация приостановить заказы, аудит, альтернатива.

**Задача 1.5.2: Sanctions Compliance Automation**

- Сверка каждого supplier (и parent/subsidiaries) с OFAC, EU, UN, UK sanctions; при совпадении — «TERMINATE immediately», legal risk CRITICAL.

---

## 2. Дополнительные задачи (Advanced Features)

### 2.1 Supply Chain Optimization

- **Cost Optimization:** TCO (purchase, shipping, inventory, quality, risk cost); рекомендация optimal mix; пример: переключение с China на Mexico — savings $1.3M + снижение inventory $500K, payback 3 months.

### 2.2 Supply Chain Resilience Scoring

- **Resilience Index (0–100):** diversification, geographic_spread, redundancy, lead_time, supplier_financial_health.
- Пример: iPhone 15 Pro → 42/100 (LOW), breakdown по факторам, рекомендации (добавить Samsung, US suppliers, nearshoring) для выхода на 75/100.

### 2.3 Demand–Supply Balancing

- Прогноз shortage: demand forecast vs supplier capacity vs industry demand → shortage risk %, рекомендации (lock capacity, secondary supplier, price premium).

---

## 3. Интеграция с другими модулями

### 3.1 SCSS ↔ CIP

- CIP обнаруживает сбой (например, power outage в регионе); SCSS определяет suppliers в этом регионе, оценивает impact (доля компонентов, downtime), запускает contingency (alert, альтернативные suppliers, rush from inventory).

### 3.2 SCSS ↔ SRO

- SRO обнаруживает stress у Bank X; SCSS проверяет, какие suppliers финансируются Bank X; алерт о риске кредитной линии и рекомендации (запрос отчетности, мониторинг, pre-qualify alternative, prepayment при необходимости).

---

## 4. Key Metrics (KPIs)

- **Risk reduction:** SPOF 23→3, geographic concentration 78%→45%, resilience score 42→75.
- **Cost savings:** optimization $5M/year, crisis avoidance $20M, negotiations $2M/year.
- **Operational:** lead time 60→35 days, stockouts 12→2/year, on-time delivery 78%→94%.
- **Compliance:** ESG violations detected and resolved, sanctions 100%, audit readiness.

---

## 5. Примеры клиентов (кратко)

- **Tesla (Automotive):** маппинг battery chain 5 tiers, bottlenecks (lithium, cobalt, graphite), симуляция «China export ban», диверсификация (Australia, Canada, US synthetic), результат: China dependency 78%→45%, resilience 38→72.
- **Pharmaceutical:** API single-sourced India; early warning + dual-source 60% India / 40% Europe; при следующем disruption — переключение на European supplier, market share +8%, ROI $200M avoided lost sales.

---

## 6. Технические детали реализации

### 6.1 Data Sources

- **Internal:** ERP (SAP, Oracle), PLM (BOM), Procurement (contracts, pricing).
- **Supplier:** APIs, EDI, financials, capacity, certifications.
- **External:** geopolitical feeds, sanctions lists (OFAC/EU/UN), news, shipping, weather, commodity prices.
- **Knowledge Graph:** связи suppliers ↔ subsuppliers ↔ raw materials, география, отраслевые данные.

### 6.2 Machine Learning (целевые модели)

- Supplier Risk Prediction (financial, delivery, country risk, industry, macro).
- Lead Time Forecasting (supplier, season, order size, route, congestion).
- Demand–Supply Gap / Shortage Predictor.
- Anomaly Detection для early warnings.

---

## Резюме: главные задачи SCSS

| # | Проблема | Решение |
|---|----------|---------|
| 1 | **Visibility** | «Черный ящик» → прозрачная карта supply chain |
| 2 | **Risk Identification** | Скрытые bottlenecks и SPOF |
| 3 | **Geopolitical Resilience** | Санкции, торговые войны, нестабильность |
| 4 | **Early Warning** | Предсказание кризисов до наступления |
| 5 | **Compliance** | ESG и sanctions compliance автоматизированы |

**Value proposition:** избежание stockouts ($10M–100M/year), cost optimization 5–15%, risk mitigation; ROI 10–100x, payback 1–3 months.

---

## Связь с текущей реализацией в платформе

- **Модуль:** `src.modules.scss` (SCSSModule), слой 0–4, агенты SCSS_ADVISOR, SUPPLY_SENTINEL, SOURCING_OPTIMIZER.
- **Модели:** `scss_suppliers`, `scss_supply_routes` (tier, country_code, sovereignty_score, risk fields).
- **Сценарии симуляции (задекларированы):** supply_disruption, geopolitical_block, supplier_bankruptcy, logistics_bottleneck, raw_material_shortage, price_shock, sanctions_impact.
- **Дальнейшая реализация:** см. [STRATEGIC_MODULES_ROADMAP.md](STRATEGIC_MODULES_ROADMAP.md) и [SCSS_IMPLEMENTATION_PLAN.md](SCSS_IMPLEMENTATION_PLAN.md) (фазы, FR-SCSS-001–008, сроки 12 мес, интеграция CIP/SRO, GTM).
