# Strategic Modules: Backward Compatibility Guarantee

## ✅ Гарантия: Модули НЕ заменяют существующий функционал

**Все существующие API endpoints, сервисы и функционал остаются без изменений.**

---

## 🔍 Текущая Структура (До Модулей)

### Существующие API Endpoints

```
/api/v1/
├── /health              ✅ Остаётся
├── /auth                ✅ Остаётся
├── /assets              ✅ Остаётся
├── /twins               ✅ Остаётся
├── /provenance          ✅ Остаётся
├── /simulations         ✅ Остаётся
├── /agents              ✅ Остаётся
├── /stress              ✅ Остаётся
├── /stress-tests        ✅ Остаётся
├── /alerts              ✅ Остаётся
├── /predictions         ✅ Остаётся
├── /whatif              ✅ Остаётся
├── /exports             ✅ Остаётся
├── /bulk                ✅ Остаётся
├── /preferences         ✅ Остаётся
├── /bim                 ✅ Остаётся
├── /websocket           ✅ Остаётся
├── /audit               ✅ Остаётся
├── /climate             ✅ Остаётся
└── /nvidia              ✅ Остаётся
```

### Существующие Сервисы

```
services/
├── knowledge_graph.py      ✅ Остаётся (расширяется)
├── cascade_engine.py       ✅ Остаётся (расширяется)
├── climate_service.py      ✅ Остаётся (расширяется)
├── financial_models.py     ✅ Остаётся (расширяется)
├── digital_twins.py        ✅ Остаётся (расширяется)
├── agents/                 ✅ Остаётся (расширяется)
│   ├── sentinel.py
│   ├── analyst.py
│   └── advisor.py
└── ... (все остальные)     ✅ Остаются
```

---

## ➕ Новая Структура (С Модулями)

### Новые API Endpoints (Добавляются)

```
/api/v1/
├── ... (все существующие endpoints остаются)
│
└── /cip                   ➕ НОВЫЙ (модуль)
    ├── /infrastructure/register
    ├── /infrastructure/{id}/dependencies
    └── /scenarios/cascade

└── /scss                  ➕ НОВЫЙ (модуль)
    ├── /supply-chain/map
    ├── /bottlenecks
    └── /scenarios/geopolitical

└── /sro                   ➕ НОВЫЙ (модуль)
    ├── /systemic-indicators
    ├── /scenarios/contagion
    └── /early-warnings

... (остальные модули)
```

### Новые Сервисы (Добавляются)

```
services/
├── ... (все существующие сервисы остаются)
│
└── modules/               ➕ НОВЫЙ (модули)
    ├── cip/
    │   ├── service.py     # Использует существующие сервисы
    │   └── agents.py      # Расширяет существующих агентов
    ├── scss/
    └── ...
```

---

## 🔗 Как Модули Интегрируются (Без Замены)

### Пример 1: CIP Модуль + Существующий Assets API

**До модулей:**
```python
# apps/api/src/api/v1/endpoints/assets.py
@router.get("/assets")
async def get_assets():
    # Существующий код
    return assets
```

**С модулями:**
```python
# apps/api/src/api/v1/endpoints/assets.py
@router.get("/assets")
async def get_assets():
    # ✅ КОД НЕ ИЗМЕНЯЕТСЯ
    # Всё работает как раньше
    return assets

# apps/api/src/modules/cip/service.py
class CIPService:
    def __init__(self):
        # ✅ Использует существующий assets API
        self.assets_api = assets.router
    
    async def register_infrastructure(self, data):
        # Создаёт новый asset через существующий API
        asset = await self.assets_api.create_asset(data)
        
        # ДОПОЛНИТЕЛЬНО: добавляет инфраструктурные данные
        infra = await self.create_infrastructure_node(asset.id)
        return infra
```

**Результат:**
- ✅ `/api/v1/assets` работает как раньше
- ✅ `/api/v1/cip/infrastructure/register` - новый endpoint
- ✅ CIP использует assets API, не заменяет его

---

### Пример 2: SCSS Модуль + Существующий Knowledge Graph

**До модулей:**
```python
# apps/api/src/services/knowledge_graph.py
class KnowledgeGraphService:
    async def create_node(self, node_type, properties):
        # Существующий код
        return node
```

**С модулями:**
```python
# apps/api/src/services/knowledge_graph.py
class KnowledgeGraphService:
    async def create_node(self, node_type, properties):
        # ✅ КОД НЕ ИЗМЕНЯЕТСЯ
        # Всё работает как раньше
        return node

# apps/api/src/modules/scss/service.py
class SCSSService:
    def __init__(self):
        # ✅ Использует существующий Knowledge Graph
        self.kg = KnowledgeGraphService()
    
    async def map_supply_chain(self, data):
        # Использует существующий метод
        supplier = await self.kg.create_node(
            node_type="SUPPLIER",  # НОВЫЙ тип узла
            properties=data
        )
        # ДОПОЛНИТЕЛЬНО: добавляет связи
        await self.kg.create_edge(
            source_id=supplier.id,
            target_id=data["factory_id"],
            edge_type="SUPPLIES_TO"  # НОВЫЙ тип связи
        )
        return supplier
```

**Результат:**
- ✅ Knowledge Graph работает как раньше
- ✅ SCSS добавляет новые типы узлов (`SUPPLIER`, `RAW_MATERIAL`)
- ✅ Существующие узлы (`ASSET`, `INFRASTRUCTURE`) остаются

---

### Пример 3: SRO Модуль + Существующий Cascade Engine

**До модулей:**
```python
# apps/api/src/layers/simulation/cascade_engine.py
class CascadeEngine:
    async def run(self, scenario_type, initial_shock):
        # Существующий код
        return result
```

**С модулями:**
```python
# apps/api/src/layers/simulation/cascade_engine.py
class CascadeEngine:
    async def run(self, scenario_type, initial_shock):
        # ✅ КОД НЕ ИЗМЕНЯЕТСЯ
        # Всё работает как раньше
        return result

# apps/api/src/modules/sro/service.py
class SROService:
    def __init__(self):
        # ✅ Использует существующий Cascade Engine
        self.cascade_engine = CascadeEngine()
    
    async def simulate_systemic_risk(self, scenario):
        # Использует существующий метод с новым типом сценария
        result = await self.cascade_engine.run(
            scenario_type="systemic_risk",  # НОВЫЙ тип сценария
            initial_shock=scenario["initial_shock"],
            # ДОПОЛНИТЕЛЬНЫЕ параметры для финансовых рисков
            correlation_matrix=scenario["correlations"]
        )
        return result
```

**Результат:**
- ✅ Cascade Engine работает как раньше
- ✅ SRO добавляет новый тип сценария (`systemic_risk`)
- ✅ Существующие сценарии (`infrastructure_cascade`) остаются

---

### Пример 4: Модули + Существующие Агенты

**До модулей:**
```python
# apps/api/src/layers/agents/sentinel.py
class SentinelAgent:
    async def monitor(self):
        # Существующий код
        pass
```

**С модулями:**
```python
# apps/api/src/layers/agents/sentinel.py
class SentinelAgent:
    async def monitor(self):
        # ✅ КОД НЕ ИЗМЕНЯЕТСЯ
        # Всё работает как раньше
        pass

# apps/api/src/modules/cip/agents.py
class CIPSentinelAgent(SentinelAgent):  # ✅ НАСЛЕДУЕТ существующий класс
    def __init__(self):
        super().__init__()  # ✅ Использует базовую функциональность
        self.module = "cip"
    
    async def monitor(self):
        # ✅ Вызывает родительский метод
        await super().monitor()
        
        # ДОПОЛНИТЕЛЬНО: модуль-специфичный мониторинг
        await self.monitor_infrastructure()
```

**Результат:**
- ✅ Существующий `SentinelAgent` работает как раньше
- ✅ `CIP_SENTINEL` - новый специализированный агент
- ✅ Оба агента работают параллельно

---

## 📊 Сравнение: До и После

### API Endpoints

| Endpoint | До Модулей | С Модулями | Изменение |
|----------|------------|------------|-----------|
| `/api/v1/assets` | ✅ Работает | ✅ Работает | ❌ Нет изменений |
| `/api/v1/stress-tests` | ✅ Работает | ✅ Работает | ❌ Нет изменений |
| `/api/v1/alerts` | ✅ Работает | ✅ Работает | ❌ Нет изменений |
| `/api/v1/cip/*` | ❌ Не существует | ✅ Новый | ➕ Добавлен |
| `/api/v1/scss/*` | ❌ Не существует | ✅ Новый | ➕ Добавлен |

### База Данных

| Таблица | До Модулей | С Модулями | Изменение |
|---------|------------|------------|-----------|
| `assets` | ✅ Существует | ✅ Существует | ❌ Нет изменений |
| `stress_tests` | ✅ Существует | ✅ Существует | ❌ Нет изменений |
| `cip.critical_infrastructure` | ❌ Не существует | ✅ Новая | ➕ Добавлена |
| `scss.supply_chain` | ❌ Не существует | ✅ Новая | ➕ Добавлена |

**Важно:** Модули используют **отдельные схемы** (`cip.*`, `scss.*`), не изменяя существующие таблицы.

### Knowledge Graph

| Узлы | До Модулей | С Модулями | Изменение |
|------|------------|------------|-----------|
| `ASSET` | ✅ Существует | ✅ Существует | ❌ Нет изменений |
| `INFRASTRUCTURE` | ❌ Не существует | ✅ Новый | ➕ Добавлен |
| `SUPPLIER` | ❌ Не существует | ✅ Новый | ➕ Добавлен |

**Важно:** Новые типы узлов добавляются, существующие остаются без изменений.

---

## 🔒 Гарантии Обратной Совместимости

### 1. API Contracts

✅ **Все существующие API endpoints остаются без изменений**  
✅ **Все существующие request/response схемы остаются**  
✅ **Все существующие коды ошибок остаются**

### 2. База Данных

✅ **Все существующие таблицы остаются без изменений**  
✅ **Все существующие индексы остаются**  
✅ **Модули используют отдельные схемы (`cip.*`, `scss.*`)**

### 3. Сервисы

✅ **Все существующие сервисы остаются без изменений**  
✅ **Модули используют существующие сервисы, не заменяют их**  
✅ **Модули расширяют функциональность через наследование**

### 4. Frontend

✅ **Все существующие компоненты работают как раньше**  
✅ **Новые модули добавляют новые компоненты**  
✅ **Существующие страницы не изменяются**

---

## 🧪 Тестирование Обратной Совместимости

### Checklist

- [ ] Все существующие API endpoints возвращают те же данные
- [ ] Все существующие frontend компоненты работают
- [ ] Все существующие интеграции не сломаны
- [ ] Все существующие тесты проходят
- [ ] Миграции базы данных не изменяют существующие таблицы

### Пример Теста

```python
# test_backward_compatibility.py

async def test_existing_assets_api_still_works():
    """Проверяем, что существующий assets API работает."""
    response = await client.get("/api/v1/assets")
    assert response.status_code == 200
    # ✅ Те же данные, что и раньше

async def test_new_cip_module_doesnt_break_assets():
    """Проверяем, что новый CIP модуль не ломает assets."""
    # Создаём инфраструктуру через CIP
    await client.post("/api/v1/cip/infrastructure/register", json={...})
    
    # Проверяем, что assets API всё ещё работает
    response = await client.get("/api/v1/assets")
    assert response.status_code == 200
    # ✅ Assets API не сломан
```

---

## 📝 Миграционная Стратегия

### Поэтапное Внедрение

1. **Week 1-2:** Создать базовый фреймворк (не затрагивает существующий код)
2. **Week 3-4:** Реализовать CIP модуль (новые файлы, новые endpoints)
3. **Week 5-6:** Тестирование (проверка, что ничего не сломалось)
4. **Week 7+:** Масштабирование на другие модули

### Rollback Plan

Если что-то пойдёт не так:

1. ✅ Отключить модули через feature flag
2. ✅ Удалить новые endpoints из router
3. ✅ Существующий функционал продолжит работать

---

## ✅ Итоговые Гарантии

1. **✅ Никакой существующий код не изменяется**
2. **✅ Все существующие API endpoints работают**
3. **✅ Все существующие сервисы работают**
4. **✅ Все существующие данные сохраняются**
5. **✅ Модули добавляются, не заменяют**

---

## 🎯 Вывод

**Стратегические модули - это НАДСТРОЙКА над существующей архитектурой, а не замена.**

Они:
- ➕ **Добавляют** новые возможности
- ➕ **Расширяют** существующие сервисы
- ➕ **Используют** существующую инфраструктуру
- ❌ **НЕ заменяют** существующий функционал
- ❌ **НЕ изменяют** существующий код
- ❌ **НЕ ломают** существующие интеграции

**Можно безопасно внедрять модули, не беспокоясь о поломке существующего функционала.**
