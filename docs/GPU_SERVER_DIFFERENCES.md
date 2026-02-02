# Чем отличается сервер с GPU (saaaliance) от локального и Contabo

Чтобы на GPU-сервере было **видно** и **понятно**, что используется GPU и NIM, добавлено следующее.

---

## 1. Command Center — видимые отличия

- **Бейдж «GPU mode»** — внизу слева показывается зелёный бейдж **GPU mode**, когда FourCastNet NIM на порту 8001 отвечает (healthy). На локальной машине и Contabo без NIM этого бейджа нет.
- **NIM: ✓ FourCastNet** — статус NIM в той же строке; на GPU-сервере при запущенном NIM — зелёная галочка.
- **Кнопка «Test weather (NIM)»** — активна только при healthy NIM; по нажатию запускается пайплайн `weather_forecast` и показывается результат (например «4 steps from FourCastNet NIM ✓»).
- **E2CC: ✓** — если настроен `E2CC_BASE_URL`, кнопка **Open in Omniverse** открывает Earth-2 Command Center.

---

## 2. Стресс-тест — отчёт

- **Источники данных:** в ответ API и в сохранённый отчёт добавляется **«FourCastNet NIM (GPU)»** в `data_sources`, когда на сервере включены `USE_LOCAL_NIM` и NIM (FourCastNet) доступен.
- **report_v2.gpu_services_used:** в отчёт V2 записывается `["FourCastNet NIM"]`, если NIM использовался.
- **В UI отчёта:** в начале отчёта (Stress Test Report) показывается блок **«Weather / climate: FourCastNet NIM (GPU). This run used the GPU server for AI weather forecast.»** — только когда в отчёте есть `gpu_services_used` или в `data_sources` есть строка с FourCastNet NIM.

Таким образом, при одном и том же сценарии стресс-теста на GPU-сервере в отчёте явно видно использование GPU/NIM; на локальной машине или Contabo без NIM этого блока и этой строки в источниках нет.

---

## 3. API

- **GET /api/v1/nvidia/nim/health** — на GPU-сервере с запущенным NIM возвращает `fourcastnet: { status: "healthy" }`.
- **GET /api/v1/data-federation/status** — при `USE_DATA_FEDERATION_PIPELINES=true` возвращает `use_data_federation_pipelines: true` и список пайплайнов (в т.ч. `weather_forecast`).
- **POST /api/v1/stress-tests/execute** — при `USE_LOCAL_NIM` и доступном NIM в ответе и в сохранённом отчёте добавляются `data_sources` с «FourCastNet NIM (GPU)» и `report_v2.gpu_services_used: ["FourCastNet NIM"]`.

---

## 4. Что нужно на GPU-сервере

- В **apps/api/.env**: `USE_LOCAL_NIM=true`, `FOURCASTNET_NIM_URL=http://localhost:8001`, `USE_DATA_FEDERATION_PIPELINES=true`.
- Запущенный **FourCastNet NIM** на порту 8001 (например `./scripts/brev-start-nim.sh`).
- Опционально: **E2CC** и `E2CC_BASE_URL` для кнопки «Open in Omniverse».

После деплоя этих изменений и перезапуска API/фронта на GPU-сервере будут видны бейдж «GPU mode», блок в отчёте и строка в источниках данных; на окружениях без NIM поведение остаётся как раньше (без этих элементов).
