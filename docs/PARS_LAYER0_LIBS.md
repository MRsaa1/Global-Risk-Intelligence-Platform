# PARS, Layer 0 подписи, libs/

Краткий обзор PARS (Layer 5), Layer 0 (Verified Truth / подписи) и структуры libs/.

## PARS (Layer 5 — Protocol)

- **Назначение**: Physical Asset Risk Schema — единый формат идентификации и обмена данными по физическим активам.
- **API**: `apps/api/src/api/v1/endpoints/pars.py`; префикс в роутере: `/api/v1/pars`.
- **Эндпоинты**:
  - `GET /pars/export/assets` — экспорт активов в формате PARS (v1)
  - `GET /pars/export/assets/{asset_id}` — один актив
  - `GET /pars/schema` — JSON Schema PARS Asset (v1)
  - `POST /pars/validate` — валидация документа без импорта
  - `POST /pars/import` — импорт PARS-документов в платформу
  - `GET /pars/status` — статус протокола и счётчик активов
- **Схема**: файл `apps/api/data/schemas/pars-asset-v1.json` (если есть); иначе возвращается минимальный inline schema. ID формата: `PARS-{REGION}-{COUNTRY}-{CITY}-{UNIQUE_ID}` (например `PARS-EU-DE-FRA-A1B2C3D4`).
- **Platform layers**: Layer 5 в `GET /api/v1/platform/layers` отдаёт PARS-метрики (total_pars_ids, version).

## Layer 0 — Verified Truth, подписи

- **Модель**: `apps/api/src/models/provenance.py` — `DataProvenance`: данные об активе, источник, хэш (`data_hash`), опционально `signature` и `signature_algorithm`.
- **API**: `apps/api/src/api/v1/endpoints/provenance.py` — создание записи, верификация по id. При создании можно передать `signature` и `signature_algorithm`; хэш вычисляется автоматически.
- **Верификация** (`POST /provenance/{id}/verify`): проверка целостности (recompute hash, сравнение с `data_hash`), формат полей; подпись проверяется только на согласованность (наличие пары signature + algorithm), без реальной криптографии (нет ключей в коде). Результат пишется в `verification_records`.
- **Подписи**: поле подписи есть в модели и API; полноценная криптоподпись (генерация/проверка с ключами) не реализована — только хранение и формальная проверка. Для минимума «криптоподпись + audit trail» (MASTER_PLAN) достаточно текущего audit trail и опционального заполнения `signature`/`signature_algorithm` внешней системой.

## libs/

- **Текущее состояние**: директория `libs/` в репозитории пуста (или отсутствует).
- **Цель**: общие библиотеки, переиспользуемые схемы и типы (в т.ч. PARS), чтобы не дублировать между apps/api и другими потребителями.
- **Предлагаемая структура** (см. `libs/README.md`):
  - `libs/pars/` — описание PARS v1, ссылка на схему в `apps/api/data/schemas/pars-asset-v1.json` или копия схемы для standalone использования.
  - При необходимости: `libs/shared/` для общих типов/констант (например, коды юрисдикций, форматы дат).
- **Итог**: PARS API и Layer 0 provenance реализованы; подписи в Layer 0 — хранятся и формально проверяются; libs/ структурированы для схем и будущих общих компонентов.

## См. также

- `apps/api/src/api/v1/endpoints/platform.py` — Layer 0 и Layer 5 (PARS) в platform layers
- `docs/MASTER_PLAN.md` — Layer 0 (криптоподпись + audit trail), Layer 5 (PARS)
