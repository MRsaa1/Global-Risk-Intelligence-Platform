# Technical Spec v1: интеграция внешних БД рисков

Спецификация закрывает пробелы из [EXTERNAL_DATABASES_TO_INTEGRATE.md](./EXTERNAL_DATABASES_TO_INTEGRATE.md): data governance, каноническая схема событий, дедупликация, качество данных, нормализация валют/инфляции, политика missing data, версионирование и воспроизводимость backtesting.

---

## 1. Цель

- Единый pipeline: **ingest → normalize → dedup → curate → metrics**.
- Внешние источники используются для backtesting, VaR/CVaR, temporal/recovery, sector metrics.
- Воспроизводимость расчётов по **версии данных** и **дате снапшота**.

---

## 2. Каноническая модель данных (минимум)

| Слой | Таблица | Назначение |
|------|---------|------------|
| Raw | `raw_source_records` | Сырые ответы API/файлов |
| Normalized | `normalized_events` | События до дедупа, единый контракт полей |
| Entity | `event_entities` | Сущность события после merge/dedup |
| Losses | `event_losses` | Экономические/страховые потери, нормализация валют |
| Impacts | `event_impacts` | Жертвы, перемещённые, сектор, инфра |
| Recovery | `event_recovery` | RTO/RPO, длительность восстановления |
| Registry | `source_registry` | Источники, лицензии, приоритеты, SLA |
| Reference | `fx_rates`, `cpi_index` | Нормализация денег |
| Runs | `processing_runs` | Версионирование и воспроизводимость |
| Quality | `data_quality_scores` | Q по событию/источнику |

---

## 3. SQL-контракты (ядро)

### 3.1 Сырые данные

```sql
create table raw_source_records (
  id bigserial primary key,
  source_name text not null,                -- emdat, usgs, noaa, fema, ...
  source_record_id text not null,
  fetched_at timestamptz not null,
  payload jsonb not null,
  checksum text not null,
  unique (source_name, source_record_id, checksum)
);
```

### 3.2 Нормализованные события (до дедупа)

```sql
create table normalized_events (
  id bigserial primary key,
  source_name text not null,
  source_record_id text not null,
  event_type text not null,                 -- flood, seismic, pandemic, cyber, ...
  event_subtype text,
  title text,
  start_date date,
  end_date date,
  country_iso2 text,
  region text,
  city text,
  lat double precision,
  lon double precision,
  geo_precision text,                       -- point, city, region, country
  fatalities numeric,
  affected numeric,
  confidence numeric not null default 0.7,  -- 0..1 на этапе source-normalization
  inserted_at timestamptz not null default now(),
  unique (source_name, source_record_id)
);
```

### 3.3 Сущность события (после merge/dedup)

```sql
create table event_entities (
  event_uid uuid primary key,
  canonical_event_type text not null,
  canonical_title text,
  start_date date,
  end_date date,
  country_iso2 text,
  region text,
  city text,
  lat double precision,
  lon double precision,
  best_source text not null,                -- выбранный source of truth
  source_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.4 Потери (экономические/страховые)

```sql
create table event_losses (
  id bigserial primary key,
  event_uid uuid not null references event_entities(event_uid),
  loss_type text not null,                  -- economic, insured
  amount_original numeric,
  currency_original text,
  amount_usd_nominal numeric,
  amount_usd_real numeric,                  -- CPI-adjusted to base year
  base_year int not null,                   -- например 2025
  source_name text not null,
  confidence numeric not null default 0.7
);
```

### 3.5 Влияния и восстановление

```sql
create table event_impacts (
  id bigserial primary key,
  event_uid uuid not null references event_entities(event_uid),
  casualties numeric,
  displaced numeric,
  infra_damage_score numeric,
  sector text,                              -- insurance, banking, real_estate, enterprise
  source_name text not null,
  confidence numeric not null default 0.7
);

create table event_recovery (
  id bigserial primary key,
  event_uid uuid not null references event_entities(event_uid),
  duration_days numeric,
  recovery_time_months numeric,
  rto_days numeric,
  rpo_hours numeric,
  source_name text not null,
  confidence numeric not null default 0.7
);
```

### 3.6 Реестр источников

```sql
create table source_registry (
  source_name text primary key,
  domain text not null,                     -- seismic, natcat, conflict, cyber, ...
  license_type text,                        -- public, academic, commercial, restricted
  refresh_frequency text not null,         -- daily, weekly, monthly
  priority_rank int not null,              -- 1 = preferred for domain
  active boolean not null default true,
  tos_url text,
  storage_restrictions text,
  updated_at timestamptz not null default now()
);
```

### 3.7 Нормализация денег (справочники)

```sql
create table fx_rates (
  id bigserial primary key,
  currency_from text not null,
  currency_to text not null default 'USD',
  rate numeric not null,
  as_of_date date not null,
  source text,
  unique (currency_from, currency_to, as_of_date)
);

create table cpi_index (
  id bigserial primary key,
  country_iso2 text not null,
  year int not null,
  index_value numeric not null,
  base_year int,
  unique (country_iso2, year)
);
```

### 3.8 Прогоны и качество

```sql
create table processing_runs (
  run_id uuid primary key,
  source_name text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,                    -- running, success, partial, failed
  dataset_version text not null,
  row_count int default 0,
  error_count int default 0,
  config_snapshot jsonb
);

create table data_quality_scores (
  id bigserial primary key,
  entity_type text not null,               -- event_entity, event_loss, ...
  entity_id text not null,                 -- event_uid or event_loss id
  q_score numeric not null,                -- 0..1
  completeness numeric,
  source_trust numeric,
  freshness numeric,
  consistency numeric,
  computed_at timestamptz not null default now()
);
```

---

## 4. Реестр источников и приоритеты

- **source_registry:** source_name, domain, license_type, refresh_frequency, **priority_rank**, active, tos_url, storage_restrictions.
- **Правило:** при конфликте значений берём источник с меньшим `priority_rank`; остальные сохраняем как альтернативные оценки.

Пример **priority_rank** по доменам:

| Домен | Источник | Rank |
|-------|----------|------|
| seismic_location | USGS | 1 |
| seismic_location | EM-DAT | 2 |
| economic_loss_natcat | EM-DAT | 1 |
| economic_loss_natcat | sigma | 2 |
| economic_loss_natcat | national_db | 3 |
| economic_loss_natcat | seed | 9 |
| conflict_events | ACLED | 1 |
| conflict_events | UCDP | 2 |
| conflict_events | seed | 9 |

---

## 5. Нормализация денег

- Хранить: **amount_original**, **currency_original**, **amount_usd_nominal**, **amount_usd_real**.
- **amount_usd_nominal:** FX на дату события (или на конец года при неполной дате).
- **amount_usd_real:** CPI-adjusted к **base_year** (например 2025).
- При неизвестной дате: снижать confidence и использовать годовую агрегацию.

---

## 6. Алгоритм dedup / entity resolution

- **Кандидаты:** одинаковый event_type, пересечение дат в окне ±7 дней, гео-близость.
- **Гео:**
  - point–point: расстояние ≤ 150 км;
  - city/region/country: совпадение по административному уровню.
- **Name similarity:** trigram / Jaro–Winkler ≥ 0.85.
- **match_score** = `0.4·time_score + 0.4·geo_score + 0.2·name_score`.
- **Порог merge:** ≥ 0.75 → один event_uid; ниже — новое событие; пограничные — в очередь manual review.

---

## 7. Quality Score (обязательный)

```
Q = 0.35·completeness + 0.25·source_trust + 0.20·freshness + 0.20·consistency
```

- **completeness:** доля заполненных ключевых полей.
- **source_trust:** из source_registry (нормализовано 0..1).
- **freshness:** экспоненциальный decay по возрасту обновления.
- **consistency:** согласованность с альтернативными источниками.

**Применение:**

| Q | Использование |
|---|----------------|
| Q ≥ 0.75 | Расчёты и backtesting |
| 0.50 ≤ Q < 0.75 | Narrative/сравнения, в моделях с пониженным весом |
| Q < 0.50 | Только хранение/лог, без влияния на метрики |

---

## 8. Missing data policy

- Никогда не подставлять «medium risk by default».
- При отсутствии loss: **null**, снижение confidence; событие остаётся валидным для частичных метрик.
- Для **recovery_time_months** допускается imputation медианой по event_type + region с флагом **imputed = true**; любая imputation снижает Q.

---

## 9. ETL-стадии

| Стадия | Действие |
|--------|----------|
| extract | Загрузка в `raw_source_records` |
| normalize | Маппинг в `normalized_events` |
| enrich | FX, CPI, геокод, классификация типов |
| match_merge | Формирование `event_entities` |
| score_quality | Расчёт Q, запись в `data_quality_scores` |
| publish | Materialized views для API/report |
| snapshot | Версия датасета `dataset_version` для воспроизводимости |

---

## 10. Версионирование и воспроизводимость

- **processing_runs:** run_id, source_name, started_at, finished_at, status, **dataset_version**, row_count, error_count.
- Все отчёты сохраняют **dataset_version** + **methodology_version**.
- Backtesting всегда запускается на **фиксированной версии**, не на «latest».

---

## 11. API-контракты (минимум)

| Endpoint | Назначение |
|----------|------------|
| `GET /risk/events?country=...&type=...&from=...&to=...` | Список событий с фильтрами |
| `GET /risk/events/{event_uid}` | Детали события |
| `GET /risk/backtesting?scenario=...&dataset_version=...` | Backtesting на версии |
| `GET /risk/quality?source=...` | Качество по источнику |

В ответах обязательно: **confidence**, **q_score**, **data_sources**.

---

## 12. Mapping к report V2

| Секция отчёта | Данные | Таблицы/поля |
|---------------|--------|--------------|
| Probabilistic | Распределение потерь | event_losses.amount_usd_real |
| Temporal | RTO, recovery | event_recovery.recovery_time_months, duration_days |
| Contagion | Секторные последствия | event_impacts + financial sources |
| Backtesting | predicted vs actual | event_uid, event_losses, backtest_runs |
| Sector metrics | По сектору | event_impacts.sector, фильтрация |

---

## 13. Порядок внедрения (реально исполнимый)

1. **Каркас:** таблицы + ETL orchestrator + source_registry.
2. **EM-DAT** end-to-end (extract → normalize → event_entities/losses).
3. **Дедуп:** USGS + EM-DAT; NOAA + FEMA.
4. **Quality scoring** + snapshot versioning (processing_runs, dataset_version).
5. Подключение **Laeven & Valencia**, **VERIS/DBIR**, **UCDP/ACLED**.
6. Отчётные витрины для **stress_report_metrics** (чтение из event_entities/losses/quality).

---

## Анализ: связь с текущей кодовой базой

### Что уже есть

| Компонент | Где | Соответствие спеки |
|-----------|-----|---------------------|
| **HistoricalEvent** | `models/historical_event.py` | Близко к «одно событие с loss/recovery», но без source/event_uid, без нормализации валют (только EUR), без Q. Нет слоёв raw → normalized → entity. |
| **BacktestRun** | `models/backtest_run.py` | Нет привязки к dataset_version; нет event_uid. Нужно добавить dataset_version и опционально event_uid. |
| **IngestionSource** | `models/ingestion_source.py` | Каталог источников без domain/priority_rank/license. Можно расширить или завести source_registry отдельно. |
| **stress_report_metrics** | `services/stress_report_metrics.py` | Использует seed, universal_stress_engine, recovery_calculator; backtesting из жёсткого списка. Нет чтения из event_entities/event_losses. |
| **historical_events_importer** | `services/historical_events_importer.py` | Импорт из USGS, NOAA и др.; нет единого контракта normalized_events и дедупа. |

### Что спека добавляет

- **Единый контракт:** event_id/source, event_type, start/end, geo, loss_econ/loss_insured, casualties, recovery_time, **confidence** — явно в normalized_events и event_entities.
- **Governance:** source_registry с license, TOS, storage_restrictions.
- **Дедупликация:** правила match (время/гео/имя), порог 0.75, manual review.
- **Нормализация денег:** amount_original, currency, amount_usd_nominal, amount_usd_real, base_year; fx_rates, cpi_index.
- **Quality Q:** формула и пороги (прод / narrative / только лог).
- **Missing data:** не подставлять 0.5; null + снижение confidence; imputed только с флагом.
- **Воспроизводимость:** processing_runs + dataset_version; backtesting по версии.

### Рекомендуемые следующие шаги

1. **Миграция БД:** добавить таблицы из раздела 3 (raw_source_records, normalized_events, event_entities, event_losses, event_impacts, event_recovery, source_registry, fx_rates, cpi_index, processing_runs, data_quality_scores).
2. **HistoricalEvent:** либо маппинг в event_entities/event_losses при импорте, либо постепенная миграция «новые события — в новую схему».
3. **BacktestRun:** добавить поля dataset_version, methodology_version, опционально event_uid.
4. **IngestionSource / source_registry:** либо расширить IngestionSource (domain, priority_rank, license_type), либо ввести source_registry и связать с ним.
5. **ETL:** реализовать стадии extract → normalize → enrich → match_merge → score_quality → publish/snapshot для первого источника (EM-DAT).
6. **stress_report_metrics:** опция читать backtesting и comparables из event_entities/event_losses по dataset_version и фильтровать по Q ≥ порогу.

После этого документ становится исполняемым техническим спецификацией, а не только списком источников.
