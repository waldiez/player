# Flutter Desktop Release

This folder contains the Flutter desktop shell for Waldiez Player.

## Structure

- `lib/` Flutter shell app (WebView host)
- `macos/` macOS runner, entitlements, plist, signing target
- `linux/` Linux runner metadata
- `windows/` Windows runner metadata
- no `android/`, `ios/`, or `web/` Flutter targets are maintained here currently

## Local Dev

From repository root:

```bash
bun run dev
make flutter-run-local
```

With YouTube API key:

```bash
YT_API_KEY=YOUR_KEY make flutter-run-local-key
```

## Release-Like Run

Use release mode to avoid Flutter debug keyboard assertions:

```bash
YT_API_KEY=YOUR_KEY make flutter-run-release-local-key
```

## Desktop Builds

macOS:

```bash
make flutter-build-macos
```

Linux:

```bash
make flutter-build-linux
```

Local web URL + key:

```bash
YT_API_KEY=YOUR_KEY make flutter-build-macos-local-key
YT_API_KEY=YOUR_KEY make flutter-build-linux-local-key
```

## Icons

Regenerate launcher icons from `../src-tauri/icons/icon.png`:

```bash
make flutter-icons
```

## Local-Only Files Policy

Do not keep temporary notes, exported logs, private config, or scratch artifacts in tracked paths.
Put local-only files under repository `.local/` (already gitignored).
