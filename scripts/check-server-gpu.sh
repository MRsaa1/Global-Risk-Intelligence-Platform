#!/usr/bin/env bash
# Check GPU server (saaaliance) readiness: NIM, API, DFM, Omniverse/E2CC.
# Run on server: ./scripts/check-server-gpu.sh

set -e

cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:9002}"

echo -e "${CYAN}=== GPU server check (NIM, API, DFM, E2CC) ===${NC}"
echo ""

# 1. FourCastNet NIM
echo -n "NIM (FourCastNet :8001): "
if curl -sf http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready"; then
  echo -e "${GREEN}ready${NC}"
else
  echo -e "${YELLOW}not ready${NC} — start: ./scripts/brev-start-nim.sh (needs NGC_API_KEY)"
fi

# 2. API
echo -n "API ($API_URL): "
if curl -sf "$API_URL/api/v1/health" -o /dev/null 2>/dev/null; then
  echo -e "${GREEN}up${NC}"
else
  echo -e "${RED}down${NC} — start: cd apps/api && source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 9002"
fi

# 3. DFM status (if API up)
if curl -sf "$API_URL/api/v1/health" -o /dev/null 2>/dev/null; then
  echo -n "DFM pipelines: "
  DFM=$(curl -sf "$API_URL/api/v1/data-federation/status" 2>/dev/null || echo "{}")
  if echo "$DFM" | grep -q '"use_data_federation_pipelines":true'; then
    echo -e "${GREEN}on${NC}"
  else
    echo -e "${YELLOW}off or error${NC} — set USE_DATA_FEDERATION_PIPELINES=true in apps/api/.env"
  fi

  echo -n "NIM health (API): "
  NIM=$(curl -sf "$API_URL/api/v1/nvidia/nim/health" 2>/dev/null || echo "{}")
  if echo "$NIM" | grep -q '"fourcastnet".*"status":"healthy"'; then
    echo -e "${GREEN}healthy${NC}"
  else
    echo -e "${YELLOW}unavailable${NC}"
  fi

  echo -n "E2CC (Omniverse): "
  OMNI=$(curl -sf "$API_URL/api/v1/omniverse/status" 2>/dev/null || echo "{}")
  if echo "$OMNI" | grep -q '"e2cc_configured":true'; then
    echo -e "${GREEN}configured${NC}"
  else
    echo -e "${YELLOW}not deployed${NC} — deploy E2CC, set E2CC_BASE_URL in apps/api/.env, restart API"
  fi
fi

echo ""
echo -e "${CYAN}Next:${NC}"
echo "  • Climate stress tests: open Command Center in browser, run stress test on a city."
echo "  • E2CC: see docs/OMNIVERSE_E2CC_SETUP.md and docs/SERVER_GPU_CLIMATE_OMNIVERSE.md"
echo ""
