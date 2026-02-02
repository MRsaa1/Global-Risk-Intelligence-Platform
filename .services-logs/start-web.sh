#!/bin/bash
cd "$(dirname "$0")/../apps/web"
LOGS_DIR="$(dirname "$0")"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] ===== Запуск Web dev server =====" >> "$LOGS_DIR/web.log"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Рабочая директория: $(pwd)" >> "$LOGS_DIR/web.log"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Проверка node_modules..." >> "$LOGS_DIR/web.log"
if [ ! -d "node_modules" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  node_modules не найден, запуск npm install..." >> "$LOGS_DIR/web.log"
    npm install >> "$LOGS_DIR/web.log" 2>&1
fi
while true; do
    if [ -f "package.json" ]; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🚀 Запуск Web dev server (npm run dev)..." >> "$LOGS_DIR/web.log"
        npm run dev >> "$LOGS_DIR/web.log" 2>&1 || {
            EXIT_CODE=$?
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ Web сервер упал (код: $EXIT_CODE), перезапуск через 5 сек..." >> "$LOGS_DIR/web.log"
            sleep 5
        }
    else
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ Ошибка: package.json не найден в $(pwd), ожидание..." >> "$LOGS_DIR/web.log"
        sleep 10
    fi
done
