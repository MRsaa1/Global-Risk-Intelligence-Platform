# 🔍 Проверка запущенных сервисов

## Проблема: WebSocket и API не отвечают

Если вы видите ошибки:
- `WebSocket connection failed`
- `Failed to load hotspots from API, using fallback: Error: Request timeout`

**Это означает, что API сервер не запущен!**

---

## ✅ Проверка API сервера

### 1. Проверьте, запущен ли API на порту 9002:

```bash
curl http://localhost:9002/docs
```

Или откройте в браузере: http://localhost:9002/docs

**Если не открывается** → API не запущен!

---

### 2. Запустите API сервер:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

**Должно появиться:**
```
INFO:     Uvicorn running on http://0.0.0.0:9002 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
```

---

### 3. Проверьте Web сервер:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/web
npm run dev
```

**Должно появиться:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://127.0.0.1:5180/
  ➜  Network: use --host to expose
```

---

## 🎯 Правильный порядок запуска:

1. **Терминал 1:** Docker (если есть)
2. **Терминал 2:** API сервер (порт 9002) ← **ОБЯЗАТЕЛЬНО!**
3. **Терминал 3:** Web сервер (порт 5180)

**Без API сервера фронтенд не будет работать!**
