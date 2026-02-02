#!/usr/bin/env bash
# =============================================================================
# Global Risk Platform — полный деплой на Contabo (точная копия проекта)
# Запускать локально в терминале: ./scripts/deploy-contabo.sh
# =============================================================================
set -e

# --- Конфигурация (при необходимости измените или задайте через переменные окружения) ---
SERVER_HOST="${DEPLOY_HOST:-173.212.208.123}"
SERVER_PORT="${DEPLOY_PORT:-32769}"
SERVER_USER="${DEPLOY_USER:-arin}"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-/home/arin/global-risk-platform}"
DOMAIN="${DEPLOY_DOMAIN:-risk.saa-alliance.com}"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Корень репозитория (скрипт можно запускать из любой папки — перейдём в корень)
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_ROOT"
if [ ! -f "apps/api/pyproject.toml" ] || [ ! -f "apps/web/package.json" ]; then
  echo -e "${RED}Ошибка: запускайте скрипт из корня репозитория global-risk-platform (найдены apps/api и apps/web).${NC}"
  exit 1
fi

echo -e "${GREEN}=== Global Risk Platform — деплой на Contabo ===${NC}"
echo "  Сервер: $SERVER_USER@$SERVER_HOST:$SERVER_PORT"
echo "  Каталог на сервере: $PROJECT_DIR"
echo "  Домен: $DOMAIN"
echo "  Локальный каталог: $REPO_ROOT"
echo ""

# --- 1. Создание архива (без node_modules, .git, .venv и т.д.) ---
echo -e "${YELLOW}[1/5] Создание архива проекта...${NC}"
TARBALL="/tmp/global-risk-platform-deploy-$$.tar.gz"
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.venv' \
    --exclude='venv' \
    --exclude='dev.db' \
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
echo "  Архив: $TARBALL ($(du -h "$TARBALL" | cut -f1))"

# --- 2. Копирование архива на сервер ---
echo -e "${YELLOW}[2/5] Копирование архива на сервер...${NC}"
scp -o ConnectTimeout=30 -o ServerAliveInterval=60 -o ServerAliveCountMax=10 -P "$SERVER_PORT" "$TARBALL" "$SERVER_USER@$SERVER_HOST:/tmp/grp-deploy.tar.gz"
rm -f "$TARBALL"

# --- 3. Подготовка скрипта установки на сервере ---
REMOTE_SCRIPT="/tmp/grp-remote-install-$$.sh"
# Переменные для подстановки в удалённый скрипт (экранируем для передачи)
ESCAPED_PROJECT_DIR="$(printf '%s' "$PROJECT_DIR" | sed "s/'/'\\\\''/g")"
ESCAPED_DOMAIN="$(printf '%s' "$DOMAIN" | sed "s/'/'\\\\''/g")"
cat > "$REMOTE_SCRIPT" << REMOTE_SCRIPT_END
#!/usr/bin/env bash
set -e
PROJECT_DIR='$ESCAPED_PROJECT_DIR'
DOMAIN='$ESCAPED_DOMAIN'

echo "[remote] Удаление старого каталога и распаковка..."
rm -rf "\$PROJECT_DIR"
mkdir -p "\$PROJECT_DIR"
tar -xzf /tmp/grp-deploy.tar.gz -C "\$PROJECT_DIR"
rm -f /tmp/grp-deploy.tar.gz
cd "\$PROJECT_DIR"

echo "[remote] Создание production .env для API..."
mkdir -p apps/api/data
# Абсолютный путь к SQLite; ALLOW_SEED_IN_PRODUCTION для кнопки "Load demo data" на сервере
cat > apps/api/.env << ENVEOF
DATABASE_URL=sqlite:///\${PROJECT_DIR}/apps/api/data/prod.db
USE_SQLITE=true
ENVIRONMENT=production
DEBUG=false
ALLOW_SEED_IN_PRODUCTION=true
CORS_ORIGINS=["https://\$DOMAIN"]
NVIDIA_LLM_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODE=cloud
ENVEOF

echo "[remote] Установка зависимостей бэкенда (Python)..."
cd apps/api
python3 -m venv .venv 2>/dev/null || python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip -q
pip install -e . -q
pip install aiosqlite networkx -q
echo "[remote] Миграции БД (alembic)..."
export DATABASE_URL="sqlite:///./data/prod.db"
alembic upgrade head 2>/dev/null || true
cd "\$PROJECT_DIR"

echo "[remote] Установка зависимостей и сборка фронтенда (Node)..."
cd apps/web
npm install --silent
npm run build
cd "\$PROJECT_DIR"

echo "[remote] Остановка старых процессов (только текущий пользователь)..."
pkill -u "\$(whoami)" -f "uvicorn src.main:app" 2>/dev/null || true
pkill -u "\$(whoami)" -f "serve -s dist" 2>/dev/null || true
pkill -u "\$(whoami)" -f "node.*serve" 2>/dev/null || true
sleep 2

echo "[remote] Запуск API (uvicorn)..."
cd apps/api
source .venv/bin/activate
export USE_SQLITE=true
nohup python -m uvicorn src.main:app --host 127.0.0.1 --port 9002 > /tmp/grp-api.log 2>&1 &
echo \$! > /tmp/grp-api.pid
cd "\$PROJECT_DIR"

echo "[remote] Запуск фронтенда (serve)..."
cd apps/web
nohup npx serve -s dist -l 5180 > /tmp/grp-web.log 2>&1 &
echo \$! > /tmp/grp-web.pid
cd "\$PROJECT_DIR"

echo "[remote] Готово."
REMOTE_SCRIPT_END

# --- 4. Копирование и запуск скрипта на сервере ---
echo -e "${YELLOW}[3/5] Копирование скрипта установки на сервер...${NC}"
scp -o ConnectTimeout=30 -o ServerAliveInterval=60 -o ServerAliveCountMax=10 -P "$SERVER_PORT" "$REMOTE_SCRIPT" "$SERVER_USER@$SERVER_HOST:/tmp/grp-remote-install.sh"
rm -f "$REMOTE_SCRIPT"

echo -e "${YELLOW}[4/5] Выполнение установки на сервере (может занять несколько минут)...${NC}"
ssh -o ConnectTimeout=30 -o ServerAliveInterval=60 -o ServerAliveCountMax=10 -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "bash /tmp/grp-remote-install.sh"

echo -e "${YELLOW}[5/5] Проверка здоровья API (ожидание 12 с)...${NC}"
sleep 12
if ssh -o ConnectTimeout=15 -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "curl -sf http://127.0.0.1:9002/api/v1/health >/dev/null 2>&1"; then
  echo -e "${GREEN}  API отвечает на :9002${NC}"
else
  echo -e "${RED}  API пока не отвечает. Последние строки лога API:${NC}"
  ssh -o ConnectTimeout=10 -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "tail -40 /tmp/grp-api.log 2>/dev/null || echo '(лог пуст или недоступен)'"
  echo ""
  echo -e "${YELLOW}  Полный лог: ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/grp-api.log'${NC}"
fi

echo ""
echo -e "${GREEN}=== Деплой завершён ===${NC}"
echo "  Фронт:  https://$DOMAIN (или http://$SERVER_HOST:5180 если nginx не настроен)"
echo "  API:    https://$DOMAIN/api  (или http://$SERVER_HOST:9002)"
echo ""
echo "Полезные команды на сервере:"
echo "  Логи API:   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/grp-api.log'"
echo "  Логи Web:   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/grp-web.log'"
echo "  Перезапуск API:  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'cd $PROJECT_DIR/apps/api && source .venv/bin/activate && pkill -f uvicorn; nohup python -m uvicorn src.main:app --host 127.0.0.1 --port 9002 >> /tmp/grp-api.log 2>\&1 \&'"
echo "  Перезапуск Web:  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'cd $PROJECT_DIR/apps/web && pkill -f \"serve -s dist\"; nohup npx serve -s dist -l 5180 >> /tmp/grp-web.log 2>\&1 \&'"
echo ""
echo "Секреты (NVIDIA API keys и т.д.): добавьте вручную в $PROJECT_DIR/apps/api/.env на сервере и перезапустите API."
