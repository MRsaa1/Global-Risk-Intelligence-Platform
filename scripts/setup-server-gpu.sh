#!/usr/bin/env bash
# ===========================================
# Setup GPU server (saaaliance) — run ON THE SERVER
# Usage: cd ~/global-risk-platform && ./scripts/setup-server-gpu.sh
# Or after "brev open saaaliance cursor": terminal runs on server → run this script
# ===========================================

set -e

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== GPU server setup (saaaliance) ===${NC}"
echo ""

# 1. Ensure apps/api/.env has required vars (append if missing)
ENV_FILE="$ROOT/apps/api/.env"
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

for line in \
  "USE_SQLITE=true" \
  "DATABASE_URL=sqlite:///./prod.db" \
  "ALLOW_SEED_IN_PRODUCTION=true" \
  "USE_DATA_FEDERATION_PIPELINES=true" \
  "USE_LOCAL_NIM=true" \
  "FOURCASTNET_NIM_URL=http://localhost:8001" \
  "E2CC_BASE_URL=http://localhost:8010"; do
  key="${line%%=*}"
  if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "$line" >> "$ENV_FILE"
    echo -e "${GREEN}+ .env: $line${NC}"
  fi
done
echo -e "${GREEN}✓ .env ready${NC}"

# 2. Ensure check-server-gpu.sh exists
CHECK_SCRIPT="$ROOT/scripts/check-server-gpu.sh"
if [ ! -x "$CHECK_SCRIPT" ]; then
  mkdir -p "$ROOT/scripts"
  cat > "$CHECK_SCRIPT" << 'CHECK'
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
API_URL="${API_URL:-http://localhost:9002}"
echo "=== GPU server check (NIM, API, DFM, E2CC) ==="
echo ""
echo -n "NIM (:8001): "
curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready" && echo "ready" || echo "not ready"
echo -n "API ($API_URL): "
curl -sf "$API_URL/api/v1/health" -o /dev/null 2>/dev/null && echo "up" || echo "down"
if curl -sf "$API_URL/api/v1/health" -o /dev/null 2>/dev/null; then
  echo -n "DFM: "
  curl -sf "$API_URL/api/v1/data-federation/status" 2>/dev/null | grep -q '"use_data_federation_pipelines":true' && echo "on" || echo "off"
  echo -n "NIM (API): "
  curl -sf "$API_URL/api/v1/nvidia/nim/health" 2>/dev/null | grep -q '"fourcastnet".*"healthy"' && echo "healthy" || echo "unavailable"
  echo -n "E2CC: "
  curl -sf "$API_URL/api/v1/omniverse/status" 2>/dev/null | grep -q '"e2cc_configured":true' && echo "configured" || echo "not deployed"
fi
echo ""
CHECK
  chmod +x "$CHECK_SCRIPT"
  echo -e "${GREEN}✓ check-server-gpu.sh created${NC}"
fi

# 3. Redis (optional but useful)
if command -v redis-cli &>/dev/null; then
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}✓ Redis running${NC}"
  else
    (redis-server --daemonize yes 2>/dev/null || true)
    sleep 1
    redis-cli ping 2>/dev/null | grep -q PONG && echo -e "${GREEN}✓ Redis started${NC}" || echo -e "${YELLOW}⚠ Redis not running${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Redis not installed (optional)${NC}"
fi

# 4. Python venv
if [ ! -d "$ROOT/apps/api/.venv" ]; then
  echo -e "${YELLOW}Creating venv...${NC}"
  cd "$ROOT/apps/api"
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip -q
  [ -f pyproject.toml ] && .venv/bin/pip install -e . -q || .venv/bin/pip install fastapi "uvicorn[standard]" pydantic pydantic-settings sqlalchemy aiosqlite httpx python-multipart -q
  cd "$ROOT"
  echo -e "${GREEN}✓ venv created${NC}"
else
  echo -e "${GREEN}✓ venv exists${NC}"
fi

# 5. Kill old API, start new
echo -e "${YELLOW}Restarting API...${NC}"
pkill -f "uvicorn src.main:app" 2>/dev/null || true
sleep 2
cd "$ROOT/apps/api"
source .venv/bin/activate
nohup uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
sleep 3
cd "$ROOT"
if curl -sf http://localhost:9002/api/v1/health -o /dev/null 2>/dev/null; then
  echo -e "${GREEN}✓ API running on :9002${NC}"
else
  echo -e "${RED}API may still be starting. Check: tail -f /tmp/api.log${NC}"
fi

# 6. Run check
echo ""
"$CHECK_SCRIPT"

# 7. Next steps
echo -e "${CYAN}Next:${NC}"
echo "  • NIM: if not ready, run: export NGC_API_KEY=your_key && ./scripts/brev-start-nim.sh  (or NIM_COMPOSE=docker-compose.nim-fourcastnet.yml ./scripts/start-nvidia-nim.sh)"
echo "  • Web: build/serve from apps/web or use nginx; open Command Center via Port Forward"
echo "  • E2CC: see docs/OMNIVERSE_E2CC_SETUP.md"
echo ""
