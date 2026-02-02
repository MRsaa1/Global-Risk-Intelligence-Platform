# Развёртывание на Brev (NVIDIA GPU)

Инструкция по запуску Physical-Financial Risk Platform на Brev (brev.nvidia.com) — окружение `saaaliance`.

---

## 1. Копирование и деплой (всё в одном)

**С Mac, одной командой:**

```bash
./scripts/brev-full-deploy.sh
```

Скрипт: создаёт tarball → копирует на Brev → распаковывает → ставит Redis, venv, deps → запускает API и Web.

---

**Или по шагам (brev-copy + вручную):**

```bash
./scripts/brev-copy.sh
```

Или вручную:
```bash
brev copy . saaaliance:/home/ubuntu/global-risk-platform
```

Или клон с git (если репо публичный):

```bash
brev shell saaaliance
# внутри Brev:
cd /home/ubuntu
git clone https://github.com/YOUR_ORG/global-risk-platform.git
cd global-risk-platform
```

---

## 2. Запуск платформы (API + Web)

**Открой Brev в Cursor:**
```bash
brev open saaaliance cursor
```

**В терминале Cursor (на Brev):**
```bash
cd /home/ubuntu/global-risk-platform
chmod +x scripts/brev-deploy.sh
./scripts/brev-deploy.sh
```

Скрипт:
- Создаёт `.env` для Brev (SQLite, DFM pipelines, local NIM)
- Устанавливает Python- и Node-зависимости
- Собирает фронтенд
- Запускает API на порту 9002 и веб на 5180

---

## 3. Port Forward в Brev

В панели Brev → Access → Port Forward:

| Локальный | Удалённый | Сервис    |
|-----------|-----------|-----------|
| 9002      | 9002      | API       |
| 5180      | 5180      | Frontend  |

Либо **Share a Service** — порт 5180 для публичного доступа.

После Port Forward:
- **API:** http://localhost:9002/docs
- **Web:** http://localhost:5180/command

---

## 4. FourCastNet NIM (опционально)

Для погодного прогноза через DFM:

```bash
# Нужен NGC_API_KEY: https://ngc.nvidia.com → Setup → API Key
export NGC_API_KEY=your_key

# Только FourCastNet (1 GPU)
./scripts/brev-start-nim.sh
```

NIM будет на http://localhost:8001. API автоматически использует его при `USE_LOCAL_NIM=true`.

---

## 5. Остановка и повторный запуск

```bash
# Остановить API и web
pkill -f "uvicorn src.main:app" 2>/dev/null || true
pkill -f "serve -s dist" 2>/dev/null || true

# Остановить NIM
docker compose -f docker-compose.nim-fourcastnet.yml down

# Запустить снова
./scripts/brev-deploy.sh
./scripts/brev-start-nim.sh   # если нужен NIM
```

---

## Переменные окружения (Brev)

Скрипт `brev-deploy.sh` создаёт `apps/api/.env` с:

- `USE_SQLITE=true` — без PostgreSQL
- `USE_DATA_FEDERATION_PIPELINES=true` — geodata через DFM
- `USE_LOCAL_NIM=true` — NIM на localhost:8001
- `FOURCASTNET_NIM_URL=http://localhost:8001`

При необходимости добавь `NGC_API_KEY`, `NOAA_API_TOKEN`, `OPENWEATHER_API_KEY` в `.env` вручную.
