#!/usr/bin/env bash
set -euo pipefail

# Tauri may rewrite src-tauri/Cargo.toml features based on config
# (e.g. app.macOSPrivateApi=false for MAS). Keep workspace unchanged by
# restoring Cargo files after the MAS build completes.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CARGO_TOML="${ROOT_DIR}/src-tauri/Cargo.toml"
CARGO_LOCK="${ROOT_DIR}/src-tauri/Cargo.lock"
TMP_DIR="$(mktemp -d)"

cp "${CARGO_TOML}" "${TMP_DIR}/Cargo.toml"
cp "${CARGO_LOCK}" "${TMP_DIR}/Cargo.lock"

restore() {
  cp "${TMP_DIR}/Cargo.toml" "${CARGO_TOML}"
  cp "${TMP_DIR}/Cargo.lock" "${CARGO_LOCK}"
  rm -rf "${TMP_DIR}"
}

trap restore EXIT

cd "${ROOT_DIR}"
bunx tauri build --config src-tauri/tauri.mas.conf.json
