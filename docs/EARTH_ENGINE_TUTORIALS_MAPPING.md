# Соответствие GEE-туториалов и эндпоинтов платформы

Краткая таблица соответствия туториалов Google Earth Engine (Python) и методов клиента / эндпоинтов API платформы. Используется для расширения интеграции.

| № | Туториал | Метод клиента | Эндпоинт API | Примечание |
|---|----------|----------------|--------------|------------|
| 1 | Flood Detection | `get_flood_extent` | `GET /earth-engine/flood-extent` | JRC GSW occurrence, water ratio за период |
| 4 | Soil Moisture Drought | `get_drought` (расширен) | `GET /earth-engine/drought` | percentile, severity class (TerraClimate) |
| 6 | Wetland | — | — | Логика близка к flood/water-index |
| 7 | Lake | — | — | Логика близка к flood-extent / water-index |
| 8 / 20 | ET (Evapotranspiration) | `get_water_stress`, `get_drought` | `GET /earth-engine/water-stress`, `/drought` | ET/PET в индексе водного стресса |
| 10 | Dust and Wind | `get_wind` | `GET /earth-engine/wind` | ERA5 u/v, скорость и направление |
| 11 | Temperature Anomaly | `get_temperature_anomaly` | `GET /earth-engine/temperature-anomaly` | Текущий период vs базовый (1990–2020) |
| 12 | Water Index | `get_water_index` | `GET /earth-engine/water-index` | MNDWI/NDWI (Landsat 8) |
| 17 | Water Stress | `get_water_stress` | `GET /earth-engine/water-stress` | Индекс водного стресса (soil + def) |
| 18 | Water Scarcity | `get_water_stress` | `GET /earth-engine/water-stress` | Тот же эндпоинт |
| 19 | Thermal Sharpening | — | — | Возможное расширение (пока не реализовано) |
| — | Остальные (2, 3, 5, 9, 13–16, 21) | — | — | Для будущего расширения |

**Клиент:** `apps/api/src/services/external/google_earth_engine_client.py`  
**Роуты:** `apps/api/src/api/v1/endpoints/earth_engine.py`
