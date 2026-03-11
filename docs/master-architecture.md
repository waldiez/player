# Master Architecture

This document defines the long-term product shape for Waldiez as a spectrum from:

- simple playback and media consumption
- reader/document-to-media workflows
- creator-grade editing and rendering
- eventually a studio-grade platform for automation, plugins, and advanced composition

The product should not collapse those into one overloaded surface. The correct structure is layered and mode-based.

## Product Layers

### 1. Runtime Layer

Owns environment concerns:

- web / PWA runtime
- Tauri desktop runtime
- Flutter desktop shell runtime
- native backend/tool availability
- file-open, deep-link, tray, background behavior

Primary code:

- frontend runtime detection
- Tauri commands
- desktop capability checks

### 2. Player Core

Owns fast consumption use cases:

- media library
- playback state
- transport controls
- backend routing across browser audio, iframe, yt-dlp, mpv
- import/export of user-facing presets and defaults

This must remain simple, resilient, and low-latency.

### 3. Reader Core

Owns text/document ingestion:

- document importers
- manifest/preset readers
- normalized reader document model
- structure extraction
- later semantic indexing or annotation

Reader is not the editor, but it is the cleanest source of authoring input.

### 4. Timeline Core

Owns authoring data structures:

- tracks
- clips
- scenes as higher-level authored groupings
- timing model
- transitions
- keyframes
- command/undo model
- snapping/ripple/trim semantics

This should live independently from the player shell.

### 5. Render Core

Owns output generation:

- project serialization
- preview graph generation
- export jobs
- ffmpeg/native composition
- fallback export paths
- proxy and analysis workflows later

Render Core must consume Timeline Core, not UI state directly.

### 6. Editor Shell

Owns the actual creation environment:

- timeline lanes
- clip selection
- inspector panels
- transport / preview
- waveform and visual overlays
- keyboard shortcuts
- workspace layout
- errors and diagnostics

This should be desktop-first.

### 7. Automation / Extension Layer

Owns the advanced future:

- scripting
- plugin APIs
- generators
- custom importers/exporters
- automation rules
- batch operations

This should be additive and package-based, not entangled with playback basics.

## Product Modes

The app should keep clear top-level modes:

- `Player`
- `Reader`
- `Editor`
- later `Studio`

Mode boundaries matter:

- `Player` optimizes for instant playback and low complexity
- `Reader` optimizes for comprehension and extraction
- `Editor` optimizes for authoring and timeline work
- `Studio` can expose advanced automation, plugin, and batch systems later

## Workspace Structure

Recommended long-term package boundaries:

- `packages/player-core`
- `packages/reader-core`
- `packages/timeline-core`
- `packages/render-core`
- `packages/editor-core`
- later `packages/plugin-sdk`

Current repo state is still earlier than that split, but the current `editor-core` package is the right direction.

## State Model

Three state classes should stay separate:

### Runtime State

- current platform/runtime
- backend availability
- active system capabilities

### Session State

- selected media
- current document
- current project
- selected scene
- selected clip
- active panel/layout

### Persisted Product State

- presets
- editor projects
- exported artifacts
- support bundles

Do not mix transient UI selection with serialized project state.

## Timeline Direction

The editor should support both:

- high-level scene authoring
- low-level track/clip authoring

Scenes remain useful as a semantic authoring layer.
Tracks and clips are the actual render model.

That means:

- scene -> default clips
- clips may later diverge from scenes
- rendering always targets timeline clips

## Command System

All editor mutations should go through a command/history boundary.

Required capabilities:

- undo/redo
- grouped operations
- future collaboration-safe mutation boundaries
- deterministic project patching

Required command categories:

- project commands
- scene commands
- track commands
- clip commands
- effect/keyframe commands

## Rendering Roadmap

### Current

- HTML storyboard export
- SRT export
- JSON project export
- basic ffmpeg-backed MP4 render
- overlapping visual/audio timeline composition

### Next

- richer transitions
- keyframed opacity/volume evaluation
- multiple stacked visual lanes
- clip-level blend and transform support
- waveform generation
- preview caching / proxies

### Later

- full effect graphs
- GPU-assisted preview paths
- export presets
- background job queue
- asset analysis pipeline

## UX / UDX Principles

### UI

- dense when needed, never muddy
- mode-aware
- keyboard-first in editor paths
- responsive without becoming mobile-shaped on desktop

### UX

- simple path always obvious
- advanced path available without modal overload
- failures visible and diagnosable
- import/open/save/export must feel predictable

### UDX

- package boundaries map to mental boundaries
- no hidden magic for project mutations
- diagnostics are built in
- commands and serialization are easy to test
- scripting/plugin boundary should be documented and stable before publicizing it

## Quality Bar

To cover the range from lightweight player to serious workstation, the product should aim for:

- `Player quality`: instant, boringly reliable
- `Editor quality`: precise, undoable, inspectable
- `Render quality`: deterministic, recoverable, observable
- `Developer quality`: modular, documented, scriptable

## Immediate Priorities

1. Finish command-history and undo/redo discipline in the editor.
2. Mature the timeline engine around trim, snap, ripple, and lane operations.
3. Improve ffmpeg composition for transitions, keyframes, and layered tracks.
4. Add waveform generation and clip previews.
5. Split timeline/render concerns into dedicated workspace packages.
