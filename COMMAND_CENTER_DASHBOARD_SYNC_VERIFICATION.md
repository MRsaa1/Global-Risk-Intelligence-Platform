# Command Center ↔ Dashboard Integration - Проверка выполнения

## ✅ Что было сделано

### Backend (Phase 2)

#### 1. `apps/api/src/api/v1/endpoints/stress_tests.py`
- ✅ Добавлен импорт: `from src.services.event_emitter import event_emitter`
- ✅ `/execute` endpoint:
  - Эмитит `STRESS_TEST_STARTED` в начале
  - Эмитит `STRESS_TEST_COMPLETED` после завершения
- ✅ `/execute/nvidia` endpoint:
  - Эмитит `STRESS_TEST_STARTED` в начале
  - Эмитит `STRESS_TEST_COMPLETED` после завершения
- ✅ `POST /{test_id}/zones` эмитит `RISK_ZONE_CREATED`
- ✅ `DELETE /{test_id}` эмитит `STRESS_TEST_DELETED`

**Как проверить:**
```bash
# Откройте файл и найдите строки:
grep -n "emit_stress_test_started\|emit_stress_test_completed" apps/api/src/api/v1/endpoints/stress_tests.py
```

#### 2. `apps/api/src/api/v1/endpoints/assets.py`
- ✅ Добавлен импорт: `from src.services.event_emitter import event_emitter`
- ✅ `POST /` (создание актива) эмитит `PORTFOLIO_UPDATED` с `action: "asset_created"`
- ✅ `DELETE /{asset_id}` эмитит `PORTFOLIO_UPDATED` с `action: "asset_deleted"`
- ✅ `POST /{asset_id}/upload-bim` эмитит `TWIN_OPENED`

**Как проверить:**
```bash
grep -n "emit_portfolio_updated\|emit.*TWIN_OPENED" apps/api/src/api/v1/endpoints/assets.py
```

### Frontend (Phase 3)

#### 3. `apps/web/src/store/platformStore.ts`
- ✅ Добавлен интерфейс `ActiveScenarioState`
- ✅ Добавлены состояния:
  - `activeScenario: ActiveScenarioState | null`
  - `selectedStressTestId: string | null`
- ✅ Добавлены действия:
  - `setActiveScenario(scenario)`
  - `clearActiveScenario()`
  - `setSelectedStressTestId(id)`
- ✅ Добавлены хуки:
  - `useActiveScenario()`
  - `useSelectedStressTestId()`

**Как проверить:**
```bash
grep -n "activeScenario\|selectedStressTestId" apps/web/src/store/platformStore.ts
```

#### 4. `apps/web/src/pages/CommandCenter.tsx`
- ✅ `activeScenario` мигрирован из локального состояния в глобальный store
- ✅ `selectedStressTestId` синхронизирован с глобальным store
- ✅ Сохранена обратная совместимость через wrapper функции

**Как проверить:**
```bash
grep -n "useActiveScenario\|useSelectedStressTestId\|setActiveScenarioState" apps/web/src/pages/CommandCenter.tsx
```

#### 5. `apps/web/src/hooks/usePlatformWebSocket.ts`
- ✅ Обработчик `STRESS_TEST_STARTED`:
  - Обновляет `activeScenario`
  - Устанавливает `selectedStressTestId`
- ✅ Обработчик `STRESS_TEST_COMPLETED` обновляет состояние
- ✅ Обработчик `STRESS_TEST_DELETED` очищает состояние
- ✅ Обработчик `RISK_ZONE_CREATED` для логирования

**Как проверить:**
```bash
grep -n "STRESS_TEST_STARTED\|setActiveScenario\|setSelectedStressTestId" apps/web/src/hooks/usePlatformWebSocket.ts
```

#### 6. `apps/web/src/types/events.ts`
- ✅ Добавлены типы событий:
  - `STRESS_TEST_DELETED`
  - `RISK_ZONE_CREATED`

**Как проверить:**
```bash
grep -n "STRESS_TEST_DELETED\|RISK_ZONE_CREATED" apps/web/src/types/events.ts
```

---

## 🧪 Как протестировать интеграцию

### Предварительные требования

1. **Запустите бэкенд:**
```bash
cd apps/api
pip install -e '.[dev]'
uvicorn src.main:app --reload --port 8000
```

2. **Запустите фронтенд:**
```bash
cd apps/web
npm run dev
```

3. **Откройте два окна браузера:**
   - Окно 1: `http://localhost:5180/command` (Command Center)
   - Окно 2: `http://localhost:5180/dashboard` (Dashboard)

### Тест 1: Запуск Stress Test → Dashboard показывает активный сценарий

**Шаги:**
1. В Command Center запустите stress test (например, через Stress Test Panel)
2. Откройте консоль браузера (F12) в обоих окнах
3. В Dashboard должно появиться:
   - Активный stress test в RecentActivityPanel
   - Обновление метрик портфеля

**Что проверить в консоли:**
```javascript
// В консоли Dashboard окна выполните:
window.__PLATFORM_STORE__ = usePlatformStore.getState()
console.log('Active Scenario:', window.__PLATFORM_STORE__.activeScenario)
console.log('Selected Test ID:', window.__PLATFORM_STORE__.selectedStressTestId)
```

**Ожидаемый результат:**
- `activeScenario` должен содержать данные о запущенном тесте
- `selectedStressTestId` должен быть установлен

### Тест 2: Завершение Stress Test → Обновление портфеля

**Шаги:**
1. Дождитесь завершения stress test
2. Проверьте Dashboard - метрики портфеля должны обновиться

**Что проверить:**
- RecentActivityPanel показывает "Stress Test Completed"
- Метрики портфеля обновлены (если тест изменил данные)

### Тест 3: Создание/удаление актива → Обновление портфеля в реальном времени

**Шаги:**
1. В Command Center или через API создайте новый актив
2. В Dashboard проверьте, что:
   - Portfolio totals обновились
   - RecentActivityPanel показывает событие "Portfolio Updated"

**API команда для теста:**
```bash
# Создать актив
curl -X POST http://localhost:8000/api/v1/assets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Building",
    "asset_type": "commercial_office",
    "country_code": "US",
    "city": "New York",
    "current_valuation": 10000000
  }'
```

**Что проверить в консоли Dashboard:**
```javascript
console.log('Portfolio:', window.__PLATFORM_STORE__.portfolioConfirmed)
console.log('Recent Events:', window.__PLATFORM_STORE__.recentEvents.slice(0, 5))
```

### Тест 4: WebSocket события

**Шаги:**
1. Откройте консоль в обоих окнах
2. Запустите stress test в Command Center
3. Проверьте WebSocket сообщения в консоли

**Что искать в консоли:**
```
[PlatformWS] Event received: STRESS_TEST_STARTED
[PlatformWS] Event received: STRESS_TEST_COMPLETED
```

---

## 🔍 Быстрая проверка через код

### Проверка всех изменений одной командой:

```bash
# Backend проверка
echo "=== Backend Events ==="
grep -c "event_emitter" apps/api/src/api/v1/endpoints/stress_tests.py apps/api/src/api/v1/endpoints/assets.py

# Frontend Store проверка
echo "=== Frontend Store ==="
grep -c "activeScenario\|selectedStressTestId" apps/web/src/store/platformStore.ts

# WebSocket Handlers проверка
echo "=== WebSocket Handlers ==="
grep -c "STRESS_TEST_STARTED\|setActiveScenario" apps/web/src/hooks/usePlatformWebSocket.ts

# Event Types проверка
echo "=== Event Types ==="
grep -c "STRESS_TEST_DELETED\|RISK_ZONE_CREATED" apps/web/src/types/events.ts
```

**Ожидаемый результат:**
- Backend: минимум 2 файла с `event_emitter`
- Frontend Store: минимум 5 упоминаний `activeScenario` или `selectedStressTestId`
- WebSocket: минимум 2 обработчика событий
- Event Types: 2 новых типа событий

---

## ✅ Чеклист проверки

- [ ] Backend: `stress_tests.py` импортирует `event_emitter`
- [ ] Backend: `assets.py` импортирует `event_emitter`
- [ ] Backend: `/execute` эмитит события
- [ ] Backend: `/execute/nvidia` эмитит события
- [ ] Backend: создание/удаление актива эмитит события
- [ ] Frontend: `platformStore.ts` содержит `activeScenario` и `selectedStressTestId`
- [ ] Frontend: `CommandCenter.tsx` использует store вместо локального состояния
- [ ] Frontend: `usePlatformWebSocket.ts` обрабатывает новые события
- [ ] Frontend: `events.ts` содержит новые типы событий
- [ ] Тест: Stress test в CC отражается в Dashboard
- [ ] Тест: Создание актива обновляет Dashboard в реальном времени

---

## 📝 Примечания

- Если бэкенд не запущен, WebSocket события не будут работать, но это нормально
- Ошибки API (500) ожидаемы, если бэкенд не настроен или база данных не запущена
- Для полного тестирования нужны запущенные сервисы: PostgreSQL, Redis, и API сервер

---

**Дата проверки:** $(date)
**Статус:** ✅ Все изменения применены
