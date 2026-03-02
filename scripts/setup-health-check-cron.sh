#!/usr/bin/env bash
# Run on the server to add a cron job that checks API health every 5 minutes.
# On failure (exit 1) your cron can send mail or trigger alerting (see crontab -e).
# Usage: from repo root on server: ./scripts/setup-health-check-cron.sh
# Or: ssh server 'cd /home/arin/global-risk-platform && ./scripts/setup-health-check-cron.sh'
# Env (optional): API_BASE_URL=https://risk.saa-alliance.com — set in crontab or in script below.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_SCRIPT="$REPO_ROOT/scripts/check-api-health.sh"

if [ ! -x "$HEALTH_SCRIPT" ]; then
  echo "Error: $HEALTH_SCRIPT not found or not executable." >&2
  exit 1
fi

# Use localhost when run from same host (cron on server)
export API_BASE_URL="${API_BASE_URL:-http://localhost:9002}"
CRON_LINE="*/5 * * * * API_BASE_URL=$API_BASE_URL $HEALTH_SCRIPT"
CRON_MARKER="pfrp-api-health"

existing=$(crontab -l 2>/dev/null || true)
if echo "$existing" | grep -q "$CRON_MARKER"; then
  echo "Cron entry for API health check already present (marker: $CRON_MARKER)."
  exit 0
fi

# Append new line with marker
(crontab -l 2>/dev/null || true; echo "# $CRON_MARKER"; echo "$CRON_LINE") | crontab -
echo "Added: every 5 min run $HEALTH_SCRIPT (API_BASE_URL=$API_BASE_URL)."
echo "To get alerts on failure: configure cron mail (MAILTO=...) or a wrapper that runs on exit 1."
