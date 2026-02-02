# Сервер с GPU (saaaliance) — климатические стресс-тесты и Omniverse Earth-2

Краткая схема и чеклист для тестирования климатических стресс-тестов на городах и связи с платформой Omniverse Earth-2 (E2CC).

---

## Архитектура (да, всё так)

| Компонент | Где | Назначение |
|-----------|-----|------------|
| **Платформа (API + Web)** | Сервер saaaliance (89.169.99.0) | Стресс-тесты по городам, метрики, рекомендации, отчёты |
| **FourCastNet NIM** | Тот же сервер, GPU (порт 8001) | AI-прогноз погоды для климатических сценариев и пайплайна `weather_forecast` |
| **Earth-2 Command Center (E2CC)** | Тот же сервер (или отдельный с GPU) | Omniverse-визуализация: глобус, погода, сценарии. **Должна быть связана с проектом** через `E2CC_BASE_URL` |

Правильно: платформа развёрнута на сервере с GPU; климатические стресс-тесты считаются по городам и выдают метрики и рекомендации; **Omniverse Earth-2 (E2CC) должна запускаться и быть связана с проектом** — тогда кнопка «Open in Omniverse» открывает визуализацию и можно смотреть те же сценарии/регионы.

---

## Что уже должно быть на saaaliance

1. **Код платформы**  
   `~/global-risk-platform` (API в `apps/api`, Web в `apps/web`).

2. **API**  
   Запущен (например `uvicorn` на порту 9002).  
   В **apps/api/.env** на сервере желательно:
   ```env
   USE_DATA_FEDERATION_PIPELINES=true
   USE_LOCAL_NIM=true
   FOURCASTNET_NIM_URL=http://localhost:8001
   ```

3. **FourCastNet NIM на GPU**  
   Контейнер/сервис на порту 8001. Проверка:
   ```bash
   curl -s http://localhost:8001/v1/health/ready
   # ожидается: {"status":"ready"} или аналог
   ```

4. **Web**  
   Доступен (через nginx или порт, например 63243 или 80).

---

## Климатические стресс-тесты: метрики и рекомендации

- **Где запускать:** Command Center → выбор города/зоны → Stress Test (или страница Stress Planner / отчёты).
- **Что даёт платформа:** сценарии (NGFS, Flood, Heat, Wildfire и т.д.), метрики по зонам, региональный план действий, сравнение с историческими событиями, executive summary и рекомендации в отчёте (PDF/UI).
- **Использование NIM:** при включённых DFM-пайплайнах и доступном NIM климатические сценарии могут подтягивать прогноз погоды через пайплайн `weather_forecast` (FourCastNet на GPU).

Проверка, что API и сценарии отвечают:
```bash
curl -s http://localhost:9002/api/v1/stress-tests/scenarios/library | jq '.[0:3]'
curl -s http://localhost:9002/api/v1/data-federation/status | jq .
```

---

## Запуск и связь Omniverse Earth-2 (E2CC) с проектом

E2CC — отдельное приложение (Omniverse Kit). Его нужно **запустить на сервере с GPU** и **связать с нашим проектом** через URL.

### Шаг 1. Установка и запуск E2CC (на saaaliance)

На той же машине (или другой с GPU), где уже стоит окружение для Omniverse:

```bash
# Клонирование blueprint (если ещё не сделано)
git lfs install
git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git
cd earth2-weather-analytics
git lfs fetch --all
```

**Режим для связи с платформой — streamer** (чтобы открывать E2CC из браузера по кнопке «Open in Omniverse»):

```bash
./deploy/deploy_e2cc.sh -s
```

В логах или документации blueprint будет указан URL стримера (часто `http://localhost:8010`). Если доступ снаружи нужен по IP/домену — настройте Port Forward или прокси на этот порт.

### Шаг 2. Связать E2CC с проектом (E2CC_BASE_URL)

В **apps/api/.env** на сервере saaaliance задайте URL, по которому доступен E2CC:

```env
# Локально на сервере:
E2CC_BASE_URL=http://localhost:8010

# Или по внешнему адресу (после Port Forward / nginx):
# E2CC_BASE_URL=http://89.169.99.0:8010
# E2CC_BASE_URL=https://your-e2cc-domain.com
```

После этого:
- `GET /api/v1/omniverse/status` вернёт `e2cc_configured: true` (если URL не localhost) или по логике вашего конфига.
- Кнопки «Omniverse» / «Open in Omniverse» в Command Center будут открывать этот URL с параметрами `region`, `scenario`, `lat`, `lon` — E2CC получит контекст нашего сценария/города.

### Шаг 3. Перезапуск API

```bash
cd ~/global-risk-platform/apps/api
source .venv/bin/activate
pkill -f "uvicorn src.main:app" 2>/dev/null; nohup uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
```

Или через ваш скрипт деплоя (например `./scripts/brev-deploy.sh`).

---

## Краткий чеклист

| Задача | Действие |
|--------|----------|
| Тестировать климатические стресс-тесты по городам | Command Center / Stress Planner → выбрать город и климатический сценарий → смотреть метрики и рекомендации в отчёте |
| Прогноз погоды через GPU (NIM) | Убедиться: NIM на 8001, в `.env` — `USE_LOCAL_NIM=true`, `FOURCASTNET_NIM_URL=http://localhost:8001`, `USE_DATA_FEDERATION_PIPELINES=true`; в UI — кнопка «Test weather (NIM)» внизу слева |
| Запустить платформу Omniverse Earth-2 | Установить и запустить E2CC в режиме streamer: `./deploy/deploy_e2cc.sh -s` |
| Связать E2CC с проектом | Задать `E2CC_BASE_URL` в `apps/api/.env`, перезапустить API; кнопка «Open in Omniverse» откроет E2CC с контекстом региона/сценария |

Подробнее по установке E2CC и вариантам (десктоп/streamer/DFM): **docs/OMNIVERSE_E2CC_SETUP.md**.  
По пайплайнам и переменным окружения: **docs/DFM_OMNIVERSE_PLAN.md**, **apps/api/.env.brev.example**.
