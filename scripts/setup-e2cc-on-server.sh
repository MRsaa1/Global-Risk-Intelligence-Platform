#!/bin/bash
# Setup Earth-2 Command Center (E2CC) on Brev / Ubuntu GPU server
# Run ON the server. After this script: run Xvfb + deploy_e2cc.sh -s (see end of script).
# Full guide: docs/E2CC_ON_SERVER_AND_STRESS_TESTS.md

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

E2CC_DIR="${E2CC_DIR:-$HOME/earth2-weather-analytics}"

echo -e "${GREEN}=== E2CC setup on server ===${NC}"

# 1. Dependencies
echo -e "${YELLOW}Step 1: Installing git-lfs, xvfb...${NC}"
sudo apt-get update -qq
sudo apt-get install -y git-lfs xvfb -qq
git lfs install

# 2. Clone (or pull)
if [ -d "$E2CC_DIR/.git" ]; then
  echo -e "${YELLOW}Step 2: Pulling earth2-weather-analytics...${NC}"
  cd "$E2CC_DIR"
  git pull --rebase || true
  git lfs fetch --all
  git lfs pull
else
  echo -e "${YELLOW}Step 2: Cloning earth2-weather-analytics...${NC}"
  cd "$(dirname "$E2CC_DIR")"
  git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git "$(basename "$E2CC_DIR")"
  cd "$E2CC_DIR"
  git lfs fetch --all
  git lfs pull
fi

# 3. Fix streamer .kit versions (6.2.2 -> 6.2.1, etc.)
KIT_FILE="$E2CC_DIR/e2cc/source/apps/omni.earth_2_command_center.app_streamer.kit"
if [ -f "$KIT_FILE" ]; then
  echo -e "${YELLOW}Step 3: Fixing streamer extension versions...${NC}"
  sed -i 's/omni.kit.streamsdk.plugins-6.2.2/omni.kit.streamsdk.plugins-6.2.1/' "$KIT_FILE"
  sed -i 's/omni.kit.widgets.custom-1.0.10/omni.kit.widgets.custom-1.0.9/' "$KIT_FILE"
  sed -i 's/omni.kit.window.section-107.0.3/omni.kit.window.section-107.0.2/' "$KIT_FILE"
  echo -e "${GREEN}✓ .kit updated${NC}"
else
  echo -e "${YELLOW}Step 3: $KIT_FILE not found, skipping .kit fix${NC}"
fi

# 4. Build E2CC
echo -e "${YELLOW}Step 4: Building E2CC (may take 10–30 min)...${NC}"
cd "$E2CC_DIR/e2cc"
./build.sh --release --no-docker
echo -e "${GREEN}✓ E2CC built${NC}"

echo ""
echo -e "${GREEN}=== Setup done. Start E2CC streamer (headless): ===${NC}"
echo ""
echo "  Option A — foreground:"
echo "    cd $E2CC_DIR"
echo "    Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX &"
echo "    export DISPLAY=:99"
echo "    ./deploy/deploy_e2cc.sh -s"
echo ""
echo "  Option B — in tmux (detach with Ctrl+B, D):"
echo "    tmux new -s e2cc"
echo "    cd $E2CC_DIR"
echo "    Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX &"
echo "    export DISPLAY=:99"
echo "    ./deploy/deploy_e2cc.sh -s"
echo ""
echo "  Then on Mac: brev port-forward saaaliance → 8010:8010"
echo "  In apps/api/.env: E2CC_BASE_URL=http://localhost:8010"
echo ""
echo -e "  Full guide: ${GREEN}docs/E2CC_ON_SERVER_AND_STRESS_TESTS.md${NC}"
echo ""
