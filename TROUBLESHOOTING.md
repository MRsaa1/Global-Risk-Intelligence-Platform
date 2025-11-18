# 🔧 Устранение проблем

## Ошибка 403 (Access Denied) от MinIO

### Проблема
Браузер получает ошибку 403 при попытке загрузить `favicon.ico` или другие ресурсы. Ошибка приходит от MinIO (S3-совместимое хранилище), а не от нашего API Gateway.

### Решение

1. **API Gateway обрабатывает favicon.ico**
   - Добавлен обработчик для `/favicon.ico` в `main-simple.ts`
   - Возвращает 204 (No Content) вместо ошибки

2. **Vite Proxy настроен правильно**
   - Все запросы к `/api/*` проксируются на `http://localhost:9002`
   - Остальные запросы обрабатываются Vite dev server

3. **Проверка портов**
   - UI: `9000` ✅
   - API Gateway: `9002` ✅
   - MinIO: `9001` (не используется нашей системой)

### Если проблема сохраняется

1. **Очистите кеш браузера**
   - Hard refresh: `Cmd+Shift+R` (Mac) или `Ctrl+Shift+R` (Windows/Linux)

2. **Проверьте, что API Gateway запущен**
   ```bash
   curl http://localhost:9002/health
   ```
   Должен вернуть: `{"status":"ok","timestamp":"..."}`

3. **Проверьте, что UI запущен**
   ```bash
   lsof -ti:9000
   ```
   Должен показать процесс

4. **Перезапустите сервисы**
   ```bash
   # Остановить API Gateway
   pkill -f "main-simple"
   
   # Запустить API Gateway
   cd apps/api-gateway
   npx tsx src/main-simple.ts
   ```

### Проверка работы

```bash
# Health check
curl http://localhost:9002/health

# Demo data
curl http://localhost:9002/api/v1/demo/data

# Favicon (должен вернуть 204)
curl -I http://localhost:9002/favicon.ico
```

---

## Другие возможные проблемы

### Порт занят
Если порт 9000 или 9002 занят:
```bash
# Проверить, что занимает порт
lsof -ti:9000
lsof -ti:9002

# Остановить процесс
kill $(lsof -ti:9000)
```

### CORS ошибки
Если видите CORS ошибки в консоли браузера:
- API Gateway уже настроен с `cors: { origin: '*' }`
- Проверьте, что запросы идут через Vite proxy (`/api/*`)

### WebSocket не работает
- WebSocket использует тот же порт, что и API Gateway (9002)
- Проверьте, что Socket.IO сервер запущен (в полной версии `main.ts`)

---

**Система должна работать без ошибок 403 после этих исправлений!** ✅

