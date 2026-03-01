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

# MAS local builds should not try notarization.
unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID APPLE_API_KEY APPLE_API_ISSUER APPLE_API_KEY_PATH
# Do not import/sign via raw certificate env vars on local MAS builds.
# Use identities already present in the local keychain.
unset APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_MAS_CERTIFICATE APPLE_MAS_CERTIFICATE_PASSWORD

# Prefer a dedicated MAS identity env var and map it to Tauri's expected var.
if [[ -n "${APPLE_MAS_SIGNING_IDENTITY:-}" ]]; then
  export APPLE_SIGNING_IDENTITY="${APPLE_MAS_SIGNING_IDENTITY}"
fi

bunx tauri build --features custom-protocol --config src-tauri/tauri.mas.conf.json -- --no-default-features
