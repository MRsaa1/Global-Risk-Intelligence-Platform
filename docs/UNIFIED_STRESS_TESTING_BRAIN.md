# Unified Stress Testing Brain — единый «мозг» тестирования по стране/городу

## Идея

**Один вход:** пользователь выбирает **страну** и **город**.  
**Один запуск:** платформа автоматически применяет **все** доступные стресс-тесты, симуляции, каскады, исторические сравнения и подключает агентов/ИИ.  
**Один выход:** **исчерпывающий мета-отчёт** по всем метрикам и сценариям с единой структурой и выводами.

Цель — уровень «10/10» в духе BlackRock Aladdin / Palantir: один запрос по локации → полная картина риска и готовый отчёт для регулятора/совета.

---

## Что уже есть в платформе (и что объединять)

| Компонент | Где живёт | Вход (локация) | Выход |
|-----------|-----------|-----------------|--------|
| Quick stress test (зоны, потери, отчёт) | `stress_tests.py` `/execute` | `city_name`, entity, severity | zones, total_loss, report_v2, cascade |
| Universal stress (методология) | `universal_stress.py` `/universal` | sector, scenario_type, severity, geographic_scope | loss_distribution, cascade, recovery, sector_metrics |
| Portfolio stress (Monte Carlo) | `stress.py` `/run` | asset_values, default_probs, scenario | VaR, CVaR, cascade |
| Risk zones по событию | `risk_zone_calculator` | event_type, lat/lng, severity | ZoneLevel, estimated_loss |
| Cascade (GNN, инфра) | `cascade_gnn`, `cascade_engine`, CIP | trigger_node, graph / инфра | affected_nodes, critical_path |
| Historical comparable | `historical_events.py` `/comparable` | event_id, city_name | comparable_events |
| FST (фин. стресс) | `fst/service.py` | scenario_id | regulatory_package, report |
| SRO (системный риск) | `sro` | shock, horizon | contagion, collapse prob |
| NVIDIA orchestration (ИИ) | `nvidia_orchestration`, `nvidia_stress_pipeline` | scenario, entity | consensus summary, analysis |
| ARIN / агенты | `arin`, `agentic_orchestrator` | entity, scenario | verdict, recommendations |
| Regulatory engine | `regulatory_engine` | jurisdiction | applicable_regulations |
| News enrichment | `news_enrichment` | context | enriched context |

Сейчас каждый кусок вызывается отдельно (разные API, разные UI). Нет единой точки «запусти всё для города X».

---

## Нужно ли это?

**Да**, если целевой уровень — enterprise и регулятор:

1. **Регулятор (ECB, Fed, OSFI, EBA):** ожидают комплексный стресс по юрисдикции/локации, а не разрозненные сценарии.
2. **Совет директоров / CRO:** один «красный отчёт» по региону с агрегацией всех типов риска.
3. **Конкуренция с Aladdin/Palantir:** у них как раз «одна кнопка — полная диагностика» по портфелю/региону.

Без единого оркестратора платформа остаётся набором инструментов; с ним — единой системой принятия решений.

---

## Где реализовать

### 1. Бэкенд: оркестратор + один эндпоинт

**Сервис:** новый модуль, например  
`apps/api/src/services/unified_stress_brain.py`  
или  
`apps/api/src/api/v1/endpoints/unified_stress.py` (логика оркестрации прямо в роутере для первого этапа).

**Функция (псевдо-сигнатура):**

```text
run_unified_stress(country_code: str, city_name: str, options: UnifiedStressOptions) -> UnifiedStressReport
```

**Внутри оркестратора (последовательно или частично параллельно):**

1. **Нормализация локации:** country_code + city_name → координаты, регион, jurisdiction (уже есть `_get_currency_for_city`, `_get_jurisdiction_for_city` в `stress_tests.py`).
2. **Каталог сценариев:** список всех типов стресс-тестов платформы (flood, seismic, fire, financial, pandemic, climate, cyber, supply_chain, …) из `StressTestType` и из universal_stress / FST / SRO.
3. **Для каждого типа сценария:**
   - вызов quick stress и/или universal stress с `geographic_scope=[city_name]` / region;
   - при наличии портфеля/активов по городу — вызов portfolio stress;
   - при наличии инфраструктуры (CIP) — каскад по графу;
   - при необходимости — SRO contagion, FST run (если привязка к региону/банкам есть).
4. **Исторические сравнения:** для каждого event_type вызов `GET /historical-events/comparable?event_id=...&city_name=...`.
5. **Агрегация метрик:** один общий словарь метрик (VaR, CVaR, RTO, потери по зонам, контагиозность, коллапс и т.д.) с пометкой источника (stress_test, universal, cascade, historical, fst, sro).
6. **Мета-отчёт:**
   - executive_summary (можно генерировать через NVIDIA orchestration по агрегированному контексту);
   - разделы по типам риска (climate, financial, operational, …);
   - сравнительная таблица «все сценарии по городу»;
   - блок historical_comparable;
   - блок regulatory (applicable_regulations по jurisdiction);
   - блок рекомендаций (ARIN/агенты, если вызываются).
7. **Агенты и ИИ:** один вызов ARIN/consensus по итоговому сценарию и метрикам; при необходимости — отдельные агенты (Sentinel, Reporter, Ethicist) с записью в audit.

**Эндпоинт, например:**

- `POST /api/v1/unified-stress/run`  
  Body: `{ "country_code": "DE", "city_name": "Frankfurt", "include_historical": true, "include_agents": true, "include_fst": false }`  
  Response: `UnifiedStressReport` (JSON); опционально — сохранение в БД и ссылка на отчёт.

Так вся логика «применить всё к одной локации» живёт в одном месте и один раз использует страну/город.

### 2. Фронтенд: точка входа

Варианты:

- **Command Center / Dashboard:** блок «Unified Stress» с выбором страны и города и кнопкой «Run full assessment».
- **Отдельная страница:** например `/unified-stress` или `/risk-brain` с пикером страны/города, прогрессом запуска и отображением мета-отчёта (секции: все метрики, все сценарии, исторические события, регуляторика, ИИ-резюме, рекомендации).
- **Municipal Dashboard / Regulator mode:** та же кнопка «Full assessment» по выбранному городу.

Удобно сначала сделать один экран «выбор страны + город → Run → один большой отчёт», затем встроить тот же flow в существующие дашборды.

### 3. Хранение и аудит

- Сохранять каждый запуск в БД (например таблица `unified_stress_runs`: id, country_code, city_name, options, report_snapshot, created_at, created_by).
- Писать в общий audit trail (например `module_audit_log` или существующий audit) факт запуска и идентификатор отчёта.
- Экспорт мета-отчёта в PDF/Excel для регулятора (как уже делается для FST/SCSS) — отдельная кнопка «Download full report».

---

## Как довести до уровня 10/10 (BlackRock / Palantir)

1. **Полнота сценариев**  
   Все стресс-тесты и симуляции платформы реально вызываются из оркестратора (не заглушки), с конфигурируемым списком «что включить» (например только climate, или climate + financial + operational).

2. **Единая метрика и нормализация**  
   Все числовые результаты приводятся к одной шкале/валюте и одному формату (например EUR, годовой горизонт), чтобы мета-отчёт был суммируемым и сравнимым.

3. **Скорость и очереди**  
   Тяжёлые прогоны (Monte Carlo 100K, каскады по большим графам) — в фоне (Celery/Redis или асинхронная задача с job_id); пользователь получает ссылку на отчёт или стриминг прогресса. Это уже частично есть в bulk stress.

4. **Качество мета-отчёта**  
   Executive summary и выводы генерируются ИИ (NVIDIA orchestration / NIM) по полному контексту всех сценариев и метрик, а не по одному сценарию — «мозг» именно объединяет всё в один нарратив.

5. **Регуляторная готовность**  
   Секция отчёта «Regulatory relevance» (ECB, Fed, OSFI, EBA) и, при необходимости, one-click export в форматах, описанных в REGULATORY_ENGAGEMENT_PLAN и OSFI checklist.

6. **Агенты и контроль качества**  
   ARIN и внутренние агенты проверяют согласованность метрик и сценариев, помечают аномалии; их выводы — отдельный блок в мета-отчёте.

7. **Прозрачность и воспроизводимость**  
   В отчёт зашиты версии моделей, параметры запуска и идентификаторы сценариев, чтобы регулятор мог повторить расчёт.

Поэтапно: сначала «один эндпоинт + один отчёт по городу» с вызовом существующих API без изменения их контрактов; затем добавление очередей, полного набора сценариев, ИИ-резюме и экспорта — так можно выйти на уровень «единого мозга тестирования» 10/10.

---

## Минимальный первый шаг (MVP)

1. Добавить `POST /api/v1/unified-stress/run` с телом `{ "country_code", "city_name" }`.
2. Внутри вызывать:
   - quick stress для 3–5 сценариев (flood, seismic, financial) с фиксированным severity;
   - historical comparable для каждого типа;
   - один раз NVIDIA orchestration по агрегированному контексту.
3. Вернуть JSON: `{ "city_name", "country_code", "scenarios": [...], "historical": [...], "executive_summary": "..." }`.
4. На фронте: одна страница или модалка с выбором страны/города и кнопкой «Run full assessment», отображение результата в виде секций.

После этого по шагам подключать universal_stress, cascade, FST, SRO, ARIN и расширять мета-отчёт до полного формата.
