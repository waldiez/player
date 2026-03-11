# Desktop Known Limitations

This document captures known limitations for release candidates and UAT.

It should be updated before each RC so testers can distinguish expected gaps from regressions.

## Current Known Limitations

### 1. Third-Party Stream Dependence

- YouTube playback/search fallback behavior depends on external services and runtime-specific backends.
- Some failures are environmental: API access, CORS, tool availability, or remote source behavior.

Impact:

- Playback path can differ across `web`, `tauri-dev`, `tauri-packaged`, and Flutter shell.

### 2. Packaged Desktop YouTube Fallback Differences

- Packaged desktop avoids some iframe fallback cases to prevent known embedded playback problems.
- Result: a desktop runtime may show a fallback message where web still plays through an iframe path.

Impact:

- Behavior may differ legitimately between browser and packaged desktop.

### 3. Export Scope

- Exported presets do not fully preserve local file payloads as portable cloud-ready content.
- `.wid` is descriptor-oriented; `.waldiez` is broader, but portability expectations must still be tested carefully.

Impact:

- Export/import should be treated as state portability, not guaranteed asset mirroring across all local-only media.

### 4. Flutter Scope

- Flutter in this repo is currently a desktop WebView shell only.
- There is no maintained Flutter `android`, `ios`, or `web` target in this repo today.
- Linux Flutter is currently experimental and may fall back to opening the player in the system browser rather than embedding the UI.

Impact:

- Flutter should not be used as evidence of mobile readiness.
- Flutter Linux should not be used as evidence of symmetric desktop support.

### 5. Platform Coverage Is Not Yet Symmetric

- macOS is historically the strongest path because the project started there.
- Linux support is now being made more explicit.
- Windows support exists in release targets but should be validated continuously rather than assumed.
- Flutter Linux support is weaker than the primary desktop app path and should be treated as a fallback shell for now.

Impact:

- QA and release decisions should be based on tested target quality, not build-system presence alone.

## For RC / UAT Review

Before each release candidate:

- confirm this list still matches reality
- remove resolved items
- add new known non-blockers discovered during QA
- link blocker issues separately from this file
