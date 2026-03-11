.DEFAULT_GOAL := help

CARGO_BIN ?= $(shell if [ -x /home/tam/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo ]; then echo /home/tam/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo; elif command -v cargo >/dev/null 2>&1; then command -v cargo; else echo cargo; fi)
RUSTC_BIN ?= $(shell if [ -x /home/tam/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustc ]; then echo /home/tam/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustc; elif command -v rustc >/dev/null 2>&1; then command -v rustc; else echo rustc; fi)
RUSTFMT_BIN ?= $(shell if [ -x /home/tam/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustfmt ]; then echo /home/tam/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustfmt; elif command -v rustfmt >/dev/null 2>&1; then command -v rustfmt; else echo rustfmt; fi)

.PHONY: help install dev dev-tauri format lint test build snapshot ship manifest-check manifest-compat check ci clean clean-cache clean-build tauri-check tauri-fmt tauri-app tauri-dmg tauri-mas flutter-run flutter-build-macos flutter-build-linux flutter-icons flutter-run-key flutter-build-macos-key flutter-run-local flutter-run-local-key flutter-run-release flutter-run-release-local flutter-run-release-local-key flutter-build-macos-local flutter-build-macos-local-key flutter-run-linux flutter-run-linux-local flutter-run-linux-local-key flutter-build-linux-local flutter-build-linux-local-key

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_.-]+:.*## / {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	bun install --frozen-lockfile

dev: ## Run web development server
	bun run dev

dev-tauri: ## Run Tauri desktop app with HMR (frontend) + watch-rebuild (Rust)
	bun run dev:tauri

format: ## Auto-format code and styles
	bun run format

lint: ## Run lint and formatting checks
	bun run lint

test: ## Run test suite
	bun run test

build: ## Build web application
	bun run build

tauri-app: ## Build signed/notarized macOS .app bundle (no DMG)
	bun run build:tauri

tauri-dmg: ## Build signed/notarized macOS .app and package DMG
	bun run build:tauri:dmg

tauri-mas: ## Build Mac App Store candidate (.app only, MAS config)
	bun run build:tauri:mas

flutter-run: ## Run Flutter desktop spike from ./flutter
	cd flutter && flutter run -d macos

flutter-build-macos: ## Build Flutter macOS app from ./flutter
	cd flutter && flutter build macos

flutter-run-linux: ## Run Flutter Linux desktop shell from ./flutter
	cd flutter && flutter run -d linux

flutter-build-linux: ## Build Flutter Linux desktop app from ./flutter
	cd flutter && flutter build linux

flutter-icons: ## Generate Flutter desktop launcher icons from src-tauri/icons/icon.png
	cd flutter && flutter pub get && dart run flutter_launcher_icons

flutter-run-key: ## Run Flutter macOS with YT_API_KEY from env (YT_API_KEY=... make flutter-run-key)
	@if [ -z "$(YT_API_KEY)" ]; then \
		echo "Missing YT_API_KEY. Usage: YT_API_KEY=... make flutter-run-key"; \
		exit 1; \
	fi
	cd flutter && flutter run -d macos --dart-define=YT_API_KEY=$(YT_API_KEY)

flutter-build-macos-key: ## Build Flutter macOS with YT_API_KEY from env (YT_API_KEY=... make flutter-build-macos-key)
	@if [ -z "$(YT_API_KEY)" ]; then \
		echo "Missing YT_API_KEY. Usage: YT_API_KEY=... make flutter-build-macos-key"; \
		exit 1; \
	fi
	cd flutter && flutter build macos --dart-define=YT_API_KEY=$(YT_API_KEY)

flutter-run-local: ## Run Flutter against local web app URL (default http://localhost:5173)
	cd flutter && flutter run -d macos --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173)

flutter-run-linux-local: ## Run Flutter Linux against local web app URL (default http://localhost:5173)
	cd flutter && flutter run -d linux --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173)

flutter-run-local-key: ## Run Flutter against local web app URL + YT key
	@if [ -z "$(YT_API_KEY)" ]; then \
		echo "Missing YT_API_KEY. Usage: YT_API_KEY=... make flutter-run-local-key"; \
		exit 1; \
	fi
	cd flutter && flutter run -d macos --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173) --dart-define=YT_API_KEY=$(YT_API_KEY)

flutter-run-linux-local-key: ## Run Flutter Linux against local web app URL + YT key
	@if [ -z "$(YT_API_KEY)" ]; then \
		echo "Missing YT_API_KEY. Usage: YT_API_KEY=... make flutter-run-linux-local-key"; \
		exit 1; \
	fi
	cd flutter && flutter run -d linux --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173) --dart-define=YT_API_KEY=$(YT_API_KEY)

flutter-run-release: ## Run Flutter macOS in release mode (avoids debug key-event assertions)
	cd flutter && flutter run -d macos --release

flutter-run-release-local: ## Run Flutter macOS release mode against local web app URL
	cd flutter && flutter run -d macos --release --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173)

flutter-run-release-local-key: ## Run Flutter macOS release mode against local web app URL + YT key
	@if [ -z "$(YT_API_KEY)" ]; then \
		echo "Missing YT_API_KEY. Usage: YT_API_KEY=... make flutter-run-release-local-key"; \
		exit 1; \
	fi
	cd flutter && flutter run -d macos --release --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173) --dart-define=YT_API_KEY=$(YT_API_KEY)

flutter-build-macos-local: ## Build Flutter macOS against local web app URL
	cd flutter && flutter build macos --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173)

flutter-build-linux-local: ## Build Flutter Linux against local web app URL
	cd flutter && flutter build linux --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173)

flutter-build-macos-local-key: ## Build Flutter macOS against local web app URL + YT key
	@if [ -z "$(YT_API_KEY)" ]; then \
		echo "Missing YT_API_KEY. Usage: YT_API_KEY=... make flutter-build-macos-local-key"; \
		exit 1; \
	fi
	cd flutter && flutter build macos --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173) --dart-define=YT_API_KEY=$(YT_API_KEY)

flutter-build-linux-local-key: ## Build Flutter Linux against local web app URL + YT key
	@if [ -z "$(YT_API_KEY)" ]; then \
		echo "Missing YT_API_KEY. Usage: YT_API_KEY=... make flutter-build-linux-local-key"; \
		exit 1; \
	fi
	cd flutter && flutter build linux --dart-define=PLAYER_WEB_URL=$(or $(PLAYER_WEB_URL),http://localhost:5173) --dart-define=YT_API_KEY=$(YT_API_KEY)

snapshot: manifest-check manifest-compat build ## Build and zip web snapshot for scp/serve
	@mkdir -p snapshots
	@ts=$$(date -u +%Y%m%dT%H%M%SZ); \
	out="$(PWD)/snapshots/player-web-$$ts.zip"; \
	tmp=$$(mktemp -d); \
	mkdir -p "$$tmp/player"; \
	cp -R dist "$$tmp/player/dist"; \
	cp MANIFEST "$$tmp/player/MANIFEST"; \
	printf "snapshot_created_utc=%s\nbase_path=/player/\npages_url=https://waldiez.github.io/player/\n" "$$ts" > "$$tmp/player/SNAPSHOT.txt"; \
	(cd "$$tmp" && zip -rq "$$out" player); \
	rm -rf "$$tmp"; \
	echo "Created $$out"

ship: snapshot ## Build snapshot and optionally scp/deploy/share (env-driven)
	@bash scripts/ship_snapshot.sh

manifest-check: ## Validate MANIFEST against local schema
	bun run manifest:check

manifest-compat: ## Validate MANIFEST xperiens compatibility rules
	bun run manifest:compat

tauri-fmt: ## Check Rust formatting in src-tauri
	cd src-tauri && find src -name '*.rs' -print0 | xargs -0 $(RUSTFMT_BIN) --edition 2021 --check

tauri-check: ## Check Rust backend in src-tauri
	@if [ "$(FORCE_TAURI_CHECK)" = "1" ]; then \
		cd src-tauri && RUSTC=$(RUSTC_BIN) $(CARGO_BIN) check --locked; \
	elif command -v pkg-config >/dev/null 2>&1 && pkg-config --exists glib-2.0 gobject-2.0; then \
		cd src-tauri && RUSTC=$(RUSTC_BIN) $(CARGO_BIN) check --locked; \
	else \
		echo "Skipping tauri-check: missing system deps for GTK/GLib (glib-2.0, gobject-2.0)."; \
		echo "Install native packages (e.g. libglib2.0-dev libgtk-3-dev) or run 'make tauri-check FORCE_TAURI_CHECK=1' in a provisioned environment."; \
	fi

check: manifest-check manifest-compat lint test build tauri-fmt tauri-check ## Run all local checks

ci: install check ## Run CI-equivalent checks locally

clean-cache: ## Remove linter/tool caches
	bun run clean:cache

clean-build: ## Remove build artifacts
	bun run clean:dist
	rm -rf src-tauri/target/release/bundle src-tauri/target/debug/bundle
	rm -f src-tauri/target/release/bundle/macos/rw.*.dmg src-tauri/target/release/bundle/dmg/rw.*.dmg

clean: ## Remove caches and build outputs
	bun run clean
	rm -rf src-tauri/target/release/bundle src-tauri/target/debug/bundle
	rm -f src-tauri/target/release/bundle/macos/rw.*.dmg src-tauri/target/release/bundle/dmg/rw.*.dmg
