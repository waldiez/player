#!/usr/bin/env bash
set -euo pipefail

# Ship the latest (or provided) snapshot zip via scp and optionally unzip remotely.
#
# Env vars:
# - SNAPSHOT_ZIP: explicit zip path (defaults to latest snapshots/player-web-*.zip)
# - SHIP_HOST: remote host (user@host). If unset, upload/deploy is skipped.
# - SHIP_PATH: remote directory (required when SHIP_HOST is set)
# - SHIP_URL_BASE: public base URL for share links (default: https://waldiez.github.io)
# - SHIP_SSH_PORT: ssh/scp port (optional)
# - SHIP_UNZIP_REMOTE: "1" to unzip remotely after upload (default: 1)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ZIP_PATH="${SNAPSHOT_ZIP:-}"
if [[ -z "$ZIP_PATH" ]]; then
  ZIP_PATH="$(ls -1t snapshots/player-web-*.zip 2>/dev/null | head -n1 || true)"
fi

if [[ -z "$ZIP_PATH" || ! -f "$ZIP_PATH" ]]; then
  echo "No snapshot zip found. Run 'make snapshot' first or set SNAPSHOT_ZIP."
  exit 1
fi

ZIP_BASENAME="$(basename "$ZIP_PATH")"
ZIP_STEM="${ZIP_BASENAME%.zip}"
URL_BASE="${SHIP_URL_BASE:-https://waldiez.github.io}"
WEB_URL="${URL_BASE%/}/player/"
DEEP_LINK_OPEN="waldiez://player/open?src="
DEEP_LINK_HOME="waldiez://player/#home"
PREVIEW_IMAGE="${WEB_URL}social-preview-1200x630.png"

if [[ -n "${SHIP_HOST:-}" ]]; then
  if [[ -z "${SHIP_PATH:-}" ]]; then
    echo "SHIP_PATH is required when SHIP_HOST is set."
    exit 1
  fi

  SSH_PORT_ARGS=()
  SCP_PORT_ARGS=()
  if [[ -n "${SHIP_SSH_PORT:-}" ]]; then
    SSH_PORT_ARGS=(-p "$SHIP_SSH_PORT")
    SCP_PORT_ARGS=(-P "$SHIP_SSH_PORT")
  fi

  echo "Uploading $ZIP_PATH to ${SHIP_HOST}:${SHIP_PATH}/"
  ssh "${SSH_PORT_ARGS[@]}" "$SHIP_HOST" "mkdir -p '$SHIP_PATH'"
  scp "${SCP_PORT_ARGS[@]}" "$ZIP_PATH" "${SHIP_HOST}:${SHIP_PATH}/"

  if [[ "${SHIP_UNZIP_REMOTE:-1}" == "1" ]]; then
    echo "Unzipping remotely at ${SHIP_HOST}:${SHIP_PATH}"
    ssh "${SSH_PORT_ARGS[@]}" "$SHIP_HOST" "cd '$SHIP_PATH' && unzip -o '$ZIP_BASENAME'"
  fi
else
  echo "SHIP_HOST not set: skipping upload/deploy (local share info only)."
fi

SHARE_FILE="snapshots/share-${ZIP_STEM}.txt"
cat > "$SHARE_FILE" <<EOF
snapshot_zip=$ZIP_PATH
web_url=$WEB_URL
preview_image=$PREVIEW_IMAGE
deep_link_home=$DEEP_LINK_HOME
deep_link_open_template=${DEEP_LINK_OPEN}<url-encoded-source>
mobile_share_whatsapp=https://wa.me/?text=${WEB_URL}
mobile_share_telegram=https://t.me/share/url?url=${WEB_URL}
mobile_share_twitter=https://twitter.com/intent/tweet?url=${WEB_URL}
EOF

echo "Share info written: $SHARE_FILE"
echo "Web URL: $WEB_URL"
