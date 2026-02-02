#!/usr/bin/env bash
# Завершает старые процессы uvicorn/serve и запускает API и фронт от пользователя arin.
# Запускать локально: ./scripts/fix-server-api.sh (подключится по SSH и выполнит всё на сервере).
set -e

# Используйте ~/.ssh/config: Host contabo (или задайте DEPLOY_SSH=user@host:port)
SSH_TARGET="${DEPLOY_SSH:-contabo}"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-/home/arin/global-risk-platform}"

echo "Подключение к $SSH_TARGET и перезапуск API и фронта..."
ssh -o ConnectTimeout=15 "$SSH_TARGET" bash -s -- "$PROJECT_DIR" << 'REMOTE'
set -e
PROJECT_DIR="$1"
cd "$PROJECT_DIR"

echo "[1/4] Завершение старых процессов (uvicorn, serve)..."
pkill -u "$(whoami)" -f "uvicorn src.main:app" 2>/dev/null || true
pkill -u "$(whoami)" -f "serve -s dist" 2>/dev/null || true
# Если остались процессы от другого пользователя — sudo (запросит пароль)
pgrep -f "uvicorn src.main:app" >/dev/null 2>&1 && { echo "  Завершаю uvicorn через sudo..."; sudo pkill -f "uvicorn src.main:app" 2>/dev/null || true; }
pgrep -f "serve -s dist" >/dev/null 2>&1 && { echo "  Завершаю serve через sudo..."; sudo pkill -f "serve -s dist" 2>/dev/null || true; }
sleep 3

echo "[2/4] Запуск API..."
cd apps/api
source .venv/bin/activate
export USE_SQLITE=true
nohup python -m uvicorn src.main:app --host 127.0.0.1 --port 9002 >> /tmp/grp-api.log 2>&1 &
echo $! > /tmp/grp-api.pid
cd "$PROJECT_DIR"

echo "[3/4] Запуск фронта..."
cd apps/web
nohup npx serve -s dist -l 5180 >> /tmp/grp-web.log 2>&1 &
echo $! > /tmp/grp-web.pid
cd "$PROJECT_DIR"

echo "[4/4] Проверка API через 8 с..."
sleep 8
if curl -sf http://127.0.0.1:9002/api/v1/health >/dev/null; then
  echo "API отвечает на :9002"
else
  echo "API пока не отвечает. Лог: tail -50 /tmp/grp-api.log"
  tail -30 /tmp/grp-api.log
fi
echo "Готово."
REMOTE

echo ""
echo "Проверка с вашей машины:"
echo "  curl -s https://risk.saa-alliance.com/api/v1/health"
echo "Логи на сервере: ssh $SSH_TARGET 'tail -f /tmp/grp-api.log'"
