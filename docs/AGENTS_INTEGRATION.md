# 🤖 AI Agents Integration with Platform Features

## Overview

AI Agents (SENTINEL, ANALYST, ADVISOR, REPORTER) интегрированы во все ключевые функции платформы. Они работают автоматически в фоне и усиливают каждую операцию.

---

## 🔗 Связи агентов с функциями платформы

### 1. **SENTINEL Agent** - 24/7 Мониторинг

**Интеграция:**

#### ✅ **Alerts System** (`/api/v1/alerts`)
- **Связь:** SENTINEL генерирует alerts автоматически
- **Как работает:**
  - Мониторит weather forecasts → создает weather alerts
  - Анализирует sensor data → создает anomaly alerts
  - Проверяет infrastructure → создает infrastructure alerts
  - Отслеживает climate thresholds → создает climate alerts
- **Endpoint:** `POST /api/v1/agents/monitor` - запускает цикл мониторинга
- **Результат:** Alerts появляются в AlertPanel на Dashboard и Command Center

#### ✅ **Stress Tests** (`/api/v1/stress-tests`)
- **Связь:** SENTINEL может автоматически запускать stress tests при обнаружении угроз
- **Как работает:**
  - Обнаруживает критическую угрозу (hurricane, flood)
  - Автоматически создает stress test для затронутых регионов
  - Генерирует alerts для всех затронутых assets
- **Пример:** Hurricane detected → Auto stress test → Alerts для всех assets в зоне

#### ✅ **Knowledge Graph** (Neo4j)
- **Связь:** SENTINEL использует Knowledge Graph для понимания зависимостей
- **Как работает:**
  - При обнаружении проблемы с infrastructure
  - Запрашивает Knowledge Graph: "Какие assets зависят от этой infrastructure?"
  - Создает alerts для всех зависимых assets
- **Результат:** Каскадные alerts для связанных активов

#### ✅ **Climate Data** (`/api/v1/climate`)
- **Связь:** SENTINEL мониторит climate data в реальном времени
- **Как работает:**
  - Получает данные от NOAA, FEMA, NASA
  - Сравнивает с портфелем assets
  - Генерирует alerts при превышении thresholds
- **Источники:** Weather forecasts, flood zones, wildfire data

---

### 2. **ANALYST Agent** - Глубокий анализ

**Интеграция:**

#### ✅ **Alert Analysis** (`/api/v1/alerts`)
- **Связь:** ANALYST автоматически анализирует alerts от SENTINEL
- **Как работает:**
  - Получает alert от SENTINEL
  - Использует **NeMo Retriever (RAG)** для поиска:
    - Похожих historical events
    - Связанных данных из Knowledge Graph
    - Контекста из базы данных
  - Выполняет root cause analysis
  - Находит contributing factors
  - Обнаруживает correlations
- **Endpoint:** `POST /api/v1/agents/analyze/asset`
- **Результат:** Детальный анализ с confidence score и data quality

#### ✅ **Asset Analysis** (`/api/v1/assets`)
- **Связь:** ANALYST анализирует assets при запросе
- **Как работает:**
  - Пользователь открывает Asset Detail
  - ANALYST анализирует:
    - Climate risk scores
    - Physical condition
    - Network dependencies
    - Historical performance
  - Использует RAG для поиска похожих assets и событий
- **Результат:** Глубокий анализ с рекомендациями

#### ✅ **Stress Test Analysis** (`/api/v1/stress-tests`)
- **Связь:** ANALYST анализирует результаты stress tests
- **Как работает:**
  - После выполнения stress test
  - ANALYST анализирует:
    - Какие assets наиболее уязвимы
    - Корреляции между рисками
    - Тренды и паттерны
  - Использует historical events для сравнения
- **Результат:** Детальный анализ результатов stress test

#### ✅ **Historical Events** (`/api/v1/historical-events`)
- **Связь:** ANALYST использует historical events для контекста
- **Как работает:**
  - При анализе alert или asset
  - ANALYST ищет похожие historical events через RAG
  - Использует их для:
    - Понимания причин
    - Предсказания последствий
    - Калибровки моделей
- **Результат:** Анализ с историческим контекстом

---

### 3. **ADVISOR Agent** - Рекомендации

**Интеграция:**

#### ✅ **Asset Recommendations** (`/api/v1/assets/{id}`)
- **Связь:** ADVISOR генерирует рекомендации для assets
- **Как работает:**
  - Анализирует текущее состояние asset
  - Получает alerts от SENTINEL
  - Получает analysis от ANALYST
  - Генерирует рекомендации с:
    - Множественными options
    - ROI анализом (NPV, 5-year)
    - Urgency оценкой
  - **Валидирует через NeMo Guardrails:**
    - Safety checks
    - Compliance (ECB, Fed, TCFD, CSRD)
    - Feasibility
    - Geographic constraints
    - Financial limits
- **Endpoint:** `GET /api/v1/agents/recommendations/{asset_id}`
- **Результат:** Приоритизированные рекомендации с ROI

#### ✅ **Stress Test Recommendations**
- **Связь:** ADVISOR рекомендует действия после stress tests
- **Как работает:**
  - После stress test показывает зоны риска
  - ADVISOR анализирует:
    - Какие assets в зоне
    - Какие действия нужны
    - ROI для каждого действия
  - Генерирует action plans
- **Результат:** Action plans с приоритетами

#### ✅ **Portfolio Optimization** (`/api/v1/portfolios`)
- **Связь:** ADVISOR рекомендует оптимизацию портфеля
- **Как работает:**
  - Анализирует весь портфель
  - Находит assets с высоким риском
  - Рекомендует:
    - Продажу рискованных assets
    - Покупку более безопасных
    - Ребалансировку
  - Валидирует через Guardrails (не рекомендует опасные действия)
- **Результат:** Portfolio optimization recommendations

---

### 4. **REPORTER Agent** - Отчеты

**Интеграция:**

#### ✅ **Stress Test Reports** (`/api/v1/stress-tests/{id}/reports`)
- **Связь:** REPORTER генерирует PDF отчеты для stress tests
- **Как работает:**
  - После завершения stress test
  - REPORTER собирает:
    - Результаты stress test
    - Risk zones
    - Action plans от ADVISOR
    - Analysis от ANALYST
  - Генерирует PDF с:
    - Executive summary (через NVIDIA LLM)
    - Детальными метриками
    - Визуализациями
    - Рекомендациями
- **Endpoint:** `POST /api/v1/agents/report/stress-test`
- **Результат:** Профессиональный PDF отчет

#### ✅ **Asset Reports**
- **Связь:** REPORTER может генерировать отчеты для assets
- **Как работает:**
  - Пользователь запрашивает отчет для asset
  - REPORTER собирает:
    - Asset data
    - Alerts history
    - Analysis results
    - Recommendations
  - Генерирует comprehensive report
- **Результат:** Asset analysis report

---

## 🔄 Автоматические Workflows

### Workflow 1: Alert → Analysis → Recommendation

```
1. SENTINEL обнаруживает угрозу
   ↓
2. Создает alert
   ↓
3. ANALYST автоматически анализирует alert (с RAG)
   ↓
4. ADVISOR генерирует рекомендации (с Guardrails)
   ↓
5. REPORTER создает отчет (опционально)
```

**Где видно:**
- Dashboard: Alert → Click → Analysis → Recommendations
- Command Center: Alert появляется → Auto-analysis → Recommendations panel

### Workflow 2: Stress Test → Analysis → Action Plan

```
1. Пользователь запускает stress test
   ↓
2. Stress test выполняется
   ↓
3. ANALYST анализирует результаты
   ↓
4. ADVISOR генерирует action plans
   ↓
5. REPORTER создает PDF отчет
```

**Где видно:**
- Stress Test Results → Analysis tab → Action Plans → Export PDF

### Workflow 3: Asset Monitoring → Continuous Analysis

```
1. SENTINEL мониторит asset 24/7
   ↓
2. При обнаружении проблемы → Alert
   ↓
3. ANALYST анализирует (с RAG контекстом)
   ↓
4. ADVISOR рекомендует действия
   ↓
5. Все сохраняется в Digital Twin timeline
```

**Где видно:**
- Asset Detail → Timeline → Alerts → Analysis → Recommendations

---

## 📊 Интеграция с NeMo Phase 1 & 2

### **NeMo Retriever (RAG)** - Используется ANALYST
- **Источники данных:**
  - Knowledge Graph (Neo4j) - зависимости и связи
  - Historical Events - похожие события
  - Vector store - семантический поиск
- **Результат:** Анализ с grounded контекстом (без hallucinations)

### **NeMo Guardrails** - Используется ADVISOR
- **Проверки:**
  - Safety - опасные действия блокируются
  - Compliance - ECB, Fed, TCFD, CSRD
  - Feasibility - реалистичность рекомендаций
  - Geographic - валидность координат
  - Financial - лимиты и constraints
- **Результат:** Только безопасные и валидные рекомендации

### **NeMo Agent Toolkit** - Мониторинг всех агентов
- **Метрики:**
  - Latency (P50, P95, P99)
  - Token usage и cost
  - Success rate
  - Health scores
- **Где видно:** `/agents` страница, Command Center компактный виджет

### **NeMo Curator** - Подготовка данных
- **Используется:**
  - Перед RAG retrieval - очистка historical events
  - Перед Knowledge Graph ingestion
  - Quality scoring для всех данных
- **Результат:** Чистые, качественные данные для агентов

### **NeMo Data Designer** - Генерация сценариев
- **Используется:**
  - Генерация stress test scenarios
  - Создание cascade examples
  - Augmentation historical data
- **Результат:** Больше данных для обучения и тестирования

### **NeMo Evaluator** - Тестирование агентов
- **Используется:**
  - Автоматическое тестирование всех агентов
  - Метрики: precision, recall, F1, ROI accuracy
  - Regression detection
- **Результат:** Гарантия качества работы агентов

---

## 🎯 Практические примеры использования

### Пример 1: Hurricane Alert
```
1. SENTINEL: Обнаруживает hurricane в прогнозе
   → Создает alert: "Hurricane Maria approaching Florida"
   
2. ANALYST: Анализирует alert
   → Использует RAG: находит похожие hurricanes (Katrina, Sandy)
   → Root cause: Climate change + warm ocean
   → Correlations: 23 assets в зоне, €180M exposure
   
3. ADVISOR: Генерирует рекомендации
   → Option 1: Evacuate (ROI: -€50K, но безопасность)
   → Option 2: Reinforce (ROI: +€200K, но риск)
   → Guardrails: Блокирует опасные варианты
   
4. REPORTER: Создает отчет
   → PDF с анализом, рекомендациями, action plan
```

### Пример 2: Asset Risk Analysis
```
1. Пользователь открывает Asset Detail
   
2. ANALYST: Автоматически анализирует asset
   → Использует RAG: находит похожие assets и события
   → Climate risk: 75 (high)
   → Physical risk: 60 (medium)
   → Network risk: 80 (high - зависит от power grid)
   
3. ADVISOR: Рекомендует действия
   → Climate adaptation: €450K (ROI: +€180K)
   → Maintenance: €50K/year (ROI: -€380K, но необходимо)
   → Guardrails: Проверяет compliance и feasibility
   
4. Все сохраняется в Digital Twin timeline
```

### Пример 3: Stress Test Workflow
```
1. Пользователь запускает stress test: "Mediterranean Drought 2031"
   
2. Stress test выполняется (Monte Carlo simulation)
   
3. ANALYST: Анализирует результаты
   → Находит каскадные эффекты через Knowledge Graph
   → Сравнивает с historical events (Germany Floods 2021)
   → Обнаруживает скрытые зависимости
   
4. ADVISOR: Генерирует action plans
   → Для каждой risk zone
   → С ROI анализом
   → Валидирует через Guardrails
   
5. REPORTER: Создает PDF отчет
   → Executive summary (LLM)
   → Детальные метрики
   → Action plans
```

---

## 🔌 API Endpoints для интеграции

### SENTINEL
- `POST /api/v1/agents/monitor` - Запустить цикл мониторинга
- `GET /api/v1/agents/alerts` - Получить активные alerts

### ANALYST
- `POST /api/v1/agents/analyze/asset` - Анализ asset
- `POST /api/v1/agents/analyze/alert` - Анализ alert (автоматически)

### ADVISOR
- `GET /api/v1/agents/recommendations/{asset_id}` - Рекомендации для asset

### REPORTER
- `POST /api/v1/agents/report/stress-test` - PDF отчет для stress test

### Мониторинг (NeMo Toolkit)
- `GET /api/v1/agents/monitoring/dashboard` - Dashboard с метриками
- `POST /api/v1/agents/monitoring/test/all` - Тест всех агентов

---

## 📈 Метрики и мониторинг

### Где видно работу агентов:

1. **Command Center:**
   - Компактный виджет: `Overseer · Agents · Live`
   - Горячая клавиша: `A` - открыть мониторинг
   - Кнопка в TOP RIGHT панели

2. **Dashboard:**
   - AlertPanel показывает alerts от SENTINEL
   - При клике на alert → Analysis от ANALYST
   - Recommendations от ADVISOR

3. **Asset Detail:**
   - Timeline показывает alerts и analysis
   - Recommendations panel от ADVISOR

4. **Stress Test Results:**
   - Analysis tab от ANALYST
   - Action Plans от ADVISOR
   - Export PDF от REPORTER

5. **Страница `/agents`:**
   - Полный мониторинг всех агентов
   - Метрики в реальном времени
   - Health scores

---

## 🚀 Автоматизация

Агенты работают **автоматически** в фоне:

- **SENTINEL:** Мониторит 24/7 (можно настроить interval)
- **ANALYST:** Анализирует alerts автоматически
- **ADVISOR:** Генерирует рекомендации при запросе
- **REPORTER:** Создает отчеты по запросу

**Настройка:**
- `auto_start_sentinel: bool` в config.py
- `sentinel_check_interval_seconds: int` - интервал мониторинга

---

## 💡 Ключевые преимущества интеграции

1. **Автоматизация:** Агенты работают без вмешательства
2. **Контекст:** RAG обеспечивает grounded анализ
3. **Безопасность:** Guardrails блокируют опасные действия
4. **Мониторинг:** Real-time метрики всех агентов
5. **Качество:** Evaluator гарантирует точность

---

**Все агенты интегрированы и работают автоматически!** 🎉
