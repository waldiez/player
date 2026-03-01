# Release Guide

This document is the public release checklist for desktop artifacts and downstream distribution channels.

## 1) Pre-Release Gate

Run these on the release candidate commit:

```bash
make check
```

Expected result:

- `manifest-check` and `manifest-compat` pass
- `lint`, `test`, and `build` pass
- `tauri-fmt` and `tauri-check` pass

Also verify:

- Branch is up to date (`main` or release branch policy)
- Working tree is clean
- CI (`.github/workflows/ci.yml`) is green

## 2) Version + Tag

Use SemVer tags. Release workflow trigger is:

- `vX.Y.Z`
- `vX.Y.Z-rcN` (pre-release)

Commands:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 3) GitHub Draft Release

Tag push triggers `.github/workflows/release.yml`:

- Builds Tauri app for macOS, Linux, Windows
- Creates/updates a **draft** GitHub release
- Uploads binaries/installers as release assets

Current workflow output targets:

- macOS: `.dmg` (and app bundle artifacts)
- Linux: `.AppImage`, `.deb`
- Windows: `.msi`, `.exe` (NSIS)

## 4) Signing / Notarization Inputs

### macOS

Optional but recommended secrets:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

Without these, macOS artifacts are unsigned/unnotarized.

### Windows

Optional but recommended secrets:

- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`
- `WINDOWS_CERTIFICATE_THUMBPRINT`

Without these, Windows artifacts are unsigned.

## 5) Publish GitHub Release

After workflow completes:

1. Open draft release.
2. Verify platform assets are present and downloadable.
3. Add notes/changelog.
4. Mark as pre-release if tag contains `-`.
5. Publish.

## 6) Mac App Store Candidate Path

This repo includes a baseline MAS config and workflow template:

- `src-tauri/tauri.mas.conf.json`
- `src-tauri/entitlements/macos-appstore.plist`
- `.github/workflows/release-mas.yml`

Local MAS candidate build:

```bash
bun run build:tauri:mas
```

Notes:

- This path keeps normal desktop release (`release.yml`) unchanged.
- `release-mas.yml` is a template baseline; provisioning profile and App Store Connect upload steps are intentionally left for project-specific setup.

---

## Distribution Channels (Post-Release)

These are generally downstream from GitHub release assets.

## A) macOS Direct Download (DMG)

Use signed/notarized `.dmg` from release assets.

Recommended validation before publish:

- Install on a clean macOS machine
- Gatekeeper opens without bypass
- Launch, playback sanity test

## B) Windows Direct Download (MSI/EXE)

Use signed `.msi`/`.exe` from release assets.

Recommended validation:

- Fresh Windows install test
- SmartScreen reputation/signature behavior
- Install/uninstall checks

## C) Homebrew (Cask)

Typical flow:

1. Create/update a cask in a tap (or `homebrew-cask` if accepted).
2. Point URL to versioned GitHub release asset (`.dmg`).
3. Include `sha256`.
4. Set `app` stanza and uninstall/zap if needed.
5. Open PR in the tap repo.

Example install UX:

```bash
brew install --cask <tap>/<cask-name>
```

## D) Linux: AppImage

Already produced by release workflow.

Options:

- Keep as direct download asset
- Mirror to a project download page/CDN

Optional enhancements:

- AppStream metadata
- zsync metadata for delta updates

## E) Linux: Flathub

Requires a separate Flatpak manifest repo flow:

1. Create `org.waldiez.Player.yml` manifest.
2. Define sources (release tarball/binary), runtime, finish-args.
3. Add metainfo XML, desktop file, icons.
4. Validate locally with `flatpak-builder`.
5. Open PR to Flathub repo.

Notes:

- Flathub has review and policy requirements.
- Keep permissions minimal (`--share=network`, file access scoped).

## F) Linux: Snap Store

Requires `snapcraft.yaml` and store publishing:

1. Create snap metadata and confinement policy.
2. Build with `snapcraft` (or Launchpad remote build).
3. Register snap name in Snap Store.
4. Upload and release to channels (`edge`, `beta`, `candidate`, `stable`).

Common channels:

- `edge` for every tag/commit
- `stable` after verification

## G) Linux: DEB (APT Repo)

`.deb` artifacts exist in GitHub release.

If you want apt install experience:

1. Host an apt repository (e.g., aptly/reprepro).
2. Publish package index + GPG signing.
3. Provide install docs for apt source key + list entry.

## H) Windows Store (Optional)

Not in current workflow by default.

Requires MSIX packaging and Partner Center pipeline:

1. Build/sign MSIX (or convert installer).
2. Create/associate Store app identity.
3. Submit package via Partner Center.
4. Handle certification and staged rollout.

## I) Winget (Recommended Windows Channel)

Simple downstream channel from GitHub assets:

1. Create/update manifest in `microsoft/winget-pkgs`.
2. Reference `.exe` or `.msi` URL + SHA256.
3. Submit PR, pass validation, merge.

---

## Suggested Release Cadence

1. `-rc` tag for candidate (`vX.Y.Z-rc1`).
2. Verify all platforms + signing results.
3. Promote to stable tag (`vX.Y.Z`).
4. Publish downstream channels (Homebrew, Winget, Flathub, Snap).
