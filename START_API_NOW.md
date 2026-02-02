# 🚀 БЫСТРЫЙ ЗАПУСК API

## ❌ Проблема: API не запущен

Ошибки в логах Vite:
- `[vite] api proxy: EPIPE (is API on :9002 running?)`
- `[vite] ws proxy error: Error: read ECONNRESET`

**Это означает: API сервер не запущен на порту 9002**

---

## ✅ РЕШЕНИЕ: Запустите API в отдельном терминале

### Шаг 1: Откройте НОВЫЙ терминал

**Не закрывайте терминал с `npm run dev`!** Откройте второй терминал.

### Шаг 2: Запустите API

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

### Шаг 3: Проверьте

Вы должны увидеть:
```
INFO:     Uvicorn running on http://0.0.0.0:9002 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Шаг 4: Обновите страницу в браузере

После запуска API обновите страницу (Cmd+R или Ctrl+R).

---

## 🔍 Если API не запускается

### Ошибка импорта?

Если видите ошибку типа:
```
ModuleNotFoundError: No module named 'src.services.nemo_retriever'
```

**Исправление:**
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
python -c "import sys; print(sys.path)"
python -c "from src.services.nemo_retriever import get_nemo_retriever_service; print('OK')"
```

Если ошибка - пришлите полный текст ошибки.

### Ошибка синтаксиса?

Если видите:
```
SyntaxError: ...
```

**Исправление:**
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
python -m py_compile src/services/nemo_retriever.py
python -m py_compile src/services/nemo_guardrails.py
python -m py_compile src/layers/agents/analyst.py
python -m py_compile src/layers/agents/advisor.py
```

Если есть ошибки - пришлите их.

---

## 📋 Полная команда для копирования

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api && source .venv/bin/activate && uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

---

## ✅ После успешного запуска

1. **API работает** - видите `Uvicorn running on http://0.0.0.0:9002`
2. **Vite подключается** - ошибки `EPIPE` и `ECONNRESET` исчезают
3. **WebSocket работает** - в браузере нет ошибок WebSocket
4. **Hotspots загружаются** - нет ошибки `Request timeout`

---

## 🔄 Автоматический запуск (для будущего)

Чтобы не запускать вручную каждый раз:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
./start-all-services.sh
```

Это запустит API в фоне с автоперезапуском.

---

**Сейчас: запустите API вручную в новом терминале!**
