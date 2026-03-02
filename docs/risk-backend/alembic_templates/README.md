# Risk Backend — Alembic templates + ORM/DTO (1:1 перенос в backend)

Пакет из **6 ревизий Alembic** и **ORM + DTO** для канонической схемы внешних рисков (Technical Spec v1). Можно перенести в `apps/api/alembic/versions/` и подключить модели.

## Сравнение с текущим backend

| Аспект | Текущий backend (`20260227_0002`) | Этот пакет (6 ревизий) |
|--------|-----------------------------------|-------------------------|
| Миграции | Одна большая миграция | 6 пошаговых: registry → raw/normalized → entities+links → losses/impacts/recovery → quality+FX/CPI → indexes+view |
| Таблица `event_entity_links` | Нет (связь entity↔source через `source_record_id` в `event_entities`) | Есть: явная связь entity ↔ (source_name, source_record_id) |
| CHECK (confidence, q_score) | Нет | Да: `confidence` и `q_score` в диапазоне 0..1 |
| Составные индексы | Отдельные индексы по полям | `(event_type, start_date)`, `(country_iso2, canonical_event_type, start_date)`, `(event_uid, loss_type)` |
| Materialized view | Нет | `mv_event_backtesting` для report API |
| Типы БД | SQLite-совместимо (Integer, JSON) | Шаблоны используют BigInteger, JSONB (PostgreSQL); для SQLite см. ниже |

## Порядок применения ревизий

1. **0001** — `source_registry`, `processing_runs`
2. **0002** — `raw_source_records`, `normalized_events`
3. **0003** — `event_entities`, `event_entity_links`
4. **0004** — `event_losses`, `event_impacts`, `event_recovery`
5. **0005** — `data_quality_scores`, `fx_rates`, `cpi_index`
6. **0006** — индексы, CHECK-ограничения, materialized view

## Установка в global-risk-platform

**Вариант A — новый backend / чистая ветка**

- Скопировать все 6 файлов из `versions/` в `apps/api/alembic/versions/`.
- В `0001_create_source_registry_and_runs.py` задать `down_revision = "20260227_0001"` (или вашу последнюю ревизию перед этим пакетом).
- Запустить: `alembic upgrade head`.

**Вариант B — уже есть одна миграция с этими таблицами**

- Текущая миграция `20260227_0002` создаёт те же таблицы, но без `event_entity_links`, CHECK и view.
- Либо оставить как есть и добавить **одну** новую ревизию (после `20260227_0002`), которая создаёт только `event_entity_links`, CHECK и `mv_event_backtesting`.
- Либо заменить `20260227_0002` на эти 6 ревизий (потребуется откат и повторное накатывание на чистой БД или миграция данных).

## SQLite

В шаблонах используется `sa.BigInteger()` и `postgresql.JSONB`. Для SQLite:

- Заменить `sa.BigInteger()` на `sa.Integer()`.
- Заменить `postgresql.JSONB(...)` на `sa.JSON()`.
- Materialized view в 0006 — только PostgreSQL; для SQLite закомментировать создание view или заменить на обычный VIEW.

## Файлы в пакете

- `versions/0001_create_source_registry_and_runs.py` … `0006_indexes_constraints_views.py` — ревизии Alembic.
- `orm_models.py` — SQLAlchemy модели (Base, EventEntity, EventEntityLink, EventLoss, …).
- `dto_schemas.py` — dataclasses для ETL: NormalizedEventDTO, QualityScoreDTO.

После переноса подключите ORM в `apps/api/src/models/` (или импортируйте из пакета) и используйте DTO в ETL-пайплайне.
