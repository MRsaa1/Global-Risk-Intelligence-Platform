# Верификация плана полного внедрения и запуска Global Risk Platform

Соответствие плана (Scope: REQUIREMENTS_VERDICT_AND_LPR_STACK.md, MASTER_PLAN.md, router.py, DEPLOY.md) текущей кодовой базе.

---

## Phase 0: Foundation and production launch

| Требование | Статус | Где в коде / конфиге |
|------------|--------|----------------------|
| Деплой: один скрипт, rollback, .env только на сервере | ✅ | [DEPLOY.md](../DEPLOY.md), [DEPLOY_SAFE.md](../DEPLOY_SAFE.md), [deploy.sh](../deploy.sh), [deploy-safe.sh](../deploy-safe.sh) |
| Проверки перед релизом: health, миграции, VITE_API_URL, без перезаписи .env/prod DB | ✅ | [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) |
| CI: тесты и линтеры перед деплоем | ✅ | [.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| Логирование API, ротация | ⚠️ | Рекомендуется настроить на сервере (см. DEPLOY); structlog в API |
| Метрики: uptime, алерты, Neo4j/MinIO/Timescale | ✅ | [GET /api/v1/platform/metrics](../apps/api/src/api/v1/endpoints/platform.py): `uptime_seconds`, `active_alerts_count`, `neo4j`, `minio`, `timescale`, `llm_usage` |
| Алертинг (API down, 5xx) | ⚠️ | Внешний мониторинг (UptimeRobot и т.п.); скрипт не в репо |
| SECRET_KEY, CORS_ORIGINS, ALLOW_SEED_IN_PRODUCTION | ✅ | [DEPLOY.md](../DEPLOY.md), [config.py](../apps/api/src/core/config.py) |
| Enterprise auth (SSO/2FA/API keys) при платящих клиентах | ✅ | [enterprise_auth](../apps/api/src/api/v1/endpoints/enterprise_auth.py), router prefix `/auth/enterprise` |

---

## Phase 1: Core functional gaps

| Требование | Статус | Где в коде |
|------------|--------|------------|
| **1.1 SSOT** Каталог источников: тип, URL, частота, схема | ✅ | [IngestionSource](../apps/api/src/models/ingestion_source.py), миграция `ingestion_sources` |
| GET/POST /api/v1/ingestion/sources | ✅ | [ingestion.py](../apps/api/src/api/v1/endpoints/ingestion.py): GET/POST `/sources`, GET/PATCH `/sources/{id}`, POST `/run-by-catalog`, POST `/refresh-all` |
| Пайплайны ingestion (2–3 приоритетных источника) | ✅ | [data_federation](../apps/api/src/services/ingestion/): market_data, natural_hazards, threat_intelligence, weather, biosecurity, cyber_threats, economic, social_media |
| Scheduler для периодического вызова пайплайнов | ✅ | [scheduler.py](../apps/api/src/core/scheduler.py), [register_jobs.py](../apps/api/src/services/ingestion/register_jobs.py), старт в [main.py](../apps/api/src/main.py) |
| **1.2 NLP** Сервис тональности (Google NL / AWS Comprehend, кэш) | ✅ | [nlp_sentiment.py](../apps/api/src/services/nlp_sentiment.py) |
| POST /api/v1/nlp/sentiment (текст или URL) | ✅ | [nlp.py](../apps/api/src/api/v1/endpoints/nlp.py) |
| **1.3 Backtesting** Отдельный сервис и API | ✅ | [backtesting_service.py](../apps/api/src/services/backtesting_service.py), [stress_report_metrics._get_backtesting_events](../apps/api/src/services/stress_report_metrics.py) |
| POST /api/v1/backtesting/run, хранение прогонов | ✅ | [backtesting.py](../apps/api/src/api/v1/endpoints/backtesting.py): POST `/run`, GET `/runs`, GET `/runs/{run_id}`; модель [backtest_run.py](../apps/api/src/models/backtest_run.py) |
| **1.4 Early Warning** Таблица/конфиг правил (метрика, порог, окно, тип алерта) | ✅ | [alert_trigger.py](../apps/api/src/models/alert_trigger.py) |
| GET/POST/PATCH /api/v1/alerts/triggers | ✅ | [alerts.py](../apps/api/src/api/v1/endpoints/alerts.py): GET/POST `/triggers`, PATCH `/triggers/{trigger_id}` |
| Движок: загрузка триггеров, сравнение с порогами, создание алертов | ✅ | `_evaluate_custom_triggers()` в [alerts.py](../apps/api/src/api/v1/endpoints/alerts.py), вызов из цикла SENTINEL |

---

## Phase 2: Risk depth

| Требование | Статус | Где в коде |
|------------|--------|------------|
| **2.1 Санкционный граф** BFS от узла на глубину 5–6 | ✅ | [knowledge_graph.bfs_from_entity](../apps/api/src/services/knowledge_graph.py), max_hops=6 |
| GET /api/v1/scss/compliance/sanctions/graph?entity_id=&max_hops=6 | ✅ | [scss.py](../apps/api/src/api/v1/endpoints/scss.py) |
| **2.2 Волатильность и ликвидность** Метрики, сценарии стресс-тестов | ✅ | [market_metrics_service.py](../apps/api/src/services/market_metrics_service.py), [market_metrics.py](../apps/api/src/api/v1/endpoints/market_metrics.py); [universal_stress_engine](../apps/api/src/services/universal_stress_engine.py): `volatility_spike`, `liquidity_dry_up` |
| **2.3 Fat Tail** Каталог tail-событий, триггеры | ✅ | [fat_tail_event.py](../apps/api/src/models/fat_tail_event.py), [fat_tail.py](../apps/api/src/api/v1/endpoints/fat_tail.py), GET `/fat-tail/triggers` |
| **2.4 Скрытая концентрация** Herfindahl по поставщику/региону/технологии | ✅ | [concentration_service.py](../apps/api/src/services/concentration_service.py), [risk_zones.py](../apps/api/src/api/v1/endpoints/risk_zones.py) GET `/concentration` |

---

## Phase 3: New modules

| Требование | Статус | Где в коде |
|------------|--------|------------|
| **3.1 LPR** Таблицы lpr_entities, lpr_appearances, lpr_metrics | ✅ | [lpr.py models](../apps/api/src/models/lpr.py), миграции, [lpr_service.py](../apps/api/src/services/lpr_service.py), [lpr.py endpoints](../apps/api/src/api/v1/endpoints/lpr.py) |
| Riva/Maxine/Vertex — конфиг и расширения | ⚠️ | [nvidia_riva.py](../apps/api/src/services/nvidia_riva.py); Maxine/Vertex — по REQUIREMENTS_VERDICT_AND_LPR_STACK.md при масштабировании |
| GET /api/v1/lpr/profile/{id}, /lpr/trends, дашборд | ✅ | Роутер `/lpr`, фронт [LPRPage](../apps/web/src/pages/LPRPage.tsx), [LPRProfilePage](../apps/web/src/pages/LPRProfilePage.tsx) |
| **3.2 Дезинформация** Модель, POST analyze, GET campaigns, алерты | ✅ | [disinformation models](../apps/api/src/models/disinformation.py), [disinformation_service.py](../apps/api/src/services/disinformation_service.py), [disinformation.py](../apps/api/src/api/v1/endpoints/disinformation.py) |
| **3.3 Этиомика** Цепочки причина→следствие, ANALYST | ✅ | [etiology_service.py](../apps/api/src/services/etiology_service.py), [etiology.py](../apps/api/src/api/v1/endpoints/etiology.py) |
| **3.4 Фрод** Правила/ML, алерты в SENTINEL | ✅ | [fraud.py models](../apps/api/src/models/fraud.py), [fraud_detector_service.py](../apps/api/src/services/fraud_detector_service.py), [fraud.py](../apps/api/src/api/v1/endpoints/fraud.py) |

---

## Phase 4: Integration, scale and launch

| Требование | Статус | Где в коде |
|------------|--------|------------|
| **4.1** Command Center: геоданные, стресс, алерты, Early Warning, ЛПР, концентрация, backtesting | ✅ | [CommandCenter.tsx](../apps/web/src/pages/CommandCenter.tsx), виджеты |
| Risk posture: SSOT-сводка, метрики по категориям, Fat Tail, концентрация, этиомика | ✅ | GET [ /api/v1/platform/risk-posture ](../apps/api/src/api/v1/endpoints/platform.py) |
| **4.2** BigQuery/Vertex AI (конфиг) | ⚠️ | [config.py](../apps/api/src/core/config.py): vertex_ai_region и др.; синхрон BigQuery — по MASTER_PLAN при необходимости |
| **4.3** Составные сценарии (например oil_20 + taiwan_earthquake) | ✅ | [universal_stress_engine.py](../apps/api/src/services/universal_stress_engine.py): разбор по `+`, composite_factor |
| **4.4** Документация для клиентов, SLA, лимиты | ⚠️ | [LAUNCH_AND_COMMERCIAL_READINESS.md](LAUNCH_AND_COMMERCIAL_READINESS.md), [CLOUD_INTEGRATION.md](CLOUD_INTEGRATION.md); детализацию по этапам и SLA — дополнять по мере запуска |

---

## Ссылки на ключевые файлы (как в плане)

| Назначение | Путь |
|------------|------|
| Конфиг | [apps/api/src/core/config.py](../apps/api/src/core/config.py) |
| Роутер API | [apps/api/src/api/v1/router.py](../apps/api/src/api/v1/router.py) |
| Алерты и мониторинг | [alerts.py](../apps/api/src/api/v1/endpoints/alerts.py), [sentinel.py](../apps/api/src/layers/agents/sentinel.py) |
| Стресс и backtesting | [stress_report_metrics.py](../apps/api/src/services/stress_report_metrics.py), [universal_stress_engine.py](../apps/api/src/services/universal_stress_engine.py) |
| SCSS и санкции | [apps/api/src/modules/scss/](../apps/api/src/modules/scss/), [SCSS_INSTITUTIONAL_ROADMAP.md](architecture/SCSS_INSTITUTIONAL_ROADMAP.md) |
| Riva | [apps/api/src/services/nvidia_riva.py](../apps/api/src/services/nvidia_riva.py) |
| Вердикт и стек ЛПР | [REQUIREMENTS_VERDICT_AND_LPR_STACK.md](REQUIREMENTS_VERDICT_AND_LPR_STACK.md) |

---

## Итог

- **Phase 0–3:** Все пункты плана имеют соответствующую реализацию в коде; отдельные элементы (логирование, алертинг, BigQuery/Vertex, документация SLA) помечены как рекомендованные к донастройке на стороне инфраструктуры или продукта.
- **Phase 4:** Интеграция в Command Center и risk-posture реализована; составные сценарии — в движке стресс-тестов; облачная аналитика и коммерческая документация — частично или по плану развития.

Обновлено: 2026-02-25.
