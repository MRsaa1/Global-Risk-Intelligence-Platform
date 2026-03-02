# Launch and commercial readiness

Summary of what is included by implementation phase, SLA/limits, pricing reference, and regulatory posture.

## What is included by phase

| Phase | Delivered |
|-------|-----------|
| **Phase 0** | Production readiness: deploy docs (DEPLOY.md, DEPLOY_SAFE.md), release checklist (docs/RELEASE_CHECKLIST.md), health and platform metrics (/api/v1/health, /api/v1/platform/metrics), logging and monitoring (docs/MONITORING.md), no overwrite of .env or prod DB. |
| **Phase 1** | SSOT catalog and ingestion (sources API, catalog-driven job); NLP sentiment service and API (Google NL / AWS Comprehend, cache); Backtesting API (POST /backtesting/run, persisted runs); Early Warning configurable triggers (alerts/triggers, SENTINEL integration). |
| **Phase 2** | Sanctions graph 5–6 hops (SCSS/Neo4j, BFS API); volatility and liquidity metrics and stress scenarios; Fat Tail catalog and triggers; hidden concentration metrics and API (risk-zones/concentration, Herfindahl by supplier/region/technology). |
| **Phase 3** | LPR module (DB, Riva/Maxine/Vertex pipeline stubs, profile/trends API, dashboard); Disinformation module (analyze, campaigns, posts, SENTINEL alerts); Etiology chains (ontology, cause-effect API, for-report); Fraud detector (rules, run-detection, SENTINEL alerts). |
| **Phase 4** | Command Center integration; Risk posture report (/api/v1/platform/risk-posture); BigQuery/Vertex/composite stress (docs/CLOUD_INTEGRATION.md, composite scenario_type with "+"); launch and commercial docs. |

## SLA and limits

- **Availability:** Target uptime as per MASTER_PLAN; health and metrics endpoints for monitoring; optional external checks (e.g. UptimeRobot) per docs/MONITORING.md.
- **Limits:** API rate limits and data volume limits to be set per deployment (env or gateway); document in client contracts.
- **Data:** Retention and backup policy as in DEPLOY.md; no overwrite of production .env or DB by automated scripts (RELEASE_CHECKLIST).

### Client-facing SLA and limits (template for contracts)

Детализацию дополнять по мере запуска этапов. Заполняемые поля для договоров и коммерческой документации:

| Пункт | Пример / место подстановки |
|-------|----------------------------|
| **Uptime** | Целевой процент доступности (напр. 99.5%); источник: MASTER_PLAN. |
| **Response time** | Целевое время ответа ключевых эндпоинтов (напр. health &lt; 2s, dashboard today-card &lt; 10s с учётом кэша 5 мин); тяжёлые эндпоинты (stress, cadapt flood-risk-product, flood-buildings) — кэш 10 мин, первый запрос может быть 10–60s; см. System Overseer пороги. |
| **Rate limits** | Лимиты запросов в минуту/час по ключу или по эндпоинту; задаются в конфиге или API Gateway. |
| **Data volume** | Лимиты по числу активных активов, сценариев, размеру отчётов — по тарифам MASTER_PLAN. |
| **Retention** | Срок хранения данных и логов; см. DEPLOY.md, backup policy. |
| **Incident response** | Время реакции на инциденты (опционально); внешний мониторинг (UptimeRobot и т.п.) + docs/MONITORING.md. |

### Production environment (required)

- **SECRET_KEY** — задать в `apps/api/.env` на сервере (никогда не коммитить).
- **CORS_ORIGINS** — домен(ы) фронта для prod (напр. `https://risk.example.com`).
- **ALLOW_SEED_IN_PRODUCTION** — `false` в prod; `true` только для demo/staging при необходимости.
- **External APIs:** GDELT, Open-Meteo, USGS — таймауты и кэш в коде (GDELT 3s для today-card, кэш 15 мин; today-card кэш 5 мин; flood-ответы 10 мин). При частых таймаутах — рассмотреть внешний мониторинг и/или увеличение таймаутов в конфиге.

### Enterprise (SSO, RBAC, audit export)

- **SSO (production):** Для production SSO задать в `.env`: `OAUTH2_CLIENT_ID`, `OAUTH2_CLIENT_SECRET`, `OAUTH2_DISCOVERY_URL` (или `OAUTH2_AUTHORIZE_URL` / `OAUTH2_TOKEN_URL` при отсутствии discovery), `OAUTH2_REDIRECT_URI`. Полноценный SSO = один выбранный IdP (например Okta, Auth0, Azure AD) и при необходимости маппинг атрибутов/JWT в роли платформы.
- **RBAC:** Роли и разрешения заданы в `ROLE_PERMISSIONS`; зависимость `require_permission("permission_name")` применена к критичным маршрутам (экспорт отчётов, экспорт audit trail, экспорт disclosure PDF). Полное применение RBAC по всем эндпоинтам — следующий этап; документировать в контрактах при необходимости.
- **Audit export (SOC 2):** `GET /api/v1/auth/enterprise/audit-export` возвращает сводный экспорт за период (логины, создание/отзыв API keys, permission overrides) в JSON или CSV. Базовый экспорт для внутреннего использования и подготовки к SOC 2; при необходимости позже добавить подпись, ретеншн и форматы под аудитора.

## Dual revenue engine

Two distinct revenue streams with separate contracts and scoping:

| Stream | Product | Clients | Access | Billing |
|--------|---------|---------|--------|--------|
| **B2G SaaS** | Municipal subscription | Cities, municipalities (5K–50K+ population) | Municipal Dashboard, reports, playbooks, alerts, launch checklist | Subscription $5K–20K/year (or Track B $1K–2K/month); Stripe or invoice |
| **Risk Data API** | High-margin data product | Insurers, reinsurers, REIT, funds | API key–scoped access to city risk scores, hazard exposure, stress results, disclosure export (municipal_schema_v1) | Per tier: requests/month, number of cities; tiered (starter/growth/enterprise) |

- **B2G:** [MunicipalSubscription](apps/api/src/models/municipal_subscription.py), tenant_id, stripe_subscription_id; access to `/cadapt/*`, Municipal Dashboard, insurability report, launch checklist.
- **Risk Data API:** API keys with scopes such as `read:city_risks`, `read:disclosure_export`, `read:stress_results`; rate limits and usage tracking (e.g. `api_usage` or billing integration) per tier. Endpoints: e.g. `/cadapt/disclosure-export`, `/cadapt/community/risk`, stress test results, ROI metrics.
- **Documentation:** B2G terms and Risk Data API limits/SLA/prices to be detailed in commercial contracts; this doc only defines the split.

### Risk Data API (B2B read-only)

- **Base URL:** `/api/v1/data` (e.g. `https://api.example.com/api/v1/data`).
- **Endpoints (GET only):**
  - `GET /api/v1/data/city-risks?city={id}` — community/city risk (proxy to CADAPT community/risk).
  - `GET /api/v1/data/disclosure?city=...&export_format=municipal_schema_v1` — disclosure export (proxy to CADAPT disclosure-export).
  - `GET /api/v1/data/stress-results` — list stress test results (read-only).
  - `GET /api/v1/data/stress-results/{test_id}` — single stress test result.
- **Authorization:** API key with scope `read:data_api` or `b2b:data` (header `X-API-Key`), or JWT Bearer with permission `read:data_api`/`b2b:data`. Missing or invalid credentials → 403.
- **Rate limit:** To be set per deployment (env or API gateway); document in client contracts.

## Pricing reference

- Align with **MASTER_PLAN.md**: Platform Subscription, Per-Asset, Professional Services.
- **B2G SaaS:** Municipal subscriptions as above; optional Custom Report / Custom Analysis ($15–30K) per LAUNCH docs.
- **Risk Data API:** Tier-based (requests/month, cities); higher margin via automation.
- Optional modules (LPR, Disinformation) as add-on options.
- Pricing tiers and caps to be defined commercially; this document only references the plan.

## Regulatory and compliance

- **BCP / resilience:** Business continuity and disaster recovery as in deploy and BCP generator; stress tests and action plans support regulatory narratives.
- **Audit trail:** Provenance, agent audit logs, module audit logs, ethicist and compliance verification where implemented.
- **Compliance:** ASGI, regulatory phrases, disclaimers, and document templates in codebase; materials for regulators (ECB, Fed) as per roadmap.

## References

- MASTER_PLAN.md  
- DEPLOY.md, DEPLOY_SAFE.md  
- docs/RELEASE_CHECKLIST.md, docs/MONITORING.md, docs/CLOUD_INTEGRATION.md  
- docs/REQUIREMENTS_VERDICT_AND_LPR_STACK.md  
