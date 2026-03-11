# Waldiez Player (Flutter)

Flutter desktop shell that hosts the web player.

Current target status:

- Desktop: `macos`, `linux`, `windows` runner folders exist
- Linux Flutter: currently experimental and falls back to opening the web UI in the system browser when embedded webview support is unavailable
- Mobile: no Flutter `android/` or `ios/` app targets in this repo yet
- Flutter web: no separate `flutter/web/` target; the main web app lives at the repo root (`bun run dev` / `bun run build`)

See release/run structure in [RELEASE.md](RELEASE.md).

## Run

```bash
make flutter-run
# Linux:
make flutter-run-linux
```

Linux note:

- The Linux Flutter shell is not currently a full embedded desktop-webview target.
- If the embedded webview backend is unavailable, the app shows the resolved player URL and opens it in the default browser.
- Treat this as a development fallback, not production-grade Linux desktop packaging.

## Build

```bash
make flutter-build-macos
# Linux:
make flutter-build-linux
```

## Optional YouTube Search Key

If you want YouTube Data API search fallback, pass:

```bash
cd flutter
flutter run -d macos --dart-define=YT_API_KEY=YOUR_KEY
```

For release build:

```bash
cd flutter
flutter build macos --dart-define=YT_API_KEY=YOUR_KEY
```

Linux example:

```bash
cd flutter
flutter run -d linux --dart-define=YT_API_KEY=YOUR_KEY
```

## Local-Only Files

For local notes, logs, and private scratch files, use repository `.local/` (gitignored).
