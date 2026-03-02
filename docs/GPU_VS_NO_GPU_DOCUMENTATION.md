# Работа системы на GPU и без GPU — описание и сравнение

Документ описывает, как работает платформа **с GPU** (NVIDIA NIM) и **без GPU**, и как зафиксировать/продемонстрировать разницу.

---

## 0. Реальные ли метрики онлайн?

**Частично.** Зависит от источника и конфигурации:

| Что | Реальные данные? | Откуда |
|-----|-------------------|--------|
| **Threat Feed (GDELT)** | Да, при работающем scheduler и доступе к GDELT | Пайплайн каждые ~15 мин, статьи в реальном времени |
| **Market Ticker (VIX, SPX и т.д.)** | Да | Yahoo Finance через `market_data_job`, каждые 5 мин |
| **Погода в стресс-тесте с GPU** | Да (инференс на GPU) | FourCastNet NIM на сервере |
| **Погода без GPU** | Да (внешний API) или заглушка | Open-Meteo и др. при настроенных пайплайнах; иначе mock |
| **Метрики отчёта V2 (VaR, CVaR, RTO, контагион)** | **Индикативные** | Считаются по формулам от `total_loss` и типа события; не из полного Monte Carlo / живого графа. См. [STRESS_TEST_REPORT_V2_METRICS.md](STRESS_TEST_REPORT_V2_METRICS.md). |
| **Risk posture, алерты, зоны** | Зависят от данных | При поднятых ingestion и заполненной БД — ближе к реальным; иначе seed/demo |

Итог: **онлайн в смысле «сняты с работающей системы»** — да (если API и scheduler настроены). **Полностью валидированные производные метрики (VaR/CVaR и т.п.)** — пока индикативные, не аудит-уровень.

---

## 0.1 Снимки «с GPU» и «без GPU»

**Готовых скриншотов в репозитории нет.** Документ только описывает, *что* снять. Чтобы задукоментировать разницу:

1. Снять снимки **по инструкции в разд. 4** (Command Center с GPU, отчёт с блоком NIM, то же без GPU).
2. Сохранить их, например, в `docs/screenshots/` (папку можно добавить в репо; при необходимости добавить в `.gitignore` большие бинарники и хранить ссылки в документе).

После этого в документе можно указать: «См. `docs/screenshots/gpu-command-center.png` и `docs/screenshots/no-gpu-command-center.png`».

---

## 1. Режим «С GPU» (GPU-сервер)

### Условия

- Сервер с NVIDIA GPU (например AWS G5/G6, инстанс типа g6e.xlarge).
- Установлены: Docker, NVIDIA Container Toolkit, драйвер (`nvidia-smi` работает).
- Запущен контейнер **FourCastNet NIM** на порту 8001.
- В `apps/api/.env` заданы:
  - `USE_LOCAL_NIM=true`
  - `FOURCASTNET_NIM_URL=http://localhost:8001`
  - `USE_DATA_FEDERATION_PIPELINES=true` (опционально, для пайплайнов с NIM)
  - `NGC_API_KEY=...` (для pull образа NIM).

### Что работает иначе

| Область | С GPU |
|--------|--------|
| **Погода для стресс-тестов** | Прогноз строится через **FourCastNet NIM** (модель на GPU). |
| **Command Center** | Бейдж **«GPU mode»**, строка **«NIM: ✓ FourCastNet»**. Кнопка **«Test weather (NIM)»** активна и возвращает результат от NIM. |
| **Стресс-тест (execute)** | В ответе API и в сохранённом отчёте: `data_sources` содержит **«FourCastNet NIM (GPU)»**, `report_v2.gpu_services_used: ["FourCastNet NIM"]`. |
| **Отчёт стресс-теста (UI)** | Блок **«Weather / climate: FourCastNet NIM (GPU). This run used the GPU server for AI weather forecast.»** |
| **Health** | `GET /api/v1/health/nvidia` → `fourcastnet_nim.ready: true`; `GET /api/v1/nvidia/nim/health` → `fourcastnet: { status: "healthy" }`. |

### Как поднять

1. Войти на GPU-сервер (см. [GPU_SERVER_ACCESS.md](GPU_SERVER_ACCESS.md)).
2. На сервере: `cd ~/global-risk-platform && ./scripts/start-all-gpu.sh` (поднимает Redis → NIM → API → Web).
3. С локальной машины: туннель `ssh -i ... -L 15180:localhost:5180 -L 19002:localhost:9002 ubuntu@<IP>` и браузер: http://127.0.0.1:15180/command?api=http://127.0.0.1:19002 .

---

## 2. Режим «Без GPU» (локально, Contabo, сервер без NIM)

### Условия

- Запущены только API (uvicorn) и Web (vite/nginx). NIM не запущен, либо в `.env`: `USE_LOCAL_NIM=false` или не задан `FOURCASTNET_NIM_URL`.

### Что работает иначе

| Область | Без GPU |
|--------|--------|
| **Погода для стресс-тестов** | Используются открытые API (Open-Meteo и др.) или заглушки; **FourCastNet не вызывается**. |
| **Command Center** | Бейджа **«GPU mode»** нет. **«NIM: ✗»** или не отображается. Кнопка «Test weather (NIM)» неактивна или возвращает ошибку/fallback. |
| **Стресс-тест (execute)** | В `data_sources` **нет** строки «FourCastNet NIM (GPU)». `report_v2.gpu_services_used` пустой или отсутствует. |
| **Отчёт стресс-теста (UI)** | Блока про «FourCastNet NIM (GPU)» **нет**; указаны только не-GPU источники. |
| **Health** | `GET /api/v1/health/nvidia` → `fourcastnet_nim.ready: false` или сервис не настроен. |

Функциональность платформы (стресс-тесты, отчёты, алерты, дашборды) сохраняется; меняется только источник погоды и наличие GPU-меток в UI/API.

---

## 3. Сводная таблица сравнения

| Критерий | С GPU (NIM запущен) | Без GPU (NIM не используется) |
|----------|----------------------|----------------------------------|
| Бейдж «GPU mode» в Command Center | Есть | Нет |
| NIM: ✓ FourCastNet | Да | Нет (✗ или скрыто) |
| Кнопка «Test weather (NIM)» | Работает, ответ от NIM | Неактивна или fallback |
| Источник погоды в стресс-тесте | FourCastNet NIM (GPU) | Open-Meteo / другие API или mock |
| `data_sources` в ответе стресс-теста | Содержит «FourCastNet NIM (GPU)» | Без этой строки |
| `report_v2.gpu_services_used` | `["FourCastNet NIM"]` | Пусто или отсутствует |
| Блок в отчёте «Weather / climate: FourCastNet NIM (GPU)» | Есть | Нет |
| GET /api/v1/health/nvidia (fourcastnet_nim) | ready: true | ready: false / не настроен |
| Требования к железу | Сервер с NVIDIA GPU, Docker, образ NIM | Только API + Web (CPU) |

---

## 4. Как задукоментировать и продемонстрировать разницу

### 4.1 Сценарий «С GPU»

1. Поднять всё на GPU-сервере: `./scripts/start-all-gpu.sh` (в туннеле открыть Command Center).
2. В Command Center проверить: бейдж **GPU mode**, **NIM: ✓ FourCastNet**.
3. Нажать **«Test weather (NIM)»** — сохранить скриншот или текст ответа («4 steps from FourCastNet NIM ✓»).
4. Запустить стресс-тест (любой сценарий), открыть отчёт — сделать скриншот блока **«Weather / climate: FourCastNet NIM (GPU)»**.
5. Вызвать API: `GET /api/v1/health/nvidia` и `GET /api/v1/nvidia/nim/health` — сохранить ответы (или скрин из Swagger).
6. В ответе `POST /api/v1/stress-tests/execute` проверить наличие `data_sources` с «FourCastNet NIM (GPU)» и `report_v2.gpu_services_used`.

### 4.2 Сценарий «Без GPU»

1. Локально (или на Contabo/сервере без NIM): запустить только API и Web (`uvicorn` + `vite preview`), **не** запускать NIM и не задавать `USE_LOCAL_NIM=true` с рабочим URL.
2. В Command Center убедиться: бейджа **GPU mode** нет, NIM не в статусе «ready».
3. «Test weather (NIM)» — неактивна или ошибка/fallback — скриншот.
4. Запустить тот же стресс-тест — в отчёте **нет** блока про FourCastNet NIM.
5. `GET /api/v1/health/nvidia` — `fourcastnet_nim.ready: false` (или аналог) — сохранить.

### 4.3 Артефакты для документации

- **С GPU:** скриншоты Command Center (бейдж + NIM ✓), отчёт стресс-теста с блоком NIM, примеры ответов `/health/nvidia` и поля `gpu_services_used` в execute.
- **Без GPU:** те же экраны без бейджа и без блока NIM в отчёте, ответ health без ready NIM.
- Краткая таблица (раздел 3 выше) может быть вынесена в презентацию или тех. спецификацию.

---

## 5. Ссылки

| Документ | Назначение |
|----------|------------|
| [GPU_VS_NO_GPU_FULL_ANALYSIS_REPORT.md](GPU_VS_NO_GPU_FULL_ANALYSIS_REPORT.md) | **Полный анализ** с архитектурой, код-путями, конфигом и сценариями проверки. |
| [GPU_SERVER_DIFFERENCES.md](GPU_SERVER_DIFFERENCES.md) | Детали отличий UI и API на GPU. |
| [GPU_SERVER_ACCESS.md](GPU_SERVER_ACCESS.md) | SSH, туннель, деплой на ваш GPU-сервер. |
| [GPU_LAUNCH_AUDIT.md](GPU_LAUNCH_AUDIT.md) | Полный чеклист подготовки и тестов на GPU. |
| [GPU_LOCAL_TESTING_CHECKLIST.md](GPU_LOCAL_TESTING_CHECKLIST.md) | Пошаговые проверки NIM, E2CC, здоровья. |
