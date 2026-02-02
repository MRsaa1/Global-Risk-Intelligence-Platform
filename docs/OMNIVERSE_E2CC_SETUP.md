# Omniverse E2CC Setup — Earth-2 Command Center

This document describes how to set up and run the **Earth-2 Command Center (E2CC)** from the [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics) blueprint, and how to integrate it with the Global Risk Platform (e.g. "Open in Omniverse" from Command Center / Present).

---

## Overview

- **E2CC**: Omniverse Kit–based app for geospatial/weather visualization (globe, image layers, timeline).
- **DFM**: Data Federation Mesh (Process, Execute, Redis, Scheduler) runs pipelines (GFS, ERA5, HRRR, FourCastNet, ESRI) and feeds E2CC.
- **Our platform**: Cesium (web) + optional E2CC for heavy Omniverse visualization. We add "Open in Omniverse" / "Launch E2CC" in the web app; E2CC runs as a separate desktop or streamed application.

---

## Prerequisites

- **Hardware**: NVIDIA GPU with CUDA; sufficient VRAM for Omniverse Kit and weather NIM.
- **Software**: Docker, Kubernetes/Helm (for DFM); [Omniverse Kit](https://docs.omniverse.nvidia.com/kit/docs/kit-manual/latest/index.html) / Launcher.
- **Blueprint**: [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics). Use [01_prerequisites](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/01_prerequisites.md) (SW/HW) and [02_quickstart](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/02_quickstart.md).

---

## Как развернуть E2CC (пошагово)

Чтобы кнопка «Open in Omniverse» открывала визуализацию погоды и стресс-сценариев, нужно развернуть Earth-2 Command Center и (опционально) связать его с нашей платформой через URL.

### Шаг 0. Требования

- **Машина с NVIDIA GPU** (например Brev L40S), CUDA, достаточно VRAM для Omniverse Kit.
- **ПО:** Docker, [Omniverse Kit](https://docs.omniverse.nvidia.com/kit/docs/kit-manual/latest/index.html) или Launcher; для полного стека — MicroK8s (Kubernetes).
- Детали: [01_prerequisites](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/01_prerequisites.md).

### Шаг 1. Клонировать blueprint

```bash
git lfs install
git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git
cd earth2-weather-analytics
git lfs fetch --all
```

### Шаг 2. Запустить E2CC (один из вариантов)

**Вариант A — только E2CC (десктоп, без DFM)**

Подходит для первого запуска и проверки глобуса и UI:

```bash
./deploy/deploy_e2cc.sh -d
```

Откроется приложение с глобусом (Blue Marble). Данные погоды через DFM пока не будут доступны, пока не поднимете DFM (вариант B или C).

**Вариант B — E2CC + DFM + NIM (полный стек на MicroK8s)**

На машине с GPU и установленным MicroK8s:

```bash
# Развернуть DFM и FourCastNet NIM в Kubernetes (первый раз может занять до часа)
./deploy/deploy_microk8s.sh

# В другом терминале — собрать и запустить E2CC (десктоп)
./deploy/deploy_e2cc.sh -d
```

В E2CC: окно **Data Federation** → выбрать дату, переменную (например Wind Speed), источник (GFS или FourCastNet) → **Fetch Weather Data**. Данные появятся на глобусе и в таймлайне.

**Вариант C — E2CC Streamer (чтобы открывать из браузера)**

Если нужна кнопка «Open in Omniverse» в нашей платформе, которая открывает не пустую вкладку, а стрим E2CC:

```bash
./deploy/deploy_e2cc.sh -s
```

Запустится приложение в режиме streamer с WebRTC. В логах или в документации blueprint будет указан URL веб-страницы стримера (например `http://localhost:8010` или другой порт). Этот URL и нужно использовать как `E2CC_BASE_URL`.

### Шаг 3. Узнать URL E2CC

- **Десктоп (`-d`):** E2CC не отдаёт HTTP; кнопка «Open in Omniverse» не сможет открыть сам E2CC в браузере. Используйте десктоп для локальной визуализации; чтобы открывать из браузера — нужен streamer (`-s`).
- **Streamer (`-s`):** После запуска в консоли или в [документации blueprint](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/tree/main/e2cc/source/extensions/omni.earth_2_command_center.app.blueprint) посмотрите, на каком порту/URL доступна веб-страница стримера (часто `http://localhost:8010` или указанный в конфиге).

Если E2CC развёрнут на Brev: сделайте Port Forward для этого порта в панели Brev и получите URL вида `https://...brev.dev` или свой домен.

### Шаг 4. Прописать URL в нашей платформе

В **apps/api/.env** (локально или на сервере/Brev):

```env
E2CC_BASE_URL=http://localhost:8010
```

Подставьте свой URL, если E2CC доступен по другому адресу (например после Port Forward на Brev).

### Шаг 5. Перезапустить API

```bash
# Локально
cd apps/api && source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 9002

# На Brev
cd ~/global-risk-platform && ./scripts/brev-deploy.sh
# или только перезапуск API
pkill -f "uvicorn src.main:app"; cd ~/global-risk-platform/apps/api && source .venv/bin/activate && nohup uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
```

После этого `GET /api/v1/omniverse/status` вернёт `e2cc_configured: true`, и кнопка «Omniverse» / «Open in Omniverse» будет открывать указанный URL (с параметрами region, scenario, lat, lon).

### Кратко

| Цель | Действие |
|------|----------|
| Просто посмотреть E2CC с глобусом | `./deploy/deploy_e2cc.sh -d` |
| Погода и AI-прогноз (FourCastNet) в E2CC | Сначала `./deploy/deploy_microk8s.sh`, затем `./deploy/deploy_e2cc.sh -d` |
| Кнопка в платформе открывает E2CC в браузере | Запустить streamer: `./deploy/deploy_e2cc.sh -s`, взять URL стримера, задать `E2CC_BASE_URL`, перезапустить API |

---

## 1. Clone and build

```bash
git lfs install
git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git
cd earth2-weather-analytics
git lfs fetch --all
```

Follow the blueprint **Quickstart** and **Deployment** guides:

- [02_quickstart](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/02_quickstart.md)
- [03_microk8s_deployment](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/03_microk8s_deployment.md) (DFM via Helm)
- [04_omniverse_app](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/04_omniverse_app.md) (E2CC UI, Data Federation dialog, features)
- [05_data_federation_mesh](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/05_data_federation_mesh.md) (DFM architecture, adapters)

---

## 2. Run E2CC and DFM locally

1. **DFM (optional but recommended)**  
   Deploy DFM per [03_microk8s_deployment](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/03_microk8s_deployment.md) (Process, Execute, Redis, Scheduler). E2CC uses the Data Federation dialog to trigger pipelines (GFS, ERA5, FourCastNet, etc.) via DFM.

2. **E2CC**  
   Build and run the Kit app per [04_omniverse_app](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/04_omniverse_app.md). Use the Data Federation dialog to fetch weather data and add layers to the globe.

3. **Troubleshooting**  
   See [07_troubleshooting](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/07_troubleshooting.md).

---

## 2.1. Ошибка «Can't find extension to satisfy dependency» (streamer)

Если при запуске streamer (`./deploy/deploy_e2cc.sh -s`) появляется ошибка вида:

- `omni.kit.streamsdk.plugins = 6.2.2` — в реестре есть только 6.2.1  
- `omni.kit.widgets.custom = 1.0.10` — в реестре есть только 1.0.9  
- `omni.kit.window.section = 107.0.3` — в реестре есть только 107.0.2  

нужно подставить **доступные** версии в конфиг streamer-приложения.

**На сервере (в каталоге earth2-weather-analytics):**

```bash
cd ~/earth2-weather-analytics
# Путь к конфигу streamer (е2cc внутри репо)
KIT_FILE="e2cc/source/apps/omni.earth_2_command_center.app_streamer.kit"

# Заменить зафиксированные версии на доступные в реестре
sed -i 's/omni.kit.streamsdk.plugins-6.2.2/omni.kit.streamsdk.plugins-6.2.1/' "$KIT_FILE"
sed -i 's/omni.kit.widgets.custom-1.0.10/omni.kit.widgets.custom-1.0.9/' "$KIT_FILE"
sed -i 's/omni.kit.window.section-107.0.3/omni.kit.window.section-107.0.2/' "$KIT_FILE"
```

Проверка:

```bash
grep -E "streamsdk|widgets.custom|window.section" "$KIT_FILE"
# Должно быть: 6.2.1, 1.0.9, 107.0.2
```

После правок **пересобрать** E2CC (без `-f` достаточно перезапуска, при необходимости — clean rebuild):

```bash
./e2cc/build.sh --release --no-docker
./deploy/deploy_e2cc.sh -s
```

---

## 3. Connecting E2CC to our API

Our platform exposes:

- **Data Federation API**: `GET /api/v1/data-federation/adapters`, `GET /api/v1/data-federation/pipelines`, `POST /api/v1/data-federation/pipelines/{id}/run` (region, scenario, options). Pipelines produce geodata, climate overlay, and weather forecast.
- **Geo Data**: `GET /api/v1/geodata/hotspots`, `GET /api/v1/geodata/climate-risk`, etc.

If you extend E2CC or DFM to consume our API:

- Use `/data-federation/pipelines/geodata_risk/run` or `climate_stress/run` with `region` (lat/lon + radius or bbox), `scenario`, and `options`.
- Use `/geodata/*` for hotspots and climate overlay in existing formats.

Document the exact request/response format and any bridge service (e.g. small proxy that maps our API to DFM-style pipelines) in this repo or in a separate integration doc.

---

## 4. "Open in Omniverse" / Launch E2CC

The web app (Command Center, Present) provides an "Open in Omniverse" / "Launch E2CC" entry point:

- **Option A**: Open a new tab to a **launch URL** that includes context (e.g. `region`, `scenario`, `narrative`). The URL can point to:
  - Our backend: `GET /api/v1/omniverse/launch?region=...&scenario=...` (returns redirect or `{ "launch_url": "..." }`), or
  - A configurable **E2CC base URL** (e.g. local E2CC UI or a deployed front-end) with the same query params.

- **Option B**: E2CC runs as a **local desktop app**. The button opens a deep link or launcher (e.g. `omniverse://...` or local URL) with context. E2CC reads params and, if configured, loads data from our API or DFM.

Configure (API `settings` / env):

- `E2CC_BASE_URL`: default launch URL for E2CC (e.g. `http://localhost:8010`). Used by `GET /api/v1/omniverse/launch` to build `launch_url`.
- `E2CC_LAUNCH_URL`: optional override for the "Open in Omniverse" link (if we add a dedicated launch URL config later).

See also **Omniverse UI** integration (e.g. `apps/web` Command Center / Present) for the actual button and client-side link.

---

## 5. Nucleus and assets

We use the structure in [OMNIVERSE_NUCLEUS_ASSET_LIBRARY](OMNIVERSE_NUCLEUS_ASSET_LIBRARY.md) and `nucleus_fetch` for USD/GLB. E2CC can use the **same Nucleus** (mount or `omniverse://` URL) for:

- Layers, textures, and assets produced by our pipelines (if we export them to Nucleus).
- Reference assets under `/Library/...` or `/Projects/...`.

Ensure `NUCLEUS_URL`, `NUCLEUS_LIBRARY_ROOT`, `NUCLEUS_PROJECTS_ROOT` (and optional `NUCLEUS_MOUNT_DIR`) are set consistently for both our API and E2CC.

---

## 6. WebRTC (future)

The blueprint includes a [WebRTC extension](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/tree/main/e2cc/source/extensions/omni.earth_2_command_center.app.blueprint) to stream E2CC to the browser. Planned next steps:

- Enable WebRTC streaming per blueprint docs.
- Add a dedicated "Omniverse View" page in the web app that embeds the WebRTC stream from E2CC.

This is **not** required for the initial "Open in Omniverse" launch; it is a follow-up enhancement.

---

## Quick reference

| Resource | Link |
|----------|------|
| Blueprint repo | [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics) |
| Workflow / Quickstart | [00_workflow](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/00_workflow.md), [02_quickstart](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/02_quickstart.md) |
| DFM | [05_data_federation_mesh](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/05_data_federation_mesh.md) |
| E2CC (Kit app) | [04_omniverse_app](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/04_omniverse_app.md) |
| Deployment | [03_microk8s_deployment](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/03_microk8s_deployment.md) |
| Nucleus layout | [OMNIVERSE_NUCLEUS_ASSET_LIBRARY](OMNIVERSE_NUCLEUS_ASSET_LIBRARY.md) |
