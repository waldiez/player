# Desktop 0.2.0 Issue Breakdown

This is the execution breakdown for the `0.2.0` desktop milestone described in [roadmap.md](/home/tam/Projects/waldiez/player/docs/roadmap.md).

Use these as milestone epics or issue groups.

## A. Playback Reliability

### A1. Backend Audit

- Audit YouTube playback paths across iframe, native audio, yt-dlp, Piped, and mpv.
- Document current fallback order per runtime (`web`, `tauri-dev`, `tauri-packaged`, `flutter-webview`).
- Confirm expected behavior when backend tools are unavailable.

Definition of done:

- Runtime/backend matrix exists in docs or issue notes.
- Unsupported combinations fail clearly.

### A2. State Transition Fixes

- Verify track-switch, seek, loop, repeat, and playlist-advance state transitions.
- Verify visibility/background transitions across desktop runtimes.
- Verify imported presets do not leave stale playback state behind.

Definition of done:

- No known stale `currentTime`, `duration`, or `isPlaying` carry-over bugs in the core flows.

### A3. Source Reliability

- Validate local file playback.
- Validate HTTP(S) stream playback.
- Validate camera, microphone, and screen capture lifecycle.
- Validate YouTube search + selection + playback in desktop builds.

Definition of done:

- Each source type has at least one passing smoke path on supported desktop targets.

### A4. Error Surfaces

- Replace silent fallback failures with visible desktop-safe messages.
- Standardize retry/fallback messages for source and backend failures.

Definition of done:

- User-facing errors exist for backend/tool/source failure classes that previously failed silently.

## B. Desktop Integration

### B1. File And Deep-Link Handling

- Verify `.wid`, `.waldiez`, media file, and `waldiez://` flows.
- Confirm state safety when the app is already open.
- Confirm behavior on first launch vs running app.

Definition of done:

- File-open and deep-link flows are explicitly tested and documented.

### B2. OS Behavior

- Verify tray/menu expectations.
- Verify window close/minimize/restore behavior.
- Verify startup assumptions and default restore behavior.

Definition of done:

- Desktop lifecycle behavior is documented and intentional, not accidental.

### B3. Linux Follow-Up

- Validate Linux-specific runtime assumptions.
- Confirm Linux build/run docs are enough for contributors and QA.
- Decide whether any Linux-only actions should exist in-app later.

Definition of done:

- Linux is treated as a first-class desktop target in docs and smoke tests.

## C. Release Engineering

### C1. Release Candidate Path

- Dry-run `v0.2.0-rc1` release process.
- Verify artifact naming, upload, and platform coverage.
- Verify release notes template against actual output.

Definition of done:

- An RC can be cut without manual guesswork.

### C2. Signing And Distribution Decisions

- Decide stable release bar for macOS signing/notarization.
- Decide stable release bar for Windows signing.
- Confirm Linux artifact expectations (`.AppImage`, `.deb`) for `0.2.0`.

Definition of done:

- Release acceptance criteria are explicit before tagging stable.

### C3. Checksums And Metadata

- Add checksum generation if missing from release flow.
- Ensure release artifacts map cleanly to docs and downstream channels.

Definition of done:

- Release asset verification is straightforward for QA and users.

## D. QA / UAT

### D1. Smoke Matrix

- Create and use the checklist in [desktop-qa-checklist.md](/home/tam/Projects/waldiez/player/docs/desktop-qa-checklist.md).
- Ensure macOS and Linux are mandatory for `0.2.0-rc1`.
- Add Windows when the artifact path is stable enough to verify consistently.

Definition of done:

- Every RC has a recorded smoke pass result.

### D2. Known Limits

- Keep [desktop-known-limitations.md](/home/tam/Projects/waldiez/player/docs/desktop-known-limitations.md) current.
- Ensure QA/UAT feedback references either “bug” or “known limitation”.

Definition of done:

- Known rough edges are captured before UAT, not rediscovered repeatedly.

## E. Supportability

### E1. Logging

- Define what logs are captured per runtime.
- Ensure desktop failures leave enough evidence for debugging.

Definition of done:

- A bug report can include meaningful runtime evidence.

### E2. Support Export

- Decide whether to add a support bundle or log export in `0.2.0`.
- At minimum, define what support artifacts QA should attach.

Definition of done:

- Support triage does not depend only on screenshots and descriptions.

### E3. Import Safety

- Validate failure behavior for broken `.wid` / `.waldiez` / remote imports.
- Confirm state is not corrupted when import fails.

Definition of done:

- Invalid imports fail safely and predictably.

## Suggested Sequencing

1. A1, A2, A3
2. B1, B2
3. C1
4. D1, D2
5. E1, E3
6. C2, C3
7. E2 if still needed before stable

## Explicit Non-Issues For 0.2.0

- Full mobile productization
- Full Flutter multi-platform support claims
- UI redesign not driven by QA/UAT
- Heavy new editing/export feature work unrelated to desktop stability
