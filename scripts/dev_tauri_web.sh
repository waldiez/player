#!/usr/bin/env bash
set -euo pipefail

DEV_URL="${TAURI_DEV_URL:-http://127.0.0.1:5173}"

if command -v curl >/dev/null 2>&1; then
  if body="$(curl --silent --max-time 2 "$DEV_URL" 2>/dev/null)"; then
    if printf "%s" "$body" | grep -Eq '(/@vite/client|Waldiez Player|waldiez-player)'; then
      echo "Reusing existing dev server at $DEV_URL"
      exit 0
    fi
    echo "Port for $DEV_URL is already serving another app. Stop it or set TAURI_DEV_URL to a different Waldiez dev server."
    exit 1
  fi
fi

exec bun run dev
