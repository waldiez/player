# Waldiez Manifest Draft

## What Exists Across Repos

- `.wid` is already used as a YAML manifest-style file (for example in `xperiens`).
- `.waldiez` appears as a packaged/bundled artifact (with a `manifest.json` inside in some examples).
- `.tic` appears to be tick/clock/service marker data, not an app manifest.

## Proposed Convention

- Use `MANIFEST` (no extension) for the canonical agent manifest.
- Use `.waldiez` for a packaged bundle that includes assets and a manifest.
- Use `.wid` for lightweight single-file descriptors (methods/atomic units).
- Keep `.tic` reserved for timing/runtime heartbeat contexts.

## Player Manifest

- Manifest file: [`MANIFEST`](/Users/laztoum/Projects/waldiez/player/MANIFEST)
- Schema file: [`schemas/waldiez-manifest.schema.json`](/Users/laztoum/Projects/waldiez/player/schemas/waldiez-manifest.schema.json)

## URI Shape (Draft)

- `waldiez://player/<path>`
- `waldiez://player/#<path-or-url>`
- `waldiez://player/open?src=<url-encoded-source>`

## Stream Capability (Draft)

- Added capability key: `waldiez.player.stream.targets.v1`
- Added operations:
  - `stream-start`
  - `stream-stop`
- Added execution profile:
  - `execution.stream.preferred_protocol: "wss"`
  - `execution.stream.targets[]` with protocol options (`wss`, `mqtts`, `webrtc`, `rtsp`)

Example:

- `waldiez://player/open?src=https%3A%2F%2Fexample.com%2Fmovie.mp4`

## Notes

- `wdz://...` remains useful as stable identity (`identity.wid`).
- `waldiez://...` can be used as launch/open links handled by the app/router.
