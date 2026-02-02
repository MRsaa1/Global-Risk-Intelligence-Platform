#!/bin/bash
# Установка и запуск NVIDIA NIM контейнеров (Earth-2 FourCastNet + CorrDiff).
# Нужно: Docker, NVIDIA Container Toolkit, GPU, NGC API Key.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Какой compose: earth2 = только FourCastNet+CorrDiff, full = + FLUX + PyG
COMPOSE_FILE="${NIM_COMPOSE:-docker-compose.nim-earth2.yml}"

echo -e "${GREEN}NVIDIA NIM — установка и запуск${NC}"
echo "  Compose: $COMPOSE_FILE"
echo ""

# Загрузка NGC_API_KEY: .env.nvidia или .env в корне
if [ -f .env.nvidia ]; then
    set -a
    source .env.nvidia 2>/dev/null || true
    set +a
fi
if [ -z "$NGC_API_KEY" ] && [ -f .env ]; then
    export NGC_API_KEY=$(grep -E '^NGC_API_KEY=' .env 2>/dev/null | cut -d= -f2-)
fi

if [ -z "$NGC_API_KEY" ]; then
    echo -e "${RED}NGC_API_KEY не задан.${NC}"
    echo "  1. Скопируйте .env.nvidia.example в .env.nvidia"
    echo "  2. Вставьте ключ с https://catalog.ngc.nvidia.com → Setup → Generate API Key"
    echo "  Или: export NGC_API_KEY=ваш_ключ"
    exit 1
fi

echo -e "${YELLOW}Вход в реестр nvcr.io...${NC}"
echo "$NGC_API_KEY" | docker login nvcr.io --username '$oauthtoken' --password-stdin

if command -v nvidia-smi &>/dev/null; then
    echo -e "${YELLOW}GPU:${NC}"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
    echo -e "${YELLOW}nvidia-smi не найден — контейнеры могут не подняться без GPU.${NC}"
fi

echo ""
echo -e "${YELLOW}Скачивание образов (первый раз может занять несколько минут)...${NC}"
docker compose -f "$COMPOSE_FILE" pull

echo ""
echo -e "${YELLOW}Запуск контейнеров...${NC}"
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo -e "${YELLOW}Ожидание готовности (до ~60 с)...${NC}"
sleep 15
for i in 1 2 3 4 5 6; do
    if curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready"; then
        break
    fi
    [ $i -lt 6 ] && sleep 10
done

echo ""
echo -e "${GREEN}Проверка:${NC}"
if curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready"; then
    echo -e "  ${GREEN}✓ FourCastNet  http://localhost:8001${NC}"
else
    echo -e "  ${YELLOW}⚠ FourCastNet  ещё не готов (подождите 1–2 мин)${NC}"
fi
if curl -sf http://localhost:8000/v1/health/ready 2>/dev/null | grep -q "ready"; then
    echo -e "  ${GREEN}✓ CorrDiff      http://localhost:8000${NC}"
else
    echo -e "  ${YELLOW}⚠ CorrDiff      ещё не готов${NC}"
fi

echo ""
echo -e "${GREEN}Готово.${NC}"
echo "  Остановка: docker compose -f $COMPOSE_FILE down"
echo "  В API включите USE_LOCAL_NIM=true в apps/api/.env и перезапустите API."
