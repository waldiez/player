# Waldiez Player (Flutter)

Flutter desktop shell that renders the web player in an embedded WebView.

Current target status:

- Desktop: `macos`, `linux`, `windows` runner folders exist
- Mobile: no Flutter `android/` or `ios/` app targets in this repo yet
- Flutter web: no separate `flutter/web/` target; the main web app lives at the repo root (`bun run dev` / `bun run build`)

See release/run structure in [RELEASE.md](RELEASE.md).

## Run

```bash
make flutter-run
# Linux:
make flutter-run-linux
```

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
