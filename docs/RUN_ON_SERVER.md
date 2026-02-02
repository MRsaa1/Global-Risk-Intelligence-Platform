# Команды на сервере saaaliance (GPU)

Копируй и выполняй на сервере (Brev, 89.169.99.0). Порядок: проверка → NIM → деплой платформы → E2CC (опционально) → перезапуск API.

---

## 0. Одна команда — настройка всего (рекомендуется)

После того как код уже на сервере (через `brev copy` + распаковка или `brev open saaaliance cursor`):

```bash
cd ~/global-risk-platform
./scripts/setup-server-gpu.sh
```

Скрипт: дополняет `apps/api/.env` (USE_DATA_FEDERATION_PIPELINES, USE_LOCAL_NIM, FOURCASTNET_NIM_URL, E2CC_BASE_URL), создаёт `check-server-gpu.sh` при отсутствии, перезапускает API, выводит проверку. NIM и E2CC нужно запускать отдельно (см. ниже).

---

## 1. Проверка (NIM, API, DFM, E2CC)

```bash
cd ~/global-risk-platform
./scripts/check-server-gpu.sh
```

---

## 2. Запуск FourCastNet NIM (GPU)

```bash
cd ~/global-risk-platform
export NGC_API_KEY=your_ngc_key   # https://ngc.nvidia.com → Setup → API Key
./scripts/brev-start-nim.sh
# Проверка: curl -s http://localhost:8001/v1/health/ready
```

---

## 3. Деплой платформы (API + Web)

```bash
cd ~/global-risk-platform
./scripts/brev-deploy.sh
```

После деплоя в `apps/api/.env` уже стоят:
- `USE_DATA_FEDERATION_PIPELINES=true`
- `USE_LOCAL_NIM=true`
- `FOURCASTNET_NIM_URL=http://localhost:8001`

При необходимости добавь вручную:
- `NVIDIA_API_KEY=...` — для LLM и отчётов по стресс-тестам.

---

## 4. E2CC (Omniverse Earth-2) — связь с проектом

Когда захочешь, чтобы кнопка «Open in Omniverse» открывала Earth-2 Command Center:

**4.1. Клонировать и запустить E2CC в режиме streamer**

```bash
cd ~
git lfs install
git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git
cd earth2-weather-analytics
git lfs fetch --all
./deploy/deploy_e2cc.sh -s
```

В логах будет URL стримера (часто `http://localhost:8010`). Если нужен доступ снаружи — настрой Port Forward на этот порт.

**4.2. Прописать URL в проекте**

В `apps/api/.env` задай `E2CC_BASE_URL`. Кнопка «Open in Omniverse» станет активной только если URL **не** localhost (иначе API считает E2CC не развёрнутым).

```bash
# Если открываешь E2CC с того же сервера — можно localhost (но кнопка в UI останется «E2CC n/a»):
# E2CC_BASE_URL=http://localhost:8010

# Чтобы кнопка открывала E2CC из браузера — укажи URL, по которому доступен стример (после Port Forward):
# E2CC_BASE_URL=http://89.169.99.0:8010
# или E2CC_BASE_URL=https://your-e2cc-domain.brev.dev
```

**4.3. Перезапустить API**

```bash
cd ~/global-risk-platform/apps/api
source .venv/bin/activate
pkill -f "uvicorn src.main:app" 2>/dev/null || true
nohup uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
```

---

## 5. Проверка снова

```bash
cd ~/global-risk-platform
./scripts/check-server-gpu.sh
```

Открой Command Center в браузере (через Port Forward на web/API). Внизу слева должны быть: **NIM: ✓ FourCastNet | E2CC: … | DFM: on** и кнопка **Test weather (NIM)**.

---

Подробнее: **docs/SERVER_GPU_CLIMATE_OMNIVERSE.md**, **docs/OMNIVERSE_E2CC_SETUP.md**.
