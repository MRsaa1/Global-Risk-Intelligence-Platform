#!/usr/bin/env bash
# Garak: LLM vulnerability scanner.
# Run against AI-Q / agent endpoints. Requires: pip install garak
# Config: which endpoints/models to scan, where to write report.

set -e
BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"
REPORT_DIR="${GARAK_REPORT_DIR:-./garak_reports}"
mkdir -p "$REPORT_DIR"

echo "Garak scan: base_url=$BASE_URL report_dir=$REPORT_DIR"

# Optional: Garak can probe OpenAI-compatible endpoints. We expose AI-Q via /aiq/ask.
# Example (if you use garak's openai plugin with a proxy that forwards to our API):
#   export OPENAI_API_BASE="$BASE_URL/v1"
#   garak --model_name openai/our-aiq-proxy --plugins ...
# Or run Garak against a dedicated test endpoint that replays to our LLM.

if ! command -v garak &>/dev/null; then
  echo "garak not installed. Install: pip install garak"
  echo "Then configure in this script: endpoint URL, model name, and report path."
  exit 1
fi

# Scan config: endpoint and model to test (customize for your deployment)
# Garak writes to stdout and can write JSON; we redirect to report dir.
REPORT_FILE="$REPORT_DIR/garak_$(date +%Y%m%d_%H%M%S).json"
garak --model_name openai/gpt-4 \
  --report_prefix "$REPORT_DIR/run" \
  --verbose 2 2>&1 | tee "$REPORT_DIR/garak_last_run.log" || true

echo "Report dir: $REPORT_DIR. Inspect garak_last_run.log and run*.json."
