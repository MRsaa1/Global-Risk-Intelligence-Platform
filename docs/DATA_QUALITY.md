# Data Quality: SLA, Provenance, Confidence

## SLA status (ingestion sources)

- **Endpoint:** `GET /api/v1/ingestion/sla-status`
- **Returns:** Per-source status: `last_refresh` (ISO), `target_max_age_seconds`, `status` (`ok` | `stale` | `fail`), `age_seconds`.
- **Use:** Dashboard freshness indicators, alerting when a source is `stale` or `fail` (e.g. no refresh within target).
- **Targets:** Defined in `apps/api/src/services/ingestion/pipeline.py` (`SOURCE_SLA_MAX_AGE_SECONDS`), e.g. market_data 1h, natural_hazards 24h, weather 1h.

## Provenance

- **Layer 0 / Verified Truth:** Data provenance and verification are tracked in `data_provenance` and related models (`apps/api/src/models/provenance.py`). Platform layer endpoints expose provenance stats where applicable.
- **Climate / risk outputs:** Climate service and risk outputs can include a `provenance` object (e.g. `data_sources`, `updated_at`) so consumers know origin and freshness.
- **References:** `apps/api/src/api/v1/endpoints/platform.py` (provenance stats), `apps/api/src/api/v1/endpoints/provenance.py`, climate service provenance in risk assessments.

## Confidence in risk outputs

- **Where used:** Stress results, climate assessments, ERF, cascade engine, ARIN verdicts, and other risk APIs expose a `confidence` (or `confidence_score`) field where applicable (0–1 or percentage).
- **Meaning:** Confidence in the model/data for that output; use for filtering or weighting in dashboards and reports.
- **References:**  
  - `apps/api/src/models/ontology.py` (ConfidenceLevel),  
  - `apps/api/src/decision_object.py` (confidence-weighted aggregation),  
  - stress/cascade/ERF/ARIN endpoints that return confidence.

## Data quality contract (practical)

1. **Ingestion:** Run scheduled jobs; monitor via `GET /ingestion/sla-status` and Prometheus `data_source_last_refresh_timestamp_seconds`.
2. **Provenance:** Prefer APIs that return provenance (e.g. climate, platform layers); use for audit and “source of truth” displays.
3. **Confidence:** Surface confidence in UI and reports; treat low-confidence outputs as requiring review or disclaimer.

## Единая модель риск-сигнала (Unified risk-signal model)

Все риск-ответы API должны по возможности содержать единый блок:

- **provenance:** `{ data_sources: string[], source_id?: string, updated_at?: string }` — источники данных и время обновления.
- **confidence:** число от 0 до 1 — уверенность модели/данных в этом ответе.
- **freshness** (при наличии): `{ age_seconds: number }` или использование `updated_at` в provenance — возраст данных.

Эндпоинты, которые должны возвращать этот контракт (через `make_risk_response_provenance` из `apps/api/src/core/provenance_response.py`):

- `platform` — сводки по платформе, слои.
- `climate` — климатические оценки и риск.
- `stress_tests` / `stress` — результаты стресс-тестов.
- `analytics` — аналитика и отчёты.
- `country_risk` — страновой риск.
- `cadapt` (community/risk, disclosure) — риск сообществ.
- `ingestion` — статус SLA и свежесть источников (через sla-status).
- `digital_twins`, `simulations` — цифровые двойники и симуляции, где возвращается риск.

При реализации передавайте в хелпер `freshness_seconds` или `updated_at` из источника данных, чтобы потребители могли оценивать актуальность сигнала.

## References

- Pipeline SLA: `apps/api/src/services/ingestion/pipeline.py` (`get_sla_status`, `get_last_refresh_times`)
- Ingestion API: `apps/api/src/api/v1/endpoints/ingestion.py` (`get_last_refresh`, `get_ingestion_sla_status`)
- Provenance models: `apps/api/src/models/provenance.py`
- Platform layers: `apps/api/src/api/v1/endpoints/platform.py`
