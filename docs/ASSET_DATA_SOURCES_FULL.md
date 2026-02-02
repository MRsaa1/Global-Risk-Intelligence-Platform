# Где взять базу активов быстро
## Полный гид по источникам данных для массового импорта

*Обновлено: февраль 2025*

---

## БЫСТРЫЙ СТАРТ (5 минут → первая 1000 зданий)

### Вариант A: Microsoft Building Footprints (ЛУЧШИЙ СТАРТ)
**Что:** 1.4 миллиарда зданий по всему миру, AI-generated  
**Лицензия:** ODbL (Open Database License) — бесплатно  
**Качество:** хорошее, но не идеальное

#### Как скачать за 5 минут:

```bash
# 1. Найди свою страну
# https://github.com/microsoft/GlobalMLBuildingFootprints

# 2. Скачай dataset-links.csv
wget https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv

# 3. Отфильтруй по стране (например, Spain)
cat dataset-links.csv | grep "Spain"

# 4. Скачай GeoJSON файлы для нужного региона
# Например, Madrid (quadkey: 120320)
wget https://minedbuildings.z5.web.core.windows.net/global-buildings/2024-09-24/Spain/120320.csv.gz

# 5. Распакуй
gunzip 120320.csv.gz
```

**Формат данных:**
```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lon1, lat1], [lon2, lat2], ...]]
  },
  "properties": {
    "height": 12.5,
    "confidence": 0.95
  }
}
```

**Конвертация в CSV для импорта (колонки платформы):**
```python
import geopandas as gpd
import pandas as pd

# Загрузить GeoJSON
gdf = gpd.read_file('120320.csv')

# Извлечь данные в формате платформы
df = pd.DataFrame({
    'name': 'Building_' + gdf.index.astype(str),
    'address': '',
    'city': 'Madrid',
    'country_code': 'ES',
    'latitude': gdf.geometry.centroid.y,
    'longitude': gdf.geometry.centroid.x,
    'valuation': None,
    'currency': 'EUR',
    'gross_floor_area_m2': gdf.geometry.area * 111320 * 111320,
    'floors_above_ground': (gdf['height'] / 3).fillna(1).astype(int),
    'asset_type': 'other',
    'year_built': None,
    'tags': '',
    'description': ''
})

df.to_csv('madrid_buildings.csv', index=False)
```

**Плюсы:** огромное покрытие, бесплатно, высота в некоторых регионах, обновляется ежегодно.  
**Минусы:** нет адресов, нет типов зданий, нет года постройки, AI может ошибаться.

---

### Вариант B: OpenStreetMap (НАИБОЛЕЕ ПОЛНЫЙ)
**Что:** Краудсорсинговая карта мира  
**Лицензия:** ODbL — бесплатно  
**Качество:** лучшее для деталей

#### Способ 1: Geofabrik (региональные экстракты)

```bash
# 1. https://download.geofabrik.de/
# 2. Выбери регион (Europe → Spain)
# 3. Скачай Shapefile (.shp.zip)

wget https://download.geofabrik.de/europe/spain-latest-free.shp.zip
unzip spain-latest-free.shp.zip
```

**Python конвертация (колонки платформы):**
```python
import geopandas as gpd
import pandas as pd

buildings = gpd.read_file('gis_osm_buildings_a_free_1.shp')
buildings = buildings[buildings['type'].notnull()]

df = pd.DataFrame({
    'name': buildings['name'].fillna('Unnamed Building'),
    'address': (buildings.get('addr:street', '') + ' ' + buildings.get('addr:housenumber', '')).str.strip(),
    'city': buildings.get('addr:city', ''),
    'country_code': 'ES',
    'latitude': buildings.geometry.centroid.y,
    'longitude': buildings.geometry.centroid.x,
    'asset_type': buildings['type'],
    'gross_floor_area_m2': buildings.geometry.area * 111320 * 111320,
    'floors_above_ground': buildings.get('building:levels', 1),
    'year_built': buildings.get('start_date', ''),
    'tags': '',
    'description': ''
})

df.to_csv('osm_spain_buildings.csv', index=False)
```

**Данные, которые OSM может иметь:** building=*, name=*, addr:street, addr:housenumber, addr:city, addr:postcode, building:levels, height, start_date, roof:material, building:material.

**Плюсы:** адреса, типы зданий, этажи, высота, год постройки, обновляется ежедневно.  
**Минусы:** покрытие неравномерное, большие файлы (Spain ≈ 2GB).

---

#### Способ 2: Overpass API (точечные запросы)

```python
import requests
import pandas as pd

query = """
[out:json];
area["name"="Madrid"]["admin_level"="8"]->.madrid;
(
  way["building"](area.madrid);
  relation["building"](area.madrid);
);
out center;
"""

url = "https://overpass-api.de/api/interpreter"
response = requests.post(url, data={'data': query})
data = response.json()

buildings = []
for element in data['elements']:
    if 'center' in element:
        lat, lon = element['center']['lat'], element['center']['lon']
    elif 'lat' in element:
        lat, lon = element['lat'], element['lon']
    else:
        continue
    tags = element.get('tags', {})
    buildings.append({
        'name': tags.get('name', 'Unnamed'),
        'address': f"{tags.get('addr:street', '')} {tags.get('addr:housenumber', '')}".strip(),
        'city': tags.get('addr:city', 'Madrid'),
        'country_code': 'ES',
        'latitude': lat,
        'longitude': lon,
        'asset_type': tags.get('building', 'other'),
        'floors_above_ground': tags.get('building:levels', 1),
        'year_built': tags.get('start_date', ''),
        'tags': '',
        'description': ''
    })

df = pd.DataFrame(buildings)
df.to_csv('madrid_osm_buildings.csv', index=False)
```

**Ограничения Overpass:** максимум ~100 000 элементов за запрос, тайм-аут 180 с. Для больших городов используй Geofabrik.

---

### Вариант C: Google Building Footprints
**Что:** 1.8 миллиарда зданий (AI-generated)  
**Лицензия:** CC-BY-4.0  
**Доступ:** Google Earth Engine или Source.coop

```python
import geopandas as gpd
import pandas as pd

url = "https://data.source.coop/vida/google-microsoft-open-buildings/geoparquet/by_country/country_iso=ESP/ESP.parquet"
gdf = gpd.read_parquet(url)
gdf_google = gdf[gdf['bf_source'] == 'Google']

df = pd.DataFrame({
    'name': 'Building_' + gdf_google.index.astype(str),
    'address': '',
    'city': '',
    'country_code': 'ES',
    'latitude': gdf_google.geometry.centroid.y,
    'longitude': gdf_google.geometry.centroid.x,
    'asset_type': 'other',
    'gross_floor_area_m2': gdf_google['area_in_meters'],
    'floors_above_ground': 1,
    'year_built': None,
    'tags': '',
    'description': ''
})

df.to_csv('spain_google_buildings.csv', index=False)
```

**Плюсы:** confidence score, площадь в м², огромное покрытие.  
**Минусы:** нет адресов, этажей, типов; нужна геокодировка для city/address.

---

## КОМБИНИРОВАННЫЙ ПОДХОД (BEST PRACTICE)

```python
import geopandas as gpd
import pandas as pd

ms = gpd.read_file('microsoft_madrid.geojson')
osm = gpd.read_file('osm_madrid.shp')

ms['centroid'] = ms.geometry.centroid
joined = gpd.sjoin_nearest(ms, osm, how='left', max_distance=10)

df = pd.DataFrame({
    'name': joined['name_right'].fillna('Building_' + joined.index.astype(str)),
    'address': (joined.get('addr:street', '') + ' ' + joined.get('addr:housenumber', '')).fillna(''),
    'city': joined.get('addr:city', 'Madrid').fillna('Madrid'),
    'country_code': 'ES',
    'latitude': joined['centroid'].y,
    'longitude': joined['centroid'].x,
    'asset_type': joined['building'].fillna('other'),
    'gross_floor_area_m2': joined.geometry.area * 111320 * 111320,
    'floors_above_ground': joined['building:levels'].fillna(joined['height'] / 3).fillna(1),
    'year_built': joined.get('start_date', ''),
    'tags': '',
    'description': ''
})

df.to_csv('madrid_combined.csv', index=False)
```

---

## ГОСУДАРСТВЕННЫЕ КАДАСТРЫ (МАКСИМАЛЬНАЯ ТОЧНОСТЬ)

### США: Census Data
https://www.census.gov/geographies/mapping-files.html — геокодирование по координатам (город, штат, zip, census tract).

### Испания: Catastro
http://www.catastro.minhap.es/ — API по координатам: referencia catastral, dirección, superficie, año construcción, uso.

### Россия: Росреестр
https://rosreestr.gov.ru/ — публичная кадастровая карта; для массового доступа часто нужна лицензия.

**Плюсы кадастров:** официальная оценка, год постройки, точная площадь, тип использования.  
**Минусы:** API платные или ограниченные, rate limits.

---

## КОММЕРЧЕСКИЕ БАЗЫ (ДЛЯ PRODUCTION)

| Источник | Что даёт | Цена |
|----------|----------|------|
| **CoreLogic** | ~150M недвижимости США, оценка, риски (flood, fire) | $10k–$100k+/год |
| **Zillow / Redfin / Realtor.com** | Рыночная стоимость, фото; Zillow Research — исторические датасеты | Contact / Research data |
| **HERE Technologies** | Глобальная карта, POIs, здания | Contact sales |
| **Mapbox Geocoding** | Адреса → координаты, границы | $0.50/1000 запросов, бесплатно до 100k/мес |

---

## СИНТЕТИЧЕСКИЕ / ДЕМО ДАННЫЕ

```python
import pandas as pd
import numpy as np
from faker import Faker

fake = Faker()
buildings = []
for i in range(1000):
    buildings.append({
        'name': fake.company() if np.random.rand() > 0.7 else f'Building {i}',
        'address': fake.street_address(),
        'city': fake.city(),
        'country_code': 'US',
        'latitude': fake.latitude(),
        'longitude': fake.longitude(),
        'valuation': np.random.randint(100000, 5000000),
        'currency': 'USD',
        'gross_floor_area_m2': np.random.randint(500, 50000),
        'floors_above_ground': np.random.randint(1, 30),
        'asset_type': np.random.choice(['residential_multi', 'commercial_office', 'industrial']),
        'year_built': np.random.randint(1950, 2024),
        'tags': 'synthetic,demo',
        'description': ''
    })

df = pd.DataFrame(buildings)
df.to_csv('synthetic_buildings.csv', index=False)
```

---

## ИМПОРТ В ПЛАТФОРМУ

### CSV шаблон (колонки платформы)

Обязательно: `name`. Рекомендуется: `latitude`, `longitude`, `city`, `country_code`, `asset_type`, `valuation`, `currency`, `gross_floor_area_m2`, `floors_above_ground`, `year_built`, `tags`, `description`.

```csv
name,address,city,country_code,latitude,longitude,valuation,currency,gross_floor_area_m2,floors_above_ground,asset_type,year_built,tags,description
Empire State Building,"350 5th Ave",New York,US,40.748817,-73.985428,2000000000,USD,257000,102,commercial_office,1931,landmark,"Iconic skyscraper"
Times Square Office,"1 Times Square",New York,US,40.758,-73.9855,500000000,USD,120000,25,commercial_office,1904,,Office building
```

### Маппинг колонок внешних источников

При конвертации из Microsoft, OSM, Google или других датасетов используй соответствие:

| Внешний источник | Колонка платформы |
|------------------|-------------------|
| `country` (название или код) | `country_code` (2 буквы ISO: ES, US, DE) |
| `square_footage`, `area_in_meters`, `area` | `gross_floor_area_m2` |
| `floors`, `building:levels` | `floors_above_ground` |
| `construction_year`, `start_date` | `year_built` |
| `valuation`, `price`, `assessed_value` | `valuation` |
| `currency` | `currency` (3 буквы: EUR, USD) |

Поля `occupancy` и `risk_category` в платформу не импортируются; при необходимости их можно добавить в `tags` (через запятую).

### Валидация и массовый импорт (API)

**Ограничения платформы:** макс. 10 MB на файл, макс. 1000 строк за один запрос.

```python
import requests

BASE = "http://localhost:8000/api/v1"
headers = {"Authorization": "Bearer YOUR_TOKEN"}  # если нужна авторизация

# 1. Скачать шаблон
r = requests.get(f"{BASE}/bulk/assets/template", headers=headers)
with open('template.csv', 'wb') as f:
    f.write(r.content)

# 2. Валидация
with open('madrid_combined.csv', 'rb') as f:
    r = requests.post(f"{BASE}/bulk/assets/validate", files={'file': f}, headers=headers)

data = r.json()
if data['valid']:
    print("Validation passed!")
else:
    print("Errors:", data['errors'])

# 3. Импорт
with open('madrid_combined.csv', 'rb') as f:
    r = requests.post(
        f"{BASE}/bulk/import-assets",
        files={'file': f},
        data={'skip_errors': 'false', 'calculate_risks': 'true'},
        headers=headers
    )

res = r.json()
# Ответ платформы: success, total_records, processed, succeeded, failed, errors, created_ids, processing_time_ms
print(f"Success: {res['success']}, created: {res['succeeded']}, ids: {res['created_ids'][:5]}")
if res['errors']:
    print("Errors:", res['errors'][:10])
```

### Большие базы: разбивка на чанки по 1000

```python
chunk_size = 1000
for i in range(0, len(df), chunk_size):
    chunk = df[i:i+chunk_size]
    chunk.to_csv(f'madrid_chunk_{i//chunk_size}.csv', index=False)
    with open(f'madrid_chunk_{i//chunk_size}.csv', 'rb') as f:
        r = requests.post(
            f"{BASE}/bulk/import-assets",
            files={'file': f},
            data={'skip_errors': 'true', 'calculate_risks': 'true'},
            headers=headers
        )
    res = r.json()
    print(f"Chunk {i//chunk_size}: succeeded={res['succeeded']}, created_ids={len(res['created_ids'])}")
```

---

## РЕКОМЕНДАЦИИ ПО ВЫБОРУ ИСТОЧНИКА

| Критерий | Microsoft | OSM | Google | Кадастр | CoreLogic |
|----------|-----------|-----|--------|---------|-----------|
| Скорость старта | высоко | высоко | средне | низко | низко |
| Покрытие | глобально | высоко | глобально | по стране | США |
| Геометрия | хорошо | отлично | хорошо | отлично | отлично |
| Атрибуты (адрес, тип) | нет | хорошо | нет | отлично | отлично |
| Цена | бесплатно | бесплатно | бесплатно | платно | платно |

---

## ИТОГОВЫЙ WORKFLOW

**MVP (1 день):** Скачать Microsoft Building Footprints для города → конвертировать в CSV (колонки платформы) → импортировать первые 1000 зданий → визуализация в Cesium.

**Production (1 неделя):** OSM (Geofabrik) + Microsoft, spatial join → геокодирование при необходимости → валидация + массовый импорт чанками → интеграция с climate API.

**Enterprise (1 месяц):** кадастр + CoreLogic/аналог, автоматизация обновлений, QA и дедупликация.

---

## ПОЛЕЗНЫЕ ССЫЛКИ

- **Microsoft Global ML Building Footprints:** https://github.com/microsoft/GlobalMLBuildingFootprints
- **OpenStreetMap (Geofabrik):** https://download.geofabrik.de/
- **Google-Microsoft Combined (VIDA):** https://source.coop/vida/google-microsoft-open-buildings
- **Overpass Turbo:** https://overpass-turbo.eu/
- **Шаблон и импорт платформы:** [ASSET_IMPORT.md](ASSET_IMPORT.md), кнопка «Download Template» и «Bulk Import» на странице Assets.
