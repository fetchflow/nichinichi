.PHONY: help install dev build build-desktop build-cli test test-parser test-sync cli release

RELEASE_VERSION ?=
# Strip leading 'v' for version files (v0.2.0 → 0.2.0); evaluated lazily
_VER = $(patsubst v%,%,$(RELEASE_VERSION))

.DEFAULT_GOAL := help

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*##"}; {printf "  %-18s %s\n", $$1, $$2}'

# ── Frontend ──────────────────────────────────────────────────────────────────

install: ## Install frontend dependencies
	cd apps/desktop && pnpm install

# ── Development ───────────────────────────────────────────────────────────────

dev: ## Start desktop app in development mode (hot-reload)
	cd apps/desktop && pnpm tauri dev

cli: ## Run CLI — pass args with ARGS="…"  (e.g. make cli ARGS="--help")
	cargo run -p nichinichi-cli -- $(ARGS)

# ── Build ─────────────────────────────────────────────────────────────────────

build: ## Build all Rust crates
	cargo build

build-desktop: ## Build production desktop installer (output: target/release/bundle/)
	cd apps/desktop && pnpm tauri build

build-cli: ## Build CLI binary for local installation (output: target/release/nichinichi)
	cargo build -p nichinichi-cli --release

clean-build:
	@echo "Cleaning the Rust build cache"
	@cargo clean --manifest-path ./apps/desktop/src-tauri/Cargo.toml

# ── Test ──────────────────────────────────────────────────────────────────────

test: ## Run all tests
	cargo test

test-parser: ## Run parser unit tests
	cargo test -p nichinichi-parser

test-sync: ## Run sync + SQLite tests
	cargo test -p nichinichi-sync

# ── Release ────────────────────────────────────────────────────────────────────

release: ## Bump versions, commit, tag, and push  (RELEASE_VERSION=vX.Y.Z required)
	@test -n "$(RELEASE_VERSION)" || (echo "error: RELEASE_VERSION is required, e.g. RELEASE_VERSION=v0.2.0 make release" && exit 1)
	sed -i'' -e 's/^version = ".*"/version = "$(_VER)"/' Cargo.toml
	cd apps/desktop && npm pkg set version=$(_VER)
	cd apps/desktop/src-tauri && \
	  tmp=$$(mktemp) && \
	  jq '.version = "$(_VER)"' tauri.conf.json > $$tmp && \
	  mv $$tmp tauri.conf.json
	cargo check
	git add Cargo.toml apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json
	git commit -m "chore: release $(RELEASE_VERSION)"
	git tag $(RELEASE_VERSION)
	git push origin HEAD $(RELEASE_VERSION)
