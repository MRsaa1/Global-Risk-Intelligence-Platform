#!/bin/bash
cd "$(dirname "$0")/../apps/api"
LOGS_DIR="$(dirname "$0")"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] ===== Запуск API сервера =====" >> "$LOGS_DIR/api.log"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Рабочая директория: $(pwd)" >> "$LOGS_DIR/api.log"
while true; do
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🚀 Запуск API сервера (uvicorn)..." >> "$LOGS_DIR/api.log"
        uvicorn src.main:app --reload --host 0.0.0.0 --port 9002 >> "$LOGS_DIR/api.log" 2>&1 || {
            EXIT_CODE=$?
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ API сервер упал (код: $EXIT_CODE), перезапуск через 5 сек..." >> "$LOGS_DIR/api.log"
            sleep 5
        }
    else
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ Ошибка: .venv не найден в $(pwd), ожидание..." >> "$LOGS_DIR/api.log"
        sleep 10
    fi
done
