# Исправление проблем на сервере

## 🔍 Обнаруженные проблемы

### 1. ❌ Frontend пытается подключиться к `localhost:9002`
**Проблема:** `AlertPanel.tsx` использует хардкод `http://localhost:9002`  
**Решение:** ✅ Исправлено - теперь использует относительный путь `/api/v1`

### 2. ❌ Climate endpoints возвращают 404
**Проблема:** `/api/v1/climate/indicators` и `/api/v1/climate/forecast` не найдены  
**Причина:** Возможно, router не зарегистрирован или сервер не перезапущен после обновления

### 3. ❌ Stress test execute возвращает 500
**Проблема:** `/api/v1/stress-tests/execute` требует `city_name` и `event_id`  
**Причина:** Frontend может не отправлять эти поля

### 4. ⚠️ WebSocket не подключается
**Проблема:** `ws://localhost:9002/api/v1/alerts/ws` не работает  
**Решение:** ✅ Исправлено - теперь использует правильный WebSocket URL

---

## 🔧 Что нужно сделать на сервере

### Шаг 1: Перезапустить backend (чтобы подхватить изменения)

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123

# Остановить backend
pkill -f "uvicorn src.main:app.*9002"

# Запустить заново
cd ~/global-risk-platform/apps/api
source .venv/bin/activate
export USE_SQLITE=true
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &

# Проверить, что запустился
sleep 2
ps aux | grep "uvicorn.*9002" | grep -v grep
```

### Шаг 2: Проверить доступность endpoints

```bash
# Проверить health
curl http://localhost:9002/api/v1/health

# Проверить climate endpoints
curl "http://localhost:9002/api/v1/climate/indicators?latitude=50.1&longitude=8.68"
curl "http://localhost:9002/api/v1/climate/forecast?latitude=50.1&longitude=8.68&days=3"

# Проверить список всех endpoints
curl http://localhost:9002/openapi.json | python3 -m json.tool | grep -E "\"/api/v1" | head -20
```

### Шаг 3: Пересобрать и перезапустить frontend (с исправлениями)

```bash
# На сервере
cd ~/global-risk-platform/apps/web

# Остановить frontend
pkill -f "vite preview.*5180"

# Пересобрать (чтобы подхватить исправления в AlertPanel.tsx)
npm run build

# Запустить заново
nohup npm run preview -- --host 0.0.0.0 --port 5180 > /tmp/web.log 2>&1 &

# Проверить
sleep 2
ps aux | grep "vite preview.*5180" | grep -v grep
```

---

## 📋 Изменения, которые нужно синхронизировать

### Исправленные файлы:

1. ✅ `apps/web/src/components/AlertPanel.tsx`
   - Изменён `API_BASE` с `http://localhost:9002` на относительный путь
   - Исправлен `WS_BASE` для правильной работы WebSocket

### Файлы для проверки:

2. ⚠️ `apps/api/src/api/v1/router.py`
   - Проверить, что `climate.router` зарегистрирован
   - Проверить, что все endpoints доступны

---

## 🔍 Диагностика

### Проверить логи backend:

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 'tail -100 /tmp/api.log | grep -E "ERROR|Exception|Traceback|404|500"'
```

### Проверить логи frontend:

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 'tail -50 /tmp/web.log'
```

### Проверить процессы:

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 'ps aux | grep -E "uvicorn|vite" | grep -v grep'
```

---

## ✅ Ожидаемый результат

После исправлений:

1. ✅ Frontend подключается к API через относительный путь `/api/v1`
2. ✅ WebSocket подключается через правильный URL
3. ✅ Climate endpoints работают (`/api/v1/climate/indicators`, `/api/v1/climate/forecast`)
4. ✅ Stress test execute работает (или возвращает понятную ошибку)
5. ✅ Нет ошибок `ERR_CONNECTION_REFUSED` в консоли браузера

---

## 🚀 Быстрое исправление

Выполните на сервере:

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 << 'ENDSSH'
cd ~/global-risk-platform

# Перезапустить backend
pkill -f "uvicorn src.main:app.*9002"
cd apps/api
source .venv/bin/activate
export USE_SQLITE=true
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &

# Пересобрать и перезапустить frontend
pkill -f "vite preview.*5180"
cd ../web
npm run build
nohup npm run preview -- --host 0.0.0.0 --port 5180 > /tmp/web.log 2>&1 &

echo "✅ Services restarted"
ENDSSH
```

---

**После этого нужно синхронизировать исправленный `AlertPanel.tsx` на сервер.**
