# Операционная справка: Что · Где

Краткая привязка тем к месту настройки или к плану.

| Что | Где |
|-----|-----|
| **Логирование API, ротация** | Настраивается на сервере (structlog уже есть в API). Конфиг ротации в репо: [infra/logrotate/pfrp-api.conf](../infra/logrotate/pfrp-api.conf). См. [MONITORING.md](MONITORING.md), [DEPLOY.md](../DEPLOY.md#logs). |
| **Алертинг (API down, 5xx)** | Внешний мониторинг (UptimeRobot и т.п.). В репо есть скрипт проверки здоровья: [scripts/check-api-health.sh](../scripts/check-api-health.sh). См. [MONITORING.md](MONITORING.md#alerting-api-down--5xx). |
| **LPR: Maxine + Vertex AI** | Riva используется; Maxine (видео/эмоции) и Vertex (Gemini для риторики) — по [REQUIREMENTS_VERDICT_AND_LPR_STACK.md](REQUIREMENTS_VERDICT_AND_LPR_STACK.md) при масштабировании ЛПР. |
| **BigQuery** | Конфиг есть ([config.py](../apps/api/src/core/config.py), [CLOUD_INTEGRATION.md](CLOUD_INTEGRATION.md)); синхрон агрегатов — по [MASTER_PLAN.md](../MASTER_PLAN.md) при необходимости. Подробнее: [BIGQUERY_SYNC.md](BIGQUERY_SYNC.md). |
| **Документация для клиентов (SLA, лимиты по этапам)** | [LAUNCH_AND_COMMERCIAL_READINESS.md](LAUNCH_AND_COMMERCIAL_READINESS.md) — раздел «SLA and limits» и шаблон для договоров; детализацию дополнять по мере запуска. |

## Связанные документы

- [MONITORING.md](MONITORING.md) — логи, метрики, алертинг, скрипт проверки здоровья, logrotate
- [BIGQUERY_SYNC.md](BIGQUERY_SYNC.md) — когда и как синхрон в BigQuery
- [FULL_IMPLEMENTATION_LAUNCH_VERIFICATION.md](FULL_IMPLEMENTATION_LAUNCH_VERIFICATION.md) — соответствие плана коду
- [DEPLOY.md](../DEPLOY.md) — деплой и логи на сервере
