#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPPORT_DST="${ROOT_DIR}/src-tauri/target/release/bundle/share/create-dmg/support"

resolve_create_dmg_support() {
  local candidate=""

  if command -v brew >/dev/null 2>&1; then
    local brew_prefix=""
    brew_prefix="$(brew --prefix create-dmg 2>/dev/null || true)"
    if [[ -n "${brew_prefix}" && -d "${brew_prefix}/share/create-dmg/support" ]]; then
      echo "${brew_prefix}/share/create-dmg/support"
      return 0
    fi
  fi

  if command -v create-dmg >/dev/null 2>&1; then
    local bin_path=""
    bin_path="$(command -v create-dmg)"
    local parent=""
    parent="$(cd "$(dirname "${bin_path}")/.." && pwd)"
    candidate="${parent}/share/create-dmg/support"
    if [[ -d "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  fi

  for candidate in \
    "/opt/homebrew/opt/create-dmg/share/create-dmg/support" \
    "/usr/local/opt/create-dmg/share/create-dmg/support" \
    "/usr/local/share/create-dmg/support"; do
    if [[ -d "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  # Clean up stale temporary rw.* DMGs from previous failed bundle runs.
  # These can leave mounted /Volumes/dmg.* entries and cause subsequent
  # hdiutil create/attach calls to fail with "Operation not permitted".
  while IFS= read -r dev; do
    [[ -n "${dev}" ]] || continue
    hdiutil detach "${dev}" >/dev/null 2>&1 || true
  done < <(
    hdiutil info 2>/dev/null | awk -v root="${ROOT_DIR}" '
      /^image-path[[:space:]]*:/ {
        p=$0; sub(/^image-path[[:space:]]*:[[:space:]]*/, "", p);
        match_path = (index(p, root "/src-tauri/target/release/bundle/") == 1 && p ~ /\/rw\.[^/]+\.dmg$/)
      }
      /^\/dev\// {
        if (match_path) print $1
      }
    '
  )
  rm -f "${ROOT_DIR}"/src-tauri/target/release/bundle/macos/rw.*.dmg >/dev/null 2>&1 || true
  rm -f "${ROOT_DIR}"/src-tauri/target/release/bundle/dmg/rw.*.dmg >/dev/null 2>&1 || true

  if [[ ! -d "${SUPPORT_DST}" ]]; then
    src_support="$(resolve_create_dmg_support || true)"
    if [[ -n "${src_support:-}" ]]; then
      mkdir -p "${SUPPORT_DST}"
      cp "${src_support}/template.applescript" "${SUPPORT_DST}/template.applescript"
      cp "${src_support}/eula-resources-template.xml" "${SUPPORT_DST}/eula-resources-template.xml"
      echo "Prepared create-dmg support assets in ${SUPPORT_DST}"
    else
      echo "Warning: create-dmg support assets not found; DMG bundling may fail."
    fi
  fi
fi

cd "${ROOT_DIR}"
bunx tauri build --features custom-protocol "$@" -- --no-default-features
