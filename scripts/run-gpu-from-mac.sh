#!/usr/bin/env bash
# ===========================================
# Run FROM your Mac: copy script to GPU server, run it there, then show tunnel + URL.
# Usage: cd ~/global-risk-platform && ./scripts/run-gpu-from-mac.sh
# Optional: GPU_IP=1.2.3.4 SSH_KEY=~/.ssh/key.pem ./scripts/run-gpu-from-mac.sh
# ===========================================

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GPU_IP="${GPU_IP:-34.238.171.112}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/risk-platform-g5.pem}"
USER="${GPU_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/global-risk-platform}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== GPU server: upload script and run (${USER}@${GPU_IP}) ===${NC}"
echo ""

# 1. Copy run-on-gpu-server.sh to server (so it works even without full deploy)
if [ ! -f "$SSH_KEY" ]; then
  echo "SSH key not found: $SSH_KEY"
  echo "Set: SSH_KEY=path/to/key.pem"
  exit 1
fi
scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$REPO_ROOT/scripts/run-on-gpu-server.sh" "${USER}@${GPU_IP}:${REMOTE_DIR}/scripts/run-on-gpu-server.sh" 2>/dev/null || {
  echo "Copying script failed. Run on server manually:"
  echo "  ssh -i $SSH_KEY ${USER}@${GPU_IP}"
  echo "  cd ${REMOTE_DIR} && ./scripts/run-on-gpu-server.sh"
  exit 1
}
echo -e "${GREEN}✓ Script uploaded${NC}"

# 1b. Copy setup and check scripts so they exist on server (avoid "No such file or directory")
scp -i "$SSH_KEY" "$REPO_ROOT/scripts/setup-server-gpu.sh" "${USER}@${GPU_IP}:${REMOTE_DIR}/scripts/setup-server-gpu.sh" 2>/dev/null && true
scp -i "$SSH_KEY" "$REPO_ROOT/scripts/check-server-gpu.sh" "${USER}@${GPU_IP}:${REMOTE_DIR}/scripts/check-server-gpu.sh" 2>/dev/null && true
ssh -i "$SSH_KEY" "${USER}@${GPU_IP}" "chmod +x ${REMOTE_DIR}/scripts/setup-server-gpu.sh ${REMOTE_DIR}/scripts/check-server-gpu.sh 2>/dev/null" || true

# 2. Copy config.py so CORS fix is in code (optional but recommended)
scp -i "$SSH_KEY" "$REPO_ROOT/apps/api/src/core/config.py" "${USER}@${GPU_IP}:${REMOTE_DIR}/apps/api/src/core/config.py" 2>/dev/null && echo -e "${GREEN}✓ config.py updated${NC}" || true

# 3. Run script on server (with optional NIM key)
echo ""
echo -e "${CYAN}Running on server...${NC}"
if [ -n "$NGC_API_KEY" ]; then
  ssh -i "$SSH_KEY" "${USER}@${GPU_IP}" "cd ${REMOTE_DIR} && chmod +x scripts/run-on-gpu-server.sh && export NGC_API_KEY='$NGC_API_KEY' && ./scripts/run-on-gpu-server.sh"
else
  ssh -i "$SSH_KEY" "${USER}@${GPU_IP}" "cd ${REMOTE_DIR} && chmod +x scripts/run-on-gpu-server.sh && ./scripts/run-on-gpu-server.sh"
fi

echo ""
echo -e "${CYAN}=== On your Mac: open tunnel, then browser ===${NC}"
echo ""
echo "  ssh -i $SSH_KEY -L 15180:localhost:5180 -L 19002:localhost:9002 ${USER}@${GPU_IP}"
echo ""
echo "  http://127.0.0.1:15180/command?api=http://127.0.0.1:19002"
echo ""
