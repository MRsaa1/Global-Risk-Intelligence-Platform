#!/usr/bin/env bash
# ===========================================
# Check GPU server API and NVIDIA services FROM your Mac.
# Prerequisite: tunnel must be open: ssh -L 15180:5180 -L 19002:9002 ubuntu@GPU_IP
# Usage: cd ~/global-risk-platform && ./scripts/check-gpu-from-mac.sh
# ===========================================

set -e

API="${API:-http://127.0.0.1:19002}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== GPU server check (via tunnel to $API) ==="
echo ""

# 1. Basic health
if curl -sf --connect-timeout 5 "$API/api/v1/health" -o /tmp/health.json 2>/dev/null; then
  echo -e "${GREEN}✓ API health${NC}"
  if grep -q '"demo_mode":true' /tmp/health.json 2>/dev/null; then
    echo "  demo_mode: true (Strategic Modules open without login)"
  fi
else
  echo -e "${RED}✗ API health failed${NC}"
  echo "  Open tunnel first: ssh -i ~/.ssh/risk-platform-g5.pem -L 15180:localhost:5180 -L 19002:localhost:9002 ubuntu@34.238.171.112"
  exit 1
fi

# 2. NVIDIA services (NIM, etc.)
if curl -sf --connect-timeout 5 "$API/api/v1/health/nvidia" -o /tmp/nvidia.json 2>/dev/null; then
  echo -e "${GREEN}✓ NVIDIA health endpoint${NC}"
  if grep -q 'fourcastnet_nim' /tmp/nvidia.json 2>/dev/null; then
    if grep -q '"ready":\s*true' /tmp/nvidia.json 2>/dev/null; then
      echo "  FourCastNet NIM: ready"
    else
      echo -e "  ${YELLOW}FourCastNet NIM: not ready (optional)${NC}"
    fi
  fi
else
  echo -e "${YELLOW}⚠ NVIDIA health endpoint failed or not available${NC}"
fi

echo ""
echo "Next: open in browser: http://127.0.0.1:15180?api=http://127.0.0.1:19002"
echo "Full checklist: docs/GPU_TESTING_CHECKLIST.md"
