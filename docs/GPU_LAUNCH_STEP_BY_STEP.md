# Запуск на GPU — пошагово (для чайников)

NGC ключ у вас уже есть. Ниже — только то, что нужно сделать по шагам. Всё, что можно было автоматизировать в репозитории, уже сделано; остальное — команды, которые вы копируете и вставляете.

---

## Часть A. На вашем компьютере (перед тем как лезть на сервер)

### Шаг A1. Откройте терминал

macOS: Terminal или iTerm. Windows: PowerShell или WSL.

### Шаг A2. Подготовьте NGC ключ

Запишите ключ в удобное место (блокнот, парольник). Он понадобится на сервере в шаге B7.  
Формат: длинная строка вида `nvapi-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

### Шаг A3. Узнайте, как подключаться к GPU-серверу

У вас инстанс AWS g6e.xlarge. Нужно:

- **IP сервера** — после запуска инстанса в AWS Console возьмите Public IPv4 (или используйте Elastic IP, если настроен).
- **Ключ SSH** — тот же, что при создании инстанса (у вас указан `risk-platform-g5`).
- **Пользователь** — для Ubuntu AMI обычно `ubuntu`.

Пример (подставьте свой IP и путь к ключу):

```bash
ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@ВАШ_PUBLIC_IP
```

Если ключ лежит в другом месте, замените `~/.ssh/risk-platform-g5.pem`.  
Первый раз спросит «Are you sure?» — напишите `yes` и Enter.

---

## Часть B. На GPU-сервере (все команды — внутри SSH-сессии)

Подключились по SSH? Дальше всё делаем **на сервере**, по порядку.

### Шаг B1. Проверить, что виден GPU

Вставьте и нажмите Enter:

```bash
nvidia-smi
```

Должна появиться таблица с видеокартой (NVIDIA L4 или аналог). Если команды нет или ошибка — на этой AMI драйвер уже стоит; при другой ОС смотрите [доку NVIDIA](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html).

### Шаг B2. Установить Docker (если ещё нет)

Проверка:

```bash
docker --version
```

Если команды нет, выполните:

```bash
sudo apt update
sudo apt install -y docker.io
sudo usermod -aG docker $USER
```

Напишите `exit`, Enter, зайдите по SSH снова (чтобы группа `docker` применилась), затем снова зайдите в репо (шаг B3).

### Шаг B3. Установить NVIDIA Container Toolkit (чтобы Docker видел GPU)

По очереди (если одна из команд выдаст ошибку — смотрите [официальную инструкцию](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) для вашей версии Ubuntu):

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /usr/share/keyrings/nvidia-container-toolkit.list > /dev/null
sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Проверка (должен вывести то же, что `nvidia-smi`):

```bash
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

Если образ не найден, попробуйте: `nvidia/cuda:12.4.0-base-ubuntu22.04`.

### Шаг B4. Доставить код на сервер

**Вариант 0 — деплой с локальной машины (рекомендуется, если на GitHub не всё актуально).**

**Полная команда с ключом Cesium и запуском бэкенда/фронта на GPU-сервере** — выполните на **Mac** из корня проекта (подставьте свой IP, путь к ключу и при необходимости токен Cesium Ion):

```bash
cd ~/global-risk-platform

# GPU-сервер
export DEPLOY_HOST=34.238.171.112
export DEPLOY_PORT=22
export DEPLOY_USER=ubuntu
export DEPLOY_PROJECT_DIR=/home/ubuntu/global-risk-platform
export SSH_KEY=~/Downloads/risk-platform-g5.pem
export DEPLOY_DOMAIN=

# Cesium Ion (глобус, NASA/OSM): подставьте свой токен с https://ion.cesium.com/
# Если не задать — в сборке подставится дефолтный токен из скрипта
export VITE_CESIUM_ION_TOKEN="ВАШ_CESIUM_ION_TOKEN"

./deploy-safe.sh
```

Скрипт: соберёт архив, загрузит на сервер, распакует, поставит зависимости, **соберёт фронт с вашим Cesium token**, перезапустит **бэкенд (API на 9002)** и **фронт (5180)**. После деплоя зайдите по SSH и при необходимости выполните **B5–B7** (NIM в `.env`, setup-server-gpu, brev-start-nim с NGC ключом), затем **B12** для проверки.

**Полный стек (что у вас есть в платформе):**

| Компонент | Назначение | Как включить на GPU-сервере |
|-----------|------------|------------------------------|
| **Погода (NIM)** | FourCastNet — прогноз погоды для стресс-тестов и climate | Шаги B5–B7: `.env` (USE_LOCAL_NIM, FOURCASTNET_NIM_URL) + `./scripts/brev-start-nim.sh` с NGC ключом. Обязательный минимум. |
| **Глобус (Cesium)** | 3D-глобус, NASA/OSM, рельеф | Токен задаётся при деплое: `export VITE_CESIUM_ION_TOKEN="..."` перед `./deploy-safe.sh`. Или дефолт из скрипта. |
| **Omniverse (E2CC)** | Earth-2 Command Center, кнопка «Open in Omniverse» | Опционально. Сборка из репо [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics), порт 8010. В `.env`: `E2CC_BASE_URL=http://localhost:8010`. Подробно: [E2CC_ON_SERVER_AND_STRESS_TESTS.md](E2CC_ON_SERVER_AND_STRESS_TESTS.md). |
| **Озвучка (Riva TTS)** | Озвучивание текста голосом | Опционально. Контейнер Riva (порт 50051), в `.env`: `ENABLE_RIVA=true`, `RIVA_URL=http://localhost:50051`. Подробно: [GPU_LOCAL_TESTING_CHECKLIST.md](GPU_LOCAL_TESTING_CHECKLIST.md) (раздел 2.6), [GTC_NVIDIA_SETUP.md](GTC_NVIDIA_SETUP.md). |

Минимум для работы: **погода (NIM)** + **глобус (Cesium token)**. Остальное — по желанию и по отдельным гайдам.

**Все NVIDIA-сервисы (как в Health / Config в UI):**

| Сервис | Назначение | Порт | Переменные в `apps/api/.env` | Проверка |
|--------|------------|------|------------------------------|----------|
| **Earth-2 FourCastNet NIM** | Погода, climate stress pipeline | 8001 | `USE_LOCAL_NIM=true`, `FOURCASTNET_NIM_URL=http://localhost:8001` | `GET http://localhost:8001/v1/health/ready` |
| **Earth-2 CorrDiff NIM** | High-resolution climate downscaling | 8000 | `USE_LOCAL_NIM=true`, `CORRDIFF_NIM_URL=http://localhost:8000` | `GET http://localhost:8000/v1/health/ready` |
| **NVIDIA Riva** | Озвучка (SENTINEL, TTS для отчётов, голосовой интерфейс) | 50051 | `ENABLE_RIVA=true`, `RIVA_URL=http://localhost:50051` | `POST /api/v1/nvidia/riva/tts`, `POST /api/v1/nvidia/riva/stt` |
| **NVIDIA Dynamo** | Низколатентный inference при масштабировании агентов | 8004 | `ENABLE_DYNAMO=true`, `DYNAMO_URL=http://localhost:8004` | Роутинг LLM при включённом Dynamo |
| **Triton Inference Server** | Self-hosted LLM/embeddings (TensorRT-LLM backend) | 8000* | `ENABLE_TRITON=true`, `TRITON_URL=http://localhost:8000`, `TRITON_LLM_MODEL=nemotron` | Model serving при роутинге LLM в Triton |

\* Triton и CorrDiff по умолчанию оба на 8000 — при одновременном запуске задайте Triton на другом порту (например 8003) и укажите `TRITON_URL=http://localhost:8003`.

Краткий вариант без своего Cesium (будет дефолтный токен):

```bash
cd ~/global-risk-platform
export DEPLOY_HOST=34.238.171.112
export DEPLOY_PORT=22
export DEPLOY_USER=ubuntu
export DEPLOY_PROJECT_DIR=/home/ubuntu/global-risk-platform
export SSH_KEY=~/Downloads/risk-platform-g5.pem
export DEPLOY_DOMAIN=
./deploy-safe.sh
```

**Вариант 1 — с GitHub.** Клонируем в папку `global-risk-platform` (подставьте свой логин вместо `MRsaa1`, если репо под другой учёткой):

```bash
cd ~
git clone https://github.com/MRsaa1/Global-Risk-Intelligence-Platform.git global-risk-platform
cd global-risk-platform
```

**Вариант 2 — репо уже есть** (например, залили архивом или делали деплой с Mac):

```bash
cd ~/global-risk-platform
git pull
```

**Вариант 3 — без GitHub и без deploy-safe:** перенесите проект архивом и распакуйте в `~/global-risk-platform`. Подробности: [DEPLOY_SAFE.md](../DEPLOY_SAFE.md).

### Шаг B5. Создать файл с переменными для API (один раз)

Выполните:

```bash
mkdir -p ~/global-risk-platform/apps/api
cat >> ~/global-risk-platform/apps/api/.env << 'EOF'
USE_SQLITE=true
DATABASE_URL=sqlite:///./prod.db
USE_LOCAL_NIM=true
FOURCASTNET_NIM_URL=http://localhost:8001
USE_DATA_FEDERATION_PIPELINES=true
EOF
```

Так в `apps/api/.env` появятся нужные для GPU и NIM строки. Если файл уже был — команда просто допишет их в конец. Дубликаты можно потом вручную убрать (оставить по одному `USE_LOCAL_NIM=true` и т.д.).

### Шаг B6. Запустить скрипт настройки сервера (допишет .env и создаст проверку)

```bash
cd ~/global-risk-platform
chmod +x scripts/setup-server-gpu.sh scripts/brev-start-nim.sh scripts/start-nvidia-nim.sh 2>/dev/null || true
./scripts/setup-server-gpu.sh
```

Скрипт допишет в `apps/api/.env` недостающие переменные и создаст `scripts/check-server-gpu.sh`.

### Шаг B7. Запустить FourCastNet NIM (подставить свой NGC ключ)

**Замените `ВАШ_NGC_КЛЮЧ`** на ваш реальный ключ и выполните одной строкой:

```bash
cd ~/global-risk-platform
export NGC_API_KEY=ВАШ_NGC_КЛЮЧ
./scripts/brev-start-nim.sh
```

Или сначала задать ключ, потом запуск:

```bash
export NGC_API_KEY=nvapi-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
./scripts/brev-start-nim.sh
```

Подождите около минуты. В конце должно быть: `✓ FourCastNet NIM ready on http://localhost:8001`.

Проверка вручную:

```bash
curl -s http://localhost:8001/v1/health/ready
```

В ответе должно быть слово `ready`.

### Шаг B8. Установить зависимости API (Python)

```bash
cd ~/global-risk-platform/apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[dev]"
cd ~/global-risk-platform
```

Если будет ошибка по `.[dev]`, попробуйте: `pip install -e .`

### Шаг B9. Запустить API

```bash
cd ~/global-risk-platform/apps/api
source .venv/bin/activate
nohup uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
```

Проверка (через пару секунд):

```bash
curl -s http://localhost:9002/api/v1/health | head -5
```

Должен вернуться JSON. Если пусто — смотрите лог: `tail -50 /tmp/api.log`.

### Шаг B10. Установить зависимости Web (Node) и собрать фронт

```bash
cd ~/global-risk-platform/apps/web
npm ci
npm run build
```

Если `npm ci` ругается на версию Node — установите Node 18+ (например через `nvm` или `sudo apt install nodejs npm` и при необходимости обновите).

### Шаг B11. Запустить веб-сервер (раздача фронта)

Вариант 1 — через `serve` (установить один раз: `npm install -g serve`):

```bash
cd ~/global-risk-platform/apps/web
nohup npx serve -s dist -l 5180 > /tmp/web.log 2>&1 &
```

Вариант 2 — dev-режим (для отладки, пока держите терминал открытым):

```bash
cd ~/global-risk-platform/apps/web
npm run dev
```

Фронт будет на порту 5180.

### Шаг B12. Проверить всё одной командой

```bash
cd ~/global-risk-platform
./scripts/check-server-gpu.sh
```

Должны быть: NIM ready, API up, DFM on, NIM health healthy. E2CC может быть "not deployed" — это норма, если вы его не ставили.

---

## После deploy-safe: только GPU/NIM (одним блоком)

Если вы залили проект с Mac через `./deploy-safe.sh`, зайдите на сервер по SSH и выполните **одним блоком** (подставьте свой NGC ключ вместо `ВАШ_NGC_КЛЮЧ`):

```bash
# Подключение: ssh -i ~/Downloads/risk-platform-g5.pem ubuntu@34.238.171.112

cd ~/global-risk-platform

# B5 — дописать NIM в .env (если ещё нет)
grep -q "USE_LOCAL_NIM" apps/api/.env 2>/dev/null || cat >> apps/api/.env << 'EOF'
USE_LOCAL_NIM=true
FOURCASTNET_NIM_URL=http://localhost:8001
USE_DATA_FEDERATION_PIPELINES=true
EOF

# B6 — настройка
chmod +x scripts/setup-server-gpu.sh scripts/brev-start-nim.sh scripts/start-nvidia-nim.sh 2>/dev/null || true
./scripts/setup-server-gpu.sh

# B7 — запуск NIM (подставьте свой ключ!)
export NGC_API_KEY=ВАШ_NGC_КЛЮЧ
./scripts/brev-start-nim.sh

# Подождите ~1 мин, затем проверка B12
sleep 60
./scripts/check-server-gpu.sh
```

Если поднимете **Omniverse (E2CC)** или **Riva (озвучка)** — добавьте в `apps/api/.env` и перезапустите API:
- E2CC: `E2CC_BASE_URL=http://localhost:8010`
- Riva TTS: `ENABLE_RIVA=true`, `RIVA_URL=http://localhost:50051`

После этого переходите к **Части C** (как открыть интерфейс в браузере).

---

## Часть C. Как зайти в интерфейс и проверить проект

### Порты на сервере

| Порт | Сервис | Что смотреть |
|------|--------|--------------|
| **5180** | Фронт (веб-интерфейс) | Command Center, дашборды, стресс-тесты |
| **9002** | API | Документация Swagger, health, все эндпоинты |
| **8001** | FourCastNet NIM | Погода/GPU-инференс (внутренний, с браузера не открывать) |

Проверка с **сервера** (в SSH):

```bash
curl -s http://localhost:5180 | head -3
curl -s http://localhost:9002/api/v1/health
curl -s http://localhost:8001/v1/health/ready
```

### Как открыть проект с вашего компьютера

Сервер слушает 9002 и 5180, но снаружи они часто закрыты фаерволом. Два варианта.

### Вариант 1: Проброс портов по SSH (самый простой)

**На вашем компьютере** (не на сервере) откройте новый терминал и выполните (подставьте свой IP и путь к ключу):

```bash
ssh -i ~/.ssh/risk-platform-g5.pem -L 5180:localhost:5180 -L 9002:localhost:9002 ubuntu@ВАШ_PUBLIC_IP
```

Оставьте это окно открытым. В браузере: **http://127.0.0.1:5180/command** и **http://127.0.0.1:9002/docs**.

**Если на Mac уже запущен локальный проект на 5180/9002** — туннель выдаст «Address already in use». Используйте другие локальные порты:

```bash
ssh -i ~/.ssh/risk-platform-g5.pem -L 15180:localhost:5180 -L 19002:localhost:9002 ubuntu@ВАШ_PUBLIC_IP
```

Тогда открывайте: **http://127.0.0.1:15180/command** и **http://127.0.0.1:19002/docs** (локальный проект остаётся на 5180 и 9002).

Внизу слева в Command Center должен быть зелёный бейдж **GPU mode** и **NIM: ✓ FourCastNet**.

### Вариант 2: Открыть порты в AWS

В AWS Console: Security Group инстанса → Inbound rules → добавить правила: TCP 5180 и TCP 9002 с вашего IP (или 0.0.0.0/0 для теста). Тогда в браузере открывать: `http://ВАШ_PUBLIC_IP:5180/command`.

### Кратко: как проверить проект

| Где | URL | Что проверить |
|-----|-----|----------------|
| **У себя в браузере** (после SSH-проброса) | http://127.0.0.1:5180 | Главная, логин |
| | http://127.0.0.1:5180/command | Command Center, бейдж **GPU mode** и **NIM: ✓ FourCastNet** |
| | http://127.0.0.1:9002/docs | Swagger API, эндпоинты |
| **На сервере** (в SSH) | `./scripts/check-server-gpu.sh` | NIM ready, API up, DFM on |

Если открывали порты в AWS (Вариант 2), вместо `127.0.0.1` подставьте публичный IP сервера (например `http://34.238.171.112:5180/command`).

**Туннель на другие порты (15180 / 19002):** если фронт открыт на порту 15180, а API на 19002, откройте страницу **с параметром `?api=`**, чтобы запросы и WebSocket шли на API:
- **http://127.0.0.1:15180/command?api=http://127.0.0.1:19002**
- Или главная: **http://127.0.0.1:15180?api=http://127.0.0.1:19002**
Без этого фронт будет слать запросы на 15180 и получите ошибки WebSocket и «Unexpected token '<'».

---

## Часть D. Что проверить в интерфейсе

1. Открыть http://127.0.0.1:5180/command (или ваш IP:5180).
2. Внизу слева — бейдж **GPU mode** и **NIM: ✓ FourCastNet**.
3. Нажать кнопку **Test weather (NIM)** — должно появиться что-то вроде «4 steps from FourCastNet NIM ✓».
4. Запустить стресс-тест (Run stress test), открыть отчёт — в блоке про погоду должно быть: **FourCastNet NIM (GPU)**.

Если что-то из этого не так — снова выполните на сервере `./scripts/check-server-gpu.sh` и пришлите вывод.

---

## Краткая шпаргалка команд (на сервере)

| Действие | Команда |
|----------|--------|
| Проверка NIM + API + DFM | `cd ~/global-risk-platform && ./scripts/check-server-gpu.sh` |
| Перезапустить NIM | `cd ~/global-risk-platform && export NGC_API_KEY=ваш_ключ && ./scripts/brev-start-nim.sh` |
| Остановить NIM | `docker compose -f ~/global-risk-platform/docker-compose.nim-fourcastnet.yml down` |
| Лог API | `tail -f /tmp/api.log` |
| Лог Web | `tail -f /tmp/web.log` |
| Убить API (чтобы перезапустить) | `pkill -f "uvicorn src.main:app"` |

---

## Insufficient capacity (нет свободных инстансов g6e.xlarge)

Если при запуске инстанса AWS пишет: **«Failed to start the instance due to insufficient capacity»** — в выбранной Availability Zone временно нет свободных машин запрошенного типа.

### Вариант 1: Другая Availability Zone (рекомендуется)

Оставляем тип **g6e.xlarge**, меняем только зону:

1. EC2 → **Instances** → выберите остановленный инстанс (например `i-0d90bc543568faadb`).
2. **Actions** → **Image and templates** → **Create image** (имя: `grp-gpu-backup`).
3. Дождитесь появления AMI (**EC2 → AMIs**).
4. **Launch instance from AMI** → выберите созданный AMI.
5. Выберите **другую AZ**: us-east-1a, 1b, 1c, 1e или 1f (не ту, где была ошибка, например не 1d).
6. Instance type: **g6e.xlarge**, тот же key pair (**risk-platform-g5**) и security group.
7. Запустите инстанс, возьмите новый **Public IPv4** и используйте его в туннеле и деплое (см. шаг B4 и Часть C).

Старый инстанс можно потом удалить (terminate), когда убедитесь, что новый работает.

### Вариант 2: Другой тип инстанса в той же AZ

Если нужно остаться в той же зоне:

1. EC2 → выберите **остановленный** инстанс.
2. **Actions** → **Instance settings** → **Change instance type**.
3. Выберите один из типов из таблицы ниже (проверьте в консоли, у какого есть capacity).
4. **Apply** → **Start instance**.

**Альтернативные GPU-типы** (под платформу: Ubuntu, Docker, NVIDIA NIM, FourCastNet):

| Тип | GPU | VRAM | Примечание |
|-----|-----|------|------------|
| **g6e.xlarge** | L4 | 24 GB | Исходный тип; при отсутствии capacity — сменить AZ или тип. |
| **g6e.2xlarge** | L4 | 24 GB | Больше vCPU/RAM; часто есть capacity. |
| **g5.xlarge** | A10G | 24 GB | Другое семейство; драйвер/NIM те же. |
| **g5.2xlarge** | A10G | 24 GB | Больше vCPU/RAM. |
| **g4dn.xlarge** | T4 | 16 GB | Старше, часто есть capacity; NIM может требовать меньше памяти. |

После смены типа проверьте на сервере: `nvidia-smi`, затем снова [шаги B7–B12](#шаг-b7-запустить-fourcastnet-nim-подставить-свой-ngc-ключ).

### Если не помогает

- Повторить запуск **через несколько часов** (capacity меняется).
- В **другом регионе** (например us-west-2): создать новый инстанс из того же AMI, тот же тип и ключ; использовать новый IP в деплое и туннеле.
- **On-Demand Capacity Reservation** для g6e.xlarge в нужной AZ — если нужна гарантированная доступность.

---

## Если что-то пошло не так

- **NIM не ready** — подождите 1–2 минуты после `brev-start-nim.sh`. Проверьте: `docker ps` (должен быть контейнер fourcastnet). Проверьте ключ: `echo $NGC_API_KEY` (не пустой).
- **API не поднимается** — смотрите `tail -100 /tmp/api.log`. Часто не хватает переменных: откройте `apps/api/.env` и убедитесь, что есть `USE_SQLITE=true`, `DATABASE_URL=...`, `USE_LOCAL_NIM=true`, `FOURCASTNET_NIM_URL=http://localhost:8001`.
- **Нет бейджа GPU mode** — в браузере вы обращаетесь к фронту (5180), а фронт дергает API (9002). Убедитесь, что в UI в настройках или через прокси запросы идут на тот же хост, где запущен API (при порт-форварде оба на localhost — ок).
- **502 / не открывается страница** — проверьте, что процессы живы: на сервере `curl -s http://localhost:5180 | head -5` и `curl -s http://localhost:9002/api/v1/health | head -5`.

Полный список тестов и опциональные сервисы (CorrDiff, E2CC, Riva): [GPU_LOCAL_TESTING_CHECKLIST.md](GPU_LOCAL_TESTING_CHECKLIST.md). Аудит и список всего, что ставить и тестировать: [GPU_LAUNCH_AUDIT.md](GPU_LAUNCH_AUDIT.md).
