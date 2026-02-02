# Окончательная настройка: Omniverse, Climate, Stress Tests

Инструкция по запуску **Omniverse (E2CC)**, **Climate API** и **Stress Tests** в платформе.

---

## 1. Стэк (без Java)

Платформа работает на **Python (API)** и **Node/TypeScript (Web)**. Java в проекте не используется.  
Если для **Earth-2 Command Center (E2CC)** или DFM нужна Java — установите её отдельно по [документации NVIDIA](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics).

---

## 2. Climate (климат) — уже работает

**API:** `GET /api/v1/climate/*`  
Источник по умолчанию: **Open-Meteo** (без API-ключа).

### Проверка

```bash
# Прогноз (широта, долгота, дни)
curl -s "http://localhost:9002/api/v1/climate/forecast?latitude=52.52&longitude=13.405&days=5" | head -c 500

# Индикаторы климатического риска
curl -s "http://localhost:9002/api/v1/climate/indicators?latitude=52.52&longitude=13.405"
```

В веб-интерфейсе климат используется в аналитике, цифровых двойниках и симуляциях.

---

## 3. Stress Tests (стресс-тесты)

**API:** `GET /api/v1/stress-tests/scenarios/library`, `GET /api/v1/stress-tests/scenarios/extended`  
**UI:** Command Center → кнопка **Stress Test** → выбор сценария (NGFS, EBA, Fed, климат, геополитика и т.д.).

### Однократный seed сценариев в БД (рекомендуется после первого запуска API)

```bash
# После запуска API (порт 9002):
curl -X POST "http://localhost:9002/api/v1/stress-tests/admin/seed"
# Ответ: {"status":"success","message":"Stress tests seeded","inserted":N}
```

Сценарии из реестра (library + extended) доступны и без seed; seed нужен для сохранения тестов в БД и для полного UI.

### Проверка

```bash
# Библиотека сценариев (регуляторные)
curl -s "http://localhost:9002/api/v1/stress-tests/scenarios/library"

# Расширенные сценарии по категориям
curl -s "http://localhost:9002/api/v1/stress-tests/scenarios/extended"
```

### Запуск стресс-теста из UI

1. Откройте **Command Center:** https://risk.saa-alliance.com/command (или http://localhost:5180/command).
2. Нажмите **Stress Test** (или «Выбрать сценарий»).
3. Выберите сценарий (например, NGFS SSP5-8.5, Flood Extreme, Heat Stress).
4. Запустите расчёт; зоны риска отобразятся на глобусе и в панелях.

---

## 4. Omniverse (E2CC) — опционально

**E2CC (Earth-2 Command Center)** — отдельное приложение на Omniverse Kit для визуализации погоды/климата. Платформа только отдаёт **URL для запуска** (кнопка «Open in Omniverse»).

### 4.1. Настройка URL E2CC в API

В `apps/api/.env` (или переменных окружения):

```env
# URL приложения E2CC (локальный или развёрнутый)
E2CC_BASE_URL=http://localhost:8010
```

Для продакшена замените на фактический URL E2CC (например, после деплоя).

### 4.2. Установка и запуск NIM (FourCastNet, CorrDiff) — одна команда

Конфигурация контейнеров уже в репозитории. Нужны: **Docker**, **NVIDIA Container Toolkit**, **GPU**, **NGC API Key**.

**Вариант 1 — скрипт (рекомендуется):**

```bash
cd /path/to/global-risk-platform

# Один раз: создать .env.nvidia и вписать NGC_API_KEY (из catalog.ngc.nvidia.com → Setup → Generate API Key)
cp .env.nvidia.example .env.nvidia
# Отредактировать .env.nvidia: NGC_API_KEY=ваш_ключ

# Установка и запуск (pull + up)
./scripts/start-nvidia-nim.sh
```

По умолчанию поднимаются только **FourCastNet** (порт 8001) и **CorrDiff** (порт 8000). Полный набор (FLUX, PyG) — задать `NIM_COMPOSE=docker-compose.nvidia.yml` перед скриптом.

**Вариант 2 — вручную:**

```bash
export NGC_API_KEY=ваш_ngc_ключ
echo $NGC_API_KEY | docker login nvcr.io -u '$oauthtoken' --password-stdin
docker compose -f docker-compose.nim-earth2.yml pull
docker compose -f docker-compose.nim-earth2.yml up -d
```

После запуска NIM в **apps/api/.env** добавить и перезапустить API:

```env
USE_LOCAL_NIM=true
```

### 4.3. Запуск самого E2CC (Omniverse Kit)

E2CC не входит в этот репозиторий. Установка по [OMNIVERSE_E2CC_SETUP.md](./OMNIVERSE_E2CC_SETUP.md):

1. Установить [Omniverse Launcher](https://www.nvidia.com/en-us/omniverse/) и Kit.
2. Клонировать и собрать [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics).
3. Запустить E2CC по инструкциям blueprint (обычно на порту 8010 или как указано в их docs).
4. В платформе кнопка **«Open in Omniverse»** откроет `E2CC_BASE_URL?region=...&scenario=...`.

---

## 5. Быстрый запуск всего (Climate + Stress Tests без Omniverse)

```bash
# Терминал 1 — API
cd apps/api
source .venv/bin/activate
export USE_SQLITE=true
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002

# Терминал 2 — Web
cd apps/web
npm run dev

# Однократно — seed стресс-тестов (когда API уже поднят)
curl -X POST "http://localhost:9002/api/v1/stress-tests/admin/seed"
```

Откройте:

- **Command Center (стресс-тесты):** http://localhost:5180/command  
- **API Docs:** http://localhost:9002/docs  
- **Climate:** запросы к `/api/v1/climate/*` из Swagger или из UI.

---

## 6. Чеклист

| Компонент        | Как проверить |
|------------------|----------------|
| **Climate**      | `GET /api/v1/climate/forecast?latitude=52.52&longitude=13.405&days=3` |
| **Stress library** | `GET /api/v1/stress-tests/scenarios/library` |
| **Stress extended** | `GET /api/v1/stress-tests/scenarios/extended` |
| **Stress seed**  | `POST /api/v1/stress-tests/admin/seed` → `"inserted": N` |
| **Omniverse launch** | `GET /api/v1/omniverse/launch?scenario=NGFS_SSP5_2050` → `launch_url` |
| **E2CC**         | Локально: запуск приложения E2CC по earth2-weather-analytics docs |

После выполнения шагов выше **Climate** и **Stress Tests** настроены и запущены; **Omniverse** — по желанию, через E2CC и при необходимости NIM.
