# Интеграция Global Risk с ARIN Platform

Документ для настройки отправки данных из сервиса **Global Risk** в **ARIN Platform** (Unified Analysis). После настройки данные будут отображаться в ARIN как источник **«Global Risk»** в Data Sources Status и в Select Data Sources.

---

## 1. Endpoint для отправки данных

**Метод:** `POST`  
**URL:**  
- Production: `https://arin.saa-alliance.com/api/v1/unified/export`  
- Локально: `http://localhost:8000/api/v1/unified/export`  

**Content-Type:** `application/json`

---

## 2. Обязательные поля тела запроса (JSON)

| Поле | Тип | Описание |
|------|-----|----------|
| `source` | string | **Всегда** `"risk_management"` — так ARIN определяет источник как Global Risk. |
| `entity_id` | string | ID сущности: UUID портфеля, тикер (BTC, ETH), или тот же ID, который используется в ARIN для выбора сущности. |
| `entity_type` | string | Тип: `"portfolio"`, `"crypto"`, `"stock"` и т.д. |
| `analysis_type` | string | Тип анализа, например: `"risk_analysis"`, `"global_risk_assessment"`, `"compliance_check"`. |
| `data` | object | Объект с результатами анализа (см. раздел 3). |

---

## 3. Рекомендуемая структура объекта `data`

Чтобы ARIN мог использовать данные в расчёте вердикта и в агентах, желательно передавать в `data` хотя бы часть полей ниже. Остальное можно добавлять по необходимости.

```json
{
  "risk_score": 65.5,
  "risk_level": "HIGH",
  "summary": "Краткое текстовое описание оценки риска",
  "recommendations": ["Рекомендация 1", "Рекомендация 2"],
  "indicators": {},
  "metadata": {}
}
```

| Поле в `data` | Тип | Описание |
|---------------|-----|----------|
| `risk_score` | number | Общий риск 0–100 (опционально, но полезно для агрегации). |
| `risk_level` | string | Уровень: `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"`. |
| `summary` | string | Текстовое резюме для вердикта и логов. |
| `recommendations` | string[] | Список рекомендаций. |
| `indicators` | object | Любые метрики (VaR, стресс-тесты и т.д.). |
| `metadata` | object | Дополнительные поля. |

Структура `data` может быть любой (объект с произвольными ключами). Минимум для появления в ARIN: непустой объект `data` (например `{}`).

---

## 4. Опциональные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `metadata` | object | Метаданные на уровне экспорта (время расчёта, версия и т.д.). |
| `api_key` | string | Нужен только если на стороне ARIN включена проверка API-ключей (см. раздел 6). |

---

## 5. Заголовки

- **Обязательно:** `Content-Type: application/json`
- **Опционально (если включена проверка ключей):**  
  `X-API-Key: <ваш_ключ>`

Ключ можно передать либо в заголовке `X-API-Key`, либо в теле в поле `api_key`.

---

## 6. API-ключ (если ARIN требует ключ)

По умолчанию ARIN **не** требует API-ключ для экспорта. Если администратор ARIN включит проверку (`unified_export_api_key_required=true`), для источника `risk_management` будет использоваться ключ из переменной окружения ARIN:

- `RISK_MANAGEMENT_API_KEY=<значение>`

Администратор ARIN выдаёт этот ключ команде Global Risk. В запросах его нужно передавать так:

- в заголовке: `X-API-Key: <значение>`,  
  или  
- в теле: `"api_key": "<значение>"`.

---

## 7. Пример полного запроса (cURL)

```bash
curl -X POST "https://arin.saa-alliance.com/api/v1/unified/export" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "risk_management",
    "entity_id": "59c072bb59594317dfc5b454f0c81105",
    "entity_type": "portfolio",
    "analysis_type": "global_risk_assessment",
    "data": {
      "risk_score": 62,
      "risk_level": "HIGH",
      "summary": "Global risk assessment: elevated volatility and concentration risk.",
      "recommendations": [
        "Review sector exposure",
        "Consider hedging for FX exposure"
      ],
      "indicators": {
        "var_95": 0.02,
        "stress_scenario": "baseline"
      }
    },
    "metadata": {
      "calculated_at": "2026-02-06T15:00:00Z",
      "version": "1.0"
    }
  }'
```

С API-ключом (если включён):

```bash
curl -X POST "https://arin.saa-alliance.com/api/v1/unified/export" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY_FROM_ARIN_ADMIN" \
  -d '{ ... тот же JSON ... }'
```

---

## 8. Пример успешного ответа ARIN (200)

```json
{
  "export_id": "RiskMgmt-1",
  "status": "received",
  "message": "Data exported successfully",
  "entity_id": "59c072bb59594317dfc5b454f0c81105",
  "entity_type": "portfolio",
  "verdict_available": true,
  "verdict_url": "/api/v1/unified/verdict/59c072bb59594317dfc5b454f0c81105?entity_type=portfolio",
  "exports_count": 1
}
```

---

## 9. Ошибки и коды

| Код | Причина |
|-----|--------|
| 400 | Нет обязательного поля: `source`, `entity_id`, `entity_type`, `analysis_type` или `data`. В ответе будет `detail` с именем поля. |
| 401 | Требуется или неверный API-ключ (если проверка включена). |
| 503 | Unified integration отключён на стороне ARIN. |

---

## 10. Настройка на стороне Global Risk

1. **URL ARIN**  
   Задать в конфиге/переменных окружения:  
   `ARIN_EXPORT_URL=https://arin.saa-alliance.com/api/v1/unified/export`  
   Или только базу: `ARIN_BASE_URL=https://arin.saa-alliance.com` (URL экспорта соберётся автоматически).

2. **Идентификаторы сущностей**  
   Использовать те же `entity_id`, что и в ARIN (UUID портфеля, тикер, `portfolio_global` и т.д.). Иначе данные не привяжутся к выбранной в ARIN сущности.

3. **Когда отправлять**  
   После расчёта глобального риска по сущности — один POST на каждую сущность (или батч по одной сущности за запрос). Повторные отправки для того же `entity_id` добавляют новые экспорты; в ARIN отображается количество и статус по источнику «Global Risk».

4. **API-ключ**  
   Если администратор ARIN выдал ключ — хранить в секретах (например `ARIN_API_KEY`) и передавать в заголовке `X-API-Key` (или в поле `api_key` в теле).

5. **Таймаут**  
   Рекомендуемый таймаут запроса: 10–30 секунд.

---

## 11. Краткий чеклист для команды Global Risk

- [ ] Endpoint: `POST https://arin.saa-alliance.com/api/v1/unified/export`
- [ ] Заголовок: `Content-Type: application/json`
- [ ] В теле: `source` = `"risk_management"`, указаны `entity_id`, `entity_type`, `analysis_type`, `data`
- [ ] `entity_id` совпадает с ID сущности в ARIN (портфель/тикер)
- [ ] При необходимости: API-ключ от администратора ARIN в `X-API-Key` или `api_key`
- [ ] Обработка ответа 200 и ошибок 400/401/503

После этого в ARIN в **Unified Analysis** в блоке **Data Sources Status** источник будет отображаться как **«Global Risk»**, а в **Agents Dashboard** в **Select Data Sources** появится пункт **«Global Risk»** (при наличии данных по выбранной сущности).

---

## 12. Отправка медиа для Physical Asset Risk (Cosmos Reason2)

ARIN включает агента **Physical Asset Risk**, который анализирует изображения и видео физических активов с помощью **NVIDIA Cosmos Reason2**. Чтобы Global Risk мог запускать визуальный анализ, нужно передать URL медиа в поле `data`.

### Поддерживаемые поля для медиа

ARIN ищет медиа URL в следующих полях внутри `data` (в порядке приоритета):

| Поле в `data` | Описание |
|----------------|----------|
| `image_url` | URL изображения (JPEG, PNG, WebP, GIF, BMP, TIFF) |
| `media_url` | URL изображения или видео |
| `video_url` | URL видео (MP4, WebM, MOV, AVI) |
| `asset_image` | Альтернативное поле для URL изображения актива |
| `photo_url` | Альтернативное поле для URL фотографии |

URL должен начинаться с `http://`, `https://` или `data:` (base64 data URI).

Также поддерживаются вложенные структуры: `data.media.image_url`, `data.assets[].image_url`, `data.inspection.image_url`.

### Пример запроса с медиа

```bash
curl -X POST "https://arin.saa-alliance.com/api/v1/unified/export" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "risk_management",
    "entity_id": "asset_building_42",
    "entity_type": "asset",
    "analysis_type": "physical_asset_assessment",
    "data": {
      "risk_score": 55,
      "risk_level": "HIGH",
      "summary": "Building exterior shows signs of weathering and foundation cracking",
      "image_url": "https://storage.example.com/inspections/building42_front.jpg",
      "recommendations": [
        "Schedule detailed structural inspection",
        "Review foundation drainage system"
      ],
      "indicators": {
        "building_age_years": 35,
        "last_inspection": "2025-06-15"
      }
    }
  }'
```

### Как это работает

1. Global Risk отправляет экспорт с `image_url` в `data`
2. При запуске **Unified Analysis** (или Comprehensive Analysis) в ARIN, агент Physical Asset Risk:
   - Проверяет `task.parameters` на наличие `media_path`/`media_url`
   - Если не найдено — ищет медиа URL в экспортах для данного `entity_id`
   - Если найден `image_url` — отправляет его в **Cosmos Reason2** для визуального анализа
   - Получает от Cosmos: `risk_score`, `severity`, `findings`, `recommendations`, `reasoning`
3. Если `COSMOS_REASON2_URL` не настроен, агент вернёт оценку на основе данных из экспорта (risk_score, summary) без визуального анализа

### Без медиа (только данные)

Если в экспорте нет URL медиа, но есть поля `risk_score`, `risk_level`, `summary` — агент использует их для оценки с пониженной уверенностью (`confidence: 0.5`) и пометкой «data-only assessment». Для полноценного визуального анализа рекомендуется включить `image_url`.

### Прямая загрузка файла (альтернативный путь)

Помимо экспорта данных, можно загрузить файл напрямую через multipart endpoint:

```bash
curl -X POST "https://arin.saa-alliance.com/api/v1/unified/physical-asset-analyze" \
  -F "entity_id=asset_building_42" \
  -F "entity_type=asset" \
  -F "media=@/path/to/inspection_photo.jpg"
```

Этот путь сохраняет файл на сервере ARIN и сразу запускает анализ через Cosmos Reason2.
