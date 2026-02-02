#!/bin/bash
# Copy project to Brev (run from Mac, in repo root)
# Then: brev open saaaliance cursor → ./scripts/brev-deploy.sh

set -e
cd "$(dirname "$0")/.."

echo "Creating tarball (excludes node_modules, .venv, .git)..."
# COPYFILE_DISABLE prevents macOS xattr in tarball (avoids "Ignoring unknown extended header" on Linux)
export COPYFILE_DISABLE=1
tar --exclude='node_modules' --exclude='.git' --exclude='__pycache__' \
  --exclude='.venv' --exclude='venv' --exclude='*.pyc' --exclude='dist' --exclude='build' \
  --exclude='.env' --exclude='*.db' -czf /tmp/pfrp-brev.tar.gz .

echo "Copying tarball to saaaliance..."
brev copy /tmp/pfrp-brev.tar.gz saaaliance:/home/ubuntu/pfrp-brev.tar.gz
# If brev copy uses different path, adjust: e.g. saaaliance:~/pfrp-brev.tar.gz

echo ""
echo "On Brev (brev open saaaliance cursor → terminal runs on server):"
echo "  mkdir -p ~/global-risk-platform"
echo "  tar -xzf ~/pfrp-brev.tar.gz -C ~/global-risk-platform"
echo "  rm ~/pfrp-brev.tar.gz"
echo "  cd ~/global-risk-platform && ./scripts/setup-server-gpu.sh"
echo ""
echo "Or full deploy: ./scripts/brev-deploy.sh (venv, API, web build)"
echo "Port Forward: 9002 (API), 5180 (web)"
echo ""
