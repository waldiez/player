# Contributing

This repository contains:

- Web app: React + TypeScript + Vite + Bun
- Desktop app: Tauri 2 (Rust backend in `src-tauri`)
- Manifest/spec layer: `MANIFEST` + schema/compat validators

## Prerequisites

- Bun `1.3.8+`
- Node-compatible shell tools (`make`, `zip`, etc.)
- Rust toolchain (for desktop checks/builds)
- Tauri system prerequisites: <https://v2.tauri.app/start/prerequisites/>

## Setup

```bash
bun install --frozen-lockfile
bun run prepare
```

`bun run prepare` installs Husky hooks (`pre-commit`, `pre-push`).

## Daily workflow

```bash
# web dev
make dev

# format
make format

# full local gate (same intent as CI)
make check
```

Key targets (`make help` for all):

- `make manifest-check`: validate `MANIFEST` against `schemas/waldiez-manifest.schema.json`
- `make manifest-compat`: enforce xperiens compatibility rules
- `make lint`: TS + Prettier + Stylelint + ESLint checks
- `make test`: vitest
- `make build`: Vite production build
- `make tauri-fmt`, `make tauri-check`: Rust backend checks

## Commit and push gates

Husky hooks run automatically:

- Pre-commit: `bun run precommit:guard`
- Pre-push: `bun run prepush:guard` (runs `make check`)

If hooks fail, fix issues locally, then commit/push again.

## Manifest rules

When editing `MANIFEST`:

- keep structure aligned with xperiens manifest shape
- keep capability strings namespaced/versioned
- run both:

```bash
make manifest-check
make manifest-compat
```

## Deploy targets and base path

Use the correct Vite base path for each host:

- `https://waldiez.github.io/player/` -> `VITE_BASE_PATH=/player/`
- `https://player.waldiez.io/` -> `VITE_BASE_PATH=/`

Example:

```bash
VITE_BASE_PATH=/player/ bun run build
```

Serving with the wrong base path can break module loading and cause browser MIME/module errors.

## Snapshot shipping

To create a portable web snapshot zip:

```bash
make snapshot
```

To run snapshot + optional SCP/remote deploy/share flow:

```bash
make ship
```

Implementation lives in `scripts/ship_snapshot.sh` and is env-driven.

## Testing guidance

- Add/adjust tests for behavior changes (prefer focused unit tests in `src/**/*.test.ts`).
- Run:

```bash
make test
make lint
```

For changes that can affect manifests, exports/imports, or streaming state, run `make check`.

## Pull requests

- Keep PRs scoped.
- Include a short "what changed / why" summary.
- Mention any manifest/schema/capability impacts.
- Include screenshots/GIFs for UI changes when relevant.
