#!/usr/bin/env bash
# Smoke check for Data Federation API (adapters, pipelines, run).
# Run from repo root. Uses apps/api venv if present.
set -e
cd "$(dirname "$0")/.."
API_DIR="apps/api"
if [[ -f "$API_DIR/.venv/bin/python" ]]; then
  "$API_DIR/.venv/bin/python" "$API_DIR/scripts/check_data_federation.py"
else
  python "$API_DIR/scripts/check_data_federation.py"
fi
