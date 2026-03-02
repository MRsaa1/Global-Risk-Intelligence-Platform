# Cloud integration (BigQuery, Vertex AI)

Phase 4 cloud: sync to BigQuery, Vertex AI usage, composite stress scenarios.

## BigQuery sync

- **Purpose:** Long-term analytics and reporting; aggregate stress results, city metrics, backtesting runs.
- **When to implement:** See [BIGQUERY_SYNC.md](BIGQUERY_SYNC.md) for the "when and how" checklist.
- **Config:** Set `GCP_PROJECT_ID`, `BIGQUERY_DATASET`, and service account in env or `config.py`. Optional job (scheduler or Celery) to push:
  - Stress test run summaries (scenario_id, total_loss, var_99, sector)
  - Backtest runs (run_id, strategy_id, MAE, MAPE, hit_rate)
  - City/risk metrics (city_id, risk_score, factors)
- **Tables:** Create dataset and tables via Terraform or `bq` CLI; schema aligned with API response shapes.

## Vertex AI

- **Config:** `vertex_ai_region`, `gcloud_project_id`, `gcloud_service_account_json` in [apps/api/src/core/config.py](../apps/api/src/core/config.py).
- **Usage:** ML models (PD/LGD, anomaly), LPR module (Gemini for doctrine comparison), NLP when using Vertex Natural Language API. Already referenced in LPR and NLP services; enable by setting GCP credentials.

## Composite stress scenarios

- **Engine:** [universal_stress_engine.py](../apps/api/src/services/universal_stress_engine.py) supports composite `scenario_type` values with "+" (e.g. `oil_20+taiwan_earthquake`). Multipliers are combined (max per component, scaled by 0.9^(n-1) for n components).
- **API:** Pass `scenario_id` or `scenario_type` with "+" in unified stress and universal stress endpoints to run combined scenarios.

## References

- MASTER_PLAN.md (Platform Subscription, data pipeline)
- docs/REQUIREMENTS_VERDICT_AND_LPR_STACK.md (Vertex AI for LPR)
