# USGS Data Sources Used by the Platform

Краткая сводка официальных источников USGS, используемых в модулях (в т.ч. Flood Risk Model), со ссылками на документацию и программы.

---

## 3D Elevation Program (3DEP)

- **Программа:** [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program) — федеральная программа лидарной съёмки и DEM; покрытие ~98% территории США; приложения: flood risk management, hydrologic modeling, FEMA, инфраструктура.
- **Официальная стратегия (Next Generation):** [USGS Circular 1553](https://pubs.usgs.gov/circ/1553/cir1553.pdf) — The 3D National Topography Model Call for Action, Part 2: The Next Generation 3D Elevation Program (версия 1.1, July 2025).
- **Использование в платформе:** рельеф для FloodHydrologyEngine (уклон, профиль). Доступ к высотам по точке — через Elevation Point Query Service (EPQS).

---

## Elevation Point Query Service (EPQS)

- **Назначение:** возврат высоты в заданной точке (lat/lon) по данным 3DEP (интерполяция из DEM).
- **Документация и загрузка данных:** [The National Map — GIS Data Download](https://www.usgs.gov/the-national-map-data-delivery/gis-data-download) (National Map Downloader, LidarExplorer, инструменты).
- **API (одна точка):** `https://epqs.nationalmap.gov/v1/json` — параметры `x` (lon), `y` (lat), `units=Meters`. Документация: [epqs.nationalmap.gov/v1/docs](https://epqs.nationalmap.gov/v1/docs).
- **Интерактивный интерфейс:** [apps.nationalmap.gov/epqs/](https://apps.nationalmap.gov/epqs/).
- **Массовые запросы (расширение):** [Bulk Point Query Service](https://apps.nationalmap.gov/bulkpqs/) — для множества точек без серии одиночных вызовов.
- **Код:** `apps/api/src/services/external/usgs_elevation_client.py` — использует EPQS (одиночные точки и профиль по сетке).

---

## NWIS и WaterWatch (streamflow)

- **Данные стока:** [USGS National Water Information System (NWIS)](https://doi.org/10.5066/F7P55KJN) — архив и real-time данные по створам (National Streamgage Network). Используются для калибровки/контекста в flood model.
- **Карты и отчёты:** [WaterWatch](https://waterwatch.usgs.gov/) — карты условий стока и засухи, сравнение с историей. Сводки по водному году и карты: [Water Year Summary](https://waterwatch.usgs.gov/publications/wysummary/2022/) (пример за 2022).
- **API:** `https://waterservices.usgs.gov/nwis/site/` и `.../nwis/iv/` — поиск створов по bbox, мгновенные значения (discharge, gage height).
- **Код:** `apps/api/src/services/external/usgs_waterwatch_client.py` — данные стока через NWIS; карты и сводки по водному году — на waterwatch.usgs.gov.

---

## Дальнейшее расширение

- **Bulk Point Query:** для `get_elevation_profile` уменьшить число запросов за счёт [Bulk Point Query Service](https://apps.nationalmap.gov/bulkpqs/) (много точек в одном запросе).
- **TNM Access API:** [TNM Access API](https://apps.nationalmap.gov/tnmaccess) — доступ к наборам данных National Map, в т.ч. для выбора лидарных проектов по bbox при необходимости более детального DEM.

---

*В репозитории: `docs/USGS_SOURCES.md`.*
