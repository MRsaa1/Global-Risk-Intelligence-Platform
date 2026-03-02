# UE5 Visual Simulation — отдельный модуль

## Это отдельный модуль?

**Да.** UE5-симуляция — это **отдельное приложение** (Unreal Engine 5), а не часть веб-фронтенда.

- **API** — бэкенд: `apps/api/`
- **Web** — веб-интерфейс (React, CesiumJS): `apps/web/`
- **UE5** — десктопная 3D-симуляция: `apps/ue5/`

Веб и UE5 ходят в один и тот же API. На фронте ничего специально под UE5 не реализовано.

## Где реализовано на фронте?

На веб-фронте (`apps/web/`) уже есть глобус и дашборд:
- CesiumGlobe.tsx — глобус, зоны, инциденты
- CommandCenter.tsx — дашборд
- ActiveIncidentsPanel.tsx — таблица инцидентов

Это не UE5. UE5 — отдельный .uproject, открывается в Unreal Editor.

## Как пользоваться UE5?

1. Установить Unreal Engine 5.4 и плагин Cesium for Unreal.
2. Открыть проект: `apps/ue5/GlobalRiskSim/GlobalRiskSim.uproject`
3. Запустить API: из корня репо `./run-local-dev.sh` или порт 9002.
4. В уровне добавить: RiskDataManager, FloodController, WindController, StressZoneRenderer; в GameMode — HUD Class = ARiskHUD.
5. Play — выбор города/сценария, данные с API.

Эндпоинты для UE5: GET /api/v1/ue5/scenario-bundle, GET /api/v1/ue5/building-damage-grid, WS /api/v1/ue5/ws/stream.
