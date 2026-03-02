#!/usr/bin/env bash
# Run on the server to install logrotate config for API (and optional web) logs.
# Usage: from repo root on server: ./scripts/setup-logrotate-on-server.sh
# Or: ssh server 'cd /home/arin/global-risk-platform && ./scripts/setup-logrotate-on-server.sh'
# Requires: sudo for copying to /etc/logrotate.d/
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONF_SRC="$REPO_ROOT/infra/logrotate/pfrp-api.conf"
TARGET="/etc/logrotate.d/pfrp-api"

if [ ! -f "$CONF_SRC" ]; then
  echo "Error: $CONF_SRC not found. Run from repo root or after deploy." >&2
  exit 1
fi

if [ -w /etc/logrotate.d ] 2>/dev/null; then
  cp "$CONF_SRC" "$TARGET"
  echo "Installed: $TARGET"
elif command -v sudo >/dev/null 2>&1; then
  sudo cp "$CONF_SRC" "$TARGET"
  echo "Installed: $TARGET (via sudo)"
else
  echo "Cannot write to /etc/logrotate.d. Run as root or copy manually:" >&2
  echo "  cp $CONF_SRC $TARGET" >&2
  exit 1
fi

if command -v logrotate >/dev/null 2>&1; then
  if logrotate -d "$TARGET" >/dev/null 2>&1; then
    echo "Config OK (dry-run passed). Rotation: daily, rotate 7, compress."
  else
    echo "Warning: logrotate -d $TARGET had warnings (check above)."
  fi
else
  echo "logrotate not found; config installed but not tested."
fi
