#!/bin/bash
# One-command deploy: copy project to Brev and run deployment.
# Run from Mac in repo root: ./scripts/brev-full-deploy.sh

set -e

cd "$(dirname "$0")/.."

echo "Creating tarball..."
export COPYFILE_DISABLE=1
tar --exclude='node_modules' --exclude='.git' --exclude='__pycache__' \
  --exclude='.venv' --exclude='venv' --exclude='*.pyc' --exclude='dist' --exclude='build' \
  --exclude='.env' --exclude='*.db' -czf /tmp/pfrp-brev.tar.gz .

echo "Copying to saaaliance..."
brev copy /tmp/pfrp-brev.tar.gz saaaliance:/home/ubuntu/pfrp-brev.tar.gz

echo "Running deploy on Brev (extract + ./scripts/brev-deploy.sh)..."
brev shell saaaliance << 'REMOTE'
cd /home/ubuntu
rm -rf global-risk-platform
mkdir -p global-risk-platform
tar -xzf pfrp-brev.tar.gz -C global-risk-platform
rm pfrp-brev.tar.gz
chmod +x global-risk-platform/scripts/brev-deploy.sh
cd global-risk-platform && ./scripts/brev-deploy.sh
REMOTE

echo ""
echo "Done. Port Forward 9002 and 5180 in Brev UI."
echo "Command Center: http://localhost:5180/command"
echo ""
