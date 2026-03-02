# Деплой на Contabo — текущее состояние продукта

Один скрипт: выкладывает текущее состояние репозитория на сервер Contabo, ставит зависимости, собирает фронт и запускает API и веб. Запускайте **из корня репо** в обычном терминале (не в IDE), чтобы не было обрыва по таймауту.

---

## Одна команда (рекомендуется)

Из корня репозитория:

```bash
chmod +x scripts/deploy-contabo-now.sh
./scripts/deploy-contabo-now.sh
```

Скрипт сам перейдёт в корень по пути к себе. Параметры по умолчанию: хост `173.212.208.123`, порт `32769`, пользователь `arin`, домен `risk.saa-alliance.com`.

---

## Если на Contabo вход по SSH-ключу

Перед запуском задайте переменную с путём к ключу:

```bash
export SSH_KEY=~/.ssh/id_ed25519_contabo
./scripts/deploy-contabo-now.sh
```

Так скрипт не «отвалится» по таймауту и будет использовать ваш ключ.

---

## Переопределение хоста, порта, пользователя, домена

При необходимости задайте переменные окружения:

```bash
# Можно использовать алиас из ~/.ssh/config (например Host contabo):
export DEPLOY_HOST=contabo
export DEPLOY_PORT=32769
export DEPLOY_USER=arin
export DEPLOY_DOMAIN=risk.saa-alliance.com
# опционально:
export DEPLOY_PROJECT_DIR=/home/arin/global-risk-platform
export SSH_KEY=~/.ssh/id_ed25519_contabo
./scripts/deploy-contabo-now.sh
```

---

## Что делает скрипт

1. **Локально:** собирает архив проекта (без `node_modules`, `.git`, `.venv`, `dist`, `.env` и т.п.).
2. Копирует архив на сервер по SSH (с таймаутами и, при заданном `SSH_KEY`, по ключу). **Если есть локальный `apps/api/.env`** — он отдельно копируется на сервер: все ключи (NVIDIA_API_KEY и др.) и переменные переносятся; на сервере подставляются только production `DATABASE_URL` и `CORS_ORIGINS`.
3. **На сервере:**
   - удаляет старый каталог проекта и распаковывает новый;
   - использует перенесённый `.env` (если был скопирован) или создаёт дефолтный `apps/api/.env` для production (SQLite, CORS для домена, NVIDIA cloud);
   - создаёт Python venv, ставит зависимости API, выполняет миграции Alembic;
   - ставит зависимости фронта и собирает его (`npm install` + `npm run build`); при сборке подставляются **VITE_API_URL** (домен) и **VITE_CESIUM_ION_TOKEN** (из локального `apps/api/.env` или `export`, иначе дефолт — при 401 на глобусе задайте свой токен в `apps/api/.env`: `VITE_CESIUM_ION_TOKEN=...`, затем передеплой);
   - останавливает старые процессы API и веб-сервера;
   - запускает API (uvicorn на порту 9002) и фронт (serve на 5180).
4. Проверяет здоровье API, выполняет seed (demo data, stress tests, regime sync), выводит ссылки и команды для логов.

---

## Требования на сервере

- SSH-доступ (порт из `DEPLOY_PORT`, при необходимости — ключ из `SSH_KEY`).
- **Python 3.11+** и **pip**.
- **Node.js 18+** и **npm**.
- По желанию: **nginx** для HTTPS (проксировать `/` на `127.0.0.1:5180`, `/api` на `127.0.0.1:9002`). Пример конфига в корне: `nginx.conf`.

---

## Перенос ключей с локальной машины на сервер

Чтобы **просто перезаписать** `.env` на сервере вашим локальным (все ключи — как у вас локально), запустите:

```bash
export SSH_KEY=~/.ssh/id_ed25519_contabo   # если вход по ключу
./scripts/sync-env-to-contabo.sh
```

Скрипт копирует `apps/api/.env` на сервер в `apps/api/.env`, перезаписывая файл, и перезапускает API. Ничего не трогает в репозитории на сервере, только .env и перезапуск uvicorn.

## После деплоя

- Если при деплое был скопирован ваш локальный `apps/api/.env`, ключи уже на сервере. Если ключи не работают — выполните `./scripts/sync-env-to-contabo.sh` (см. выше).
- Логи API: `ssh contabo 'tail -f /tmp/grp-api.log'` (или с `-p 32769 arin@173.212.208.123`).
- Логи фронта: `ssh contabo 'tail -f /tmp/grp-web.log'`

### Ошибка alembic: «source code string cannot contain null bytes»

На сервере в файлах миграций есть нуль-байты. Самый надёжный способ — **зайти на сервер и выполнить блок ниже** (без вложенных кавычек через ssh):

```bash
ssh contabo
```

На сервере по очереди:

```bash
cd /home/arin/global-risk-platform/apps/api && source .venv/bin/activate
```

```bash
python3 << 'ENDPY'
import glob
for p in glob.glob("alembic/versions/*.py"):
    with open(p, "rb") as f:
        data = f.read()
    if b"\x00" in data:
        with open(p, "wb") as f:
            f.write(data.replace(b"\x00", b""))
        print("Fixed", p)
ENDPY
```

```bash
export DATABASE_URL=sqlite:///./data/prod.db && alembic upgrade head
```

Если миграции прошли без ошибок, перезапустите API:

```bash
pkill -f "uvicorn src.main:app" 2>/dev/null; nohup python -m uvicorn src.main:app --host 127.0.0.1 --port 9002 >> /tmp/grp-api.log 2>&1 &
exit
```

**Удалить файлы macOS (.\_*)** — они попадают в архив при упаковке на Mac и вызывают ошибку «null bytes» у Alembic. На сервере выполни:

```bash
cd /home/arin/global-risk-platform
find . -name '._*' -delete
cd apps/api && source .venv/bin/activate && export DATABASE_URL=sqlite:///./data/prod.db && alembic upgrade head
```

**Через tr (если всё ещё ошибка):** на сервере в каталоге `apps/api` выполни — удалит нуль-байты из всех .py в alembic:

```bash
cd /home/arin/global-risk-platform/apps/api
for f in alembic/versions/*.py alembic/env.py; do [ -f "$f" ] && tr -d '\0' < "$f" > "$f.new" && mv "$f.new" "$f"; done
export DATABASE_URL=sqlite:///./data/prod.db && alembic upgrade head
```

**Альтернатива:** полный деплой с локальной машины подставит на сервер чистые файлы из репозитория (в репо нуль-байтов нет): `./scripts/deploy-contabo-now.sh`

### Ошибка «table users already exists» при alembic upgrade

База уже содержит таблицы от прошлого запуска, но в `alembic_version` нет записи. Пометить БД начальной ревизией и догнать до актуальной:

```bash
cd /home/arin/global-risk-platform/apps/api && source .venv/bin/activate
export DATABASE_URL=sqlite:///./data/prod.db
alembic stamp 001
alembic upgrade head
```

Затем перезапустить API (см. ниже).

### Если «Load demo data» (seed) возвращает 500

Часто причина — не применённые миграции (нет таблиц portfolios/projects/damage_claims). На сервере выполните миграции и перезапустите API:

```bash
ssh contabo 'cd /home/arin/global-risk-platform/apps/api && source .venv/bin/activate && export DATABASE_URL=sqlite:///./data/prod.db && alembic upgrade head && pkill -f "uvicorn src.main:app" 2>/dev/null; nohup python -m uvicorn src.main:app --host 127.0.0.1 --port 9002 >> /tmp/grp-api.log 2>&1 &'
```

После этого снова нажмите «Load demo data» в интерфейсе. Если ошибка сохраняется, посмотрите текст ошибки в ответе API (вкладка Network в DevTools) или в логах: `ssh contabo 'tail -100 /tmp/grp-api.log'`.

---

## Старый скрипт

Раньше использовался `scripts/deploy-contabo.sh`. Для деплоя текущего состояния продукта используйте **`scripts/deploy-contabo-now.sh`** (поддержка ключа и таймаутов без обрыва).
