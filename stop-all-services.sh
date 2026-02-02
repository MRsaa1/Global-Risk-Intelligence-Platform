#!/bin/bash
# Остановка всех сервисов

cd "$(dirname "$0")"

LOGS_DIR="$PWD/.services-logs"

echo "🛑 Остановка всех сервисов..."

# Остановка API
if [ -f "$LOGS_DIR/api.pid" ]; then
    API_PID=$(cat "$LOGS_DIR/api.pid")
    # Останавливаем процесс и все дочерние процессы
    pkill -P $API_PID 2>/dev/null || true
    kill $API_PID 2>/dev/null || true
    echo "✅ API сервер остановлен"
    rm -f "$LOGS_DIR/api.pid"
fi

# Остановка Web
if [ -f "$LOGS_DIR/web.pid" ]; then
    WEB_PID=$(cat "$LOGS_DIR/web.pid")
    # Останавливаем процесс и все дочерние процессы
    pkill -P $WEB_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    echo "✅ Web сервер остановлен"
    rm -f "$LOGS_DIR/web.pid"
fi

# Остановка всех процессов uvicorn и vite (на всякий случай)
pkill -f "uvicorn src.main:app" 2>/dev/null && echo "✅ Остановлены процессы uvicorn" || true
pkill -f "vite" 2>/dev/null && echo "✅ Остановлены процессы vite" || true
pkill -f "start-api.sh" 2>/dev/null && echo "✅ Остановлены скрипты API" || true
pkill -f "start-web.sh" 2>/dev/null && echo "✅ Остановлены скрипты Web" || true

# Остановка Docker (опционально, раскомментируйте если нужно)
# docker-compose down 2>/dev/null && echo "✅ Docker контейнеры остановлены" || true

echo "✅ Все сервисы остановлены"
