#!/bin/bash
# Запуск всех сервисов в фоне с автоперезапуском
# Использование: ./start-all-services.sh

# Не останавливаться при ошибках (Docker может быть не установлен)
set +e

cd "$(dirname "$0")"

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Директории для логов
LOGS_DIR="$PWD/.services-logs"
mkdir -p "$LOGS_DIR"

echo -e "${BLUE}🚀 Запуск всех сервисов в фоне с автоперезапуском${NC}"
echo "=============================================="
echo ""

# Функция для остановки всех сервисов
stop_all() {
    echo -e "\n${YELLOW}Остановка всех сервисов...${NC}"
    if [ -f "$LOGS_DIR/api.pid" ]; then
        kill $(cat "$LOGS_DIR/api.pid") 2>/dev/null || true
    fi
    if [ -f "$LOGS_DIR/web.pid" ]; then
        kill $(cat "$LOGS_DIR/web.pid") 2>/dev/null || true
    fi
    pkill -f "uvicorn src.main:app" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo -e "${GREEN}✅ Все сервисы остановлены${NC}"
    exit 0
}

trap stop_all SIGINT SIGTERM

# 1. Запуск Docker инфраструктуры (опционально)
echo -e "${BLUE}1. Проверка Docker инфраструктуры...${NC}"
DOCKER_AVAILABLE=false

if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    if docker info &> /dev/null; then
        DOCKER_AVAILABLE=true
        echo -e "${YELLOW}ℹ️  Docker доступен, запуск контейнеров...${NC}"
        if command -v docker-compose &> /dev/null; then
            docker-compose up -d postgres redis neo4j minio 2>&1 | tee "$LOGS_DIR/docker.log" || true
        else
            docker compose up -d postgres redis neo4j minio 2>&1 | tee "$LOGS_DIR/docker.log" || true
        fi
        echo -e "${GREEN}✅ Docker контейнеры запущены${NC}"
        echo "⏳ Ожидание готовности сервисов (10 сек)..."
        sleep 10
    else
        echo -e "${YELLOW}⚠️  Docker установлен, но daemon не запущен${NC}"
        echo -e "${YELLOW}   Продолжаем без Docker (предполагаем локальные БД)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker не установлен${NC}"
    echo -e "${YELLOW}   Продолжаем без Docker (предполагаем локальные БД)${NC}"
fi

# 2. Создание скрипта для запуска API с автоперезапуском
echo -e "\n${BLUE}2. Запуск API сервера (порт 9002)...${NC}"

cat > "$LOGS_DIR/start-api.sh" << 'EOF'
#!/bin/bash
API_DIR="$(cd "$(dirname "$0")/../apps/api" && pwd)"
cd "$API_DIR"
LOGS_DIR="$(dirname "$0")"
export PYTHONPATH="${API_DIR}:${PYTHONPATH:-}"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] ===== Запуск API сервера =====" >> "$LOGS_DIR/api.log"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Рабочая директория: $API_DIR" >> "$LOGS_DIR/api.log"
while true; do
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🚀 Запуск API сервера (uvicorn)..." >> "$LOGS_DIR/api.log"
        uvicorn src.main:app --reload --host 0.0.0.0 --port 9002 --no-access-log >> "$LOGS_DIR/api.log" 2>&1 || {
            EXIT_CODE=$?
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ API сервер упал (код: $EXIT_CODE), перезапуск через 5 сек..." >> "$LOGS_DIR/api.log"
            sleep 5
        }
    else
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ Ошибка: .venv не найден в $(pwd), ожидание..." >> "$LOGS_DIR/api.log"
        sleep 10
    fi
done
EOF

chmod +x "$LOGS_DIR/start-api.sh"

# Запуск API в фоне
nohup bash "$LOGS_DIR/start-api.sh" > /dev/null 2>&1 &
API_PID=$!
echo $API_PID > "$LOGS_DIR/api.pid"
echo -e "${GREEN}✅ API сервер запущен (PID: $API_PID)${NC}"
echo "   Логи: tail -f $LOGS_DIR/api.log"

# 3. Создание скрипта для запуска Web с автоперезапуском
echo -e "\n${BLUE}3. Запуск Web dev server (порт 5180)...${NC}"

cat > "$LOGS_DIR/start-web.sh" << 'EOF'
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
EOF

chmod +x "$LOGS_DIR/start-web.sh"

# Запуск Web в фоне
nohup bash "$LOGS_DIR/start-web.sh" > /dev/null 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$LOGS_DIR/web.pid"
echo -e "${GREEN}✅ Web dev server запущен (PID: $WEB_PID)${NC}"
echo "   Логи: tail -f $LOGS_DIR/web.log"

# Информация
echo ""
echo "=============================================="
echo -e "${GREEN}✅ Все сервисы запущены в фоне!${NC}"
echo ""
echo "🌐 Сервисы:"
echo "   API:  http://localhost:9002/docs"
echo "   Web:  http://127.0.0.1:5180"
echo ""
echo "📋 Логи:"
echo "   API:  tail -f $LOGS_DIR/api.log"
echo "   Web:  tail -f $LOGS_DIR/web.log"
echo "   Docker: docker-compose logs -f"
echo ""
echo "🛑 Остановка:"
echo "   ./stop-all-services.sh"
echo "   или Ctrl+C"
echo ""
echo "💡 Сервисы автоматически перезапускаются при падении"
echo "💡 Вы можете закрыть этот терминал - сервисы продолжат работать"
echo "=============================================="

# Ждем завершения
wait
