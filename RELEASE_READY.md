# Release Ready Checklist

Use this file as a one-time setup + per-release runbook.

Reference: [docs/release.md](./docs/release.md)

## A) One-Time Setup (Apple + GitHub)

## App Identity

- Product: `Waldiez Player`
- Bundle Identifier: `io.waldiez.player` (from `src-tauri/tauri.conf.json`)
- Team ID: `<FILL_ME_TEAM_ID>`

## Apple Developer Credentials

- Apple ID email: `<FILL_ME_APPLE_ID_EMAIL>`
- App-specific password created: `YES/NO`
- Developer ID Application cert installed in Keychain: `YES/NO`

Verify codesign identities:

```bash
security find-identity -v -p codesigning
```

Expected identity (example):

- `Developer ID Application: Your Name (TEAMID)`

## Export Certificate for CI

- Export `.p12` including private key: `YES/NO`
- `.p12` password chosen: `YES/NO`
- Base64 encoded for secret:

```bash
base64 -i cert.p12 | pbcopy
```

## GitHub Secrets (Repo Settings > Secrets and variables > Actions)

Set these secrets:

- `APPLE_CERTIFICATE` = base64(p12)
- `APPLE_CERTIFICATE_PASSWORD` = p12 password
- `APPLE_SIGNING_IDENTITY` = exact identity string
- `APPLE_ID` = Apple ID email
- `APPLE_PASSWORD` = app-specific password
- `APPLE_TEAM_ID` = Team ID

For Mac App Store candidate workflow (`.github/workflows/release-mas.yml`), set:

- `APPLE_MAS_CERTIFICATE`
- `APPLE_MAS_CERTIFICATE_PASSWORD`
- `APPLE_MAS_SIGNING_IDENTITY`

Use the exact certificate label for MAS identity, typically:

- `3rd Party Mac Developer Application: Your Name (TEAMID)`

Use the exact certificate label for notarized direct macOS release identity:

- `Developer ID Application: Your Name (TEAMID)`

Optional Windows signing secrets:

- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`
- `WINDOWS_CERTIFICATE_THUMBPRINT`

## B) Pre-Release Gate (Every Release)

On the candidate commit:

```bash
make check
```

Must pass:

- manifest checks
- lint/test/build
- tauri fmt/check

Repo state before tagging:

- `git status` clean
- `git pull` up to date
- CI green on `main`

## C) Release Candidate (Recommended)

1. Choose RC version: `vX.Y.Z-rcN`
2. Tag + push:

   ```bash
   git tag v0.1.0-rc1
   git push origin v0.1.0-rc1
   ```

3. Watch workflow:
   - `.github/workflows/release.yml`

4. Validate draft release artifacts:
   - macOS `.dmg`
   - Linux `.AppImage`, `.deb`
   - Windows `.msi`, `.exe`

## C2) MAS Candidate Build (Manual Workflow)

Local dry run:

```bash
bun run build:tauri:mas
```

CI template workflow:

- `.github/workflows/release-mas.yml`

## D) macOS Validation (Post-RC Build)

On a clean macOS machine:

1. Download `.dmg`
2. Install and launch app
3. Confirm no "unidentified developer" block
4. Smoke test playback/search/basic flows

Optional local checks:

```bash
spctl -a -t open --context context:primary-signature -v /Applications/Waldiez\ Player.app
codesign -dv --verbose=4 /Applications/Waldiez\ Player.app
```

## E) Stable Release

After RC is validated:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then:

1. Open draft release on GitHub
2. Finalize notes/changelog
3. Publish release

## F) Downstream Stores/Channels

Track status per release:

- Homebrew cask: `TODO`
- Winget: `TODO`
- Flathub: `TODO`
- Snap: `TODO`
- APT/DNF/AUR repo (if used): `TODO`
- Windows Store/MSIX (optional): `TODO`
