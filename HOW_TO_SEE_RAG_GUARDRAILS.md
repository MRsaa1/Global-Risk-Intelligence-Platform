# 🔍 Как увидеть работу RAG и Guardrails на фронтенде

## 📊 Где искать работу агентов

RAG и Guardrails работают **"под капотом"** - они автоматически улучшают качество анализа и рекомендаций. Вот где это видно:

---

## 1️⃣ ANALYST Agent (с RAG)

### Что делает RAG:
- Подключает анализ к Knowledge Graph (зависимости активов)
- Использует исторические события для контекста
- Повышает confidence анализа

### Где увидеть:

#### Вариант A: Через API напрямую

**Откройте в браузере:**
```
http://127.0.0.1:9002/docs
```

**Найдите endpoint:**
- `/api/v1/alerts/{alert_id}/analyze` - анализ алерта с RAG

**Или через curl:**
```bash
# Создайте тестовый алерт (если есть)
curl http://127.0.0.1:9002/api/v1/alerts/{alert_id}/analyze
```

**В ответе вы увидите:**
```json
{
  "analysis_id": "...",
  "root_causes": [
    {
      "factor": "Climate change",
      "contribution": 0.4,
      "evidence": "Increasing frequency... Historical context: Similar event: Flood 2021",
      "sources": ["event_123", "event_456"]  // ← Это от RAG!
    }
  ],
  "contributing_factors": [
    {
      "factor": "Historical pattern: flood",
      "source": "event_123"  // ← Это от RAG!
    }
  ],
  "correlations": [
    {
      "pair": ["asset_1", "asset_2"],
      "source": "Knowledge Graph",  // ← Это от RAG!
      "relationship_type": "DEPENDS_ON"
    }
  ],
  "confidence": 0.95,  // ← Повышен благодаря RAG!
  "data_quality": 0.9
}
```

**Признаки работы RAG:**
- ✅ Поле `sources` в `root_causes` - ссылки на исторические события
- ✅ Поле `source` в `contributing_factors` - от RAG
- ✅ `relationship_type` в `correlations` - от Knowledge Graph
- ✅ `confidence > 0.9` - повышен благодаря хорошему контексту

---

## 2️⃣ ADVISOR Agent (с Guardrails)

### Что делают Guardrails:
- Проверяют безопасность рекомендаций
- Проверяют compliance (ECB, Fed, TCFD, CSRD)
- Отклоняют опасные рекомендации
- Добавляют warnings

### Где увидеть:

#### Вариант A: Через API напрямую

**Endpoint:**
```
POST /api/v1/assets/{asset_id}/recommendations
```

**Или через curl:**
```bash
curl -X POST http://127.0.0.1:9002/api/v1/assets/{asset_id}/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "regulations": ["ECB", "TCFD"]
  }'
```

**В ответе вы увидите:**
```json
{
  "recommendations": [
    {
      "id": "...",
      "trigger": "Climate risk score 75 exceeds threshold",
      "recommendation_reason": "Physical adaptation provides positive NPV... ⚠️ Guardrail Warning: Compliance check passed (ECB, TCFD)",  // ← Это от Guardrails!
      "options": [
        {
          "name": "Physical Adaptation",
          "npv_5yr": 200000,
          "roi_5yr": 0.35
        }
      ],
      "urgency": "high"
    }
  ]
}
```

**Признаки работы Guardrails:**
- ✅ Текст `⚠️ Guardrail Warning:` в `recommendation_reason`
- ✅ Нет опасных рекомендаций (например, "sell all assets")
- ✅ Compliance warnings для регуляторных требований

---

## 3️⃣ В консоли браузера (Developer Tools)

### Откройте Developer Tools (F12)

**В Network tab:**
1. Фильтр: `XHR` или `Fetch`
2. Найдите запросы к `/api/v1/alerts/.../analyze` или `/api/v1/assets/.../recommendations`
3. Откройте Response - там будут данные с RAG/Guardrails

**В Console tab:**
- Если есть логи от агентов, вы увидите:
  ```
  RAG retrieved 5 relevant documents for alert abc123
  Guardrail validation passed for recommendation xyz789
  ```

---

## 4️⃣ Через System Overseer

### Откройте Command Center:
```
http://127.0.0.1:5180/command
```

**В System Overseer вы увидите:**
- Статус агентов
- Метрики производительности
- Если RAG/Guardrails работают - это отразится в метриках

---

## 5️⃣ В логах API сервера

**В терминале, где запущен API, вы увидите:**
```
INFO: RAG retrieved 5 relevant documents for alert abc123
INFO: Guardrails validation passed for recommendation xyz789
WARNING: Guardrail violations for recommendation def456: ['safety']
```

---

## 🧪 Тестовый сценарий

### Шаг 1: Создайте тестовый алерт

```bash
curl -X POST http://127.0.0.1:9002/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "type": "weather_threat",
    "title": "Hurricane approaching",
    "message": "Hurricane detected in region",
    "severity": "high",
    "asset_id": "test_asset_123"
  }'
```

### Шаг 2: Запросите анализ

```bash
curl http://127.0.0.1:9002/api/v1/alerts/{alert_id}/analyze
```

**Проверьте:**
- ✅ Есть ли `sources` в `root_causes`?
- ✅ Есть ли `historical_events` в контексте?
- ✅ `confidence > 0.85`?

### Шаг 3: Запросите рекомендации

```bash
curl -X POST http://127.0.0.1:9002/api/v1/assets/test_asset_123/recommendations \
  -H "Content-Type: application/json" \
  -d '{"regulations": ["ECB", "TCFD"]}'
```

**Проверьте:**
- ✅ Есть ли `⚠️ Guardrail Warning:` в тексте?
- ✅ Нет ли опасных рекомендаций?

---

## 📝 Что искать в ответах

### RAG (ANALYST):
- ✅ `sources: [...]` - ссылки на исторические события
- ✅ `source: "event_123"` - в contributing_factors
- ✅ `relationship_type: "DEPENDS_ON"` - в correlations
- ✅ `confidence: 0.95` - повышенный confidence
- ✅ `data_quality: 0.9` - хорошее качество данных

### Guardrails (ADVISOR):
- ✅ `⚠️ Guardrail Warning:` - предупреждения
- ✅ Нет опасных действий в рекомендациях
- ✅ Compliance warnings для регуляторных требований
- ✅ `safe_fallback` - если рекомендация отклонена

---

## 🎯 Быстрый тест

**Откройте API Docs:**
```
http://127.0.0.1:9002/docs
```

1. Найдите `/api/v1/alerts/{alert_id}/analyze`
2. Нажмите "Try it out"
3. Введите любой `alert_id`
4. Нажмите "Execute"
5. Проверьте Response - там будут признаки RAG

---

**RAG и Guardrails работают автоматически - они улучшают качество анализа и рекомендаций "под капотом"!**
