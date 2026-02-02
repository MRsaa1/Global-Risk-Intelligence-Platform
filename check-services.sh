#!/bin/bash
# Скрипт для проверки статуса сервисов

cd "$(dirname "$0")"
LOGS_DIR="$PWD/.services-logs"

echo "🔍 Проверка статуса сервисов..."
echo ""

# Проверка API
if [ -f "$LOGS_DIR/api.pid" ]; then
    API_PID=$(cat "$LOGS_DIR/api.pid")
    if ps -p "$API_PID" > /dev/null 2>&1; then
        echo "✅ API сервер запущен (PID: $API_PID)"
    else
        echo "❌ API сервер не запущен (PID файл существует, но процесс не найден)"
    fi
else
    echo "❌ API сервер не запущен (PID файл не найден)"
fi

# Проверка Web
if [ -f "$LOGS_DIR/web.pid" ]; then
    WEB_PID=$(cat "$LOGS_DIR/web.pid")
    if ps -p "$WEB_PID" > /dev/null 2>&1; then
        echo "✅ Web сервер запущен (PID: $WEB_PID)"
    else
        echo "❌ Web сервер не запущен (PID файл существует, но процесс не найден)"
    fi
else
    echo "❌ Web сервер не запущен (PID файл не найден)"
fi

echo ""
echo "📋 Последние строки логов:"
echo ""
echo "--- API LOG (последние 20 строк) ---"
tail -20 "$LOGS_DIR/api.log" 2>/dev/null || echo "Лог API недоступен"
echo ""
echo "--- WEB LOG (последние 20 строк) ---"
tail -20 "$LOGS_DIR/web.log" 2>/dev/null || echo "Лог Web недоступен"
echo ""
echo "🌐 Проверка портов:"
if lsof -i :9002 > /dev/null 2>&1; then
    echo "✅ Порт 9002 (API) занят"
else
    echo "❌ Порт 9002 (API) свободен"
fi

if lsof -i :5180 > /dev/null 2>&1; then
    echo "✅ Порт 5180 (Web) занят"
else
    echo "❌ Порт 5180 (Web) свободен"
fi
