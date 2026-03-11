# Desktop Reader And Editor Plan

## Scope

This document covers the next two desktop-focused tracks after playback/runtime hardening:

1. `Reader mode`
2. `Editor mode`

The intent is to keep the desktop app as the primary host while avoiding a monolithic frontend that mixes playback, document ingestion, manifest tooling, and authoring concerns into one runtime surface.

## Current Constraints

- The current app already supports `.wid` and `.waldiez` import/export through [moodDefaults.ts](/home/tam/Projects/waldiez/player/src/lib/moodDefaults.ts).
- The current manifest direction in this repo is:
  - `MANIFEST` for canonical structured manifests
  - `.wid` for lightweight single-file descriptors
  - `.waldiez` for bundled/package artifacts
- `xperiens` already uses `MANIFEST` with the `https://xperiens.waldiez.io/schema/v1/manifest` schema family.
- Desktop runtime checks now exist for `mpv`, `yt-dlp`, and Tauri listener readiness, so new reader/editor work should build on that desktop support path.

## Reader Mode

### Goal

Reader mode should accept local or imported files, extract text and structure from them, and present them in a reader-first UI that can later drive:

- text visualization
- read-aloud / media session playback
- annotation/highlight flows
- conversion into timeline/editor inputs

### Supported Inputs

Reader mode should support files only if the desktop app can extract a usable text model from them.

Recommended support order:

1. Plain text and Markdown
   - `.txt`
   - `.md`
   - `.markdown`
2. PDF
   - `.pdf`
3. HTML-like documents
   - `.html`
   - `.htm`
4. Structured manifests and descriptor files
   - `MANIFEST`
   - `.wid`
   - `.waldiez`
   - `.json`
   - `.yaml`
   - `.yml`
5. Optional second phase
   - `.epub`
   - `.docx`

Do not promise arbitrary office formats until extraction quality is acceptable.

### Canonical Reader Model

All supported inputs should normalize into one internal representation:

```ts
interface ReaderDocument {
  id: string;
  sourcePath?: string;
  sourceType: "text" | "markdown" | "pdf" | "html" | "manifest" | "archive";
  title: string;
  mimeType?: string;
  sections: ReaderSection[];
  plainText: string;
  metadata: Record<string, unknown>;
  diagnostics: ReaderDiagnostic[];
}
```

Key rule:

- rendering should consume `ReaderDocument`
- importers should be format-specific adapters

That keeps PDF/Markdown/manifest parsing out of the UI layer.

### Reader Import Pipeline

Recommended desktop pipeline:

1. Detect file type by extension and MIME.
2. Route through a dedicated importer:
   - `importTextDocument`
   - `importMarkdownDocument`
   - `importPdfDocument`
   - `importManifestDocument`
   - `importWaldiezBundleDocument`
3. Normalize into `ReaderDocument`.
4. Persist only normalized metadata plus original file reference.
5. Render from normalized structure.

### `.wid`, `.waldiez`, and `MANIFEST`

Reader mode should treat manifests as readable first-class documents, not only as import payloads.

That means:

- `.wid` should open as structured YAML text plus parsed manifest view
- `.waldiez` should expose:
  - manifest summary
  - bundled file inventory
  - extracted readable sections where applicable
- `MANIFEST` should open directly as the canonical manifest document

Recommended reader views for manifest-like documents:

1. Raw source
2. Structured manifest view
3. Extracted narrative summary

### Repo-Aware Manifest Sources

The desktop app should be able to open manifest-oriented files from:

- the local repo
- sibling repos in the same workspace
- imported filesystem locations

For this user setup, explicitly support discovery from:

- `/home/tam/Projects/waldiez/*`
- `/home/tam/Projects/wid`
- `/home/tam/Projects/waldiez/xperiens`

Use cases:

- open `MANIFEST` files directly
- inspect `.wid` descriptors
- inspect `.waldiez` bundles
- browse schema-aligned project metadata from neighboring repos

Recommended desktop-only feature:

- a `Workspace Sources` panel that indexes known roots for `MANIFEST`, `.wid`, `.waldiez`, `.md`, and `.pdf`

This should remain desktop-only because local repo traversal is not a web concern.

### Reader UX

Reader mode should not look like the current transport player with text dropped into it.

Core reader UX should include:

- left sidebar: sources, sections, outline
- center pane: reading surface
- right sidebar: metadata, extracted structure, diagnostics
- mode switch:
  - `Read`
  - `Structure`
  - `Source`
  - later `Visualize`

### Desktop Dependencies

Recommended extraction stack:

- Markdown/text/HTML: native frontend parsing or Bun-side helpers
- PDF: desktop backend extraction library or Tauri-side command
- `.waldiez`: unzip + read `MANIFEST`
- `.wid` / `MANIFEST`: YAML parser already present

Important rule:

- PDF parsing should be handled by a backend/service layer, not directly in React components

### Reader Milestones

#### Reader M1

- local file open for `.txt`, `.md`, `.pdf`, `.wid`, `.waldiez`, `MANIFEST`
- normalized `ReaderDocument`
- basic reader screen
- source/structure/raw tabs

#### Reader M2

- workspace repo indexing
- manifest-aware rendering
- desktop search across opened documents
- document diagnostics export

#### Reader M3

- read-aloud pipeline
- sentence/paragraph timing
- visualization hooks for text-driven playback
- handoff into editor package

## Editor Mode

### Goal

Editor mode is not just another player tab. It is a different product surface:

- document/media composition
- timeline and scene authoring
- manifest editing
- export/build workflows

It should therefore be treated as a separate package, hosted by the desktop app when needed.

### Recommendation

Create the editor as a separate workspace package rather than baking it directly into the main player app.

Recommended shape:

- `packages/editor-core`
  - schema/types
  - timeline/document graph model
  - import/export logic
  - manifest adapters
- `packages/editor-ui`
  - React editor surface
  - panels, timeline, inspectors
- player app consumes editor package for desktop
- web can optionally consume a limited editor build later

### Why A Separate Package

1. The editor has different runtime needs.
   - large state graph
   - undo/redo
   - autosave
   - validation
   - export pipeline

2. The desktop app should stay boot-fast for normal playback and reader flows.

3. Web and desktop may share editor UI, but desktop can enable extra integrations:
   - local files
   - repo workspace scanning
   - shell/export commands
   - heavy converters

4. Testing becomes cleaner.
   - editor model tests
   - import/export tests
   - UI tests
   - desktop integration tests

### Packaging Strategy

Recommended architecture:

- `player` remains the shell app
- `editor-core` owns authoring data structures
- `editor-ui` is mounted lazily inside desktop builds
- web build can expose a constrained editor if needed later

This gives:

- desktop-first power features
- optional web editor surface
- no editor tax on standard playback mode

### Editor Should Consume Reader Output

Reader mode should be an ingestion path for editor mode.

Examples:

- Markdown document -> scene/script blocks
- PDF -> extracted section list -> storyboard/script source
- `MANIFEST` / `.wid` -> editable structured manifest graph
- `.waldiez` -> package inspector -> editable clone/new export

That means the shared contract should be:

- `ReaderDocument` in
- `EditorProject` out

### Recommended Editor Boundaries

Editor owns:

- project model
- authoring UI
- validation
- export/build steps
- undo/redo
- autosave

Player owns:

- playback shell
- runtime/device/media controls
- support snapshot and diagnostics
- desktop shell integrations

Shared layer owns:

- manifest types
- reader document model
- parsers/importers
- conversion utilities

### Editor Phases

#### Editor E1

- separate `editor-core` package
- basic project schema
- import from `ReaderDocument`
- open/edit/save local project state on desktop

#### Editor E2

- lazy-mounted desktop editor UI package
- manifest inspector/editor
- structured diff/validation

#### Editor E3

- export pipelines
- template/project presets
- optional limited web editor distribution

## Decision Summary

### Reader mode

- implement inside the desktop app first
- support file types only when text extraction is reliable
- normalize everything into one `ReaderDocument`
- treat `MANIFEST`, `.wid`, and `.waldiez` as readable structured documents
- add workspace-aware repo browsing for desktop

### Editor mode

- build as a separate workspace package
- desktop should host it first
- web can consume a reduced version later
- share manifest and reader models instead of duplicating them

## Recommended Next Implementation Order

1. Add reader domain types and importer interfaces.
2. Implement desktop reader support for `.md`, `.txt`, `.wid`, `MANIFEST`, `.waldiez`.
3. Add PDF extraction via desktop backend.
4. Add workspace manifest/document discovery for local repos.
5. Create `editor-core` package with import-from-reader adapters.
6. Mount a lazy desktop editor shell after the reader path is stable.
