# Аудит и консолидация: Command Center ↔ Dashboard ↔ События

Единый документ: что реализовано, как связано, чего не хватает и что проверить.

---

## 1. Реализовано

### 1.1 Backend

| Модуль | Файл | Назначение |
|--------|------|------------|
| **EventEmitter** | `apps/api/src/services/event_emitter.py` | Эмиссия платформенных событий, causality, broadcast в WebSocket |
| **WebSocket** | `apps/api/src/api/v1/endpoints/websocket.py` | `ConnectionManager`, каналы, `GET /ws/connect`, `GET /ws/stats`, `POST /ws/broadcast` |
| **Events (модели)** | `apps/api/src/models/events.py` | `PlatformEvent`, `EventTypes`, `get_channel_for_event` |

**EventEmitter — хелперы:**
- `emit_stress_test_started`, `emit_stress_test_progress`, `emit_stress_test_completed`, `emit_stress_test_failed`
- `emit_risk_zone_created`, `emit_zone_selected`
- `emit_portfolio_updated`, `emit_asset_risk_updated`
- `emit_digital_twin_opened`, `emit_digital_twin_closed`

Через `emit()` с `event_type`-строками: `STRESS_TEST_DELETED`, `RISK_ZONE_CREATED` (в `EventTypes` нет, но используются).

**WebSocket — каналы:**
- `dashboard`, `assets`, `alerts`, `stress_tests`, `command_center`, `user:{id}`

**Подключение:**
- Роутер: `api_router.include_router(websocket.router, prefix="/ws")`  
- `main`: `app.include_router(api_router, prefix=settings.api_prefix)` → `api_prefix = "/api/v1"`  
- Итог: **`/api/v1/ws/connect`**

**Использование EventEmitter:**
- `stress_tests.py`: `emit_stress_test_*`, `emit_risk_zone_created`, `emit(STRESS_TEST_DELETED)`
- `assets.py`: `emit_portfolio_updated` (create/delete asset)
- `bulk.py`: `emit_portfolio_updated` (import, delete, update, recalculate), `emit_asset_risk_updated` (recalculate)

---

### 1.2 Frontend

| Модуль | Файл | Назначение |
|--------|------|------------|
| **platformStore** | `apps/web/src/store/platformStore.ts` | Portfolio (intent/confirmed), activeStressTest, activeScenario, selectedStressTestId, selectedZone, recentEvents, wsStatus; хуки `usePortfolio`, `useActiveStressTest`, `useRecentEvents` |
| **usePlatformWebSocket** | `apps/web/src/hooks/usePlatformWebSocket.ts` | Подписка на `/api/v1/ws/connect?channels=...`, реконнект, обработка `message` → `handleEvent` → store |
| **types/events** | `apps/web/src/types/events.ts` | `PlatformEvent`, `EventTypes`, `getChannelForEvent` (дублирует бэкенд) |

**Обработка в `usePlatformWebSocket`:**
- `STRESS_TEST_STARTED` → setStressTestIntent, setActiveScenario, setSelectedStressTestId
- `STRESS_TEST_COMPLETED` / `STRESS_TEST_FAILED` → confirmStressTest
- `STRESS_TEST_PROGRESS` → updateStressTestProgress
- `STRESS_TEST_DELETED` → при совпадении `entity_id` с `selectedStressTestId`: clearActiveScenario, clearStressTest, setSelectedStressTestId(null)
- `RISK_ZONE_CREATED` → только `console.log`
- `ZONE_SELECTED` → `event.data.zone` → selectZone (см. п. 3)
- `ZONE_DESELECTED` → deselectZone(entity_id)
- `PORTFOLIO_UPDATED` → `event.data.portfolio` → setPortfolioIntent / setPortfolioConfirmed (см. п. 3)
- `ASSET_RISK_UPDATED` → только `console.log`
- `TWIN_OPENED` / `TWIN_CLOSED` → openDigitalTwin / closeDigitalTwin

**Страницы и каналы:**
- **Dashboard**: `usePlatformWebSocket(['dashboard','stress_tests','alerts'])`, `usePortfolio`, `useActiveStressTest`, `useRecentEvents`, `RecentActivityPanel(recentEvents)`, свой блок по `activeStressTest` (не `ActiveOperationBadge`)
- **CommandCenter**: `usePlatformWebSocket(['command_center','dashboard','stress_tests'])`, `usePlatformStore`, `usePortfolio`, `exportStressTestPdf` из `../lib/exportService`
- **Visualizations**: `usePlatformWebSocket` (каналы по контексту)

**lib:**
- `api`, `auth`, `chartColors`, `i18n`, `modules`, `notifications`, `useWebSocket`, `useStressTests`, `analytics`, `exportService`

---

## 2. Связи: цепочка событий

```
[Backend]  stress_tests / assets / bulk
    → event_emitter.emit_*(...)  или  event_emitter.emit(事件_type=...)
    → EventEmitter._broadcast(event)
         → channel = EventTypes.get_channel_for_event(event_type)
         → ws_manager.broadcast_to_channel(channel, event.dict())
         → если channel != "dashboard": broadcast_to_channel("dashboard", {event, event_type, entity_type, entity_id, action, intent})

[WebSocket]  /api/v1/ws/connect?channels=dashboard,stress_tests,...
    → payload: { type: "message", channel, data: <event.dict() или summary> }

[Frontend]  usePlatformWebSocket(channels)
    → onmessage → handleEvent(message.data, message.channel)
    → switch(event.event_type) → store.set* / update* / clear*
    → store.addEvent(event)
```

**Маршрутизация по `get_channel_for_event` (backend `events.py`):**
- `stress_test.*` → `stress_tests`
- `zone.*` → `command_center`  
  - `RISK_ZONE_CREATED` не в `EventTypes`, в `get_channel_for_event` не учтён → по умолчанию `dashboard`
- `portfolio.*`, `exposure.*`, `asset.*` → `dashboard`
- `twin.*`, `historical.*` → `command_center`
- `alert.*` → `alerts`
- `STRESS_TEST_DELETED` не матчится по `startswith("stress_test")` → `dashboard`

---

## 3. Пробелы и риски

### 3.1 PORTFOLIO_UPDATED и форма `portfolio_data`

**Ожидание на фронте (platformStore):**  
`PortfolioState`: `totalExposure`, `atRisk`, `criticalCount`, `weightedRisk` (+ опц. `totalAssets`, `digitalTwins`, `portfolioValue`).

**Фактическая форма в `emit_portfolio_updated`:**

| Источник | `portfolio_data` |
|----------|-------------------|
| `assets` create | `{ action, asset_id, name, valuation, asset_type }` |
| `assets` delete | `{ action, asset_id, name, valuation }` |
| `bulk` import | `{ action, assets_created, created_ids }` |
| `bulk` delete | `{ action, assets_deleted, deleted_names }` |
| `bulk` update | `{ action, assets_updated, updates_applied }` |
| `bulk` recalc risks | `{ action, assets_updated }` |

В `usePlatformWebSocket` при `PORTFOLIO_UPDATED` делается:
`setPortfolioConfirmed(event.data.portfolio)` или `setPortfolioIntent(event.data.portfolio)`.

То есть в store попадает объект без `totalExposure`/`atRisk`/`criticalCount`/`weightedRisk`. Это перезаписывает `portfolioConfirmed` некорректной структурой и ломает `useStats()` в Dashboard (totalAssets, criticalCount, portfolioValue и т.д.).

**Рекомендация:**  
Либо в `assets`/`bulk` перед `emit_portfolio_updated` считать/брать из БД агрегаты (totalExposure, atRisk, criticalCount, weightedRisk, totalAssets, portfolioValue) и в `data.portfolio` отдавать именно `PortfolioState`; либо не вызывать `setPortfolioConfirmed`/`setPortfolioIntent`, когда `event.data.portfolio` не похож на `PortfolioState` (например, нет `totalExposure` и `atRisk`), а только логировать или триггерить refetch.

---

### 3.2 ZONE_SELECTED: `event.data.zone` vs `emit_zone_selected`

**Бэкенд** (`emit_zone_selected`):
```python
data={ "name": zone_name, "risk_score": risk_score, "exposure": exposure }
# entity_id = zone_id
```

**Фронт** (`usePlatformWebSocket`):
```ts
if (event.data.zone) {
  store.selectZone(event.data.zone, { eventId, causedBy })
}
```

`event.data.zone` всегда `undefined`, `selectZone` не вызывается.

**Рекомендация:**  
Либо в `emit_zone_selected` добавить в `data` поле `zone` с объектом (id=entity_id, name, risk_score, exposure, и при необходимости остальные поля `RiskZone`); либо на фронте при `ZONE_SELECTED` строить объект из `entity_id` и `event.data` и передавать его в `selectZone`.

---

### 3.3 Дубликат в `dashboard` и неполный payload

В `EventEmitter._broadcast` при `channel != "dashboard"` в канал `dashboard` уходит упрощённое сообщение:
`{ event, event_type, entity_type, entity_id, action, intent }` — без `data`.

Подписчик на `dashboard` (и на `stress_tests`) может получить два сообщения: полный `event.dict()` на `stress_tests` и этот summary на `dashboard`. Обработчики в `handleEvent` ориентированы на полный объект (`event.data`, `event.data.portfolio`, `event.data.progress` и т.д.). Для summary `event.data` нет → возможны `updateStressTestProgress(entity_id, 0, undefined)` и перезатирание корректного `progress`.

**Рекомендация:**  
Либо не слать summary в `dashboard` для событий, которые уже приходят полными на своих каналах; либо в summary не использовать те же `event_type`, что и у полного события; либо на фронте в `handleEvent` игнорировать сообщения без `data` (или без обязательных полей для каждого `event_type`).

---

### 3.4 RecoveryPlan / BCP

- Моделей `RecoveryPlan` в `apps/api/src/models/` нет.
- В `models/__init__.py` нет.
- В роутере и эндпоинтах нет.
- Связи со stress tests (автозапуск планов, эмиссия `recovery_plan.activated` и т.п.) нет.

По `docs/UNIFIED_PLAN.md` BCP/Recovery Plans — отдельная фаза.

---

### 3.5 ActiveOperationBadge

- Компонент: `apps/web/src/components/dashboard/ActiveOperationBadge.tsx` (type, name, progress, status, startedAt).
- В **Dashboard** не используется: вместо него свой блок по `activeStressTest` (BoltIcon, name, progress).

**Рекомендация:**  
Либо заменить кастомный блок на `ActiveOperationBadge` для единообразия, либо удалить компонент, если он не планируется.

---

### 3.6 `events.py` и `models/__init__.py`

- `PlatformEvent` и `EventTypes` в `apps/api/src/models/events.py`.
- В `models/__init__.py` не импортируются и не экспортируются.
- На работу `event_emitter` и `websocket` это не влияет: они импортируют из `src.models.events` напрямую. При необходимости единой точки экспорта моделей — добавить в `__init__.py`.

---

### 3.7 `STRESS_TEST_DELETED` и `RISK_ZONE_CREATED` в `EventTypes` и `get_channel_for_event`

- В `EventTypes` (backend) их нет; в `event_emitter` и `stress_tests` используются строки `"STRESS_TEST_DELETED"` и `"RISK_ZONE_CREATED"`.
- `get_channel_for_event("STRESS_TEST_DELETED")` → `dashboard` (не `stress_tests`).
- `get_channel_for_event("RISK_ZONE_CREATED")` → `dashboard` (логичнее `command_center` для зон).

Фронт обрабатывает оба типа. Для точной маршрутизации и консистентности можно добавить их в `EventTypes` и в `get_channel_for_event`.

---

## 4. Чеклист проверки (Command Center ↔ Dashboard)

1. **Stress test**
   - Command Center: запуск stress test → в store `activeStressTest` и `activeScenario`.
   - Dashboard (другая вкладка/экран): тот же `activeStressTest` (имя + progress), `activeScenario` при наличии, `recentEvents` обновляются.
   - Завершение/ошибка в CC → на Dashboard `confirmStressTest`, снятие/остановка индикатора.

2. **PORTFOLIO_UPDATED**
   - Пока не приводить `portfolio_data` к `PortfolioState`: не проверять `setPortfolioConfirmed` на реальных агрегатах.
   - Проверить: после create/delete asset в `assets` или bulk-операций приходит `PORTFOLIO_UPDATED`, в `recentEvents` появляется запись, без падений и без перезаписи `portfolioConfirmed` «битой» структурой (см. п. 3.1 — временно не вызывать setPortfolioConfirmed при несовместимом формате или поправить бэкенд).

3. **WebSocket**
   - Открыть CC и Dashboard; в обеих вкладках `wsStatus` = `connected`.
   - Перезапуск API → реконнект, `wsStatus`: `disconnected` → `connecting` → `connected`.
   - В `RecentActivityPanel` или по логам: после операций в CC приходят события (stress, zone, twin и т.д.).

4. **STRESS_TEST_DELETED**
   - В CC удалить тест, который `selectedStressTestId`. На Dashboard и в CC: `selectedStressTestId`, `activeStressTest`, `activeScenario` сбрасываются, без ошибок.

5. **ZONE_SELECTED**
   - Пока `event.data.zone` не добавлен/не строится на фронте — не ожидать обновления `selectedZones`/`selectedZone` по WebSocket. После доработки (п. 3.2) — проверить выбор зоны в CC и отражение в store.

---

## 5. Сводка по файлам

| Назначение | Файлы |
|------------|-------|
| Эмиссия событий | `event_emitter.py`, `events.py` |
| Приём и рассылка | `websocket.py` (ConnectionManager, `/ws/connect`) |
| Маршрутизация каналов | `events.py` → `EventTypes.get_channel_for_event` |
| Обработка на фронте | `usePlatformWebSocket.ts` → `handleEvent` |
| Глобальное состояние | `platformStore.ts` |
| Типы событий (фронт) | `types/events.ts` |
| Страницы | `Dashboard.tsx`, `CommandCenter.tsx`, при необходимости `Visualizations` |
| Вызовы emit | `stress_tests.py`, `assets.py`, `bulk.py` |
| Экспорт PDF stress test | `lib/exportService.ts` |
| Модели (без events) | `models/__init__.py` |

---

## 6. Приоритеты доработок

| Приоритет | Задача |
|-----------|--------|
| Высокий | Привести `portfolio_data` в `emit_portfolio_updated` к `PortfolioState` или не вызывать setPortfolioConfirmed при несовместимом формате. |
| Высокий | Исправить `ZONE_SELECTED`: `data.zone` на бэкенде или сборка zone на фронте. |
| Средний | Убрать или изменить дубликат в `dashboard` (summary без `data`), чтобы не портить `progress` и др. |
| Средний | Ввести `STRESS_TEST_DELETED` и `RISK_ZONE_CREATED` в `EventTypes` и при необходимости поправить `get_channel_for_event`. |
| Низкий | Подключить `ActiveOperationBadge` в Dashboard или убрать компонент. |
| Низкий | Добавить `events` в `models/__init__.py` при желании единого экспорта. |
| Отдельная фаза | RecoveryPlan/BCP: модели, API, связь со stress tests. |
