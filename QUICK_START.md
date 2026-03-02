# 🚀 Быстрый запуск проекта

**ВАЖНО:** Все команды выполняйте из **корня проекта** (`/Users/artur220513timur110415gmail.com/global-risk-platform`)

⚠️ **Фронт (Vite) ходит на API по адресу `127.0.0.1:9002`.** Если видите в браузере ошибку `ECONNREFUSED 127.0.0.1:9002` или в консоли Vite `api proxy: ECONNREFUSED` — **сначала запустите API** (терминал 2), потом уже Web (терминал 3).

---

## 1️⃣ Терминал 1: Docker (если установлен)

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
docker compose up -d postgres redis neo4j minio
```

**Или пропустите**, если Docker не установлен (базы должны быть запущены локально).

При работе **без Docker** (только API + SQLite) не задавайте `ENABLE_NEO4J` или явно укажите `ENABLE_NEO4J=false` в `apps/api/.env`, иначе появятся алерты подключения к Neo4j (Knowledge Graph опционален).

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
- **Strategic Modules:** http://127.0.0.1:5180/modules (CIP, SCSS, SRO)

---

## 📦 Наполнение стратегических модулей (CIP, SCSS, SRO)

Один раз заполнить все три модуля по 6 сущностей + связи (для демо):

```bash
curl -X POST http://localhost:9002/api/v1/seed/strategic-modules
```

- **CIP:** 6 объектов инфраструктуры (энергия, вода, телеком, ЦОД, экстренные службы) + зависимости
- **SCSS:** 6 поставщиков (сырьё, компоненты, логистика) + маршруты поставок
- **SRO:** 6 финансовых институтов (банки, страховые, клиринг) + корреляции + индикаторы

Повторный вызов не дублирует данные (если в модуле уже ≥6 записей, он пропускается).

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

## ⚠️ 504 Outdated Optimize Dep / Failed to fetch dynamically imported module

Если в консоли: **504 (Outdated Optimize Dep)** (react-dom, html2canvas и т.д.) или **Failed to fetch dynamically imported module** (Dashboard, Assets и т.д.):

1. **Остановите** dev-сервер (Ctrl+C).
2. Запустите с очисткой кэша (из папки `apps/web`):
   ```bash
   npm run dev:fresh
   ```
   Или вручную: `rm -rf node_modules/.vite && npm run dev`
3. **Закройте все вкладки** с приложением и откройте http://127.0.0.1:5180 заново, либо жёсткое обновление (Cmd+Shift+R).

На экране ошибки можно нажать **«Reload page»** — полная перезагрузка страницы часто устраняет сбой.

---

## 🔤 Шрифты и стили не применились (JetBrains Mono / цвета)

Платформа использует **JetBrains Mono** (подгрузка с Google Fonts). Если видите системный шрифт или старые цвета:

1. **Жёсткое обновление:** `Ctrl+Shift+R` (Windows/Linux) или `Cmd+Shift+R` (macOS).
2. **Очистка кэша Vite и перезапуск фронта:**
   ```bash
   cd apps/web && rm -rf node_modules/.vite && npm run dev
   ```
3. **Проверка загрузки шрифтов:** DevTools → вкладка **Network** → фильтр «Font» или «All» — запросы к `fonts.googleapis.com` / `fonts.gstatic.com` должны быть со статусом 200. Если они блокируются (сеть, расширения) — будет fallback (system-ui).
4. **Прод:** пересобрать и задеплоить: `npm run build` в `apps/web`, затем выкладка актуального `dist/`.

В `index.html` добавлен критический inline-стиль и preload шрифтов, чтобы типографика применялась до загрузки бандла.

---

## 🛑 Остановка

В каждом терминале нажмите `Ctrl+C`

Или для Docker:
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
docker compose down
```
