#!/bin/bash
# Start FourCastNet NIM on Brev (single GPU)
# Requires: NGC_API_KEY — get from https://ngc.nvidia.com → Setup → API Key

set -e

cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$NGC_API_KEY" ]; then
  echo -e "${RED}Error: NGC_API_KEY not set${NC}"
  echo "  export NGC_API_KEY=your_key"
  echo "  Get key: https://ngc.nvidia.com → Setup → API Key"
  exit 1
fi

echo -e "${GREEN}Starting FourCastNet NIM...${NC}"

# NGC login
echo $NGC_API_KEY | docker login nvcr.io --username '$oauthtoken' --password-stdin

# Start
docker compose -f docker-compose.nim-fourcastnet.yml up -d

echo ""
echo -e "${YELLOW}Waiting for NIM (60s)...${NC}"
sleep 60

if curl -s http://localhost:8001/v1/health/ready 2>/dev/null | grep -q "ready"; then
  echo -e "${GREEN}✓ FourCastNet NIM ready on http://localhost:8001${NC}"
else
  echo -e "${YELLOW}⚠ NIM may still be warming up. Check: curl http://localhost:8001/v1/health/ready${NC}"
fi

echo ""
echo "  API uses it when USE_LOCAL_NIM=true (set in brev-deploy.sh .env)"
echo "  Stop: docker compose -f docker-compose.nim-fourcastnet.yml down"
echo ""
