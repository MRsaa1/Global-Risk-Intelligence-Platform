# 🚀 ЗАПУСК ВСЕХ СЕРВИСОВ С НУЛЯ

## ❌ Проблема: ERR_CONNECTION_REFUSED

Сайт `127.0.0.1` не доступен - сервисы не запущены.

---

## ✅ РЕШЕНИЕ: Запустите 2 терминала

### 📋 Терминал 1: API сервер (порт 9002)

**Откройте новый терминал и выполните:**

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

**✅ Успешный запуск выглядит так:**
```
INFO:     Uvicorn running on http://0.0.0.0:9002 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

**⚠️ Если порт занят:**
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
./kill-port-9002.sh
```
Затем запустите API снова.

---

### 📋 Терминал 2: Web сервер (порт 5180)

**Откройте ВТОРОЙ терминал и выполните:**

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/web
npm run dev
```

**✅ Успешный запуск выглядит так:**
```
VITE v5.4.21  ready in 176 ms

➜  Local:   http://127.0.0.1:5180/
```

---

## 🔍 Проверка

### 1. Проверьте API:
```bash
curl http://127.0.0.1:9002/api/v1/health
```

Должен вернуть: `{"status":"healthy"}`

### 2. Откройте в браузере:
- **Web UI:** http://127.0.0.1:5180
- **API Docs:** http://127.0.0.1:9002/docs

---

## ⚠️ Важно

1. **Оба терминала должны быть открыты одновременно**
2. **Не закрывайте терминалы** - сервисы работают в них
3. **Если закрыли терминал** - сервис остановился, нужно запустить снова

---

## 🛑 Остановка

В каждом терминале нажмите `Ctrl+C`

---

## 🔄 Автоматический запуск (альтернатива)

Если хотите запустить в фоне:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
./start-all-services.sh
```

Затем проверьте логи:
```bash
tail -f logs/api.log
tail -f logs/web.log
```

---

## 📝 Быстрая команда для копирования

**Терминал 1 (API):**
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api && source .venv/bin/activate && uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

**Терминал 2 (Web):**
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/web && npm run dev
```

---

**Сейчас: откройте 2 терминала и запустите оба сервиса!**
