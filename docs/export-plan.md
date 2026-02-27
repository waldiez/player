# Export Plan (CI + Manifest-Aligned)

## Current State

- **Web export/deploy:** enabled via GitHub Pages workflow.
  - Output: `dist/`
  - URL: `https://waldiez.github.io/player/`
- **Desktop export:** not yet producing distributable binaries in CI.
  - Current CI only runs Rust/Tauri checks (`cargo fmt`, `cargo check`).

## Snapshot + Ship Tasks

- `make snapshot`
  - Builds web app and creates `snapshots/player-web-<UTC>.zip`
  - Bundle contains `dist/`, `MANIFEST`, `SNAPSHOT.txt`
- `make ship`
  - Runs `make snapshot`
  - Calls `scripts/ship_snapshot.sh`
  - If `SHIP_HOST` + `SHIP_PATH` are set, uploads via `scp` and optionally unzips remotely
  - Writes share links file: `snapshots/share-player-web-<UTC>.txt`

Environment variables for `make ship`:

- `SHIP_HOST` (example: `user@example.com`)
- `SHIP_PATH` (remote directory)
- `SHIP_URL_BASE` (public base URL for share links)
- `SHIP_SSH_PORT` (optional)
- `SHIP_UNZIP_REMOTE=0|1` (default `1`)

## What We Can Export (Conceptually)

- **`.wid`**: lightweight descriptor export (no heavy bundled assets).
- **`.waldiez`**: bundled export (manifest + local assets/recordings/project state).

## Current Web UI Export Behavior

- Export `.wid` now writes a manifest-compatible YAML descriptor with:
  - `$schema` set to xperiens manifest schema
  - `identity`, `description`, `interface`, `state`, `execution`, `lifecycle`
- Export `.waldiez` now writes a zip bundle containing at least:
  - `.tic`
  - `MANIFEST`
  - `data/preferences.json` (state payload snapshot)

## Web Live Streaming Scope (Important)

- Web `Go Live` currently supports best-effort publishing over **WSS** from sources the browser can capture:
  - camera / microphone streams
  - browser-playable HTTP(S) media streams (when capture APIs are available)
- Web `Go Live` does **not** support reliable rebroadcast of YouTube/Spotify iframe playback.
  - Technical reason: cross-origin iframe and capture limitations in browsers.
  - Policy/legal reason: third-party content licensing and platform terms may prohibit rebroadcast.
- Desktop/RPi/device builds can implement richer ingest/transcode pipelines for non-web transports, but licensing rules still apply.

## Recommended Phases

1. **Now (stable):**
   - Keep web Pages deploy as primary CI export.
   - Keep MANIFEST compatibility checks strict (`manifest:check`, `manifest:compat`).
2. **Next (desktop releases):**
   - Add tag-triggered Tauri release workflow.
   - Upload desktop artifacts per platform (macOS/Windows/Linux).
3. **Later (mobile/flutter):**
   - Add mobile runtime/export only when runtime and UX are ready.
   - Keep manifest capabilities versioned and namespaced for compatibility.

## Compatibility Rule

- Keep top-level MANIFEST structure xperiens-compatible.
- Add new features through versioned capability keys, for example:
  - `waldiez.player.source.webrtc.v1`
  - `waldiez.player.stream.live-dj.v1`
