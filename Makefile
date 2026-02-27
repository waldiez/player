.DEFAULT_GOAL := help

.PHONY: help install dev format lint test build snapshot ship manifest-check manifest-compat check ci clean clean-cache clean-build tauri-check tauri-fmt

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_.-]+:.*## / {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	bun install --frozen-lockfile

dev: ## Run web development server
	bun run dev

format: ## Auto-format code and styles
	bun run format

lint: ## Run lint and formatting checks
	bun run lint

test: ## Run test suite
	bun run test

build: ## Build web application
	bun run build

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
	cd src-tauri && cargo fmt --all -- --check

tauri-check: ## Check Rust backend in src-tauri
	cd src-tauri && cargo check --locked

check: manifest-check manifest-compat lint test build tauri-fmt tauri-check ## Run all local checks

ci: install check ## Run CI-equivalent checks locally

clean-cache: ## Remove linter/tool caches
	bun run clean:cache

clean-build: ## Remove build artifacts
	bun run clean:dist

clean: ## Remove caches and build outputs
	bun run clean
