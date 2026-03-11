# Product Roadmap

This document tracks the desktop-first product plan after `0.1.0`.

Related planning docs:

- [Master Architecture](/home/tam/Projects/waldiez/player/docs/master-architecture.md)
- [Desktop 0.2.0 Issues](/home/tam/Projects/waldiez/player/docs/desktop-0.2.0-issues.md)
- [Desktop QA Checklist](/home/tam/Projects/waldiez/player/docs/desktop-qa-checklist.md)
- [Desktop Known Limitations](/home/tam/Projects/waldiez/player/docs/desktop-known-limitations.md)
- [Desktop Reader And Editor Plan](/home/tam/Projects/waldiez/player/docs/desktop-reader-editor-plan.md)

Scope rule:

- Primary product: desktop app
- Secondary product: web player / PWA
- Flutter: desktop shell only for now
- Flutter Linux: experimental shell, not a primary release target today
- Not in current scope: standalone Flutter mobile app, standalone Flutter web app

## Release Position

Current version markers in the repo are still `0.1.0`:

- [package.json](/home/tam/Projects/waldiez/player/package.json)
- [src-tauri/Cargo.toml](/home/tam/Projects/waldiez/player/src-tauri/Cargo.toml)
- [src-tauri/tauri.conf.json](/home/tam/Projects/waldiez/player/src-tauri/tauri.conf.json)

The next meaningful milestone should be `0.2.0`, focused on desktop reliability and release quality rather than broad feature expansion.

## 0.2.0 Goal

Make Waldiez feel like a dependable desktop product instead of a promising prototype.

### Themes

1. Playback reliability
2. Desktop OS integration
3. Release pipeline maturity
4. QA repeatability
5. Supportability

### In Scope

#### 1. Playback Reliability

- Harden Tauri playback paths for YouTube, local files, URL streams, microphone, camera, and screen capture.
- Reduce state sync bugs when switching tracks, windows, playback backends, and visibility state.
- Improve fallback behavior across iframe, native audio, yt-dlp, and mpv flows.
- Surface clearer user-facing errors when a source or backend fails.

Acceptance criteria:

- Top desktop playback flows work without manual recovery on macOS and Linux.
- Track switches reset correctly and do not inherit stale state.
- Background/foreground transitions behave predictably.
- If a backend fails, the user sees a clear fallback or failure reason.

#### 2. Desktop Integration

- Validate file-open and deep-link flows for desktop builds.
- Tighten app data, import/export, and preset handling for desktop use.
- Review tray behavior, window lifecycle, and startup assumptions.
- Add Linux-specific run/build guidance and environment-aware actions where useful.

Acceptance criteria:

- Opening media files and preset files from the OS works on supported desktop targets.
- Deep-link entrypoints do not corrupt state.
- Desktop-only behaviors are documented and testable.

#### 3. Release Pipeline

- Keep tag-triggered desktop release flow as the main delivery path.
- Ensure release artifacts are generated consistently for macOS, Linux, and Windows.
- Produce clear release notes/checklist inputs per candidate.
- Confirm signing/notarization gaps and decide which are required before stable.

Acceptance criteria:

- A `v0.2.0-rc1` tag can produce a usable draft release.
- Release checklist in [docs/release.md](/home/tam/Projects/waldiez/player/docs/release.md) can be executed without guesswork.
- Platform artifacts match documented expectations.

#### 4. QA / UAT Readiness

- Define a desktop smoke matrix for macOS, Linux, and Windows.
- Add a concise regression checklist for the top user journeys.
- Capture known limitations explicitly so UAT feedback is actionable.

Acceptance criteria:

- QA can run a short, repeatable smoke pass against a release candidate.
- Known limitations are documented before external feedback starts.

#### 5. Supportability

- Improve diagnostics for desktop failures.
- Add or standardize log export / support bundle behavior.
- Ensure imported presets and runtime state are recoverable after user mistakes.

Acceptance criteria:

- Field failures can be diagnosed from logs or a support export.
- Corrupt or invalid imported state fails safely.

### Deferred From 0.2.0

- Major UI redesign based on internal taste alone
- Standalone mobile product
- Standalone Flutter web app
- Advanced downstream store packaging work beyond the core desktop release path
- Large new media-editing capabilities not required for desktop stability

## 1.0.0 Goal

Ship a stable, supportable desktop product with clear compatibility guarantees.

### Themes

1. Compatibility guarantees
2. Distribution confidence
3. Operational maturity
4. Product boundary clarity

### Must Be True Before 1.0.0

#### 1. Format And Compatibility

- `.wid` and `.waldiez` import/export behavior is stable and versioned.
- Manifest-aligned capabilities are clearly namespaced and backwards-compatible.
- Existing saved prefs and project state survive upgrades safely.

Acceptance criteria:

- Compatibility expectations are documented.
- Breaking changes require explicit migration or version gating.

#### 2. Cross-Platform Desktop Confidence

- macOS, Linux, and Windows desktop builds are consistently releasable.
- Platform support level is documented honestly.
- Installer/download/update path is understandable to non-developers.

Acceptance criteria:

- Stable release artifacts exist for the declared platforms.
- Platform-specific caveats are documented before release.

#### 3. Operational Support

- Release, rollback, and triage are routine.
- Desktop crash/failure reports are diagnosable.
- QA regression flow is lightweight but reliable.

Acceptance criteria:

- A stable release no longer depends on tribal knowledge.
- A support issue can be reproduced or triaged from captured evidence.

#### 4. Product Scope Discipline

- Desktop remains the primary supported runtime.
- Web/PWA and Flutter shell roles are documented clearly.
- Future mobile work, if any, is treated as a new product decision, not implied support.
- Linux Flutter remains explicitly secondary until it has real embedded-webview support.

Acceptance criteria:

- README/docs do not overstate target support.
- Release notes and issue templates match actual support boundaries.

## Recommended Milestone Structure

### Milestone A: Desktop Stability

- Playback backend audit
- State transition fixes
- Source-switch and fallback cleanup
- Desktop-specific bug triage

### Milestone B: Desktop Release Candidate

- Release artifact validation
- Smoke checklist execution
- Logging/support export improvements
- Known-limits document

### Milestone C: Stable Foundation

- Compatibility guarantees
- Support policy and docs
- Store/distribution follow-up only after core desktop release quality is proven

## Candidate Issue Buckets

### Desktop Core

- Playback backend fallback failures
- Visibility/background edge cases
- Deep-link / file-open handling
- Desktop audio/video device recovery

### Release Engineering

- Release workflow verification
- Artifact naming and checksums
- Signing/notarization decision log
- Release notes template completion

### QA

- Desktop smoke checklist
- RC validation template
- Cross-platform issue labeling

### Support

- Log export
- Error surfaces
- Safe preset import failure handling

Working documents for execution:

- [desktop-0.2.0-issues.md](/home/tam/Projects/waldiez/player/docs/desktop-0.2.0-issues.md)
- [desktop-qa-checklist.md](/home/tam/Projects/waldiez/player/docs/desktop-qa-checklist.md)
- [desktop-known-limitations.md](/home/tam/Projects/waldiez/player/docs/desktop-known-limitations.md)

## Non-Goals

These should not quietly expand the `0.2.0` scope:

- Rebuilding the UI without QA/UAT input
- Positioning Flutter as a full multi-platform app before Android/iOS/web targets exist
- Adding heavyweight editing/rendering systems before desktop playback is boringly reliable
- Shipping every downstream store channel before the core GitHub desktop release path is stable

## Notes On Flutter

The Flutter folder currently represents a desktop WebView shell:

- Desktop runners exist for `macos`, `linux`, and `windows`
- There is no `flutter/android/`, `flutter/ios/`, or `flutter/web/` target in this repo today
- `flutter analyze` and `flutter test` passed locally during the latest verification pass

That means Flutter should be planned as optional desktop packaging/runtime work, not as the primary `0.2.0` release vehicle.
