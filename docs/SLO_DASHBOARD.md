# SLO Dashboard: панели и примеры запросов

Определения панелей для мониторинга и примеры запросов Prometheus/Grafana. См. также [OBSERVABILITY_SLO.md](OBSERVABILITY_SLO.md) для целевых порогов.

---

## 1. Freshness (свежесть данных)

**Источники:** `GET /api/v1/ingestion/sla-status`, метрика Prometheus `data_source_last_refresh_timestamp_seconds`.

**Панель:** таблица или график по `source_id`: возраст в секундах, порог SLA (из `SOURCE_SLA_MAX_AGE_SECONDS`).

### Prometheus: возраст данных в секундах

```promql
# Текущее время минус последнее обновление по источнику
(time() - data_source_last_refresh_timestamp_seconds{source_id!=""})
```

### Grafana: таблица по источникам

- Метрика: `data_source_last_refresh_timestamp_seconds`
- Transform: добавить колонку `age_seconds` = `time() - value` (или через Prometheus выше).
- Порог SLA берётся из конфига (например 3600 для 1h); подсветить красным, если `age_seconds > SOURCE_SLA_MAX_AGE_SECONDS`.

### Альтернатива: запрос к API

Периодический вызов `GET /api/v1/ingestion/sla-status` и отображение `status` (ok/stale/fail) и `age_seconds` по каждому источнику.

---

## 2. API latency

**Метрика:** `http_request_duration_seconds` (histogram по path).

**Панель:** p50 / p95 / p99 по основным путям; целевые пороги из [OBSERVABILITY_SLO.md](OBSERVABILITY_SLO.md) (например p95 &lt; 2s, p99 &lt; 5s).

### Prometheus: p95 по path

```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path)
)
```

### p50 и p99

```promql
# p50
histogram_quantile(0.5, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path))

# p99
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path))
```

Исключить health/docs при необходимости: добавить `path !~ "health|docs"` в селектор.

---

## 3. WS delivery (WebSocket)

**Цель:** число подключений, ошибки отключений.

Если в коде есть счётчики (например в `apps/api/src/api/v1/endpoints/websocket.py`): экспорт в Prometheus метрик вида `ws_connections_active`, `ws_messages_sent_total`, `ws_errors_total`. Тогда панель:

- График `ws_connections_active`.
- Rate ошибок: `rate(ws_errors_total[5m])` или `increase(ws_errors_total[5m])`.

Если метрик пока нет — описать в панели: «Добавить счётчики в websocket.py и экспорт в Prometheus; затем построить графики подключений и ошибок». После появления метрик использовать запросы выше.

---

## 4. Alert lag (время от события до алерта)

**Идея:** время от момента события до появления алерта в системе (поля `created_at` у алертов и время события).

- Запрос к API алертов (например список с `created_at` и временем связанного события) и агрегат разницы.
- Или запрос к логам: время события в логе vs время записи алерта.

**Пример описания панели:** «Запрос к GET /api/v1/alerts с фильтром по периоду; колонки event_time, alert_created_at, lag_seconds; цель — средний lag &lt; N минут».

---

## Алерты (Alerts)

### Деградация качества данных

- **Основа:** `GET /api/v1/ingestion/sla-status` или метрика `data_source_last_refresh_timestamp_seconds`.
- **Правило:** алерт, если какой-либо source не обновлялся дольше `SOURCE_SLA_MAX_AGE_SECONDS` (или заданного порога).

**Prometheus (если есть gauge по возрасту):**

```yaml
# Пример: алерт, если возраст данных > 7200 с (2 ч) для любого source
- alert: DataSourceStale
  expr: (time() - data_source_last_refresh_timestamp_seconds) > 7200
  for: 5m
  labels: { severity: warning }
  annotations:
    summary: "Data source {{ $labels.source_id }} is stale"
```

**Внешний скрипт (cron):** вызывать `GET /api/v1/ingestion/sla-status`, при `status != "ok"` отправить алерт (email, PagerDuty, Slack — по конфигу).

### Model drift

- **Определение:** что считать дрифтом — например изменение распределения скора риска во времени или падение accuracy на отложенной выборке.
- **Если в репо уже есть джоба/метрика дрифта:** добавить алерт на неё (например метрика `model_drift_score` или результат бэктеста).
- **Если метрики пока нет:** в документе зафиксировать целевой подход:
  - Периодический бэктест (например через `backtest` API или отдельную джобу), запись результата в Prometheus.
  - Шаблон правила: «Когда появится метрика `model_drift_*`, добавить правило: alert если значение выше порога за N минут».

**Пример шаблона правила (когда метрика будет):**

```yaml
# Placeholder: раскомментировать и подставить метрику и порог
# - alert: ModelDriftDetected
#   expr: model_drift_score > 0.15
#   for: 15m
#   labels: { severity: warning }
#   annotations:
#     summary: "Model drift above threshold"
```

При желании добавить в API или scheduler периодическую проверку `sla-status` и запись результата в метрики/логи для алертинга (см. ingestion pipeline и [DATA_QUALITY.md](DATA_QUALITY.md)).
