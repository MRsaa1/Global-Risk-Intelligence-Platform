# Города и страны: расширение базы и согласованность метрик

## Расширение базы городов

- **Источник**: `apps/api/src/data/cities.py` — `CITIES_DATABASE` и вспомогательные функции.
- **Не только один город на страну**: в базе несколько городов на страну (например, USA: New York, Los Angeles, San Francisco, Chicago, Miami, Houston, Boston, Washington, Denver, Seattle; Germany: Frankfurt, Berlin, Munich, Cologne, Dusseldorf; и т.д.). Добавлены дополнительные города для стран с одним городом:
  - Portugal: Porto (к Lisbon)
  - Ireland: Cork (к Dublin)
  - New Zealand: Auckland (к Sydney/Melbourne для AU)
  - Morocco: Casablanca
  - Kenya: Nairobi
  - Czech Republic: Prague
  - Hungary: Budapest
  - Romania: Bucharest
  - Malaysia: Kuala Lumpur
  - Peru: Lima
- У каждого города задано поле **country_code** (ISO 3166-1 alpha-2: US, DE, PT и т.д.) для единой фильтрации по всем модулям.

## Единый контур по выбранному городу/стране

Чтобы все метрики во всех модулях соответствовали выбранному городу или стране:

1. **Выбор города/страны**  
   На фронте (Command Center, Dashboard, Municipal) хранится выбранный `city_id` и/или `country_code` (ISO).

2. **Запросы к API с контекстом**  
   При запросе сводки и метрик передавайте тот же контекст:
   - **GET /api/v1/geodata/summary?city_id=...** или **?country_code=US**  
     Возвращает агрегаты только по выбранному городу или стране (города из CITIES_DATABASE с данным `country_code`; при наличии активных активов в БД — только активы с `Asset.country_code` / `Asset.city` в этом контексте).
   - **GET /api/v1/country-risk/{country_code}** и **GET /api/v1/country-risk/{country_code}/cities**  
     Уже используют общую базу городов и `get_cities_by_country_code(iso)`.

3. **Где применяется фильтр**
   - **geodata/summary**: опциональные query-параметры `city_id`, `country_code`; сводка (exposure, risk, zone counts) считается только по выбранному городу/стране; при наличии активов в БД — `get_real_aggregates(db, country_code=..., city_id=...)` фильтрует по `Asset.country_code` и при необходимости по `Asset.city`.
   - **country_risk**: список городов страны и агрегаты по стране строятся из `CITIES_DATABASE` по `country_code`.
   - Остальные модули (CADAPT, stress tests, Municipal и т.д.), которые принимают `city` или `country_code`, должны использовать тот же идентификатор (например, `city_id` из CITIES_DATABASE или ISO код страны), чтобы метрики совпадали.

4. **Ответ summary с контекстом**  
   Если передан `city_id` или `country_code`, в ответе geodata/summary добавляется поле **scope**: `{"city_id": "...", "country_code": "..."}`, чтобы фронт мог отображать, к какому контексту относятся метрики.

## Функции в cities.py

- **get_city(city_id)** — данные города по id.
- **get_all_cities()** — все города.
- **get_cities_by_country_code(iso)** — все города страны по ISO коду (например `"DE"`).
- **COUNTRY_TO_ISO** — маппинг названия страны в ISO (для заполнения `country_code` у городов).

## Рекомендация для фронта

- Хранить выбранные **city_id** и/или **country_code** в одном месте (например, в platform store или контексте).
- При запросах к `/geodata/summary`, `/country-risk/...`, CADAPT, stress и другим эндпоинтам передавать тот же **city_id** или **country_code**, чтобы везде отображались согласованные метрики по выбранному городу/стране.
