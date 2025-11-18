# 🔧 Исправление проблемы с Proxy

## Проблема

При открытии `http://localhost:9000/demo` запросы идут на MinIO (порт 9001) вместо нашего API Gateway (порт 9002), что вызывает ошибку `AccessDenied`.

## Причина

Vite proxy может неправильно маршрутизировать запросы или UI делает прямые запросы без использования proxy.

## Решение

### 1. Обновлен Vite Proxy

В `apps/control-tower/vite.config.ts` добавлена более точная настройка proxy:
- `rewrite: (path) => path` - сохраняет префикс `/api`
- Обработка ошибок proxy

### 2. Проверка запросов

Убедитесь, что в коде используются относительные пути:
```typescript
// ✅ Правильно (использует proxy)
fetch('/api/v1/demo/data')

// ❌ Неправильно (прямой запрос)
fetch('http://localhost:9001/api/v1/demo/data')
```

### 3. Перезапуск UI

Если проблема сохраняется, перезапустите UI:

```bash
# Остановить UI
pkill -f "vite"

# Запустить UI
cd apps/control-tower
npm run dev
```

### 4. Проверка в браузере

Откройте DevTools (F12) → Network и проверьте:
- Запросы к `/api/*` должны идти на `localhost:9000` (Vite proxy)
- Vite автоматически проксирует их на `localhost:9002` (API Gateway)
- НЕ должно быть запросов на `localhost:9001` (MinIO)

## Проверка работы

```bash
# Проверить API Gateway напрямую
curl http://localhost:9002/api/v1/demo/data

# Проверить через Vite proxy
curl http://localhost:9000/api/v1/demo/data
```

Оба запроса должны возвращать одинаковые данные.

## Если проблема сохраняется

1. **Очистите кеш браузера**
   - Hard refresh: `Cmd+Shift+R` (Mac) или `Ctrl+Shift+R` (Windows)

2. **Проверьте консоль браузера**
   - Откройте DevTools (F12) → Console
   - Посмотрите на ошибки

3. **Проверьте Network tab**
   - DevTools → Network
   - Убедитесь, что запросы идут на правильные адреса

4. **Перезапустите все сервисы**
   ```bash
   # Остановить все
   pkill -f "vite"
   pkill -f "main-simple"
   
   # Запустить API Gateway
   cd apps/api-gateway
   npx tsx src/main-simple.ts &
   
   # Запустить UI
   cd apps/control-tower
   npm run dev &
   ```

---

**После перезапуска UI проблема должна быть решена!** ✅

