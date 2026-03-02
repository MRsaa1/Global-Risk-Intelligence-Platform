# NIM, FourCastNet, Omniverse (E2CC) и отчёт GPU vs без GPU

Ответы на частые вопросы и пошаговые инструкции.

---

## 1. Что дают NIM и FourCastNet?

**NIM (NVIDIA Inference Microservices)** — способ запускать модели NVIDIA в контейнерах (Docker) с единым API. На платформе используется для погоды.

**FourCastNet** — нейросетевая модель прогноза погоды (Earth-2). Работает как NIM на GPU и даёт:

| Без NIM (только CPU/API) | С NIM (GPU) |
|--------------------------|-------------|
| Погода для стресс-тестов: Open-Meteo API или упрощённая модель | Прогноз от FourCastNet на GPU: выше точность, физически обоснованные поля (ветер, давление, осадки) |
| Нет бейджа «GPU mode» в Command Center | В UI: «GPU mode», «NIM: ✓ FourCastNet» |
| В отчёте стресс-теста: «Open-Meteo (API)» | В отчёте: **«FourCastNet NIM (GPU). This run used the GPU server for AI weather forecast.»** |
| Кнопка «Test weather (NIM)» не даёт прогноз от NIM | «Test weather (NIM)» прогоняет пайплайн weather_forecast через NIM (4 шага) |

**Итог:** NIM + FourCastNet дают AI-прогноз погоды на GPU для стресс-тестов и климатических сценариев; без них платформа использует внешний API (Open-Meteo) или упрощённую модель.

---

## 2. Как запустить Omniverse (E2CC)?

**E2CC (Earth-2 Command Center)** — приложение на базе Omniverse Kit: глобус, слои погоды/климата, таймлайн. Запускается отдельно от веб-платформы; кнопка «Open in Omniverse» в Command Center открывает его в браузере (режим streamer).

### Вариант A: E2CC ещё не установлен

**На GPU-сервере по SSH:**

```bash
cd ~/global-risk-platform
chmod +x scripts/setup-e2cc-on-server.sh
./scripts/setup-e2cc-on-server.sh
```

Скрипт ставит зависимости, клонирует [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics), правит версии расширений и собирает E2CC (10–30 мин). В конце выведет команды для запуска.

### Вариант B: E2CC уже собран — только запуск

**На сервере (в tmux или в фоне):**

```bash
cd ~/global-risk-platform
./scripts/start-e2cc.sh --background
```

Или вручную:

```bash
cd ~/earth2-weather-analytics
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX &
export DISPLAY=:99
./deploy/deploy_e2cc.sh -s
```

E2CC слушает порт **8010**.

### Связать E2CC с платформой

В **apps/api/.env** на сервере:

```bash
E2CC_BASE_URL=http://localhost:8010
```

Перезапустить API. С Mac в туннель добавить проброс 8010:

```bash
ssh -i ~/.ssh/risk-platform-g5.pem -L 15180:localhost:5180 -L 19002:localhost:9002 -L 8010:localhost:8010 ubuntu@100.30.226.186
```

В браузере кнопка «Open in Omniverse» откроет `http://127.0.0.1:8010` (или тот URL, который отдаёт E2CC).

Подробно: **docs/E2CC_ON_SERVER_AND_STRESS_TESTS.md**, **docs/OMNIVERSE_E2CC_SETUP.md**.

---

## 3. Как запустить именно платформу Earth-2 (E2CC)?

**E2CC** — это и есть визуальная часть Earth-2 (глобус + погода). Запуск — как в п. 2: `./scripts/start-e2cc.sh --background` или `./deploy/deploy_e2cc.sh -s` из каталога earth2-weather-analytics.

Наша **Global Risk Platform** (веб: Command Center, стресс-тесты, отчёты) и **E2CC** — два разных приложения:
- платформа: порты 5180 (фронт), 9002 (API);
- E2CC: порт 8010.

Оба могут работать на одном GPU-сервере; в платформе кнопка «Open in Omniverse» просто открывает E2CC по URL.

---

## 4. Как записать и сделать отчёт «с GPU» и «без GPU», чтобы была видна разница?

Платформа уже пишет в отчёт стресс-теста, использовался ли NIM (GPU) или нет. Достаточно два запуска и сравнение отчётов.

### Шаг 1: Запуск с GPU (NIM включён)

- Убедитесь: NIM запущен (`curl -s http://localhost:8001/v1/health/ready` → ready), в `.env`: `USE_LOCAL_NIM=true`, `FOURCASTNET_NIM_URL=http://localhost:8001`.
- В Command Center запустите **стресс-тест** (Run stress test), выберите сценарий, дождитесь окончания.
- Откройте **отчёт** этого запуска.

**Что сохранить/записать:**
- В начале отчёта блок: **«Weather / climate: FourCastNet NIM (GPU). This run used the GPU server for AI weather forecast.»**
- В источниках данных (Data sources): **FourCastNet NIM (GPU)**.
- При желании: скриншот отчёта или экспорт PDF, время выполнения, метрики.

### Шаг 2: Запуск без GPU (NIM выключен)

- На том же сервере остановите NIM:  
  `docker compose -f ~/global-risk-platform/docker-compose.nim-fourcastnet.yml down`  
  либо на другом окружении без NIM (например Contabo или локально без NIM).
- Перезапустите API (чтобы он перестал видеть NIM).
- Запустите **тот же сценарий** стресс-теста (тот же тип, те же параметры по возможности).
- Откройте отчёт этого запуска.

**Что будет в отчёте:**
- Нет блока про FourCastNet NIM (GPU).
- В источниках данных: **Open-Meteo (API)** или **Weather Model (simulated)**.

### Шаг 3: Сравнение

| Критерий | С GPU (NIM) | Без GPU |
|---------|-------------|---------|
| Блок в отчёте | «Weather / climate: FourCastNet NIM (GPU)...» | Нет такого блока |
| Источники данных | FourCastNet NIM (GPU) | Open-Meteo (API) или simulated |
| В API-ответе | `gpu_services_used: ["FourCastNet NIM"]`, в `data_sources` — «FourCastNet NIM (GPU)» | Нет `gpu_services_used` или пусто, в `data_sources` — Open-Meteo |

Можно оформить краткий отчёт вручную (два скрина/два PDF + таблица выше) или сохранить оба отчёта из UI и сравнить их.

### Опционально: один сценарий, два окружения

- **Окружение 1:** GPU-сервер с запущенным NIM — один стресс-тест → сохранить/скрин отчёта.
- **Окружение 2:** тот же код, но без NIM (Contabo или NIM остановлен) — тот же сценарий → сохранить отчёт.
- В итоговом документе указать: «Запуск 1 — с GPU (FourCastNet NIM), Запуск 2 — без GPU (Open-Meteo)» и приложить оба отчёта или скрины блоков «Weather / climate» и «Data sources».

Подробнее про проверки GPU: **docs/GPU_LAUNCH_AUDIT.md** (раздел 4), **docs/GPU_SERVER_DIFFERENCES.md**.
