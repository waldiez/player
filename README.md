# Waldiez Player

A powerful video player and editor with an impressive UI - effects, filters, audio visualization, and more. Can be used both as a standalone player and as a video composition/generation tool.

## Features

### Player Mode

- 🎬 High-quality video playback with hardware acceleration
- 🎨 Real-time effects and filters (brightness, contrast, saturation, hue, blur, vignette)
- 🔊 Audio visualization (waveform, spectrum analyzer)
- 📑 Chapter markers and bookmarks
- ⌨️ Keyboard shortcuts for power users
- 🖥️ Fullscreen mode with elegant controls

### Editor Mode

- ✂️ Non-destructive timeline editing
- 🎞️ Multiple video/audio/subtitle tracks
- ⚡ Keyframe animation for effects and transforms
- 🎭 Transitions between clips (fade, dissolve, wipe, slide, zoom, etc.)
- 📤 Export to multiple formats (MP4, WebM, MOV, GIF)
- ↩️ Full undo/redo history

### Composition Engine (Video Generation)

- 📝 Declarative project format (JSON/YAML manifests)
- 🖼️ Generate videos from images, audio clips, and captions
- ⏱️ Precise timing control for all assets
- 🎬 Ken Burns effect, pan, zoom, and motion effects
- 📊 Programmatic video creation from data/assets
- 🔄 Batch rendering support

## Use Cases

### As a Video Player

Simply open any video file and enjoy a beautiful playback experience with real-time effects.

### As a Video Editor

Import media, arrange on the timeline, add effects and transitions, export your creation.

### As a Video Generator

Define your video composition in a JSON manifest:

```json
{
  "settings": {
    "resolution": { "width": 1920, "height": 1080 },
    "frameRate": 30
  },
  "composition": {
    "tracks": [
      {
        "type": "image",
        "items": [
          {
            "assetId": "panel-001",
            "startTime": 0,
            "duration": 5,
            "effects": [{ "type": "ken-burns", "parameters": { "startScale": 1.1, "endScale": 1.0 } }],
            "transitions": [{ "type": "fade", "duration": 0.5, "position": "in" }]
          }
        ]
      },
      {
        "type": "audio",
        "items": [
          { "assetId": "narration", "startTime": 0.5 },
          { "assetId": "background-music", "startTime": 0, "transform": { "opacity": 0.3 } }
        ]
      },
      {
        "type": "caption",
        "items": [{ "source": "captions.srt" }]
      }
    ]
  }
}
```

Perfect for:

- **Comic/Slideshow Videos**: Turn image sequences into videos with narration
- **Automated Video Production**: Generate videos from templates and data
- **Podcast Visualizers**: Combine audio with animated backgrounds
- **Documentation Videos**: Create product demos from screenshots

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4
- **State Management**: Zustand with devtools
- **Desktop**: Tauri 2.x (Rust backend)
- **Media Engine**: FFmpeg via Rust bindings
- **GPU Acceleration**: WebGPU/WebGL for real-time effects
- **UI Components**: Radix UI primitives

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution workflow, checks, hooks, manifest rules, and deploy path guidance.

### Prerequisites

- [Bun](https://bun.sh) v1.3+ (package manager)
- [Rust](https://rustup.rs) (for Tauri backend)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
# Install dependencies
bun install

# Run in development mode (web only)
bun dev

# Run with Tauri (desktop)
bun dev:tauri
```

### Build

```bash
# Build web version
bun build

# Build desktop application
bun build:tauri
```

### Testing & Quality

```bash
# Run all checks
bun all

# Run tests
bun test

# Lint & format
bun format
bun lint
```

### Auto-Generate `latest-auto.wid`

Generate the CDN preset locally from a JSON feed:

```bash
bun run wid:latest:sample
# or:
bun run wid:latest --feed path-or-url-to-feed.json --out static/cdn/repo/latest-auto.wid
# build feed from YouTube + generate strict .wid:
bun run wid:latest:pipeline
# trust report only (no write):
bun run wid:latest:report
# strict latest-news validation (fails if any track is rejected):
bun run wid:latest --feed path-or-url-to-feed.json --out static/cdn/repo/latest-auto.wid --verify-news --strict-news
```

Feed contract (minimum):

```json
{
  "mode": "dock",
  "tracks": [{ "mood": "dock", "videoId": "4xiWvdwsCBQ", "name": "Latest Feed Pulse 01" }]
}
```

- A scheduled workflow is included at `.github/workflows/latest-auto-wid.yml`.
- If secret `LATEST_WID_FEED_URL` exists, the workflow fetches that feed URL.
- Otherwise it builds `static/cdn/repo/latest-feed.generated.json` from YouTube Search API.
- The workflow also publishes `public/cdn/repo/latest-auto.wid` for first-load bootstrap.
- `YOUTUBE_API_KEY` is required to validate recency/topic against YouTube metadata.
- Automated workflows run in non-strict mode: rejected tracks are dropped, and generation continues as long as at least one track passes validation.
- `--strict-news` remains available for manual runs when you want the command to fail on any rejected track.
- Optional semantic scoring can be enabled with:
  - `OPENAI_API_KEY` + `--llm-provider openai`
  - `ANTHROPIC_API_KEY` + `--llm-provider anthropic`
- Optional GitHub Variables for generated feed mode:
  - `LATEST_WID_YT_QUERY`
  - `LATEST_WID_YT_CHANNEL_IDS` (CSV of channel IDs)
  - `LATEST_WID_MIN_DURATION_SECONDS`
  - `LATEST_WID_BLOCKED_TERMS`
  - `LATEST_WID_LLM_PROVIDER`
  - `LATEST_WID_LLM_MODEL`
  - `LATEST_WID_LLM_MIN_SCORE` (defaults to `70` if unset)
- Use `--dry-run --dry-run-report` to print per-track trust evidence (age, keyword hits, llm score, reason) without writing files.
- Upload-ready non-default presets are listed in `static/cdn/repo/upload-catalog.json`.

## Project Structure

```
waldiez-player/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── ui/            # Base UI primitives (Button, Slider, Tooltip)
│   │   ├── player/        # Video player components
│   │   ├── editor/        # Timeline editor components
│   │   └── effects/       # Effects panel components
│   ├── hooks/             # Custom React hooks
│   ├── stores/            # Zustand state stores
│   │   ├── playerStore    # Playback state, effects, UI
│   │   ├── editorStore    # Timeline, clips, tracks
│   │   └── compositionStore # Video generation/composition
│   ├── lib/               # Utility functions
│   └── types/             # TypeScript types
│       ├── player.ts      # Player-related types
│       ├── editor.ts      # Editor/timeline types
│       └── composition.ts # Video generation types
├── schemas/               # JSON schemas for project files
│   ├── project.schema.json
│   └── example-project.json
├── src-tauri/             # Rust backend (coming soon)
│   ├── src/
│   │   ├── media/         # FFmpeg integration
│   │   ├── effects/       # GPU effect processing
│   │   └── export/        # Video encoding/export
│   └── Cargo.toml
└── public/                # Static assets
```

## Keyboard Shortcuts

| Key                    | Action                           |
| ---------------------- | -------------------------------- |
| `Space`                | Play/Pause                       |
| `←` / `→`              | Seek -5s / +5s                   |
| `J` / `K` / `L`        | Rewind / Pause / Forward         |
| `M`                    | Mute/Unmute                      |
| `F`                    | Fullscreen                       |
| `[` / `]`              | Decrease/Increase playback speed |
| `Cmd/Ctrl + Z`         | Undo                             |
| `Cmd/Ctrl + Shift + Z` | Redo                             |
| `S`                    | Split clip at playhead           |
| `Delete`               | Delete selected clip             |

## Roadmap

- [ ] Tauri Rust backend with FFmpeg integration
- [ ] GPU-accelerated video processing
- [ ] Audio waveform visualization
- [ ] LUT support for color grading
- [ ] Batch export from CLI
- [ ] Plugin system for custom effects
- [ ] YAML manifest support

## License

Apache-2.0

---

Part of the [Waldiez](https://waldiez.io) ecosystem.
