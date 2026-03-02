#!/usr/bin/env bash
# ===========================================
# Run ON the GPU server (34.238.171.112 or any ubuntu@...).
# Fixes .env (CORS), starts API + frontend, optionally NIM, runs check.
# Usage on server: cd ~/global-risk-platform && ./scripts/run-on-gpu-server.sh
# Or from Mac: ./scripts/run-gpu-from-mac.sh
# ===========================================

set -e

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== GPU server: fix env, API, front, NIM, check ===${NC}"
echo ""

# 1. Fix .env: comment CORS_ORIGINS; ensure ALLOW_SEED_IN_PRODUCTION for demo (Strategic Modules open without login)
ENV_FILE="$ROOT/apps/api/.env"
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
if grep -q '^CORS_ORIGINS=' "$ENV_FILE" 2>/dev/null; then
  sed -i 's/^CORS_ORIGINS=/#CORS_ORIGINS=/' "$ENV_FILE"
  echo -e "${GREEN}✓ .env: CORS_ORIGINS commented out (use defaults)${NC}"
fi
if grep -q '^ALLOW_SEED_IN_PRODUCTION=' "$ENV_FILE" 2>/dev/null; then
  sed -i 's/^ALLOW_SEED_IN_PRODUCTION=.*/ALLOW_SEED_IN_PRODUCTION=true/' "$ENV_FILE"
else
  echo 'ALLOW_SEED_IN_PRODUCTION=true' >> "$ENV_FILE"
fi
echo -e "${GREEN}✓ .env: ALLOW_SEED_IN_PRODUCTION=true (demo_mode: Strategic Modules open)${NC}"

# 2. Setup (adds USE_SQLITE, DATABASE_URL, NIM vars, creates check script, restarts API)
if [ -x "$ROOT/scripts/setup-server-gpu.sh" ]; then
  "$ROOT/scripts/setup-server-gpu.sh"
else
  echo -e "${YELLOW}⚠ setup-server-gpu.sh not found, starting API manually...${NC}"
  pkill -f "uvicorn src.main:app" 2>/dev/null || true
  sleep 2
  cd "$ROOT/apps/api"
  [ -d .venv ] && source .venv/bin/activate
  set -a && [ -f .env ] && source .env && set +a
  nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 9002 --no-access-log > /tmp/api.log 2>&1 &
  sleep 3
  cd "$ROOT"
  curl -sf http://localhost:9002/api/v1/health -o /dev/null && echo -e "${GREEN}✓ API :9002${NC}" || echo -e "${RED}API check: tail -f /tmp/api.log${NC}"
fi

# 3. Frontend (serve on 5180)
if [ -d "$ROOT/apps/web/dist" ]; then
  pkill -f "serve -s dist" 2>/dev/null || true
  sleep 1
  cd "$ROOT/apps/web"
  nohup npx serve -s dist -l 5180 > /tmp/web.log 2>&1 &
  sleep 2
  cd "$ROOT"
  if curl -sf http://localhost:5180 -o /dev/null 2>/dev/null; then
    echo -e "${GREEN}✓ Frontend :5180${NC}"
  else
    echo -e "${YELLOW}⚠ Frontend may still be starting (check /tmp/web.log)${NC}"
  fi
else
  echo -e "${YELLOW}⚠ apps/web/dist not found — run deploy or npm run build in apps/web${NC}"
fi

# 4. NIM (optional): start if NGC_API_KEY is set
if [ -n "$NGC_API_KEY" ] && [ -x "$ROOT/scripts/brev-start-nim.sh" ]; then
  echo ""
  echo -e "${CYAN}Starting FourCastNet NIM...${NC}"
  "$ROOT/scripts/brev-start-nim.sh" || true
else
  echo ""
  echo -e "${YELLOW}NIM not started (optional). To enable:${NC}"
  echo "  export NGC_API_KEY=your_ngc_key"
  echo "  ./scripts/brev-start-nim.sh"
fi

# 5. E2CC (Earth-2 Command Center): start if built, so "Open in Omniverse" works
E2CC_DIR="${E2CC_DIR:-$HOME/earth2-weather-analytics}"
if [ -x "$E2CC_DIR/deploy/deploy_e2cc.sh" ] && [ -x "$ROOT/scripts/start-e2cc.sh" ]; then
  if ! curl -sf http://localhost:8010 -o /dev/null 2>/dev/null; then
    echo -e "${CYAN}Starting E2CC streamer (Omniverse)...${NC}"
    "$ROOT/scripts/start-e2cc.sh" --background || true
    sleep 3
  fi
  if curl -sf http://localhost:8010 -o /dev/null 2>/dev/null; then
    echo -e "${GREEN}✓ E2CC :8010 (Open in Omniverse)${NC}"
  else
    echo -e "${YELLOW}E2CC not responding yet. To start manually: ./scripts/start-e2cc.sh${NC}"
  fi
else
  echo -e "${YELLOW}E2CC not built. To enable «Open in Omniverse»: ./scripts/setup-e2cc-on-server.sh then ./scripts/start-e2cc.sh${NC}"
fi

# 6. Final check (create minimal script if missing)
CHECK_SCRIPT="$ROOT/scripts/check-server-gpu.sh"
if [ ! -x "$CHECK_SCRIPT" ]; then
  mkdir -p "$ROOT/scripts"
  cat > "$CHECK_SCRIPT" << 'CHECKEOF'
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
API_URL="${API_URL:-http://localhost:9002}"
echo "=== GPU server check ==="
echo -n "NIM (:8001): "; curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready" && echo "ready" || echo "not ready"
echo -n "API (:9002): "; curl -sf "$API_URL/api/v1/health" -o /dev/null 2>/dev/null && echo "up" || echo "down"
echo -n "Front (:5180): "; curl -sf http://localhost:5180 -o /dev/null 2>/dev/null && echo "up" || echo "down"
echo -n "E2CC (:8010): "; curl -sf http://localhost:8010 -o /dev/null 2>/dev/null && echo "up" || echo "down"
echo ""
CHECKEOF
  chmod +x "$CHECK_SCRIPT"
  echo -e "${GREEN}✓ check-server-gpu.sh created${NC}"
fi
echo ""
"$CHECK_SCRIPT"

# 7. Instructions for Mac
echo ""
echo -e "${CYAN}=== From your Mac ===${NC}"
echo "1. Open tunnel (leave terminal open). With E2CC add -L 8010:localhost:8010:"
echo "   ssh -i ~/.ssh/risk-platform-g5.pem -L 15180:localhost:5180 -L 19002:localhost:9002 -L 8010:localhost:8010 ubuntu@34.238.171.112"
echo ""
echo "2. In browser open:"
echo "   http://127.0.0.1:15180/command?api=http://127.0.0.1:19002"
echo "   «Open in Omniverse» → http://127.0.0.1:8010 (if E2CC running)"
echo ""
echo -e "${GREEN}Done.${NC}"
