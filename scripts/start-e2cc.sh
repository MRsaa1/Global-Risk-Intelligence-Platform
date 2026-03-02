#!/usr/bin/env bash
# ===========================================
# Start Earth-2 Command Center (E2CC) streamer ON the GPU server.
# Run after setup-e2cc-on-server.sh. Listens on port 8010.
# Usage: cd ~/global-risk-platform && ./scripts/start-e2cc.sh [--background]
#   --background: start in background (nohup); otherwise foreground.
# ===========================================

set -e

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

E2CC_DIR="${E2CC_DIR:-$HOME/earth2-weather-analytics}"
DEPLOY_SCRIPT="$E2CC_DIR/deploy/deploy_e2cc.sh"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKGROUND=false
[ "$1" = "--background" ] && BACKGROUND=true

if [ ! -x "$DEPLOY_SCRIPT" ]; then
  echo -e "${RED}E2CC not built. Run first: ./scripts/setup-e2cc-on-server.sh${NC}"
  echo "  Then: ./scripts/start-e2cc.sh"
  exit 1
fi

# Start Xvfb if not running
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  echo -e "${CYAN}Starting Xvfb :99...${NC}"
  Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX >/dev/null 2>&1 &
  sleep 2
  echo -e "${GREEN}✓ Xvfb started${NC}"
else
  echo -e "${GREEN}✓ Xvfb already running${NC}"
fi

export DISPLAY=:99

# Ensure E2CC_BASE_URL in platform .env so "Open in Omniverse" works
ENV_FILE="$ROOT/apps/api/.env"
if [ -f "$ENV_FILE" ] && ! grep -q '^E2CC_BASE_URL=' "$ENV_FILE" 2>/dev/null; then
  echo 'E2CC_BASE_URL=http://localhost:8010' >> "$ENV_FILE"
  echo -e "${GREEN}✓ .env: E2CC_BASE_URL added${NC}"
fi

if [ "$BACKGROUND" = true ]; then
  echo -e "${CYAN}Starting E2CC streamer in background (port 8010)...${NC}"
  nohup env DISPLAY=:99 bash -c "cd '$E2CC_DIR' && ./deploy/deploy_e2cc.sh -s" > /tmp/e2cc.log 2>&1 &
  echo -e "${GREEN}✓ E2CC starting. Logs: tail -f /tmp/e2cc.log${NC}"
  echo "  From Mac add to tunnel: -L 8010:localhost:8010"
  echo "  Then in browser: http://127.0.0.1:8010 (or use «Open in Omniverse» in Command Center)"
  exit 0
fi

echo -e "${CYAN}Starting E2CC streamer (foreground, port 8010). Ctrl+C to stop.${NC}"
echo "  From Mac: ssh ... -L 8010:localhost:8010 ... then http://127.0.0.1:8010"
echo ""
cd "$E2CC_DIR"
exec ./deploy/deploy_e2cc.sh -s
