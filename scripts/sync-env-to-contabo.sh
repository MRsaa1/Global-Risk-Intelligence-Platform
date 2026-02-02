#!/usr/bin/env bash
# =============================================================================
# Перенести локальный apps/api/.env на Contabo — перезаписать .env на сервере
# и перезапустить API. Запуск из корня репо: ./scripts/sync-env-to-contabo.sh
#
#   export SSH_KEY=~/.ssh/id_ed25519_contabo   # при необходимости
#   export DEPLOY_HOST=173.212.208.123 DEPLOY_PORT=32769 DEPLOY_USER=arin
# =============================================================================
set -e

SERVER_HOST="${DEPLOY_HOST:-173.212.208.123}"
SERVER_PORT="${DEPLOY_PORT:-32769}"
SERVER_USER="${DEPLOY_USER:-arin}"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-/home/arin/global-risk-platform}"

SSH_EXTRA=()
[ -n "${SSH_KEY:-}" ] && [ -f "$SSH_KEY" ] && SSH_EXTRA=(-i "$SSH_KEY")
SSH_OPTS=(-o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "${SSH_EXTRA[@]}")
SCP_OPTS=(-o ConnectTimeout=15 "${SSH_EXTRA[@]}")

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/apps/api/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Ошибка: локальный файл apps/api/.env не найден: $ENV_FILE"
  exit 1
fi

echo "Копирую локальный .env на сервер ($SERVER_USER@$SERVER_HOST:$SERVER_PORT)..."
scp "${SCP_OPTS[@]}" -P "$SERVER_PORT" "$ENV_FILE" "$SERVER_USER@$SERVER_HOST:/tmp/grp-api-env-upload.txt"

echo "Перемещаю в $PROJECT_DIR/apps/api/.env и перезапускаю API..."
ssh "${SSH_OPTS[@]}" -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "mkdir -p $PROJECT_DIR/apps/api && mv /tmp/grp-api-env-upload.txt $PROJECT_DIR/apps/api/.env && cd $PROJECT_DIR/apps/api && (pkill -u \$(whoami) -f 'uvicorn src.main:app' 2>/dev/null || true); sleep 2; source .venv/bin/activate 2>/dev/null || true; nohup python -m uvicorn src.main:app --host 127.0.0.1 --port 9002 >> /tmp/grp-api.log 2>&1 &"

echo "Готово. .env на сервере перезаписан, API перезапущен."
echo "Логи: ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'tail -f /tmp/grp-api.log'"
