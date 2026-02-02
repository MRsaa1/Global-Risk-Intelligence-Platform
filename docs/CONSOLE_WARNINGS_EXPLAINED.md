# Пояснение к предупреждениям в консоли

Кратко, откуда берутся сообщения и что с ними делать.

---

## 1. `[DEPRECATED] Default export is deprecated. Instead use import { create } from 'zustand'`

**Что это:** zustand 4 помечает старый способ импорта как устаревший. Кто-то использует `import zustand from 'zustand'` вместо `import { create } from 'zustand'`.

**Откуда:** Не из нашего кода. В `platformStore.ts` и `collaborationStore.ts` уже используется правильный импорт `import { create } from 'zustand'`. Предупреждение идёт из **зависимости** (чаще всего из **@react-three/fiber**), у которой в bundle остался старый импорт.

**Что делать:**
- В `package.json` уже стоит zustand `^5.0.0` и override, чтобы все пакеты использовали одну версию. Выполните в `apps/web`: **`npm install`**. После этого предупреждение может исчезнуть (в v5 default export убран).
- Если после обновления что-то ломается — можно вернуть `"zustand": "^4.5.7"` и просто игнорировать это предупреждение до обновления библиотек.

Подробнее: [docs/ZUSTAND_DEPRECATION.md](./ZUSTAND_DEPRECATION.md).

---

## 2. `THREE.WebGLRenderer: Context Lost.`

**Что это:** Браузер/драйвер отобрал WebGL-контекст у канваса (переключение вкладок, нехватка GPU, слишком много 3D/WebGL на странице).

**Откуда:** Обычно из Three.js (Viewer3D, BIMViewer) или из xeokit (XeokitBIMViewer), когда контекст реально теряется.

**Что делать:**
- В **XeokitBIMViewer** уже есть обработка: при потере контекста показывается «WebGL context lost. Restoring…», при восстановлении контекста вьюер пересоздаётся и проект перезагружается.
- Для **BIMViewer (IFC)** есть оверлей «WebGL context lost»; после восстановления контекста может понадобиться обновить страницу.
- Сообщение само по себе не «баг» — это уведомление о событии. Дальнейшие INVALID_OPERATION идут уже по потерянному контексту.

---

## 3. `WebGL: INVALID_OPERATION: uniformMatrix4fv / uniform1f / uniform3fv / … location is not from the associated program`  
   и  
   `glDrawElements: Vertex buffer is not big enough for the draw call`

**Что это:** Вызовы WebGL идут по уже **недействительному** контексту или по объектам (шейдеры, буферы), привязанным к старому контексту.

**Откуда:** Почти всегда **после** «Context Lost»: контекст потерян, а xeokit/Three.js продолжают рисовать кадр — отсюда ошибки uniform/vertex buffer.

**Что делать:**
- После восстановления контекста XeokitBIMViewer пересоздаёт вьюер и перезагружает проект — новые кадры идут уже по новому контексту, ошибки должны прекратиться.
- Если контекст не восстанавливается — закрыть лишние вкладки с 3D или перезагрузить страницу.
- Убирать эти сообщения в коде не нужно: они следствие потери контекста, а не отдельная ошибка логики.

---

## 4. `[WARN] [Component '__14']: planView property is deprecated - replaced with navMode`

**Что это:** Внутри пакета **@xeokit/xeokit-bim-viewer** какой-то компонент (например, NavCube или контрол камеры) всё ещё читает/использует старое свойство `planView`.

**Откуда:** Из кода самой библиотеки xeokit-bim-viewer, не из нашего кода. У нас в XeokitBIMViewer уже передаётся `navMode: "orbit"` и не используется `planView`.

**Что делать:** Ничего менять в нашем коде не нужно. Предупреждение исчезнет только после обновления **@xeokit/xeokit-bim-viewer** до версии, где внутренние компоненты переведены на `navMode`.

---

## 5. `BIM loaded: Object`

**Что это:** Один раз при успешной загрузке IFC-модели в BIMViewer вызывается `onLoad(metadata)`; в AssetDetail для него стоит `console.log('BIM loaded:', metadata)`.

**Что делать:** Если лог не нужен — в `AssetDetail.tsx` можно заменить `onLoad` на пустой колбэк или убрать `console.log`. Повторные логи «BIM loaded» уже исправлены (эффект загрузки не перезапускается из-за смены ссылки на `onLoad`).

---

## Итог

| Сообщение | Источник | Действие |
|-----------|----------|----------|
| zustand default export deprecated | Зависимость (fiber и др.) | `npm install` с zustand 5 или игнорировать |
| Context Lost | Браузер/GPU | Обработка в XeokitBIMViewer есть; при необходимости обновить страницу |
| INVALID_OPERATION / Vertex buffer | Следствие Context Lost | Не исправлять отдельно; исчезнут после восстановления контекста |
| planView deprecated | Внутри xeokit-bim-viewer | Ждать обновления библиотеки |
| BIM loaded | Наш `console.log` в AssetDetail | Убрать или оставить по желанию |
