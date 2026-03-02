# Аудит подготовки запуска на GPU (AWS g6e.xlarge)

Полный чеклист: что сделать на локальной машине, что установить и перенести на машину с GPU, какие программы протестировать и в каком порядке.

**Пошаговая инструкция «для чайников» (NGC ключ уже есть):** [GPU_LAUNCH_STEP_BY_STEP.md](GPU_LAUNCH_STEP_BY_STEP.md).

**Одной командой поднять всё на GPU:** на сервере выполнить `./scripts/start-all-gpu.sh` (поднимает Redis → NIM → API → Web; перед этим задать `NGC_API_KEY` в `apps/api/.env`).

**См. также:** [GPU_LOCAL_TESTING_CHECKLIST.md](GPU_LOCAL_TESTING_CHECKLIST.md), [GPU_SERVER_DIFFERENCES.md](GPU_SERVER_DIFFERENCES.md), [DEPLOY_SAFE.md](../DEPLOY_SAFE.md), [scripts/setup-server-gpu.sh](../scripts/setup-server-gpu.sh), [scripts/brev-start-nim.sh](../scripts/brev-start-nim.sh), [scripts/start-nvidia-nim.sh](../scripts/start-nvidia-nim.sh).

---

## Контекст

- **Инстанс:** AWS g6e.xlarge (4 vCPU, 1x NVIDIA GPU, Ubuntu 24.04).
- **AMI:** Deep Learning OSS Nvidia Driver AMI GPU PyTorch 2.9 (Ubuntu 24.04) — драйвер и PyTorch уже в образе.
- **Цель:** поднять платформу на GPU с NIM (FourCastNet), проверить все сценарии, при необходимости перенести конфиг/код с локальной машины.

---

## 1. Что сделать на локальной машине (до переноса на GPU)

| Задача | Действие |
|--------|-----------|
| Репозиторий | Клонировать/обновить `global-risk-platform`, убедиться что ветка актуальна. |
| NGC API Key | Зарегистрироваться на [catalog.ngc.nvidia.com](https://catalog.ngc.nvidia.com) → Setup → Generate API Key. Хранить в безопасном месте (на GPU-сервер передать через переменную или `.env.nvidia`). |
| Шаблон .env для API | Скопировать [apps/api/.env.example](../apps/api/.env.example) в `apps/api/.env` (локально для проверки). На GPU-сервер `.env` не копировать по соображениям безопасности (см. [DEPLOY_SAFE.md](../DEPLOY_SAFE.md)) — на сервере создать/восстановить из бэкапа. |
| Список переменных для GPU | Выписать переменные для GPU (см. раздел 3 ниже) в отдельный файл/заметку и на сервере вписать в `apps/api/.env` вручную. |
| (Опционально) Локальная проверка без GPU | По [QUICK_START.md](../QUICK_START.md): поднять API (port 9002) и Web (port 5180), проверить `/docs`, Command Center. Без NIM бейдж «GPU mode» не появится — норма. |

**Что не переносить с локальной машины на GPU:** готовый `.env` с секретами (на сервер только свои ключи и значения). Базы `*.db` — по желанию (если нужны те же данные, их бэкапят/восстанавливают отдельно по [DEPLOY_SAFE.md](../DEPLOY_SAFE.md)).

---

## 2. Что «скачать» / установить на машине с GPU (AWS g6e.xlarge)

Все шаги выполняются **на инстансе** (SSH на приватный/публичный IP после запуска).

### 2.0. Общая подготовка (обязательно)

| Что | Действие |
|-----|----------|
| NVIDIA драйвер | Уже в AMI. Проверка: `nvidia-smi`. |
| Docker | Установить, если нет: `sudo apt update && sudo apt install -y docker.io`; пользователь в группу: `sudo usermod -aG docker $USER` (выйти/войти). |
| NVIDIA Container Toolkit | Нужен для `runtime: nvidia`. [Инструкция](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html). После: `sudo nvidia-ctk runtime configure --runtime=docker` и перезапуск Docker. |
| NGC API Key | Сохранить в переменной или файле (например `~/.env.ngc` с одной строкой `NGC_API_KEY=...`). Используется для `docker login nvcr.io` и pull образов NIM. |
| Код платформы | Клонировать репо на сервер: `git clone ... global-risk-platform` или перенести архив по [DEPLOY_SAFE.md](../DEPLOY_SAFE.md) (без перезаписи `.env` на сервере). |
| Зависимости API | В репо: `cd apps/api && python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"` (или по README). |
| Зависимости Web | `cd apps/web && npm ci` или `npm install`. |

Проверка общей подготовки:

```bash
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

Оба должны выполниться без ошибок.

### 2.1. Образы NIM (скачиваются на GPU-сервере через Docker)

| Образ | Файл compose | Порт | Назначение |
|-------|----------------|------|------------|
| FourCastNet NIM | [docker-compose.nim-fourcastnet.yml](../docker-compose.nim-fourcastnet.yml) | 8001 | Погода для стресс-тестов и climate (обязательный минимум). |
| CorrDiff NIM (опционально) | [docker-compose.nim-earth2.yml](../docker-compose.nim-earth2.yml) | 8000 | High-res downscaling. |
| FLUX NIM (опционально) | [docker-compose.nvidia.yml](../docker-compose.nvidia.yml) | 8002 | Генерация изображений. |

Скачивание и запуск только FourCastNet (минимум):

```bash
export NGC_API_KEY=ваш_ключ
echo "$NGC_API_KEY" | docker login nvcr.io -u '$oauthtoken' --password-stdin
cd ~/global-risk-platform
docker compose -f docker-compose.nim-fourcastnet.yml pull
docker compose -f docker-compose.nim-fourcastnet.yml up -d
# или скрипт: ./scripts/start-nvidia-nim.sh  (NIM_COMPOSE=docker-compose.nim-fourcastnet.yml)
```

Проверка: `curl -s http://localhost:8001/v1/health/ready` → в ответе `ready`.

### 2.2. Что не нужно «качать» на локальную машину для GPU

- Образы NIM (`nvcr.io/...`) качаются **только на сервере с GPU** через `docker compose pull` (с настроенным NGC).
- E2CC (Earth-2 Command Center) — опционально, собирается на сервере из репо [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics) по [E2CC_ON_SERVER_AND_STRESS_TESTS.md](E2CC_ON_SERVER_AND_STRESS_TESTS.md).

---

## 3. Переменные окружения API на GPU-сервере (apps/api/.env)

Минимальный набор для работы с NIM (вписать в `apps/api/.env` на сервере):

```bash
# База (если без внешних БД)
USE_SQLITE=true
DATABASE_URL=sqlite:///./prod.db

# GPU / NIM
USE_LOCAL_NIM=true
FOURCASTNET_NIM_URL=http://localhost:8001

# Опционально: пайплайны (weather_forecast использует NIM)
USE_DATA_FEDERATION_PIPELINES=true
```

Опционально: CorrDiff — `CORRDIFF_NIM_URL=http://localhost:8000`. E2CC — `E2CC_BASE_URL=http://localhost:8010`. Riva — `ENABLE_RIVA=true`, `RIVA_URL=...`. Полный список — [GPU_LOCAL_TESTING_CHECKLIST.md](GPU_LOCAL_TESTING_CHECKLIST.md) (раздел 2.7) и [DEPLOY_FULL.md](DEPLOY_FULL.md).

---

## 4. Полный список программ/сценариев для тестирования

После запуска API и Web на GPU-сервере прогнать по порядку (по [GPU_LOCAL_TESTING_CHECKLIST.md](GPU_LOCAL_TESTING_CHECKLIST.md), Часть 1):

| № | Что тестировать | Где проверять | Критерий успеха |
|---|-----------------|---------------|------------------|
| 1 | FourCastNet NIM (погода) | Command Center, внизу слева | Бейдж «GPU mode», «NIM: ✓ FourCastNet» |
| 2 | Test weather (NIM) | Command Center → кнопка «Test weather (NIM)» | Результат «4 steps from FourCastNet NIM ✓» |
| 3 | Стресс-тест с GPU | POST /api/v1/stress-tests/execute или UI Run stress test | В ответе и отчёте: `data_sources` с «FourCastNet NIM (GPU)», `report_v2.gpu_services_used: ["FourCastNet NIM"]` |
| 4 | Отчёт стресс-теста в UI | Stress Test Report | Блок «Weather / climate: FourCastNet NIM (GPU)...» |
| 5 | Health NVIDIA | GET /api/v1/health/nvidia | `fourcastnet_nim.ready: true` |
| 6 | Health detailed | GET /api/v1/health/detailed | В `nvidia_services.fourcastnet_nim`: configured, ready |
| 7 | Climate forecast / indicators | GET /api/v1/climate/forecast, /climate/indicators | Ответ без ошибок |
| 8 | NVIDIA-enhanced stress test | POST /api/v1/stress-tests/execute/nvidia | Ответ с pipeline_stages, при NIM — использование FourCastNet |
| 9 | E2CC / Open in Omniverse | Command Center → «Open in Omniverse» | При настроенном E2CC — бейдж «E2CC: ✓» (опционально) |
| 10 | CorrDiff NIM | Data Federation / climate stress | High-res downscaling (опционально) |
| 11 | PhysicsNeMo | Stress pipeline / assets | Если развёрнут (опционально) |
| 12 | Riva TTS/STT | POST /api/v1/nvidia/riva/tts | Голос без ошибок (опционально) |

Минимум для уверенности в работе GPU: пункты 1–6 и 3–4 (один полный стресс-тест + отчёт в UI).

---

## 5. Порядок задач (краткий сценарий запуска)

1. **Локально:** репо, NGC key, список переменных для `apps/api/.env`.
2. **На GPU-сервере:** установить Docker + NVIDIA Container Toolkit; проверить `nvidia-smi` и `docker run --gpus all ...`.
3. **На GPU-сервере:** склонировать/перенести код, поставить зависимости API и Web.
4. **На GPU-сервере:** задать `NGC_API_KEY`, запустить NIM: `docker compose -f docker-compose.nim-fourcastnet.yml up -d`, проверить `curl localhost:8001/v1/health/ready`.
5. **На GPU-сервере:** создать/отредактировать `apps/api/.env` (USE_LOCAL_NIM, FOURCASTNET_NIM_URL, при необходимости USE_DATA_FEDERATION_PIPELINES).
6. **На GPU-сервере:** запустить API (uvicorn port 9002) и Web (npm run dev или build + serve), при необходимости через screen/tmux или systemd.
7. **Тестирование:** пройти пункты 1–12 из таблицы выше (минимум 1–6 и 3–4).

Опционально: один раз выполнить на сервере [scripts/setup-server-gpu.sh](../scripts/setup-server-gpu.sh) — он допишет в `apps/api/.env` нужные ключи и создаст [scripts/check-server-gpu.sh](../scripts/check-server-gpu.sh) для быстрой проверки NIM/API/DFM/E2CC.

---

## 6. Полезные файлы и ссылки

| Документ | Назначение |
|----------|------------|
| [GPU_LOCAL_TESTING_CHECKLIST.md](GPU_LOCAL_TESTING_CHECKLIST.md) | Полный чеклист тестов и подготовка по каждому сервису (NIM, E2CC, FLUX, Riva и т.д.). |
| [GPU_SERVER_DIFFERENCES.md](GPU_SERVER_DIFFERENCES.md) | Чем отличается сервер с GPU (бейджи, отчёты, API). |
| [DEPLOY_SAFE.md](../DEPLOY_SAFE.md) | Деплой кода на сервер без перезаписи .env и баз. |
| [scripts/start-nvidia-nim.sh](../scripts/start-nvidia-nim.sh) | Запуск NIM (FourCastNet или earth2 compose). |
| [scripts/start-all-gpu.sh](../scripts/start-all-gpu.sh) | **Поднять всё на GPU:** Redis → NIM → API → Web одной командой. |
| [scripts/setup-server-gpu.sh](../scripts/setup-server-gpu.sh) | Настройка .env и проверочного скрипта на GPU-сервере. |
| [scripts/check-server-gpu.sh](../scripts/check-server-gpu.sh) | Проверка NIM, API, DFM, E2CC (создаётся setup-server-gpu.sh). |

---

## 7. Итоговый список: что загрузить/установить где

| Где | Что |
|-----|-----|
| **Локальная машина** | Репозиторий; NGC API Key (хранить безопасно); список переменных для `apps/api/.env`; при необходимости — шаблон `.env` и бэкап баз для восстановления на сервере. |
| **Машина с GPU** | Docker + NVIDIA Container Toolkit; код платформы (git clone или архив по DEPLOY_SAFE); Python venv и зависимости API; Node и зависимости Web; образы NIM (через `docker compose -f docker-compose.nim-fourcastnet.yml pull` после `NGC_API_KEY` и `docker login nvcr.io`); файл `apps/api/.env` с переменными (создать/восстановить на сервере, не копировать готовый .env с локальной машины). |

После выполнения плана на GPU-сервере будут доступны Command Center с бейджем «GPU mode», стресс-тесты с FourCastNet NIM (GPU) в отчётах и прохождение всех обязательных тестов из таблицы в разделе 4.
