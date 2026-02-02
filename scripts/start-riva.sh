#!/usr/bin/env bash
# Deploy NVIDIA Riva (Speech AI) — TTS/STT for voice alerts and reports.
# Option A: NGC Quick Start (recommended first-time). Set RIVA_QUICKSTART_DIR to the unpacked NGC Riva quick start, NGC_API_KEY, then run this script.
# Option B: Docker Compose only. Run: docker compose -f docker-compose.riva.yml up -d (may require models from riva_init first).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

RIVA_QUICKSTART_DIR="${RIVA_QUICKSTART_DIR:-}"
NGC_API_KEY="${NGC_API_KEY:-}"

if [[ -n "$RIVA_QUICKSTART_DIR" && -f "$RIVA_QUICKSTART_DIR/riva_init.sh" && -f "$RIVA_QUICKSTART_DIR/riva_start.sh" ]]; then
  echo "Using NGC Riva Quick Start at: $RIVA_QUICKSTART_DIR"
  if [[ -z "$NGC_API_KEY" ]]; then
    echo "Set NGC_API_KEY (e.g. export NGC_API_KEY=your_key) for riva_init.sh to download models."
    read -p "Continue without NGC_API_KEY? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[yY]$ ]]; then exit 1; fi
  fi
  cd "$RIVA_QUICKSTART_DIR"
  if [[ ! -d "model_repo" || -z "$(ls -A model_repo 2>/dev/null)" ]]; then
    echo "Running riva_init.sh (download models, may take a while)..."
    bash riva_init.sh
  else
    echo "Model repo already present, skipping riva_init.sh."
  fi
  echo "Starting Riva server (riva_start.sh)..."
  bash riva_start.sh
  echo "Riva should be listening on 0.0.0.0:50051. Set in apps/api/.env: ENABLE_RIVA=true, RIVA_URL=http://localhost:50051"
  exit 0
fi

# Option B: Docker Compose
echo "Starting Riva with Docker Compose..."
docker compose -f docker-compose.riva.yml up -d

echo ""
echo "Riva container started. Check: docker compose -f docker-compose.riva.yml logs -f riva"
echo "If the container exits (models missing), run NGC Riva Quick Start first:"
echo "  1. Download from https://catalog.ngc.nvidia.com/orgs/nvidia/teams/riva/resources/riva_quickstart"
echo "  2. Unpack, set NGC_API_KEY, then: export RIVA_QUICKSTART_DIR=/path/to/unpacked && $0"
echo ""
echo "When Riva is ready, set in apps/api/.env:"
echo "  ENABLE_RIVA=true"
echo "  RIVA_URL=http://localhost:50051"
echo "Health: curl -s http://localhost:9002/api/v1/nvidia/riva/health (after API is running)"
