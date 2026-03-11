# Flutter Desktop Release

This folder contains the Flutter desktop shell for Waldiez Player.

## Structure

- `lib/` Flutter shell app (WebView host)
- `macos/` macOS runner, entitlements, plist, signing target
- `linux/` Linux runner metadata
- `windows/` Windows runner metadata
- no `android/`, `ios/`, or `web/` Flutter targets are maintained here currently

Current support note:

- macOS remains the strongest Flutter shell path.
- Linux Flutter is currently an experimental wrapper and may fall back to launching the web UI in the system browser instead of embedding it.
- Do not treat Flutter Linux as equivalent to the primary desktop app release path.

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

Important:

- A successful Linux Flutter build does not currently imply full embedded-webview runtime support.
- Release decisions should continue to be based on the main desktop app path first.

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
