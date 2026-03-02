# Безопасный деплой (базы и ключи сохраняются)

**Полный чеклист по базам и ключам:** [docs/DEPLOY_FULL.md](docs/DEPLOY_FULL.md) — все БД (SQLite, PostgreSQL, TimescaleDB, Neo4j, Redis, MinIO), все переменные окружения и API-ключи.

---

## Одна команда для деплоя на сервер

### Contabo — наш способ (рекомендуется) ✅

Для деплоя на Contabo используется **`scripts/deploy-contabo-now.sh`**. Подробно: [docs/DEPLOY_CONTABO.md](docs/DEPLOY_CONTABO.md).

**Важно:** команды нужно запускать из корня репозитория (каталог, где лежат папки `apps/`, `scripts/` и файл `deploy-safe.sh`). Сначала перейдите в этот каталог:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
chmod +x scripts/deploy-contabo-now.sh
./scripts/deploy-contabo-now.sh
```

Если проект у вас в другом месте (например `~/global-risk-platform`), подставьте свой путь: `cd ~/global-risk-platform`, затем те же две строки с chmod и скриптом.

**Что делает:** архив без node_modules/.git/.env → копирование на сервер → **локальный `apps/api/.env` копируется на сервер** (ключи переносятся) → на сервере: распаковка, production DATABASE_URL и CORS, venv, pip, alembic, npm install + build, перезапуск API и фронта.

**По умолчанию:** хост `173.212.208.123`, порт `32769`, пользователь `arin`, каталог `/home/arin/global-risk-platform`, домен `risk.saa-alliance.com`.

**Если вход по SSH-ключу:**

```bash
export SSH_KEY=~/.ssh/id_ed25519_contabo
./scripts/deploy-contabo-now.sh
```

**Проверка SSH перед деплоем:**

```bash
ssh -p 32769 -i ~/.ssh/id_ed25519_contabo arin@173.212.208.123 true
```

(или `arin@contabo` если в `~/.ssh/config` есть Host contabo.)

---

### Альтернатива: deploy-safe.sh (базы и ключи только с сервера)

Скрипт **deploy-safe.sh** не копирует локальный `.env` — на сервере сохраняются и восстанавливаются только уже существующие `.env` и `*.db`. Удобен, когда ключи и базы настраиваются только на сервере. По умолчанию тоже Contabo. Команда:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform && ./deploy-safe.sh
```

### Другой сервер (GPU / VPS): подставьте хост, порт, пользователя, каталог и ключ

```bash
export DEPLOY_HOST=34.238.171.112
export DEPLOY_PORT=22
export DEPLOY_USER=ubuntu
export DEPLOY_PROJECT_DIR=/home/ubuntu/global-risk-platform
export SSH_KEY=~/.ssh/risk-platform-g5.pem
cd /Users/artur220513timur110415gmail.com/global-risk-platform && ./deploy-safe.sh
```

Для Contabo с другим ключом или доменом:

```bash
export DEPLOY_HOST=contabo
export DEPLOY_PORT=32769
export DEPLOY_USER=arin
export DEPLOY_PROJECT_DIR=/home/arin/global-risk-platform
export DEPLOY_DOMAIN=risk.saa-alliance.com
export SSH_KEY=~/.ssh/id_ed25519_contabo
cd /Users/artur220513timur110415gmail.com/global-risk-platform && ./deploy-safe.sh
```

**Перед первым деплоем:** убедитесь, что по SSH заходите без запроса пароля (`ssh -p <PORT> -i <SSH_KEY> <USER>@<HOST> true`). На сервере не трогайте `apps/api/.env` вручную перед деплоем — скрипт восстановит его из `~/pfrp-preserve/`.

---

## Запуск на GPU-сервере (AWS)

Из корня проекта на Mac. Подставьте свой IP и ключ (пример: `34.238.171.112`, `~/.ssh/risk-platform-g5.pem`).

**Быстрый запуск (скрипт поднимает API и фронт на сервере, выводит команду туннеля):**
```bash
cd ~/global-risk-platform && ./scripts/run-gpu-from-mac.sh
```
С другим хостом/ключом:
```bash
cd ~/global-risk-platform && GPU_IP=34.238.171.112 SSH_KEY=~/.ssh/risk-platform-g5.pem ./scripts/run-gpu-from-mac.sh
```
С NIM:
```bash
cd ~/global-risk-platform && NGC_API_KEY=ваш_ngc_api_key ./scripts/run-gpu-from-mac.sh
```

**Обновить код на сервере.** На GPU-сервере часто нет git (папка залита без клонирования). Тогда обновление — только с Mac.

- **Вариант 1 — полный деплой архивом (рекомендуется):** с Mac залить весь код, на сервере сохраняются `.env` и базы, затем перезапуск.
```bash
export DEPLOY_HOST=34.238.171.112
export DEPLOY_PORT=22
export DEPLOY_USER=ubuntu
export DEPLOY_PROJECT_DIR=/home/ubuntu/global-risk-platform
export SSH_KEY=~/.ssh/risk-platform-g5.pem
cd ~/global-risk-platform && ./deploy-safe.sh
```

- **Вариант 2 — только перезапуск API/фронта** (код на сервере уже актуальный, например вы скопировали один файл):
```bash
ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@34.238.171.112 'cd ~/global-risk-platform && ./scripts/run-on-gpu-server.sh'
```

- **Вариант 3 — на сервере есть git** (если вы один раз сделали `git clone` в `~/global-risk-platform`):
```bash
cd ~/global-risk-platform && git pull
ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@34.238.171.112 'cd ~/global-risk-platform && git pull && ./scripts/run-on-gpu-server.sh'
```

**Туннель (отдельный терминал, не закрывать):**
```bash
ssh -i ~/.ssh/risk-platform-g5.pem -L 15180:localhost:5180 -L 19002:localhost:9002 ubuntu@34.238.171.112
```
В браузере: **http://127.0.0.1:15180?api=http://127.0.0.1:19002**

Подробный чеклист: [docs/GPU_LAUNCH_STEP_BY_STEP.md](docs/GPU_LAUNCH_STEP_BY_STEP.md).  
**Тестирование всего по пунктам:** [docs/GPU_TESTING_CHECKLIST.md](docs/GPU_TESTING_CHECKLIST.md) — туннель, API/NIM, Command Center, Stress Test, BCP, Municipal, AI в отчёте.

---

## Деплой через deploy-safe.sh (другой хост, в т.ч. Contabo)

Скрипт собирает архив, на сервере сохраняет `.env` и базы → распаковывает код → восстанавливает `.env` и базы → ставит зависимости → миграции → сборка фронта → перезапуск API и веб. Из корня проекта:

```bash
cd ~/global-risk-platform && ./deploy-safe.sh
```

Хост, порт, пользователь и каталог задаются переменными. **Пример для GPU (ubuntu, порт 22):**
```bash
export DEPLOY_HOST=34.238.171.112
export DEPLOY_PORT=22
export DEPLOY_USER=ubuntu
export DEPLOY_PROJECT_DIR=/home/ubuntu/global-risk-platform
export SSH_KEY=~/.ssh/risk-platform-g5.pem
cd ~/global-risk-platform && ./deploy-safe.sh
```

**Пример для другого сервера (Contabo):** [docs/GPU_LAUNCH_STEP_BY_STEP.md](docs/GPU_LAUNCH_STEP_BY_STEP.md) — шаг B4; или задайте свои значения:
```bash
export DEPLOY_HOST=contabo
export DEPLOY_PORT=32769
export DEPLOY_USER=arin
export DEPLOY_PROJECT_DIR=/home/arin/global-risk-platform
export DEPLOY_DOMAIN=risk.saa-alliance.com
export SSH_KEY=~/.ssh/id_ed25519_contabo
cd ~/global-risk-platform && ./deploy-safe.sh
```
Таймаута нет — keepalive 60s, до 2400 раз.

## Что делает скрипт

1. Собирает архив (без `node_modules`, `.env`, `*.db`, `.git`, а также без больших статик-каталогов `apps/web/public/models`, `samples`, `xeokit-data` — они грузятся отдельно).
2. **На сервере:** копирует все `apps/api/.env*` и все `*.db` (в т.ч. из `apps/api/data/`) в `~/pfrp-preserve/`.
3. Загружает архив на сервер, распаковывает новую версию в `DEPLOY_PROJECT_DIR`.
4. **Восстанавливает** все `.env*` и `*.db` из `~/pfrp-preserve/` в `apps/api/`.
5. **Step 4b:** загружает статику (3D-модели GLB, samples, xeokit-data) через **rsync** — при первом деплое полная загрузка (~660 MB), при повторных только изменённые файлы. На Mac и на сервере должен быть установлен `rsync` (обычно уже есть).
6. Если `.env` после восстановления нет (первый деплой) — создаёт шаблон в **`apps/api/.env`** (CORS, `ALLOW_SEED_IN_PRODUCTION=true`; ключи добавить вручную). Если `.env` есть — выставляет `ALLOW_SEED_IN_PRODUCTION=true` (демо-сервер).
7. Ставит зависимости, запускает миграции (при ошибке — предупреждение, деплой не прерывается), собирает фронт, перезапускает API и веб.
8. После проверки здоровья API: при `ALLOW_SEED_IN_PRODUCTION=true` выполняет полный сид — демо-данные (активы + Digital Twins + 3D-модели), модули (CIP, SCSS, SRO), стресс-тесты, синхронизацию режима (PD/LGD на твинах).

**Где .env на сервере:** только в `apps/api/.env` (не в корне проекта). Все команды с `.env` выполняйте из каталога `apps/api` или указывайте путь `apps/api/.env`.

## Важно

- **rsync** — на машине, с которой запускаете деплой (Mac), и на сервере должен быть установлен `rsync` (для загрузки 3D-моделей и статики; обычно уже есть в системе).
- **В скрипте нет зашитых идентификаторов** — хост, порт, пользователь и каталог задаются только переменными в вашем терминале.
- **Базы данных** (`prod.db`, `dev.db` и др.) — сохраняются на сервере в `~/pfrp-preserve/` и возвращаются на место после распаковки.
- **Ключи** (`.env`, `.env.local` и др.) — никогда не перезаписываются с вашей машины. Локальный `.env` на сервер **не отправляется**. Используется только то, что уже есть на сервере (бэкап → восстановление).
- Перед миграциями создаётся копия `prod.db` с датой в имени (на случай отката).
- При ошибке миграций деплой продолжается; в логе выводится инструкция, что выполнить на сервере.

## Ошибка «Temporary failure in name resolution» при pip install (Step 6)

На сервере не работает DNS или нет выхода в интернет — pip не может достучаться до pypi.org.

**Что сделать на сервере (по SSH):**

1. **Проверить DNS:**
   ```bash
   ping -c 2 pypi.org
   cat /etc/resolv.conf
   ```
   Если ping не ходит — настроить DNS.

2. **Подставить рабочие DNS (например Cloudflare/Google):**
   ```bash
   # временно (до перезагрузки)
   echo "nameserver 1.1.1.1" | sudo tee /etc/resolv.conf
   # или
   echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
   ```
   На некоторых VPS (в т.ч. Contabo) `resolv.conf` управляется через systemd или панель — тогда в панели хостинга проверить DNS серверы или:
   ```bash
   sudo systemctl restart systemd-resolved 2>/dev/null || true
   ```

3. **Проверить доступ в интернет:**
   ```bash
   curl -sI https://pypi.org | head -1
   ```

4. **Запустить деплой снова** (код уже на сервере, повторно выполнятся Step 6–11):
   ```bash
   cd ~/global-risk-platform && ./deploy-safe.sh
   ```

5. **Либо доставить зависимости вручную на сервере** (если DNS уже работает):
   ```bash
   cd /home/arin/global-risk-platform/apps/api   # или ваш DEPLOY_PROJECT_DIR
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -e .
   pip install aiosqlite email-validator scipy networkx
   # Дальше: alembic upgrade head, в apps/web — npm install && npm run build, перезапуск API и serve (см. deploy-safe.sh Step 7–9)
   ```

## Без таймаута

- SSH keepalive каждые 30 сек, до 20 часов — длительный `npm run build` не обрывает сессию.
- ConnectTimeout 120 сек, TCPKeepAlive включён.

## После деплоя

- Сайт и API: по `DEPLOY_DOMAIN` (если задан) или по серверу и портам 5180 (фронт) / 9002 (API).

## GPU-сервер (AWS): «Failed to fetch» и «Unexpected token '<'»

Если при открытии приложения **на GPU-сервере** (по туннелю или по IP:5180) в консоли: Failed to fetch alerts/summary, Failed to load hotspots, Unexpected token '<', "<!DOCTYPE "... is not valid JSON — **запросы к API не доходят до бэкенда** или бэкенд не запущен.

**Что проверить на GPU-сервере (ubuntu, ключ .pem):**

1. **API запущен и отвечает локально на сервере:**
   ```bash
   ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@ВАШ_GPU_IP
   curl -s http://localhost:9002/api/v1/health
   ```
   Должен вернуться JSON с `"status":"healthy"`. Если пусто или connection refused — API не запущен. Запустите:
   ```bash
   cd /home/ubuntu/global-risk-platform/apps/api
   source .venv/bin/activate
   set -a && [ -f .env ] && source .env && set +a
   pkill -f "uvicorn src.main:app" 2>/dev/null; sleep 2
   nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 --no-access-log > /tmp/api.log 2>&1 &
   sleep 3
   curl -s http://localhost:9002/api/v1/health
   ```

2. **Доступ через SSH-туннель.** Если открываете фронт через туннель на **другие порты** (например 15180 и 19002), в браузере **обязательно** указывайте API в URL, иначе фронт ходит не туда и получает HTML вместо JSON:
   - **http://127.0.0.1:15180/command?api=http://127.0.0.1:19002**
   - Или главная: **http://127.0.0.1:15180?api=http://127.0.0.1:19002**
   Без `?api=...` запросы уходят на порт фронта → «Unexpected token '<'» и Failed to fetch.
   **Strategic Modules (CIP, SCSS, SRO и т.д.):** скрипты `run-on-gpu-server.sh` и `setup-server-gpu.sh` добавляют в `apps/api/.env` переменную `ALLOW_SEED_IN_PRODUCTION=true` — тогда API отдаёт `demo_mode: true`, и модули открываются без логина. Если модули остаются заблокированы, на сервере проверьте наличие строки в `.env` и перезапустите API.

3. **Доступ по домену (nginx на GPU).** Если перед приложением стоит nginx (домен указывает на GPU-сервер), в конфиге nginx для этого домена должен быть `location /api/` с `proxy_pass http://127.0.0.1:9002/api/;`. Иначе на `/api/...` отдаётся HTML. Пример:
   ```nginx
   location /api/ {
       proxy_pass http://127.0.0.1:9002/api/;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
   После правок: `sudo nginx -t && sudo systemctl reload nginx`.

4. **Проверка:** в браузере открыть URL API (например `http://127.0.0.1:19002/api/v1/health` при туннеле или `http://GPU_IP:9002/api/v1/health` при открытых портах) — должен быть JSON, а не HTML.

Полный чеклист по запуску и доступу к приложению на GPU-сервере (туннель, порты, NIM): [docs/GPU_LAUNCH_STEP_BY_STEP.md](docs/GPU_LAUNCH_STEP_BY_STEP.md).

- **Step 11:** скрипт автоматически вызывает seed стресс-тестов (`POST /api/v1/stress-tests/admin/seed`), чтобы в **Risk Flow Analysis** (Visualizations) выпадающий список «Stress test» был полным (15–20+ сценариев, как локально). Если в блоке только 4 теста — вручную: `curl -X POST http://localhost:9002/api/v1/stress-tests/admin/seed` на сервере.
- Логи на GPU-сервере (подставьте свой IP и путь к ключу):
  ```bash
  ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@ВАШ_GPU_IP 'tail -f /tmp/api.log'
  ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@ВАШ_GPU_IP 'tail -f /tmp/web.log'
  ```

## Применить все изменения на GPU-сервере (все команды)

Подставьте свой GPU IP (например `34.238.171.112`) и ключ (например `~/.ssh/risk-platform-g5.pem`). Выполнять **из корня проекта** на своей машине (Mac).

**Вариант A: код уже запушен в git, на сервере есть клонированный репо**

```bash
# 1) Сборка фронта локально (опционально; можно собрать на сервере)
cd ~/global-risk-platform/apps/web
npm run build

# 2) Копируем собранный фронт на сервер
cd ~/global-risk-platform
scp -i ~/.ssh/risk-platform-g5.pem -r apps/web/dist ubuntu@34.238.171.112:~/global-risk-platform/apps/web/

# 3) На сервере: подтянуть код (API, скрипты, доки), перезапустить API и фронт
ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@34.238.171.112 'cd ~/global-risk-platform && git pull && ./scripts/run-on-gpu-server.sh'
```

Если фронт собираете на сервере (нет Node на Mac или удобнее один раз всё делать там):

```bash
# 1) На сервере: подтянуть код, собрать фронт, перезапустить всё
ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@34.238.171.112 'cd ~/global-risk-platform && git pull && cd apps/web && npm ci && npm run build && cd ../.. && ./scripts/run-on-gpu-server.sh'
```

**Вариант B: без git (только локальные правки) — копируем фронт и изменённый API**

```bash
cd ~/global-risk-platform

# 1) Сборка фронта
cd apps/web && npm run build && cd ../..

# 2) Копировать dist на сервер
scp -i ~/.ssh/risk-platform-g5.pem -r apps/web/dist ubuntu@34.238.171.112:~/global-risk-platform/apps/web/

# 3) Копировать изменённый файл API (демо-текст LLM)
scp -i ~/.ssh/risk-platform-g5.pem apps/api/src/services/nvidia_llm.py ubuntu@34.238.171.112:~/global-risk-platform/apps/api/src/services/

# 4) На сервере перезапустить API (подхватит новый nvidia_llm.py) и при необходимости фронт
ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@34.238.171.112 'cd ~/global-risk-platform && ./scripts/run-on-gpu-server.sh'
```

**После деплоя**

- Туннель с Mac (в отдельном терминале не закрывать):
  ```bash
  ssh -i ~/.ssh/risk-platform-g5.pem -L 15180:localhost:5180 -L 19002:localhost:9002 ubuntu@34.238.171.112
  ```
- В браузере: **http://127.0.0.1:15180** (или с явным API: `http://127.0.0.1:15180?api=http://127.0.0.1:19002`).

## Опционально: тестирование на GPU без «ошибок» в UI

- **ARIN export:** если кнопка «Send to ARIN» показывает «ARIN export not configured» — это не ошибка. Чтобы включить экспорт во внешний ARIN, добавьте в `apps/api/.env`: `ARIN_BASE_URL=https://arin.saa-alliance.com` (или свой URL) и перезапустите API.
- **AI в отчёте (Explain scenario, Recommendations, NGFS):** если видите «Demo response. Optional: set NVIDIA_API_KEY…» — это демо-ответ без ключа. Чтобы включить живой AI: зайдите на сервер (`ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@34.238.171.112`), в файл `~/global-risk-platform/apps/api/.env` добавьте строку `NVIDIA_API_KEY=ваш_ключ_из_NGC`, сохраните, затем выполните `cd ~/global-risk-platform && ./scripts/run-on-gpu-server.sh`. Ключ: [NVIDIA NGC](https://ngc.nvidia.com) → Setup → Generate API Key. Без ключа приложение работает, блоки показывают демо-текст.
- **No comparable historical events:** пустой список по сценарию/региону — нормально. Исторические события подтягиваются из API при наличии данных для этого типа и региона.

## Включить демо-режим (ERF, BIOSEC, ASM, CADAPT, Municipal без логина)

На сервере переменная окружения хранится в **`apps/api/.env`**. Добавить или выставить `ALLOW_SEED_IN_PRODUCTION=true` и перезапустить API:

```bash
ssh contabo "cd /home/arin/global-risk-platform/apps/api && (grep -q 'ALLOW_SEED_IN_PRODUCTION' .env && sed -i 's/ALLOW_SEED_IN_PRODUCTION=.*/ALLOW_SEED_IN_PRODUCTION=true/' .env || echo 'ALLOW_SEED_IN_PRODUCTION=true' >> .env) && cd /home/arin/global-risk-platform && ./restart-api.sh"
```

Или вручную: зайти на сервер, отредактировать `apps/api/.env`, добавить строку `ALLOW_SEED_IN_PRODUCTION=true`, затем выполнить `./restart-api.sh` из корня проекта.

## Если «Load demo data» даёт 500 или 503 (проблема с базами)

Часто это устаревшая схема БД после обновления кода. На сервере выполните (подставьте свой способ входа, например `ssh contabo`, и каталог проекта — тот же путь, что в `DEPLOY_PROJECT_DIR`):

```bash
ssh contabo
cd <каталог_проекта>/apps/api
source .venv/bin/activate
alembic upgrade head
# затем перезапустите API
pkill -f "uvicorn src.main:app"
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
exit
```

После этого seed и остальные API должны работать.

## Если alembic upgrade head пишет «table users already exists»

БД уже содержит таблицы, но в истории Alembic их нет. Пометить текущее состояние и догнать до head (подставьте свой каталог проекта):

```bash
cd <каталог_проекта>/apps/api
source .venv/bin/activate
export USE_SQLITE=true
export DATABASE_URL=sqlite:///./prod.db
alembic stamp 001
alembic upgrade head
pkill -f "uvicorn src.main:app"
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
```

Если снова появится «table X already exists» на следующей миграции — помечайте её ревизию и снова `upgrade head`.

**После «table user_preferences already exists»** (миграция 20260117_0001 уже по факту применена), из каталога `apps/api`:

```bash
alembic stamp 20260117_0001
alembic upgrade head
pkill -f "uvicorn src.main:app"
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
```

Если снова будет «table X already exists» — найдите имя ревизии по имени таблицы в `alembic/versions/` и выполните `alembic stamp <revision>` перед `alembic upgrade head`.
