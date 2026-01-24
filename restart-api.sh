#!/bin/bash
# Перезапуск API бэкенда

cd "$(dirname "$0")/apps/api"

# Остановить старый процесс
pkill -f "uvicorn src.main:app" 2>/dev/null && echo "Остановлен старый uvicorn" || true
sleep 2

# Запустить с venv
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
