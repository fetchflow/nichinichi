.PHONY: help install dev build build-desktop test test-parser test-sync cli

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

# ── Test ──────────────────────────────────────────────────────────────────────

test: ## Run all tests
	cargo test

test-parser: ## Run parser unit tests
	cargo test -p nichinichi-parser

test-sync: ## Run sync + SQLite tests
	cargo test -p nichinichi-sync
