# InitScene / Entry

Точки входа приложения и начальная сцена (InitScene).

## Web (React)

- **Entry**: `apps/web/index.html` → `main.tsx` → `App.tsx`.
- **main.tsx**: инициализация React Query, BrowserRouter, analytics, рендер `<App />`.
- **App.tsx**: объявление маршрутов (React Router); корень `/` → redirect на `/command`; маршруты `/command`, `/dashboard`, `/regulator`, модули, страницы стресс-тестов, BCP, и т.д.
- **Layout**: общий layout с сайдбаром и WebSocket (`usePlatformWebSocket`) оборачивает роуты; одна точка входа в «сцену» — выбранный маршрут (Command Center, Dashboard, Regulator Mode и др.).

## Command Center (глобус / 3D)

- **InitScene**: первая загрузка Command Center (`/command`) — начальное состояние глобуса (камера, слои) задаётся в `CommandCenter.tsx` и связанных компонентах (Cesium/globe). Нет отдельного контракта «InitScene»; сцена определяется состоянием store (например, `platformStore`) и параметрами сцены при первом монтировании.
- **Entry в контекст стресс-теста**: запуск стресс-теста из Command Center или из Stress Planner — entry point в сценарий (scenario id, параметры). Связь Command Center ↔ Dashboard через единый store и WebSocket (см. `docs/COMMAND_DASHBOARD_SYNC.md`).

## API

- **Entry**: ASGI (Uvicorn) → `src.main.app`; роуты подключаются через `api_router` в `src.api.v1.router`. Health: `GET /api/v1/health`.

## Итог

- **Частично**: веб entry и маршруты есть; InitScene как отдельный контракт (например, JSON с начальной камерой/слоями) не выделен — начальная сцена задаётся кодом Command Center. При необходимости можно ввести явный InitScene (например, endpoint или конфиг с default camera position и layer visibility) для единообразия и тестов.
