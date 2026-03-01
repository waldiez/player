# Waldiez Player (Flutter)

Flutter desktop shell that renders the web player in an embedded WebView.

See release/run structure in [RELEASE.md](RELEASE.md).

## Run

```bash
make flutter-run
```

## Build (macOS)

```bash
make flutter-build-macos
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

## Local-Only Files

For local notes, logs, and private scratch files, use repository `.local/` (gitignored).
