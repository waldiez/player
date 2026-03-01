#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Waldiez Player.app"
APP_DIR="${ROOT_DIR}/src-tauri/target/release/bundle/macos"
APP_PATH="${APP_DIR}/${APP_NAME}"
DMG_DIR="${ROOT_DIR}/src-tauri/target/release/bundle/dmg"

# 1) Build/sign/notarize/staple app bundle only (skip Tauri's create-dmg flow).
bash "${ROOT_DIR}/scripts/build_tauri.sh" --bundles app "$@"

if [[ ! -d "${APP_PATH}" ]]; then
  echo "App bundle not found at: ${APP_PATH}" >&2
  exit 1
fi

mkdir -p "${DMG_DIR}"

version="$(
  node -e 'console.log(require("./src-tauri/tauri.conf.json").version || "0.0.0")' \
    2>/dev/null || echo "0.0.0"
)"
arch="$(uname -m)"
dmg_name="Waldiez Player_${version}_${arch}.dmg"
dmg_path="${DMG_DIR}/${dmg_name}"
tmp_dmg="${DMG_DIR}/WaldiezPlayer_${version}_${arch}.dmg"

# 2) Build a plain, reliable DMG from the notarized/stapled .app.
rm -f "${dmg_path}" "${tmp_dmg}"
hdiutil create \
  -volname "WaldiezPlayer" \
  -srcfolder "${APP_PATH}" \
  -ov \
  -format UDZO \
  "${tmp_dmg}"

mv -f "${tmp_dmg}" "${dmg_path}"

echo "Created DMG: ${dmg_path}"
