# Подключение Google Earth Engine к платформе

Платформа использует Google Earth Engine для данных: климат (ERA5, MODIS NDVI), затопления (JRC Global Surface Water), рельеф (SRTM), землепользование (Dynamic World). Без учётных данных API возвращает mock-данные.

---

## Что нужно от тебя

### Вариант A: С ключом сервисного аккаунта (если политика организации разрешает ключи)

### 1. Google Cloud проект с включённым Earth Engine

- Зайди в [Google Cloud Console](https://console.cloud.google.com/) и создай проект (или выбери существующий).
- Зарегистрируй проект для Earth Engine: [Sign up for Earth Engine](https://signup.earthengine.google.com/) (привязка Cloud-проекта к Earth Engine).
- Включи Earth Engine API в проекте: [Enable Earth Engine API](https://console.cloud.google.com/apis/library/earthengine.googleapis.com) (кнопка Enable).

### 2. Service Account и ключ

- В том же Cloud-проекте: **IAM & Admin → Service accounts** → **Create Service Account** (имя, например `ee-platform`).
- Создай ключ: у созданного сервисного аккаунта **Keys → Add key → Create new key → JSON**. Скачай JSON-файл (например `ee-key.json`).
- Никому не отдавай файл и не коммить его в репозиторий. Добавь `*ee-key*.json` и путь к ключу в `.gitignore`.

### 3. Права сервисного аккаунта в Earth Engine

- В [Earth Engine Console](https://code.earthengine.google.com/) убедись, что проект зарегистрирован и API включён.
- Сервисные аккаунты в этом проекте получают доступ к Earth Engine автоматически. При необходимости выдай роли в [IAM](https://console.cloud.google.com/iam-admin/iam) (например, если используешь только EE — достаточно прав на проект с включённым EE API).

---

### Вариант B: Без ключа — Application Default Credentials (если политика блокирует создание ключей)

Если в организации включена политика **iam.disableServiceAccountKeyCreation**, создавать JSON-ключи для сервисных аккаунтов нельзя. Используй учётную запись пользователя и ADC:

1. Установи [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), если ещё нет.
2. Выполни один раз (откроется браузер для входа):
   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project YOUR_PROJECT_ID
   ```
   Подставь свой Project ID (например `axial-entropy-484310-e5`).
3. В `apps/api/.env` задай только проект, ключ не указывай:
   ```bash
   ENABLE_EARTH_ENGINE=true
   GCLOUD_PROJECT_ID=axial-entropy-484310-e5
   ```
4. Запускай API из того же окружения, где делал `gcloud auth application-default login`. Учётные данные сохраняются в `~/.config/gcloud/application_default_credentials.json`.

Для продакшена на сервере без ключа ADC не подойдёт — нужен ключ (если политика разрешит) или решение от администратора организации.

---

## Настройка в проекте

### Переменные окружения (в `apps/api/.env`)

| Переменная | Описание | Пример |
|------------|----------|--------|
| `ENABLE_EARTH_ENGINE` | Включить использование Earth Engine (по умолчанию `true`) | `true` |
| `GCLOUD_PROJECT_ID` | ID Google Cloud проекта | `my-risk-platform` |
| `GCLOUD_SERVICE_ACCOUNT_JSON` | Путь к JSON-ключу **или** строка с содержимым JSON. **Не задавай**, если используешь ADC (Вариант B) | `/path/to/ee-key.json` или `{"type":"service_account",...}` |

**Вариант A — путь к файлу (рекомендуется для сервера):**

```bash
ENABLE_EARTH_ENGINE=true
GCLOUD_PROJECT_ID=my-risk-platform
GCLOUD_SERVICE_ACCOUNT_JSON=/secure/ee-key.json
```

**Вариант B — JSON в переменной (удобно для Docker/CI):**

Вставить содержимое скачанного JSON в одну строку (экранировать кавычки при необходимости или задать через секреты):

```bash
ENABLE_EARTH_ENGINE=true
GCLOUD_PROJECT_ID=my-risk-platform
GCLOUD_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"ee-platform@my-risk-platform.iam.gserviceaccount.com",...}'
```

### Установка Python-зависимости

Клиент использует `earthengine-api`. Установи опциональную зависимость:

```bash
cd apps/api
pip install -e ".[earth_engine]"
# или
pip install earthengine-api>=1.4.0
```

---

## Проверка

1. Запусти API и открой:
   - `GET /api/v1/earth-engine/status` — в ответе должно быть `"enabled": true` и твой `project_id`.
2. Запрос данных по точке:
   - `GET /api/v1/earth-engine/climate?lat=40.71&lng=-74.00` — климат (ERA5, NDVI).
   - `GET /api/v1/earth-engine/flood-risk?lat=40.71&lng=-74.00` — риск затопления (JRC).
   - `GET /api/v1/earth-engine/elevation?lat=40.71&lng=-74.00` — высота (SRTM).
   - `GET /api/v1/earth-engine/land-use?lat=40.71&lng=-74.00` — землепользование (Dynamic World).
   - Новые эндпоинты (паводки, засуха, тепло/ветер):
     - `GET /api/v1/earth-engine/water-index?lat=40.71&lng=-74.00` — MNDWI/NDWI по точке (опционально: `radius_m`, `date`).
     - `GET /api/v1/earth-engine/flood-extent?lat=40.71&lng=-74.00` — детекция водной поверхности за период (опционально: `radius_m`, `start_date`, `end_date`, по умолчанию последние 30 дней).
     - `GET /api/v1/earth-engine/water-stress?lat=40.71&lng=-74.00` — индекс водного стресса (опционально: `radius_m`).
     - `GET /api/v1/earth-engine/temperature-anomaly?lat=40.71&lng=-74.00` — аномалия температуры относительно базового периода (опционально: `radius_m`, `baseline_start_year`, `baseline_end_year`, по умолчанию 1990–2020).
     - `GET /api/v1/earth-engine/wind?lat=40.71&lng=-74.00` — скорость и направление ветра за период (опционально: `radius_m`, `start_date`, `end_date`, по умолчанию последние 30 дней).

В ответах при успехе будет `"source": "google_earth_engine"` (или `jrc_global_surface_water`, `srtm`, `dynamic_world`). При отключённом EE или ошибке — `"source": "mock"` и подсказка в `note`.

---

## Где используются данные Earth Engine

- **API:** эндпоинты `/api/v1/earth-engine/*` отдают сырые данные по точке.
- **Клиент** (`apps/api/src/services/external/google_earth_engine_client.py`) можно вызывать из других сервисов (например, `climate_service`, `flood_hydrology_engine`) для подстановки реальных данных вместо mock — при `enable_earth_engine=true` и заданных `GCLOUD_*` клиент инициализируется и отдаёт данные из EE.

---

## Ошибки

- **Earth Engine ADC init failed / Run: gcloud auth application-default login** — при использовании Варианта B (без ключа) нужно один раз выполнить `gcloud auth application-default login` и `gcloud auth application-default set-quota-project YOUR_PROJECT_ID` из того же пользователя, под которым запускается API.
- **Earth Engine init failed / invalid_grant** — проверь время на сервере (NTP), корректность JSON ключа и что проект зарегистрирован в Earth Engine и API включён.
- **could not parse service account** — в `GCLOUD_SERVICE_ACCOUNT_JSON` должен быть либо путь к существующему .json с полем `client_email`, либо строка JSON с `client_email`.
- **ModuleNotFoundError: No module named 'ee'** — установи `pip install earthengine-api` или `pip install -e ".[earth_engine]"`.
