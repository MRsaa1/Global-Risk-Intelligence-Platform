# 🚀 Быстрый запуск проекта

**ВАЖНО:** Все команды выполняйте из **корня проекта** (`/Users/artur220513timur110415gmail.com/global-risk-platform`)

---

## 1️⃣ Терминал 1: Docker (если установлен)

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
docker compose up -d postgres redis neo4j minio
```

**Или пропустите**, если Docker не установлен (базы должны быть запущены локально).

---

## 2️⃣ Терминал 2: API сервер (порт 9002)

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

**Проверка:** Откройте http://localhost:9002/docs

---

## 3️⃣ Терминал 3: Web dev server (порт 5180)

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/web
npm run dev
```

**Проверка:** Откройте http://127.0.0.1:5180

---

## ✅ Готово!

- **API:** http://localhost:9002/docs
- **Web:** http://127.0.0.1:5180
- **Command Center:** http://127.0.0.1:5180/command

---

## 🌍 Omniverse, Climate, Stress Tests

- **Climate** и **Stress Tests** уже доступны (API `/api/v1/climate/*`, `/api/v1/stress-tests/*`).
- Однократный seed сценариев стресс-тестов в БД (когда API запущен):
  ```bash
  ./scripts/seed-stress-and-print-urls.sh
  ```
  Или вручную: `curl -X POST http://localhost:9002/api/v1/stress-tests/admin/seed`
- **Omniverse (E2CC)** — опционально; настройка и запуск: [docs/SETUP_OMNIVERSE_CLIMATE_STRESS.md](docs/SETUP_OMNIVERSE_CLIMATE_STRESS.md).

---

## 🛑 Остановка

В каждом терминале нажмите `Ctrl+C`

Или для Docker:
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
docker compose down
```
