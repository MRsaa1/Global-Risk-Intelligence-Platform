#!/usr/bin/env bash
# =============================================================================
# Деплой текущего состояния продукта на Contabo — одной командой, без аута.
# Запуск из корня репо: ./scripts/deploy-contabo-now.sh
#
# Опционально (перед запуском):
#   export SSH_KEY=~/.ssh/id_ed25519_contabo   # ключ для Contabo
#   export DEPLOY_HOST=contabo DEPLOY_PORT=32769 DEPLOY_USER=arin   # или IP: 173.212.208.123
#   export DEPLOY_DOMAIN=risk.saa-alliance.com
# =============================================================================
set -e

SERVER_HOST="${DEPLOY_HOST:-173.212.208.123}"
SERVER_PORT="${DEPLOY_PORT:-32769}"
SERVER_USER="${DEPLOY_USER:-arin}"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-/home/arin/global-risk-platform}"
DOMAIN="${DEPLOY_DOMAIN:-risk.saa-alliance.com}"

# SSH: ключ (например ~/.ssh/id_ed25519_contabo) и таймауты — без обрыва при долгой сборке
SSH_EXTRA=()
[ -n "${SSH_KEY:-}" ] && [ -f "$SSH_KEY" ] && SSH_EXTRA=(-i "$SSH_KEY")
SSH_OPTS=(-o ConnectTimeout=30 -o ServerAliveInterval=60 -o ServerAliveCountMax=30 -o StrictHostKeyChecking=accept-new "${SSH_EXTRA[@]}")
SCP_OPTS=(-o ConnectTimeout=30 -o ServerAliveInterval=60 -o ServerAliveCountMax=30 "${SSH_EXTRA[@]}")

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
if [ ! -f "apps/api/pyproject.toml" ] || [ ! -f "apps/web/package.json" ]; then
  echo -e "${RED}Ошибка: запускайте из корня репозитория global-risk-platform.${NC}"
  exit 1
fi

echo -e "${GREEN}=== Деплой на Contabo (текущее состояние продукта) ===${NC}"
echo "  Сервер: $SERVER_USER@$SERVER_HOST:$SERVER_PORT"
echo "  Каталог: $PROJECT_DIR"
echo "  Домен: $DOMAIN"
echo ""

# --- 1. Архив ---
echo -e "${YELLOW}[1/5] Создание архива...${NC}"
TARBALL="/tmp/grp-deploy-$$.tar.gz"
# COPYFILE_DISABLE=1 (macOS) prevents AppleDouble ._* files in tarball (they cause "null bytes" in Alembic on Linux)
export COPYFILE_DISABLE=1 2>/dev/null || true
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='._*' \
    --exclude='*.pyc' \
    --exclude='.venv' \
    --exclude='venv' \
    --exclude='*.db' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.cursor' \
    --exclude='.services-logs' \
    --exclude='*.log' \
    --exclude='dist' \
    --exclude='.turbo' \
    --exclude='.vite' \
    -czf "$TARBALL" -C "$REPO_ROOT" .
echo "  Размер: $(du -h "$TARBALL" | cut -f1)"

# --- 2. Копирование на сервер ---
echo -e "${YELLOW}[2/5] Копирование на сервер...${NC}"
scp "${SCP_OPTS[@]}" -P "$SERVER_PORT" "$TARBALL" "$SERVER_USER@$SERVER_HOST:/tmp/grp-deploy.tar.gz"
rm -f "$TARBALL"

# Локальный .env с ключами — переносим на сервер (ключи те же)
if [ -f "$REPO_ROOT/apps/api/.env" ]; then
  echo "  Копирование локального apps/api/.env на сервер (ключи и переменные)..."
  scp "${SCP_OPTS[@]}" -P "$SERVER_PORT" "$REPO_ROOT/apps/api/.env" "$SERVER_USER@$SERVER_HOST:/tmp/grp-api-env.txt"
else
  echo "  Локальный apps/api/.env не найден — на сервере будет создан дефолтный .env (ключи добавьте вручную)."
  ssh "${SSH_OPTS[@]}" -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "rm -f /tmp/grp-api-env.txt"
fi

# --- 3. Удалённый скрипт установки и запуска ---
REMOTE_SCRIPT="/tmp/grp-install-$$.sh"
ESCAPED_PROJECT_DIR="$(printf '%s' "$PROJECT_DIR" | sed "s/'/'\\\\''/g")"
ESCAPED_DOMAIN="$(printf '%s' "$DOMAIN" | sed "s/'/'\\\\''/g")"
cat > "$REMOTE_SCRIPT" << REMOTE_END
#!/usr/bin/env bash
set -e
PROJECT_DIR='$ESCAPED_PROJECT_DIR'
DOMAIN='$ESCAPED_DOMAIN'

echo "[remote] Распаковка..."
rm -rf "\$PROJECT_DIR"
mkdir -p "\$PROJECT_DIR"
tar -xzf /tmp/grp-deploy.tar.gz -C "\$PROJECT_DIR"
rm -f /tmp/grp-deploy.tar.gz
find "\$PROJECT_DIR" -name '._*' -delete 2>/dev/null || true
cd "\$PROJECT_DIR"

echo "[remote] .env для API..."
mkdir -p apps/api/data
if [ -f /tmp/grp-api-env.txt ]; then
  cp /tmp/grp-api-env.txt apps/api/.env
  rm -f /tmp/grp-api-env.txt
  echo "[remote] Использован перенесённый с локальной машины .env (все ключи и переменные)."
  # На сервере подставляем production DATABASE_URL и CORS (чтобы БД и домен были корректны)
  ( grep -v "^DATABASE_URL=" apps/api/.env 2>/dev/null; echo "DATABASE_URL=sqlite:///\${PROJECT_DIR}/apps/api/data/prod.db" ) > apps/api/.env.tmp && mv apps/api/.env.tmp apps/api/.env
  ( grep -v "^CORS_ORIGINS=" apps/api/.env 2>/dev/null; echo "CORS_ORIGINS=[\"https://\$DOMAIN\",\"http://\$DOMAIN\"]" ) > apps/api/.env.tmp && mv apps/api/.env.tmp apps/api/.env
else
  cat > apps/api/.env << ENVEOF
DATABASE_URL=sqlite:///\${PROJECT_DIR}/apps/api/data/prod.db
USE_SQLITE=true
ENVIRONMENT=production
DEBUG=false
ALLOW_SEED_IN_PRODUCTION=true
CORS_ORIGINS=["https://\$DOMAIN","http://\$DOMAIN"]
NVIDIA_LLM_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODE=cloud
ENVEOF
fi

echo "[remote] Python: venv и зависимости..."
cd apps/api
python3 -m venv .venv 2>/dev/null || python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip -q
pip install -e . -q
pip install aiosqlite networkx -q
export DATABASE_URL="sqlite:///./data/prod.db"
alembic upgrade head || { echo "[remote] WARNING: alembic upgrade failed (see above). Seed may fail until migrations are applied."; }
cd "\$PROJECT_DIR"

echo "[remote] Frontend: npm install и build (может занять несколько минут)..."
cd apps/web
npm install --silent
npm run build
cd "\$PROJECT_DIR"

echo "[remote] Остановка старых процессов..."
pkill -u "\$(whoami)" -f "uvicorn src.main:app" 2>/dev/null || true
pkill -u "\$(whoami)" -f "serve -s dist" 2>/dev/null || true
pkill -u "\$(whoami)" -f "node.*serve" 2>/dev/null || true
sleep 2

echo "[remote] Запуск API (port 9002)..."
cd apps/api
source .venv/bin/activate
nohup python -m uvicorn src.main:app --host 127.0.0.1 --port 9002 > /tmp/grp-api.log 2>&1 &
echo \$! > /tmp/grp-api.pid
cd "\$PROJECT_DIR"

echo "[remote] Запуск фронта (port 5180)..."
cd apps/web
nohup npx serve -s dist -l 5180 > /tmp/grp-web.log 2>&1 &
echo \$! > /tmp/grp-web.pid
cd "\$PROJECT_DIR"

echo "[remote] Готово."
REMOTE_END

# --- 4. Копирование и выполнение скрипта на сервере ---
echo -e "${YELLOW}[3/5] Копирование скрипта установки...${NC}"
scp "${SCP_OPTS[@]}" -P "$SERVER_PORT" "$REMOTE_SCRIPT" "$SERVER_USER@$SERVER_HOST:/tmp/grp-install.sh"
rm -f "$REMOTE_SCRIPT"

echo -e "${YELLOW}[4/5] Выполнение установки на сервере (таймаут 15 мин)...${NC}"
ssh "${SSH_OPTS[@]}" -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "bash /tmp/grp-install.sh" || {
  echo -e "${RED}Установка завершилась с ошибкой. Логи на сервере:${NC}"
  echo "  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -100 /tmp/grp-api.log'"
  exit 1
}

# --- 5. Проверка ---
echo -e "${YELLOW}[5/5] Проверка API (ожидание 15 с)...${NC}"
sleep 15
if ssh "${SSH_OPTS[@]}" -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "curl -sf http://127.0.0.1:9002/api/v1/health >/dev/null 2>&1"; then
  echo -e "${GREEN}  API отвечает на :9002${NC}"
else
  echo -e "${RED}  API пока не отвечает. Лог:${NC}"
  ssh "${SSH_OPTS[@]}" -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "tail -50 /tmp/grp-api.log 2>/dev/null" || true
fi

echo ""
echo -e "${GREEN}=== Деплой завершён ===${NC}"
echo "  Фронт:  https://$DOMAIN  (или http://$SERVER_HOST:5180)"
echo "  API:    https://$DOMAIN/api  (или http://$SERVER_HOST:9002)"
echo ""
echo "Полезные команды:"
echo "  Логи API:   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/grp-api.log'"
echo "  Логи Web:   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/grp-web.log'"
echo ""
if [ -f "$REPO_ROOT/apps/api/.env" ]; then
  echo "Использован ваш локальный .env — ключи уже на сервере."
else
  echo "Секреты (NVIDIA_API_KEY и др.): добавьте в $PROJECT_DIR/apps/api/.env на сервере и перезапустите API:"
  echo "  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'cd $PROJECT_DIR/apps/api && source .venv/bin/activate && pkill -f uvicorn; nohup python -m uvicorn src.main:app --host 127.0.0.1 --port 9002 >> /tmp/grp-api.log 2>&1 &'"
fi
