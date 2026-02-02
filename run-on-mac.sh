#!/bin/bash
# One-command launch: Docker + optional seed + API (background) + optional Web (background).
# Run from repo root. Logs: .services-logs/api.log, .services-logs/web.log

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Ensure Docker Desktop's CLI is on PATH (macOS)
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# Find docker - macOS Docker Desktop locations (symlink /usr/local/bin/docker can be broken)
DOCKER_CMD=""
[ -x /Applications/Docker.app/Contents/Resources/bin/docker ] && DOCKER_CMD=/Applications/Docker.app/Contents/Resources/bin/docker
[ -z "$DOCKER_CMD" ] && [ -x /usr/local/bin/docker ] && DOCKER_CMD=/usr/local/bin/docker
[ -z "$DOCKER_CMD" ] && [ -x /opt/homebrew/bin/docker ] && DOCKER_CMD=/opt/homebrew/bin/docker
[ -z "$DOCKER_CMD" ] && command -v docker &> /dev/null && DOCKER_CMD=docker

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

LOG_DIR="${ROOT}/.services-logs"
mkdir -p "$LOG_DIR"

# 1. Check Docker
if [ -z "$DOCKER_CMD" ]; then
    echo -e "${RED}Docker is not installed. Install Docker and run again.${NC}"
    exit 1
fi
if ! "$DOCKER_CMD" info &> /dev/null; then
    echo -e "${RED}Docker daemon is not running. Start Docker and run again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker is running"

# 2. Start infrastructure
echo ""
echo "Starting infrastructure (postgres, redis, neo4j, minio)..."
"$DOCKER_CMD" compose up -d postgres redis neo4j minio

echo "Waiting for ports (5433, 6379)..."
for i in {1..30}; do
    if (command -v nc &> /dev/null && nc -z 127.0.0.1 6379 2>/dev/null) || true; then
        break
    fi
    sleep 1
done
sleep 3
echo -e "${GREEN}✓${NC} Infrastructure up"

# 3. Optional: seed high-fidelity demo scenario
if [ -d "apps/api" ] && [ -f "apps/api/src/main.py" ]; then
    API_DIR="${ROOT}/apps/api"
    if [ ! -f "${API_DIR}/data/high_fidelity/wrf_nyc_001/flood.json" ]; then
        echo ""
        echo "Seeding high-fidelity demo scenario (wrf_nyc_001)..."
        (cd "$API_DIR" && { . .venv/bin/activate 2>/dev/null; PYTHONPATH=src python3 -m scripts.seed_high_fidelity >> "${LOG_DIR}/seed.log" 2>&1; }) || true
        echo -e "${GREEN}✓${NC} Seed done (or skipped)"
    fi
fi

# 4. Start API in background
echo ""
echo "Starting API on port 9002 (background, log: .services-logs/api.log)..."
(
    cd "${ROOT}/apps/api"
    if [ -d ".venv" ]; then
        source .venv/bin/activate
    fi
    exec uvicorn src.main:app --host 0.0.0.0 --port 9002 >> "${LOG_DIR}/api.log" 2>&1
) &
API_PID=$!
echo $API_PID > "${LOG_DIR}/api.pid"

# Wait for API to respond
echo "Waiting for API (http://localhost:9002/docs)..."
for i in {1..40}; do
    if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:9002/docs" 2>/dev/null | grep -q 200; then
        echo -e "${GREEN}✓${NC} API is up"
        break
    fi
    if ! kill -0 $API_PID 2>/dev/null; then
        echo -e "${RED}API process exited. Check .services-logs/api.log${NC}"
        exit 1
    fi
    sleep 1
done

# 5. Optional: start Web in background (if --web or RUN_WEB=1)
START_WEB="${RUN_WEB:-0}"
for arg in "$@"; do
    if [ "$arg" = "--web" ]; then START_WEB=1; fi
done
if [ "$START_WEB" = "1" ] && [ -d "apps/web" ] && command -v npm &> /dev/null; then
    echo ""
    echo "Starting Web dev server (background, log: .services-logs/web.log)..."
    (cd "${ROOT}/apps/web" && npm run dev >> "${LOG_DIR}/web.log" 2>&1) &
    echo $! > "${LOG_DIR}/web.pid"
    echo -e "${GREEN}✓${NC} Web starting (see .services-logs/web.log for URL, often http://127.0.0.1:5180)"
else
    echo ""
    echo "To start Web: RUN_WEB=1 ./run-on-mac.sh --web  or run manually: cd apps/web && npm run dev"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}Ready.${NC}"
echo "  API:  http://localhost:9002/docs"
echo "  Web:  start with --web or run 'cd apps/web && npm run dev'"
echo "  Logs: .services-logs/api.log, .services-logs/web.log"
echo "  Stop: kill \$(cat .services-logs/api.pid) 2>/dev/null; docker compose down"
echo "=============================================="
