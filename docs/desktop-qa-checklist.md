# Desktop QA Checklist

Use this checklist for `0.2.0` release candidates and focused desktop smoke passes.

Target result:

- `PASS`: no blocker found
- `FAIL`: reproducible blocker or major regression
- `N/A`: target/runtime not applicable

## Test Matrix

Record for each candidate:

- Build/tag:
- Runtime:
  - macOS Tauri
  - Linux Tauri
  - Windows Tauri
  - Flutter desktop shell (optional check)
- Tester:
- Date:

## 1. Launch And Basic State

- App launches cleanly.
- No immediate crash or blank window.
- Existing local prefs load without obvious corruption.
- Default mood/player state is usable.

## 2. Local Media

- Open a local audio file.
- Open a local video file.
- Playback starts, pauses, seeks, and resumes correctly.
- Switching between two local tracks resets position correctly.

## 3. Search And Cloud Sources

- Search for a YouTube result and play it.
- Selecting a new search result starts from `0:00`.
- SoundCloud search/add still works if enabled in the runtime.
- Source fallback does not leave the UI in a broken state.

## 4. Playlist Behavior

- Add multiple items to the library.
- Next/previous track behavior is correct.
- Repeat modes behave as expected.
- Selecting an item in the playlist starts the selected item, not the previous timestamp.

## 5. Desktop Runtime Behavior

- Background/foreground transitions behave as expected.
- If “pause when hidden” is enabled, it pauses and resumes cleanly.
- If “pause when hidden” is disabled, playback remains stable or recovers when focus returns.

## 6. Presets And Import/Export

- Export `.wid`.
- Export `.waldiez`.
- Import a valid local preset.
- Import a valid remote preset URL or GitHub path.
- Invalid import fails safely without corrupting current usable state.

## 7. Devices And Capture

- Microphone source can be added and removed.
- Camera source can be added and removed.
- Screen capture can be started and stopped.
- Device failure or permission denial is handled visibly.

## 8. Desktop Entry Points

- File-open for media works.
- File-open for `.wid` / `.waldiez` works.
- Deep-link flow works if configured for the target.
- Opening a file while the app is already running does not corrupt state.

## 9. Live / Beacon

- Configure a beacon-capable endpoint.
- Start live/beacon publishing.
- Confirm state updates are emitted.
- Stop live/beacon publishing cleanly.

## 10. Release Artifact Sanity

- Artifact installs or launches normally.
- App identity/name/icon look correct.
- Version shown in release context matches the tag.
- No obvious packaging issue blocks first-run usage.

## Blocker Definition

Treat as a `0.2.0` blocker if any of these occur:

- app does not launch
- local file playback fails in the primary desktop runtime
- YouTube/search playback is broken in the supported desktop path
- track switching leaves stale position/state
- preset import corrupts usable state
- release artifact is not installable/launchable

## Reporting Template

- Runtime/platform:
- Build/tag:
- Area:
- Steps:
- Expected:
- Actual:
- Reproducible:
- Logs/screenshots attached:
