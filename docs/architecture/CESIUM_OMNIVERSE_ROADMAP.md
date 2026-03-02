# Cesium → Omniverse Roadmap

Фундамент для внедрения практик Sandtable, Lockheed Martin JAM, Terradepth, Ansys и стратегической цели **Real-World 3D Geospatial Extension для NVIDIA Omniverse**.

---

## Цель

- **Тактически:** CZML для сценариев, слои данных на террейне, активные инциденты на глобусе, периодическое обновление.
- **Стратегически:** Cesium for Unreal → единый геоконтекст в UE5; **Omniverse** — визуализация/симуляция с реальным миром (террейн, 3D Tiles, координаты).

---

## Фазы

### Phase 1 — CZML и Replay на глобусе (в работе)

- **Backend:** генерация CZML из cascade animation (временные метки, позиции/полигоны по кадрам).
- **API:** `GET /api/v1/replay/cascade-animation/{decision_id}/czml` — возвращает CZML документ.
- **Frontend:** загрузка CZML в Cesium (`viewer.dataSources.add(Cesium.CzmlDataSource.load(url))`) из Replay или Command Center; кнопка «View on Globe».
- **Результат:** сценарий replay/cascade отображается на глобусе как временная анимация.

### Phase 2 — Слои данных на террейне

- Опциональный слой поверх текущей подложки (elevation/slope или тематический: flood depth, heat index).
- Источники: внутренний тайловый API или `UrlTemplateImageryProvider` (NOAA, USDA и т.д.).
- Включение/выключение слоя в UI глобуса (чекбокс или слой-панель).

### Phase 3 — Активные инциденты (как Lockheed Martin JAM)

- Эндпоинт списка активных инцидентов: существующий `GET /api/v1/agents/alerts` (и при необходимости `GET /api/v1/cadapt/community/alerts`).
- На глобусе: маркеры/иконки по координатам алертов; автообновление по таймеру (например каждые 5–15 мин).
- Список «Active incidents» в панели Command Center или рядом с глобусом.

### Phase 4 — Периодическое обновление слоёв

- Для выбранного слоя (flood, heat, wind): не только разовая загрузка, а обновление по интервалу (настраиваемый интервал в минутах).
- Минимальные перезапросы (обновлять только данные слоя, не пересоздавать весь Viewer).

### Phase 5 — Bathymetry и прибрежные сценарии

- При появлении сценариев storm surge / прибрежного затопления: слой Cesium World Bathymetry (или свой тайловый слой глубин) в регионе интереса.
- Опционально: ion Self-Hosted для Bathymetry при требованиях к резидентности данных.

### Phase 6 — Cesium for Unreal (фундамент под Omniverse)

- Текущая интеграция UE5: JSON (flood/wind) для FluidFlux и Chaos.
- Следующий шаг: **Cesium for Unreal** в проекте UE5 — подтягивать террейн и 3D Tiles из Cesium ion (или Self-Hosted), а flood/wind оставлять параметрами симуляции.
- Результат: один виртуальный все-доменный мир с реальным геоконтекстом (как VRAI).

### Phase 7 — Real-World 3D Geospatial Extension для NVIDIA Omniverse

- **Цель:** Omniverse как платформа визуализации/симуляции с реальным миром (террейн, здания, координаты).
- Варианты:
  - **A)** Официальный или community Omniverse extension, подтягивающий 3D Tiles (Cesium-совместимые) или террейн из ion / Self-Hosted в сцену Omniverse.
  - **B)** Конвейер: Cesium ion Self-Hosted (или собственный тайлер) → 3D Tiles → конвертер в формат Omniverse (USD и т.п.) → загрузка в сцену.
- Действия: мониторинг появления «Cesium/geospatial» extension для Omniverse; при отсутствии — заложить конвейер «ion/3D Tiles → Omniverse» в архитектуру.

### Phase 8 — Cesium ion Self-Hosted (при необходимости)

- При требованиях: воздушный зазор, on-prem, резидентность данных.
- Текущий поток (террейн + 3D Tiles зданий из ion) переключить на Self-Hosted; браузерный код меняется минимально (URL/токен).

---

## Ссылки на кейсы

- [Sandtable – military planning with Cesium](https://cesium.com/blog/2026/01/20/sandtable-military-planning/)
- [Lockheed Martin – wildland fires with Cesium](https://cesium.com/blog/2024/08/08/lockheed-martin-tracks-wildland-fires-with-cesium/)
- [Terradepth – Cesium ion Self-Hosted at the edge](https://cesium.com/blog/2025/10/07/terradepth-processes-seafloor-data-at-the-edge/)
- [Ansys – Cesium ion Self-Hosted for Geospatial Data Cloud](https://cesium.com/blog/2025/05/15/ansys-uses-cesium-ion-self-hosted-for-geospatial-data-cloud/)
- VRAI – Virtual All-Domain Environment with Cesium for Unreal
- CZML: [Cesium Language (CZML)](https://github.com/AnalyticalGraphicsInc/czml-writer/wiki/CZML-Guide) — временные ряды в 3D для Cesium.

---

## Статус

| Phase | Статус | Примечание |
|-------|--------|------------|
| 1. CZML + Replay на глобусе | Выполнено | GET /replay/cascade-animation/{id}/czml, View on Globe в ReplayPage, czmlUrl в CesiumGlobe |
| 2. Слои на террейне | Запланировано | |
| 3. Активные инциденты | Запланировано | |
| 4. Периодическое обновление | Запланировано | |
| 5. Bathymetry | Запланировано | |
| 6. Cesium for Unreal | Запланировано | |
| 7. Omniverse extension | Стратегическая цель | |
| 8. ion Self-Hosted | По требованию | |
