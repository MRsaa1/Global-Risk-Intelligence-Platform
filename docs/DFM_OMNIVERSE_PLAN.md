# DFM-адаптеры, пайплайны и Omniverse-визуализация

План работ по Data Federation (DFM) и Omniverse/E2CC при запущенном GPU.

---

## 1. Текущее состояние

### DFM-адаптеры (уже есть)

| Адаптер   | Источник              | Назначение                    |
|-----------|------------------------|-------------------------------|
| `usgs`    | USGS Earthquake Catalog| Сейсмика                      |
| `weather` | Open-Meteo / погода    | Прогноз погоды                |
| `noaa`    | NOAA                   | Климат/океан                  |
| `fema`    | FEMA                   | Риски и события               |
| `cmip6`   | CMIP6                  | Климатические сценарии        |
| `nim`     | FourCastNet NIM (GPU)  | AI-прогноз погоды (NIM)       |

**API:** `GET /api/v1/data-federation/adapters` — список адаптеров.

### DFM-пайплайны (уже есть)

| Пайплайн         | Описание                                      |
|------------------|-----------------------------------------------|
| `geodata_risk`   | USGS + Weather → города → риск → hotspots    |
| `climate_stress` | Климатический стресс, overlay                 |
| `weather_forecast` | Прогноз погоды (в т.ч. NIM при GPU)        |

**API:**  
- `GET /api/v1/data-federation/pipelines` — список пайплайнов  
- `POST /api/v1/data-federation/pipelines/{id}/run` — запуск (body: region, scenario, options)

Когда **USE_DATA_FEDERATION_PIPELINES=true**, эндпоинты `/api/v1/geodata/hotspots` и `/api/v1/geodata/climate-risk` делегируют в эти пайплайны.

### Omniverse / E2CC (уже есть)

- **API:** `GET /api/v1/omniverse/launch?region=...&scenario=...&lat=...&lon=...`  
  Возвращает `{ "launch_url": "..." }` для кнопки «Open in Omniverse».
- **UI:** Command Center — кнопка «Omniverse» в шапке; в контекстной панели hotspot — «Open in Omniverse» (region + scenario).
- **Конфиг:** `E2CC_BASE_URL` (по умолчанию `http://localhost:8010`).

---

## 2. Чеклист при запущенном GPU

1. **NIM (FourCastNet / CorrDiff)**  
   - Запустить контейнеры NIM (порты 8000, 8001 и т.д.) или локальный NIM.  
   - В `.env`: при необходимости `FOURCASTNET_NIM_URL`, `USE_LOCAL_NIM=true`.

2. **Включить DFM-пайплайны**  
   В `apps/api/.env`:
   ```env
   USE_DATA_FEDERATION_PIPELINES=true
   ```
   Тогда geodata/hotspots и climate-risk будут идти через пайплайны (USGS, Weather, при наличии — NIM).

3. **E2CC (Omniverse) для визуализации**  
   Если поднят Earth-2 Command Center (Omniverse Kit):
   ```env
   E2CC_BASE_URL=http://localhost:8010
   ```
   Для удалённого E2CC подставить фактический URL.

4. **Проверка**  
   ```bash
   # Список адаптеров
   curl -s http://localhost:9002/api/v1/data-federation/adapters | jq .

   # Список пайплайнов
   curl -s http://localhost:9002/api/v1/data-federation/pipelines | jq .

   # Запуск пайплайна geodata_risk (region + options)
   curl -s -X POST http://localhost:9002/api/v1/data-federation/pipelines/geodata_risk/run \
     -H "Content-Type: application/json" \
     -d '{"region":{"lat":52.52,"lon":13.405,"radius_km":500},"options":{"min_risk":0.3}}' | jq .

   # URL для Omniverse (region + scenario + lat/lon)
   curl -s "http://localhost:9002/api/v1/omniverse/launch?region=berlin&scenario=flood&lat=52.52&lon=13.405" | jq .
   ```

---

## 3. Дальнейшие шаги (Omniverse-визуализация)

1. **E2CC-подобный слой**  
   Reference: [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics) — раздел [04_omniverse_app](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/04_omniverse_app.md).  
   Cesium остаётся веб-глобусом; тяжёлые гео/погодные сцены — в Omniverse Kit / E2CC по ссылке «Open in Omniverse».

2. **Передача контекста в E2CC**  
   В `launch_url` уже передаются `region`, `scenario`, `lat`, `lon`.  
   В E2CC-приложении — читать query-параметры и центрировать камеру/сцену на (lat, lon), подставлять сценарий.

3. **DFM и NIM**  
   Пайплайн `weather_forecast` использует адаптер `nim` при доступном NIM.  
   При запущенном GPU убедиться, что NIM доступен по `FOURCASTNET_NIM_URL` и адаптер `nim` возвращает данные (не mock).

---

## 4. Файлы в репозитории

| Компонент        | Путь |
|------------------|------|
| Адаптеры         | `apps/api/src/data_federation/adapters/` |
| Пайплайны        | `apps/api/src/data_federation/pipelines/` |
| API DFM          | `apps/api/src/api/v1/endpoints/data_federation.py` |
| API Omniverse    | `apps/api/src/api/v1/endpoints/omniverse.py` |
| Подключение geodata к пайплайнам | `apps/api/src/api/v1/endpoints/geodata.py` |
| Конфиг           | `apps/api/src/core/config.py` (use_data_federation_pipelines, e2cc_base_url) |
