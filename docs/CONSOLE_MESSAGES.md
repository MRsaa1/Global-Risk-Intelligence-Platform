# Пояснение сообщений в консоли браузера

## Не из приложения (расширения браузера)

| Сообщение | Источник | Действие |
|-----------|----------|----------|
| `Port connected` (inject.js) | Расширение (например, кошелёк, React DevTools) | Игнорировать |
| `[Violation] Permissions policy violation: unload is not allowed` (inject.js) | Расширение | Игнорировать или отключить расширение на localhost |
| `SES Removing unpermitted intrinsics` (lockdown-install.js) | Расширение (например, MetaMask/SES) | Игнорировать |

## Из приложения

| Сообщение | Значение |
|-----------|----------|
| `Download the React DevTools...` | Рекомендация установить React DevTools. Не ошибка. |
| `CesiumGlobe: Rotation enabled`, `✅ Cesium Globe initialized`, `✅ NASA Black Marble loaded`, и т.д. | Нормальная инициализация глобуса и слоёв. |
| `WebSocket connecting to: ws://...` / `WebSocket connected` | Подключение к стримингу API. Всё в порядке. |
| `onOpenDigitalTwin called`, `City clicked: Madrid`, `Digital Twin: Loading 3D model...`, `✅ Google Photorealistic 3D Tiles loaded` | Открытие Digital Twin и загрузка 3D для города. Ожидаемое поведение. |
| `CesiumGlobe: Rendering paused` | Рендер глобуса приостановлен (например, при открытом Digital Twin). Нормально. |

## Предупреждение Cesium (3D Tiles)

```
The tiles needed to meet maximumScreenSpaceError would use more memory than allocated for this tileset.
The tileset will be rendered with a larger screen space error (see memoryAdjustedScreenSpaceError).
Consider using larger values for cacheBytes and maximumCacheOverflowBytes.
```

**Что это:** Cesium хочет подгрузить больше тайлов для заданной детализации, чем разрешено лимитом кэша. Он автоматически рисует тайлсет с чуть большим `screen space error` (меньше детализация), чтобы уложиться в память.

**Нужно ли чинить:** Обычно нет. Визуально разница небольшая. Если хочется убрать предупреждение или дать больше детализации — в коде для этого тайлсета можно увеличить `maximumMemoryUsage` (в опциях `Cesium3DTileset` / Google Photorealistic). Уже сделано для глобуса и Digital Twin; при необходимости лимит можно поднять ещё.
