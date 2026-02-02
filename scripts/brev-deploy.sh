#!/bin/bash
# Deploy Physical-Financial Risk Platform on Brev (saaaliance)
# Run this ON the Brev environment: ./scripts/brev-deploy.sh
# Handles: Redis, fresh venv (no Mac/Linux mismatch), API, Web

set -e

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"
PY="$PROJECT_ROOT/apps/api/.venv/bin/python3"
PIP="$PROJECT_ROOT/apps/api/.venv/bin/pip"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🌍 Deploying on Brev...${NC}"

# 0. Redis (required by circuit breakers / caching)
echo -e "${YELLOW}Step 0: Redis...${NC}"
if ! command -v redis-server &>/dev/null; then
  echo "  Installing Redis..."
  sudo apt-get update -qq && sudo apt-get install -y redis-server -qq
fi
if ! redis-cli ping 2>/dev/null | grep -q PONG; then
  sudo systemctl start redis-server 2>/dev/null || redis-server --daemonize yes
  sleep 2
fi
echo -e "${GREEN}✓ Redis running${NC}"

# 1. Create .env for Brev
echo -e "${YELLOW}Step 1: Creating .env...${NC}"
mkdir -p apps/api
cat > apps/api/.env << 'EOF'
# Brev deployment
USE_SQLITE=true
ENVIRONMENT=production
DEBUG=false

# Data Federation pipelines (DFM)
USE_DATA_FEDERATION_PIPELINES=true
DATA_FEDERATION_CACHE_TTL_SEC=3600

# Local NIM (FourCastNet on port 8001)
USE_LOCAL_NIM=true
FOURCASTNET_NIM_URL=http://localhost:8001
CORRDIFF_NIM_URL=http://localhost:8000

# CORS for Brev Share/Port Forward
CORS_ORIGINS=["http://localhost:5180","http://127.0.0.1:5180","http://localhost:9002","http://0.0.0.0:5180"]

# Omniverse / E2CC (Earth-2 Command Center) — опционально. Кнопка «Open in Omniverse» откроет этот URL.
# По умолчанию API подставляет http://localhost:8010. Задайте, когда поднимете E2CC (отдельное приложение).
# E2CC_BASE_URL=http://localhost:8010

# Add below if needed (do not commit keys):
# NGC_API_KEY=...
# NVIDIA_API_KEY=...
# NOAA_API_TOKEN=...
# OPENWEATHER_API_KEY=...
EOF
echo -e "${GREEN}✓ .env created${NC}"

# 2. Python backend (fresh venv — avoid Mac/Linux mismatch from copied .venv)
echo -e "${YELLOW}Step 2: Installing Python dependencies...${NC}"
cd "$PROJECT_ROOT/apps/api"
rm -rf .venv
python3 -m venv .venv
"$PIP" install --upgrade pip -q
if [ -f pyproject.toml ]; then
  "$PIP" install -e . -q
else
  echo -e "${YELLOW}  pyproject.toml missing, installing core deps...${NC}"
  "$PIP" install fastapi "uvicorn[standard]" pydantic pydantic-settings sqlalchemy aiosqlite httpx "python-jose[cryptography]" passlib bcrypt python-multipart numpy scipy pandas shapely structlog orjson reportlab redis -q
fi
"$PIP" install email-validator -q
echo -e "${GREEN}✓ Backend deps installed${NC}"

# 3. Frontend
echo -e "${YELLOW}Step 3: Building frontend...${NC}"
cd "$PROJECT_ROOT/apps/web"
if ! command -v npm &>/dev/null; then
  echo "  Installing Node..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
npm install --silent
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"

# 4. Stop existing
echo -e "${YELLOW}Step 4: Stopping existing processes...${NC}"
pkill -f "uvicorn src.main:app" 2>/dev/null || true
pkill -f "vite preview" 2>/dev/null || true
sleep 2

# 5. Start API (use venv python explicitly)
echo -e "${YELLOW}Step 5: Starting API on 0.0.0.0:9002...${NC}"
cd "$PROJECT_ROOT/apps/api"
export USE_SQLITE=true
nohup "$PY" -m uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/pfrp-api.log 2>&1 &
echo $! > /tmp/pfrp-api.pid
sleep 3

# 6. Start web
echo -e "${YELLOW}Step 6: Starting web on 0.0.0.0:5180...${NC}"
cd "$PROJECT_ROOT/apps/web"
nohup npx vite preview --port 5180 --host > /tmp/pfrp-web.log 2>&1 &
echo $! > /tmp/pfrp-web.pid

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "  API:  http://0.0.0.0:9002  → Port Forward 9002"
echo "  Web:  http://0.0.0.0:5180  → Port Forward 5180"
echo ""
echo "  Command Center: http://localhost:5180/command (after Port Forward)"
echo ""
echo "  Logs: tail -f /tmp/pfrp-api.log /tmp/pfrp-web.log"
echo ""
echo "  NIM (optional): export NGC_API_KEY=... && ./scripts/brev-start-nim.sh"
echo "  Stop: pkill -f 'uvicorn src.main:app'; pkill -f 'vite preview'"
echo ""
