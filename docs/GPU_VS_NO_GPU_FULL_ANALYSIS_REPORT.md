# Полный анализ: работа платформы с GPU и без GPU

**Дата отчёта:** 2025-02-25  
**Версия платформы:** 1.5.0  
**Цель:** Сводный анализ режимов «с GPU» (NVIDIA NIM) и «без GPU», код, конфигурация и сценарии проверки.

---

## 1. Резюме

| Аспект | С GPU (NIM на сервере) | Без GPU |
|--------|------------------------|---------|
| **Погода в реальном времени** | FourCastNet NIM (инференс на GPU), пайплайн `weather_forecast` и эндпоинт `POST /nim/fourcastnet/forecast` | Open-Meteo API или mock; NIM не вызывается |
| **Стресс-тест (execute)** | Пайплайн использует Earth-2 cloud API или mock; отчёт помечается `gpu_services_used: ["FourCastNet NIM"]` и `data_sources` с «FourCastNet NIM (GPU)», если NIM доступен | Без меток GPU, в отчёте Open-Meteo (API) или mock |
| **Command Center** | Бейдж «GPU mode», «NIM: ✓ FourCastNet», кнопка «Test weather (NIM)» возвращает прогноз от NIM | Без бейджа, NIM ✗ или скрыт |
| **Health** | `GET /api/v1/health/nvidia` → `fourcastnet_nim.ready: true` | `fourcastnet_nim.ready: false` или не настроен |
| **Требования** | Сервер с NVIDIA GPU, Docker, образ FourCastNet NIM, `USE_LOCAL_NIM=true`, `FOURCASTNET_NIM_URL` | Только API + Web (CPU), без NIM |

Функциональность (стресс-тесты, отчёты, алерты, дашборды) сохраняется в обоих режимах; различаются источник погоды, наличие GPU-меток в UI/API и рекомендации в health.

---

## 1.1 Расчёты, скорость, точность, объём — что одинаково, что нет

| Аспект | Одинаково? | Пояснение |
|--------|------------|-----------|
| **Расчёты риска (зоны, потери, VaR/CVaR)** | Да | Один и тот же код: risk zone calculator, формулы в отчёте V2, cascade simulation. Не зависят от GPU. |
| **Скорость execute стресс-теста** | Почти да | В execute погоду даёт Earth-2 cloud или mock в обоих режимах; основной объём — БД, зоны, опционально LLM. Разница только если подставить в execute погоду из NIM (сейчас не сделано). |
| **Точность погоды в execute** | Да (сейчас) | И с GPU, и без GPU в цепочке execute используется один источник: Earth-2 API или mock. Точность не меняется от наличия NIM. |
| **Точность погоды в пайплайне weather_forecast / кнопка Test weather** | Нет | С GPU — FourCastNet NIM (модель на GPU); без GPU — Open-Meteo или mock. Здесь точность и источник различаются. |
| **Объём/throughput** | Частично | NIM на GPU позволяет много запросов погоды локально без лимитов внешнего API; без GPU — ограничения Open-Meteo и т.п. Остальные сервисы (БД, LLM cloud) — лимиты те же. |
| **Работа остальных сервисов** | Да | БД, Redis, Neo4j, LLM (NVIDIA cloud), алерты, дашборды, ingestion — одни и те же, от наличия GPU не зависят. |

**Итог:** Одинаковы — логика расчётов риска, работа всех сервисов кроме NIM, текущая точность и скорость в execute. Различаются — источник и точность погоды в пайплайне weather_forecast и в эндпоинте NIM, метки «GPU» в отчёте и UI, возможность локального инференса погоды без внешних лимитов.

---

## 1.2 Где в платформе показаны данные FourCastNet (NIM)

| Место | Что показывается |
|--------|-------------------|
| **Command Center** (нижняя панель, слева) | Бейдж **«GPU mode»**, строка **«NIM: ✓ FourCastNet»** (или ✗), кнопка **«Test weather (NIM)»**. После нажатия — краткий результат рядом с кнопкой: *«N steps from FourCastNet NIM ✓»* (число шагов прогноза). **Числовые данные погоды** (температура, осадки, ветер) в UI **не выводятся** — только факт успешного ответа и количество шагов. |
| **Отчёт стресс-теста** (Report 2.0, блок после методологии) | Если запуск был с GPU и NIM доступен: блок **«Weather / climate: FourCastNet NIM (GPU). This run used the GPU server for AI weather forecast.»** — только указание, что использовался GPU, **без таблицы или графиков погоды** от NIM. |
| **API** | `POST /api/v1/nvidia/nim/fourcastnet/forecast` возвращает полный массив `forecasts` (forecast_time, temperature_k, wind_u_ms, wind_v_ms, precipitation_mm по шагам). Эти данные можно использовать в своих скриптах или доработать UI. |
| **Command Center — раздел «Данные прогноза»** | После нажатия **«Test weather (NIM)»** под блоком NIM/DFM появляется панель **«FourCastNet NIM — данные прогноза»**: таблица по шагам (время, T °C, осадки мм, ветер м/с), координаты и модель. Кнопка «✕» закрывает панель. |

Итог: в платформе **видны** факт использования NIM (бейдж, строка, блок в отчёте), число шагов после «Test weather» и **таблица данных прогноза** (температура, осадки, ветер по шагам) в Command Center после успешного запуска «Test weather (NIM)».

---

## 2. Методология анализа

- Просмотр кода: `apps/api/src/services/nvidia_nim.py`, `nvidia_services_status.py`, `nvidia_stress_pipeline.py`, `nvidia_earth2.py`, `data_federation/pipelines/weather_forecast.py`, `api/v1/endpoints/stress_tests.py`, `health.py`, `nvidia.py`.
- Конфигурация: `apps/api/src/core/config.py`, `apps/api/.env.example`.
- Фронт: Command Center — запросы к `/nvidia/nim/health` и кнопка «Test weather (NIM)».
- Документация: `docs/GPU_VS_NO_GPU_DOCUMENTATION.md`, `GPU_SERVER_ACCESS.md`.

---

## 3. Архитектура по режимам

### 3.1 Режим «С GPU»

```
[Браузер] → Command Center (бейдж GPU, NIM ✓)
                ↓
[API] GET /health/nvidia, GET /nvidia/nim/health  → nvidia_services_status, nim_service.check_health
[API] POST /nvidia/nim/fourcastnet/forecast       → nim_service.fourcastnet_forecast() → Docker NIM :8001
[API] Data Federation: weather_forecast pipeline  → adapter "nim" (NIM) → fallback adapter "weather" (Open-Meteo)
[API] POST /stress-tests/execute                 → nvidia_stress_pipeline.execute() → earth2_service (cloud/mock)
                                                 → при сохранении отчёта: если nim_service.check_health("fourcastnet")
                                                    → report_v2.gpu_services_used = ["FourCastNet NIM"]
                                                    → data_sources += "FourCastNet NIM (GPU)"
```

- **Сервисы:** Redis (опционально), FourCastNet NIM (Docker, порт 8001), API (uvicorn), Web (Vite/nginx).
- **Конфиг:** `USE_LOCAL_NIM=true`, `FOURCASTNET_NIM_URL=http://localhost:8001`, при необходимости `USE_NIM_WEATHER=true`, `NGC_API_KEY` для pull образа.

### 3.2 Режим «Без GPU»

```
[Браузер] → Command Center (без бейджа GPU, NIM ✗)
                ↓
[API] GET /health/nvidia  → fourcastnet_nim.ready: false или не настроен
[API] POST /nvidia/nim/fourcastnet/forecast → 503 или mock (если use_local=False → _mock_fourcastnet)
[API] Data Federation: weather_forecast     → adapter "weather" (Open-Meteo и т.д.) или пустой результат
[API] POST /stress-tests/execute              → тот же nvidia_stress_pipeline.execute() → earth2 (cloud/mock);
                                               при сохранении отчёта nim_used=false → data_sources += "Open-Meteo (API)"
```

- **Сервисы:** только API + Web (NIM не запущен или не сконфигурирован).
- **Конфиг:** `USE_LOCAL_NIM=false` или не задан `FOURCASTNET_NIM_URL`.

---

## 4. Код: где используется GPU/NIM

| Компонент | Файл | Поведение с GPU | Поведение без GPU |
|-----------|------|------------------|-------------------|
| NIM сервис | `nvidia_nim.py` | `use_local=True`, вызов `fourcastnet_url/v1/infer`, при ошибке → mock | `use_local=False` или пустой URL → сразу `_mock_fourcastnet` |
| Health NIM | `nvidia_services_status.py` | `_check_nim_ready(fourcastnet_url)` → ready: true/false | Не вызывается или ready: false |
| Weather pipeline | `weather_forecast.py` | Если `use_local_nim` и `use_nim_weather` → adapter "nim" (FourCastNet) | adapter "weather" (Open-Meteo и др.) |
| Stress execute | `stress_tests.py` | После выполнения: если `use_local_nim` и `nim_service.check_health("fourcastnet")` → gpu_services_used, data_sources += "FourCastNet NIM (GPU)" | nim_used=false → data_sources += "Open-Meteo (API)" |
| Stress pipeline (погода) | `nvidia_stress_pipeline.py` | `earth2_service.get_weather_forecast()` — облачный Earth-2 API или mock (не локальный NIM) | То же (источник погоды в execute не переключается на NIM в текущей реализации) |
| Command Center | `CommandCenter.tsx` | Запрос `/nvidia/nim/health` → бейдж GPU, «NIM: ✓», кнопка Test weather (NIM) | NIM не ready → без бейджа, кнопка неактивна или fallback |

Важно: в цепочке **execute** стресс-теста погоду даёт **Earth-2 cloud API** (или mock), а не локальный NIM. Метки «GPU» в отчёте означают, что **на сервере доступен NIM** (проверка health), а не что именно этот запуск использовал NIM для погоды в пайплайне execute.

---

## 5. Конфигурация

| Переменная | С GPU | Без GPU |
|------------|--------|---------|
| `USE_LOCAL_NIM` | `true` | `false` или не задана |
| `FOURCASTNET_NIM_URL` | `http://localhost:8001` (или адрес контейнера) | пусто или не задана |
| `USE_NIM_WEATHER` | `true` (по умолчанию) | можно `false` |
| `NGC_API_KEY` | задан (для pull NIM) | не обязателен |
| `NVIDIA_API_KEY` | опционально (Earth-2 cloud, LLM) | опционально |

Остальные сервисы (Redis, БД, Neo4j, LLM cloud и т.д.) от режима GPU не зависят.

---

## 6. API и UI: сводная таблица

| Проверка | С GPU | Без GPU |
|----------|--------|---------|
| `GET /api/v1/health/nvidia` → fourcastnet_nim | configured: true, ready: true | ready: false или не настроен |
| `GET /api/v1/nvidia/nim/health` | fourcast: { status: "healthy" } | ошибка или status не healthy |
| Command Center: бейдж «GPU mode» | Есть | Нет |
| Command Center: «NIM: ✓ FourCastNet» | Да | Нет (✗ или скрыто) |
| Кнопка «Test weather (NIM)» | Успешный ответ (steps from FourCastNet NIM ✓) | Неактивна или ошибка/fallback |
| `POST /stress-tests/execute` → data_sources | Содержит «FourCastNet NIM (GPU)» при готовности NIM | «Open-Meteo (API)» |
| `POST /stress-tests/execute` → report_v2.gpu_services_used | `["FourCastNet NIM"]` | пусто или отсутствует |
| Отчёт стресс-теста (UI): блок про погоду/GPU | «Weather / climate: FourCastNet NIM (GPU)» | Нет такого блока |

---

## 7. Сценарии проверки (воспроизведение)

### 7.1 Сценарий «С GPU»

1. Войти на GPU-сервер (см. [GPU_SERVER_ACCESS.md](GPU_SERVER_ACCESS.md)).
2. На сервере: `cd ~/global-risk-platform && ./scripts/start-all-gpu.sh` (Redis → NIM → API → Web).
3. Локально: туннель `ssh -L 15180:localhost:5180 -L 19002:localhost:9002 ubuntu@<IP>`.
4. Браузер: http://127.0.0.1:15180/command?api=http://127.0.0.1:19002 .
5. Проверить: бейдж GPU, NIM ✓, «Test weather (NIM)» → ответ с шагами FourCastNet.
6. Запустить стресс-тест → открыть отчёт: блок «Weather / climate: FourCastNet NIM (GPU)», в API в ответе execute — `gpu_services_used`, `data_sources` с «FourCastNet NIM (GPU)».
7. Сохранить ответы: `GET /api/v1/health/nvidia`, `GET /api/v1/nvidia/nim/health`.

### 7.2 Сценарий «Без GPU»

1. Локально (или сервер без NIM): только API + Web, без запуска NIM; в `.env`: `USE_LOCAL_NIM=false` или не задавать `FOURCASTNET_NIM_URL`.
2. Открыть Command Center: нет бейджа GPU, NIM не в статусе ready.
3. «Test weather (NIM)» — неактивна или ошибка.
4. Тот же стресс-тест → в отчёте нет блока про FourCastNet NIM; в ответе execute — нет `gpu_services_used`, в `data_sources` — «Open-Meteo (API)».
5. Сохранить: `GET /api/v1/health/nvidia` → fourcastnet_nim.ready: false.

### 7.3 Артефакты для отчёта/демо

- **С GPU:** скриншоты Command Center (бейдж + NIM ✓), отчёт стресс-теста с блоком NIM, примеры JSON `/health/nvidia` и поля `gpu_services_used` в execute.
- **Без GPU:** те же экраны без бейджа и без блока NIM; ответ health без ready NIM.
- Таблицы из разд. 1, 6 можно вынести в презентацию или тех. спецификацию.

### 7.4 Скрипты для автоматической проверки

| Скрипт | Назначение |
|--------|------------|
| `scripts/gpu-test-local.sh` | Вызов health/nvidia и nvidia/nim/health на **локальном** API (без GPU); сохранение в `docs/gpu-test-artifacts/local/`. |
| `scripts/gpu-test-gpu.sh` | То же на API **с GPU** (через туннель: `BASE_URL=http://127.0.0.1:19002`); сохранение в `docs/gpu-test-artifacts/gpu/`. |
| `scripts/gpu-test-compare.sh` | Сравнение артефактов local vs gpu: NIM ready, fourcastnet status, при наличии — gpu_services_used и data_sources из execute. |

Запуск: сначала поднять API локально (без NIM), выполнить `./scripts/gpu-test-local.sh`; затем поднять API на GPU-сервере, туннель, выполнить `BASE_URL=http://127.0.0.1:19002 ./scripts/gpu-test-gpu.sh`; затем `./scripts/gpu-test-compare.sh`. Опционально: переменная `TOKEN` (JWT) для вызова POST `/stress-tests/execute` в обоих скриптах. См. `docs/gpu-test-artifacts/README.md`.

---

## 8. Выводы и рекомендации

- **Разделение режимов реализовано:** по конфигу и health чётко видно «с GPU» vs «без GPU»; UI и отчёты отражают наличие NIM.
- **Погода:** с GPU реальный инференс даёт NIM (эндпоинт forecast и пайплайн weather_forecast); в execute стресс-теста погода идёт из Earth-2 cloud или mock — при желании можно доработать подстановку погоды из NIM и в execute.
- **Метрики отчёта V2 (VaR, CVaR и т.д.)** остаются индикативными (см. [STRESS_TEST_REPORT_V2_METRICS.md](STRESS_TEST_REPORT_V2_METRICS.md)); режим GPU на них не переключает метод расчёта.
- **Рекомендация для полного сравнения:** провести один и тот же стресс-тест на одном и том же сценарии дважды (с GPU и без GPU), сохранить скриншоты и ответы API в `docs/screenshots/` и сослаться на них в [GPU_VS_NO_GPU_DOCUMENTATION.md](GPU_VS_NO_GPU_DOCUMENTATION.md).

---

## 9. Ссылки на документы

| Документ | Назначение |
|----------|------------|
| [GPU_VS_NO_GPU_DOCUMENTATION.md](GPU_VS_NO_GPU_DOCUMENTATION.md) | Краткое описание и таблицы сравнения, что снимать для демо |
| [GPU_SERVER_ACCESS.md](GPU_SERVER_ACCESS.md) | SSH, туннель, деплой на GPU-сервер |
| [GPU_LAUNCH_AUDIT.md](GPU_LAUNCH_AUDIT.md) | Чеклист подготовки и тестов на GPU |
| [STRESS_TEST_REPORT_V2_METRICS.md](STRESS_TEST_REPORT_V2_METRICS.md) | Метрики отчёта V2 (индикативные) |
| [docs/gpu-test-artifacts/README.md](gpu-test-artifacts/README.md) | Артефакты и скрипты gpu-test-local.sh / gpu-test-gpu.sh / gpu-test-compare.sh |
| [docs/screenshots/README.md](screenshots/README.md) | Куда класть скриншоты с/без GPU |
