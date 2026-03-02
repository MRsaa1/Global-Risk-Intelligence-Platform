# Чеклист: тестирование с GPU локально → продакшен Contabo

Сначала тестируем всё локально с GPU; когда на 100% готово — деплоим на Contabo (без GPU, облачные API по желанию).

**Полный аудит подготовки запуска на GPU (AWS g6e.xlarge):** [GPU_LAUNCH_AUDIT.md](GPU_LAUNCH_AUDIT.md) — что сделать локально, что установить на сервере, список тестов и порядок задач.

---

## Часть 1. Что нужно протестировать с GPU

Список сценариев и проверок, которые задействуют GPU/NIM. Прогонять после того, как подготовка (Часть 2) выполнена.

| № | Что тестировать | Где проверять | Что должно быть видно при успехе |
|---|-----------------|---------------|----------------------------------|
| 1 | **FourCastNet NIM (погода)** | Command Center → внизу слева | Бейдж «GPU mode», «NIM: ✓ FourCastNet» |
| 2 | **Test weather (NIM)** | Command Center → кнопка «Test weather (NIM)» | Результат типа «4 steps from FourCastNet NIM ✓» |
| 3 | **Стресс-тест с GPU** | POST /api/v1/stress-tests/execute (или UI Run stress test) | В ответе и в отчёте: `data_sources` содержит «FourCastNet NIM (GPU)», `report_v2.gpu_services_used: ["FourCastNet NIM"]` |
| 4 | **Отчёт стресс-теста в UI** | Stress Test Report | Блок «Weather / climate: FourCastNet NIM (GPU). This run used the GPU server for AI weather forecast.» |
| 5 | **Health NVIDIA** | GET /api/v1/health/nvidia | `fourcastnet_nim.ready: true` при запущенном NIM |
| 6 | **Health detailed** | GET /api/v1/health/detailed | В `nvidia_services.fourcastnet_nim`: configured, ready |
| 7 | **Climate forecast / indicators** | GET /api/v1/climate/forecast, /climate/indicators | Ответ без ошибок; при USE_LOCAL_NIM и NIM — данные могут идти через пайплайн с NIM |
| 8 | **NVIDIA-enhanced stress test** | POST /api/v1/stress-tests/execute/nvidia | Ответ с pipeline_stages, при поднятом NIM — использование FourCastNet |
| 9 | **E2CC / Open in Omniverse** (опционально) | Command Center → кнопка «Open in Omniverse» | При настроенном E2CC_BASE_URL открывается Earth-2 Command Center; в UI бейдж «E2CC: ✓» |
| 10 | **CorrDiff NIM** (если поднят) | Data Federation / climate stress pipeline | High-resolution downscaling при вызове пайплайнов, использующих CorrDiff |
| 11 | **PhysicsNeMo** (если развёрнут локально) | Physics simulation в stress pipeline / assets | Flood/structural simulation через physics_nemo_api_url |
| 12 | **Riva TTS/STT** (если включён) | POST /api/v1/nvidia/riva/tts | Голосовой вывод без ошибок |

Минимум для уверенности, что GPU задействован: пункты 1–6 и 3–4 (один полный стресс-тест и отчёт). Остальное — по мере поднятия соответствующих сервисов.

---

## Часть 2. Что подготовить под каждый сервис для тестов

По каждому компоненту: что установить, что скачать, какие переменные и порты. Когда всё из нужного списка готово — переходим к «Включаем GPU и тестируем» (Часть 3).

### 2.0. Общая подготовка (обязательно)

| Что | Действие |
|-----|----------|
| **ОС** | Ubuntu 22.04 / 24.04 (или другая с поддержкой Docker + NVIDIA). Для AMI «Deep Learning OSS Nvidia Driver AMI GPU PyTorch 2.9 (Ubuntu 24.04)» драйвер уже есть. |
| **NVIDIA драйвер** | Должен стоять и быть виден: `nvidia-smi`. На указанной AMI уже есть. |
| **Docker** | Установлен, текущий пользователь в группе `docker`. |
| **NVIDIA Container Toolkit** | Нужен для `runtime: nvidia` в контейнерах. Установка: [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html). После установки: `sudo nvidia-ctk runtime configure --runtime=docker` и перезапуск Docker. |
| **NGC API Key** | Бесплатно: [catalog.ngc.nvidia.com](https://catalog.ngc.nvidia.com) → Setup → Generate API Key. Нужен для pull образов `nvcr.io`. |
| **Репо платформы** | Клонирован, зависимости API и Web установлены (venv, npm install). |

Проверка общей подготовки:

```bash
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

Оба должны отработать без ошибок.

---

### 2.1. FourCastNet NIM (погода для стресс-тестов и climate)

| Что | Действие |
|-----|----------|
| **Образ** | `nvcr.io/nim/nvidia/fourcastnet:latest` (скачивается при первом `docker compose up`). |
| **Скачать/запуск** | Из корня репо: `export NGC_API_KEY=ваш_ключ`, затем `docker compose -f docker-compose.nim-fourcastnet.yml up -d` (или `./scripts/start-nvidia-nim.sh` с `NIM_COMPOSE=docker-compose.nim-fourcastnet.yml`). |
| **Порт** | 8001 (хост) → 8000 (контейнер). |
| **Переменные API** | В `apps/api/.env`: `USE_LOCAL_NIM=true`, `FOURCASTNET_NIM_URL=http://localhost:8001`. |
| **Проверка** | `curl -s http://localhost:8001/v1/health/ready` → в ответе `ready`. |

Документация: [GPU_SERVER_DIFFERENCES.md](GPU_SERVER_DIFFERENCES.md), [scripts/start-nvidia-nim.sh](../scripts/start-nvidia-nim.sh).

---

### 2.2. CorrDiff NIM (high-resolution downscaling, опционально)

| Что | Действие |
|-----|----------|
| **Образ** | `nvcr.io/nim/nvidia/corrdiff:latest`. |
| **Скачать/запуск** | Вместе с FourCastNet: `docker compose -f docker-compose.nim-earth2.yml up -d`. CorrDiff на порту 8000. |
| **Порт** | 8000 (хост) → 8000 (контейнер). |
| **Переменные API** | В `apps/api/.env`: `CORRDIFF_NIM_URL=http://localhost:8000` (уже по умолчанию в config). |
| **Проверка** | `curl -s http://localhost:8000/v1/health/ready` → `ready`. |

Файл: [docker-compose.nim-earth2.yml](../docker-compose.nim-earth2.yml).

---

### 2.3. Earth-2 Command Center (E2CC) — для Digital Twin / «Open in Omniverse»

Опционально. Нужен только если тестируем кнопку «Open in Omniverse» и визуализацию в E2CC.

| Что | Действие |
|-----|----------|
| **Репо** | `git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git`, затем `git lfs pull`. |
| **Зависимости** | `git-lfs`, `xvfb`; исправление версий расширений в `.kit` (см. [E2CC_ON_SERVER_AND_STRESS_TESTS.md](E2CC_ON_SERVER_AND_STRESS_TESTS.md)). |
| **Сборка** | `./build.sh --release --no-docker` в `e2cc`. |
| **Запуск** | Xvfb + `deploy_e2cc.sh -s` (или по инструкции в репо). Слушает порт 8010. |
| **Переменные API** | В `apps/api/.env`: `E2CC_BASE_URL=http://localhost:8010`. |
| **Проверка** | В браузере открыть `http://localhost:8010` (или порт-форвард); в Command Center бейдж «E2CC: ✓». |

Документация: [E2CC_ON_SERVER_AND_STRESS_TESTS.md](E2CC_ON_SERVER_AND_STRESS_TESTS.md). Требует время на сборку и GPU.

---

### 2.4. FLUX NIM (генерация изображений для REPORTER, опционально)

| Что | Действие |
|-----|----------|
| **Образ** | `nvcr.io/nim/black-forest-labs/flux.1-dev:latest`. Может требовать HF_TOKEN. |
| **Compose** | В [docker-compose.nvidia.yml](../docker-compose.nvidia.yml) сервис `flux`, порт 8002. |
| **Переменные API** | `FLUX_NIM_URL=http://localhost:8002`. |
| **Проверка** | `curl -s http://localhost:8002/v1/health/ready`. |

---

### 2.5. PhysicsNeMo (физика: flood/structural, опционально)

В коде используется облачный API или локальный URL. Для локального теста с GPU нужен развёрнутый PhysicsNeMo NIM (образ и порт уточнять по документации NVIDIA). В config: `physics_nemo_api_url` (по умолчанию localhost:8002). Подготовка — по официальной инструкции NVIDIA для развёртывания PhysicsNeMo.

---

### 2.6. Riva (TTS/STT, опционально)

| Что | Действие |
|-----|----------|
| **Образ** | `nvcr.io/nvidia/riva/riva-speech:2.24.0`. Часто нужна предзагрузка моделей (riva_init). |
| **Порт** | 50051. |
| **Переменные API** | `ENABLE_RIVA=true`, `RIVA_URL=http://localhost:50051`. |
| **Документация** | [GTC_NVIDIA_SETUP.md](GTC_NVIDIA_SETUP.md). |

---

### 2.7. Переменные .env для API (сводка)

Минимальный набор для теста с GPU (только FourCastNet):

```bash
# apps/api/.env
USE_SQLITE=true
DATABASE_URL=sqlite:///./prod.db

# Включить локальный NIM (GPU)
USE_LOCAL_NIM=true
FOURCASTNET_NIM_URL=http://localhost:8001

# Опционально: Data Federation pipeline (weather_forecast использует NIM)
USE_DATA_FEDERATION_PIPELINES=true
```

Если поднимаете Earth-2 (FourCastNet + CorrDiff):

```bash
USE_LOCAL_NIM=true
FOURCASTNET_NIM_URL=http://localhost:8001
CORRDIFF_NIM_URL=http://localhost:8000
```

Для E2CC:

```bash
E2CC_BASE_URL=http://localhost:8010
```

LLM (executive summary, агенты) работает по облаку при заданном `NVIDIA_API_KEY`; для локального теста GPU можно не задавать ключ, тогда часть сценариев будет с mock/fallback.

---

## Часть 3. Когда всё на 100% готово — включаем GPU и тестируем

Последовательность после завершения подготовки.

1. **Убедиться, что общая подготовка выполнена** (драйвер, Docker, NVIDIA Container Toolkit, NGC_API_KEY, репо и зависимости).
2. **Запустить нужные NIM-контейнеры** (как минимум FourCastNet):
   ```bash
   export NGC_API_KEY=ваш_ключ
   docker compose -f docker-compose.nim-fourcastnet.yml up -d
   # подождать ~1 мин, затем:
   curl -s http://localhost:8001/v1/health/ready
   ```
3. **Прописать в `apps/api/.env`** переменные из п. 2.7 (как минимум `USE_LOCAL_NIM=true`, `FOURCASTNET_NIM_URL=http://localhost:8001`).
4. **Запустить API и Web** (из корня репо, как обычно):
   ```bash
   cd apps/api && source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 9002
   cd apps/web && npm run dev
   ```
5. **Прогнать тесты из Части 1** по порядку (health/nvidia, Command Center GPU badge, Test weather (NIM), один стресс-тест, отчёт в UI).
6. **Зафиксировать результат** (скрин или запись, что в отчёте есть «FourCastNet NIM (GPU)»).
7. **Для продакшена на Contabo:** не поднимать NIM на сервере, в `.env` на Contabo оставить `USE_LOCAL_NIM=false` (или не задавать). Деплой как обычно (`./deploy-safe.sh`). Платформа будет использовать Open-Meteo и облачные API; стресс-тесты и отчёты работают без GPU.

---

## Краткая таблица: что тестируем / что готовим

| Сервис | Тестируем (Часть 1) | Готовим (Часть 2) |
|--------|---------------------|-------------------|
| FourCastNet NIM | П. 1–6, 8 | Драйвер, Docker, nvidia-container-toolkit, NGC key, compose, USE_LOCAL_NIM, FOURCASTNET_NIM_URL |
| CorrDiff NIM | П. 10 | docker-compose.nim-earth2, CORRDIFF_NIM_URL |
| E2CC / Omniverse | П. 9 | earth2-weather-analytics, xvfb, build, E2CC_BASE_URL |
| FLUX NIM | REPORTER image gen | docker-compose.nvidia flux, FLUX_NIM_URL |
| PhysicsNeMo | П. 11 | Локальный NIM по доке NVIDIA, physics_nemo_api_url |
| Riva | П. 12 | Riva образ + init, ENABLE_RIVA, RIVA_URL |

Когда всё нужное из столбца «Готовим» выполнено — переходим к Части 3 и прогоняем пункты из столбца «Тестируем».
