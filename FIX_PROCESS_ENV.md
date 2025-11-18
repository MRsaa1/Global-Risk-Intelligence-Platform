# 🔧 Исправление ошибки "Can't find variable: process"

## Проблема

Белый экран и ошибка:
```
ReferenceError: Can't find variable: process
```

## Причина

В Vite (в отличие от Create React App) переменные окружения доступны через `import.meta.env`, а не через `process.env`. Использование `process.env` в браузерном коде вызывает ошибку, так как `process` не определен в браузере.

## Решение

Все использования `process.env` заменены на `import.meta.env`:

### Изменения

1. **apps/control-tower/src/services/api.ts**
   ```typescript
   // ❌ Было
   baseURL: process.env.REACT_APP_API_URL || 'http://localhost:9002/api'
   
   // ✅ Стало
   baseURL: import.meta.env.VITE_API_URL || 'http://localhost:9002/api'
   ```

2. **apps/control-tower/src/pages/Login.tsx**
   ```typescript
   // ❌ Было
   const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:9002';
   
   // ✅ Стало
   const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9002';
   ```

3. **apps/control-tower/src/components/Layout.tsx**
   ```typescript
   // ❌ Было
   process.env.REACT_APP_WS_URL || 'http://localhost:9002'
   
   // ✅ Стало
   import.meta.env.VITE_WS_URL || 'http://localhost:9002'
   ```

4. **apps/control-tower/src/hooks/useWebSocket.ts**
   ```typescript
   // ❌ Было
   url || 'http://localhost:9002'
   
   // ✅ Стало
   url || import.meta.env.VITE_WS_URL || 'http://localhost:9002'
   ```

5. **apps/control-tower/src/pages/CalculationDetail.tsx**
   - Все `process.env.REACT_APP_*` заменены на `import.meta.env.VITE_*`

## Vite переменные окружения

В Vite переменные окружения должны:
- Начинаться с `VITE_` (не `REACT_APP_`)
- Быть доступны через `import.meta.env.VITE_*`

### Пример .env файла (опционально)

```env
VITE_API_URL=http://localhost:9002
VITE_WS_URL=http://localhost:9002
```

## Проверка

После перезапуска UI:
1. Откройте http://localhost:9010/demo
2. Белый экран должен исчезнуть
3. Ошибка "Can't find variable: process" не должна появляться

## Если проблема сохраняется

1. **Очистите кеш браузера**
   - Hard refresh: `Cmd+Shift+R` (Mac) или `Ctrl+Shift+R` (Windows)

2. **Проверьте консоль браузера**
   - Откройте DevTools (F12) → Console
   - Убедитесь, что нет других ошибок

3. **Перезапустите UI**
   ```bash
   # Остановить
   pkill -f "vite"
   
   # Запустить
   cd apps/control-tower
   npm run dev
   ```

---

**Проблема должна быть решена после перезапуска UI!** ✅

