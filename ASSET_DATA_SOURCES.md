# Откуда брать данные для Assets и точных Digital Twins

Краткий гайд: как наполнить базу активов и какие поля нужны для Digital Twins на базе Cesium 3D и NVIDIA (Earth-2, Physics NeMo, LLM).

Развёрнутый гид с командами и примерами кода (Microsoft, OSM, Google, кадастры, комбинированный подход): [docs/ASSET_DATA_SOURCES_FULL.md](docs/ASSET_DATA_SOURCES_FULL.md).

---

## 1. Быстрый старт

| Действие | Как |
|----------|-----|
| **Демо-данные (5 активов по Германии)** | На странице Assets → кнопка «Load demo data» (в dev) или `POST /api/v1/seed/seed` |
| **Шаблон CSV для Bulk Import** | «Download Template» на Assets или `GET /api/v1/bulk/assets/template` → `asset_upload_template.csv` |
| **Загрузка своего CSV** | «Bulk Import» на Assets → выбрать CSV (до 1000 строк, UTF-8, макс. 10 MB) |

---

## 2. Колонки CSV (Bulk Import)

**Обязательно:** `name`

**Важно для Digital Twins и 3D:**
- `latitude`, `longitude` — координаты (WGS84). Без них 3D и стресс-тесты по адресу не привяжутся.
- `city` — для выбора 3D-модели города (см. п. 4).
- `country_code` — ISO 3166-1 (DE, US, AU, …).

**Рекомендуется:**
- `asset_type` — office, data_center, logistics, retail, industrial, residential_multifamily, infrastructure_transport, infrastructure_energy и др. (см. `bulk_operations.asset_type_mapping`).
- `valuation`, `currency` — для рисков и отчётов.
- `gross_floor_area_m2`, `year_built`, `floors_above_ground` — для физического риска и твинов.

**По желанию:** `address`, `region`, `postal_code`, `tags`, `description`.

Пример строки:
```csv
name,asset_type,address,city,country_code,latitude,longitude,valuation,currency,year_built,gross_floor_area_m2,floors_above_ground,tags,description
Munich Office Tower,office,Marienplatz 1,Munich,DE,48.1351,11.5820,125000000,EUR,2015,25000,12,premium,"Class A office"
```

---

## 3. Откуда взять данные для CSV

### Открытые / бесплатные

| Источник | Что даёт | Ссылка | Примечание |
|----------|----------|--------|------------|
| **OpenAddresses** | Адрес, lat/lon по странам | [openaddresses.io](https://openaddresses.io) | Экспорт CSV, подходит для геокодирования |
| **OpenStreetMap (OSM)** | Здания, площади, типы, иногда этажность | [overpass-turbo.eu](https://overpass-turbo.eu), [geofabrik.de](https://download.geofabrik.de) | Нужна конвертация в наш формат |
| ** cadastral / гос. реестры** | Площади, год постройки, кадастр | Национальные geoportals (например, Германия, UK, США) | Зависит от юрисдикции |
| **UNIGIS / Urban Atlas** | Land cover, секторы (ЕС) | [land.copernicus.eu](https://land.copernicus.eu) | Для типа использования и контекста |

### Коммерческие

| Источник | Назначение |
|----------|------------|
| **CoStar, REIS, RCA** | Офис, ритейл, логистика, оценки (США) |
| **JLL, CBRE, Cushman** | Портфели, площадь, оценки, аренда |
| **Vexcel, Nearmap, Aerometrex** | Фото/3D, привязка к Cesium Ion |

### Собственные данные

- ERP, CMMS, реестр недвижимости — экспорт в CSV по нашему шаблону.
- BIM (IFC) — после создания актива: «Upload BIM» / `POST /assets/{id}/upload-bim` для связи твина с 3D по зданию.

---

## 4. Что нужно для точных Digital Twins (Cesium + NVIDIA)

### 3D в Digital Twin

- **Cesium Ion 3D Tiles** — основа 3D: глобально OSM Buildings; для «премиум» городов — photogrammetry из Cesium Ion.
- **Города с отдельными 3D-моделями в приложении:**  
  New York, Sydney, San Francisco, Boston, Denver, Melbourne, Washington DC.  
  В CSV лучше указывать `city` в виде, удобном для маппинга: «New York», «Sydney», «San Francisco» и т.п.
- Для **остальных городов** используется Cesium OSM Buildings (серые здания). Нужны `latitude`, `longitude` и по возможности `city`.

Чтобы твин открывался в «премиум» 3D, актив должен однозначно сопоставляться с таким городом (через `city`/`asset_id` и логику в DigitalTwinPanel).

### NVIDIA

- **NVIDIA LLM** — отчёты по стресс-тестам, executive summary. Достаточно полей актива (название, тип, город, координаты, оценка, риски).
- **Earth-2, Physics NeMo** — в коде заложены через NIM/конфиг; для сценариев используются координаты и параметры актива (площадь, этажность, тип). Важны: `latitude`, `longitude`, `gross_floor_area_m2`, `asset_type`, `year_built`.

### Итоговый минимум для «точного» твина

1. `latitude`, `longitude`
2. `city` (для премиум 3D — один из перечисленных выше городов)
3. `gross_floor_area_m2` или `valuation` (хотя бы одно для масштаба и риска)
4. `asset_type`
5. По возможности: `year_built`, `address`

---

## 5. Типы активов (asset_type)

Поддерживаемые значения (при импорте нормализуются через `asset_type_mapping`):

- `office` / `commercial_office`
- `retail` / `commercial_retail`
- `industrial` / `industrial_manufacturing`
- `logistics` / `industrial_logistics`
- `data_center` / `industrial_data_center`
- `hotel` / `hospitality_hotel`
- `residential` / `residential_multifamily`
- `mixed_use`
- `infrastructure` / `infrastructure_transport`
- `energy` / `infrastructure_energy`

---

## 6. Полезные ссылки

- **Полный гид по источникам данных (Microsoft, OSM, Google, кадастры, примеры кода):** [docs/ASSET_DATA_SOURCES_FULL.md](docs/ASSET_DATA_SOURCES_FULL.md)
- **Шаблон CSV:** кнопка «Download Template» на [Assets](/assets) или `GET /api/v1/bulk/assets/template`
- **Seed:** `POST /api/v1/seed/seed` (dev/demo)
- **Валидация CSV без импорта:** `POST /api/v1/bulk/assets/validate` (файл в body)
- **Импорт:** `POST /api/v1/bulk/import-assets` (или «Bulk Import» на Assets)
- **Cesium Ion:** [cesium.com/ion](https://cesium.com/ion) — 3D Tiles, OSM Buildings, свои слои
- **OpenAddresses:** [openaddresses.io](https://openaddresses.io)
- **NVIDIA Earth-2:** [developer.nvidia.com/earth-2](https://developer.nvidia.com/earth-2)  
- **NVIDIA Physics NeMo:** [github.com/NVIDIA/physicsnemo](https://github.com/NVIDIA/physicsnemo)

---

## 7. Типовой сценарий

1. Скачать шаблон: Assets → «Download Template».
2. Взять адреса/координаты из OpenAddresses, OSM или своей системы; при необходимости догеокодировать (Nominatim, Google, и т.п.) и заполнить `latitude`, `longitude`, `city`, `country_code`.
3. Добавить `name`, `asset_type`, `valuation`, `gross_floor_area_m2` из кадастра, реестра или оценок.
4. Проверить: `POST /api/v1/bulk/assets/validate` с вашим CSV.
5. Импортировать: «Bulk Import» или `POST /api/v1/bulk/import-assets`.
6. Для зданий с IFC: после создания актива — загрузка BIM в `POST /assets/{id}/upload-bim`.

Для премиум 3D по возможности используйте `city` из списка: New York, Sydney, San Francisco, Boston, Denver, Melbourne, Washington DC — и корректные `latitude`/`longitude` в границах города.
