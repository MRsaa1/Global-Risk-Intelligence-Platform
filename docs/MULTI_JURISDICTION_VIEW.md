# Multi-Jurisdiction View

Агрегированное представление комплаенса по юрисдикциям для кросс-граничного и супервизорского обзора.

## API

**GET** `/api/v1/compliance/multi-jurisdiction?entity_type=CITY_REGION`

Параметры:
- `entity_type` (optional) — тип объекта: `CITY_REGION`, `FINANCIAL`, `INFRASTRUCTURE`, `HEALTHCARE`, `ENTERPRISE` и др. По умолчанию `CITY_REGION`.

Ответ:
- `description` — описание ответа
- `entity_type` — переданный тип
- `jurisdictions` — массив по юрисдикциям (EU, USA, UK, Japan, Canada, Australia). Для каждой:
  - `jurisdiction_code`, `jurisdiction_name`
  - `regulations` — список ID регуляций (TCFD, NGFS, SEC, FSA_Japan и т.д.)
  - `regulation_labels` — подписи к регуляциям
  - `disclosure_required` — требуется ли раскрытие
  - `frameworks` — список framework_id для Compliance Dashboard (basel, tcfd, dora, …)
  - `last_verification_by_framework` — последняя верификация по каждому framework для этой юрисдикции (из `compliance_verifications`)

## Источники данных

- **regulatory_engine**: маппинг entity_type + jurisdiction → применимые регуляции и framework_id.
- **compliance_verifications**: последний статус проверки по framework и jurisdiction.

## Использование

- **Regulator Mode** (Supervisory Climate Risk View): можно вызывать multi-jurisdiction и отображать таблицу/карту по юрисдикциям.
- **Cross-border отчёты**: агрегация по EU, US, UK и т.д. для единого отчёта.
- **Compliance Dashboard**: фильтр по юрисдикции уже есть в `GET /compliance/dashboard?jurisdiction=...`; multi-jurisdiction даёт сводку по всем юрисдикциям одним запросом.

## См. также

- `docs/MASTER_PLAN.md` — Cross-Border View, Multi-jurisdiction aggregation
- `apps/api/src/services/regulatory_engine.py` — JURISDICTION_CITY_REGION_REGULATIONS, get_applicable_regulations
- `apps/web/src/pages/RegulatorMode.tsx` — Supervisory view (можно подтянуть данные из multi-jurisdiction)
