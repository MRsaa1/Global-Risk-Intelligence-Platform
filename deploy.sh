#!/bin/bash
# ===========================================
# PHYSICAL-FINANCIAL RISK PLATFORM
# Единая точка деплоя на сервер
# ===========================================
# Вызывает deploy-safe.sh: базы и .env на сервере сохраняются,
# без таймаута (keepalive), первый деплой создаёт .env из шаблона.
#
# Использование:
#   ./deploy.sh
#   DEPLOY_HOST=my-server DEPLOY_PORT=22 ./deploy.sh
#   SSH_KEY=~/.ssh/my_key ./deploy.sh
# ===========================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "deploy-safe.sh" ]; then
    echo "Ошибка: deploy-safe.sh не найден. Запускайте из корня репозитория."
    exit 1
fi

exec ./deploy-safe.sh "$@"
