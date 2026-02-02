#!/bin/bash
# Запуск: бэкенд (Docker) + инфраструктура, затем инструкции для API и фронта.
# Запускать в корне репозитория.

set -e
cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🐳 Запуск Docker: postgres, redis, neo4j, minio..."

if command -v docker-compose &> /dev/null; then
  docker-compose up -d postgres redis neo4j minio
elif docker compose version &> /dev/null; then
  docker compose up -d postgres redis neo4j minio
else
  echo "Нужен Docker. Установите Docker Desktop или docker-compose."
  exit 1
fi

echo ""
echo "⏳ Ожидание готовности сервисов (15 сек)..."
sleep 15

echo ""
echo -e "${GREEN}✅ Docker: postgres, redis, neo4j, minio — запущены.${NC}"
echo ""
echo "=============================================="
echo "Открой ещё 2 терминала и выполни:"
echo ""
echo "--- Терминал 1: API (перезапуск) ---"
echo "  cd $(pwd)/apps/api"
echo "  source .venv/bin/activate"
echo "  uvicorn src.main:app --reload --port 9002"
echo ""
echo "--- Терминал 2: Фронтенд ---"
echo "  cd $(pwd)/apps/web"
echo "  npm run dev"
echo ""
echo "--- В браузере ---"
echo "  Фронт:  http://127.0.0.1:5180"
echo "  API:    http://127.0.0.1:9002/docs"
echo "=============================================="
