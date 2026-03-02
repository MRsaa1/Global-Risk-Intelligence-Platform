# Command Center ↔ Dashboard sync

Единый store и события между Command Center и Dashboard: что синхронизировано и как это работает.

## Единый store (Zustand)

Оба экрана используют **один и тот же** [platformStore](apps/web/src/store/platformStore.ts):

| State | Описание | Где пишется | Где читается |
|-------|----------|-------------|--------------|
| `portfolioIntent` / `portfolioConfirmed` | Портфель (exposure, at risk, critical count) | CC, Dashboard, WebSocket | Оба |
| `activeStressTest` | Текущий запущенный стресс-тест | CC (start), WebSocket (progress/complete) | Оба |
| `activeScenario` | Активный сценарий для визуализации на глобусе | CC | CC (глобус), Dashboard (контекст) |
| `selectedZone` / `selectedZones` | Выбранная зона на карте | CC | CC |
| `recentEvents` | Последние события (stress test, zone, twin, alert, data refresh) | CC (addEvent), WebSocket (addEvent) | Оба |
| `lastRefreshBySource` | Время последнего обновления по источникам (GDELT, USGS, …) | Dashboard (refresh), WebSocket | Оба |
| `threatFeed` / `marketData` | Угрозы и рыночные данные | WebSocket | Оба |
| `showDigitalTwinPanel` / `openDigitalTwins` | Открытые Digital Twin | CC | CC |

При переключении между Command Center и Dashboard данные не сбрасываются: оба подписаны на один store.

## WebSocket

[Layout](apps/web/src/components/Layout.tsx) подписан на каналы:

`dashboard`, `stress_tests`, `alerts`, `command_center`, `threat_intelligence`, `market_data`

События с бэкенда приходят в [usePlatformWebSocket](apps/web/src/hooks/usePlatformWebSocket.ts), там вызываются действия store (`addEvent`, `setStressTestIntent`, `setPortfolioConfirmed`, `setLastRefresh`, `addThreatSignal` и т.д.). И Command Center, и Dashboard получают одни и те же обновления через общий store.

## События из Command Center на Dashboard

- Запуск стресс-теста в CC → `addEvent(STRESS_TEST_STARTED)` и `setStressTestIntent` → на Dashboard отображаются «Active operation» и запись в Recent Activity.
- Выбор зоны, открытие Digital Twin, обновление портфеля в CC → события в `recentEvents` → на Dashboard блок «Recent Activity» показывает те же события.
- Данные ingestion (refresh-all) и угрозы приходят по WebSocket и пишутся в store → и CC, и Dashboard видят одни и те же `lastRefreshBySource` и `threatFeed`.

## Персистенция

- `recentEvents` сохраняются в `localStorage` (ключ `pfrp_recent_events`), чтобы после перезагрузки вкладки или открытия в новой вкладке лента активности сохранялась.

## Что не синхронизируется (и не должно)

- Локальный UI Command Center: какие слои включены (flood, wind, earthquake и т.д.), положение камеры, открытые панели — это состояние только CC.
- Локальный UI Dashboard: открытые аккордеоны, выбранные фильтры — только Dashboard.

## Как проверить синхронизацию

1. Открыть Command Center, запустить стресс-тест или выбрать зону.
2. Перейти на Dashboard — в блоке «Recent Activity» должны быть те же события; при активном тесте — карточка «Active operation».
3. На Dashboard нажать «Command Center» (иконка глобуса в сайдбаре) — в CC должны быть те же `activeStressTest` / `activeScenario` и актуальный портфель из store.

## Ссылки в UI

- На Dashboard у блока Recent Activity есть ссылка «Open in Command Center», у карточки активного стресс-теста — «Open in Command Center» (ведёт на `/command`).
- В сайдбаре иконка глобуса ведёт в Command Center; остальные пункты — в соответствующие страницы (в т.ч. Dashboard).

## Итог

Command Center и Dashboard используют **один store и одни и те же WebSocket-события**. Синхронизация «из коробки»: всё, что пишется в store в CC или приходит по WebSocket, видно на Dashboard, и наоборот, где применимо (портфель, события, активный тест, данные обновлений и угрозы).
