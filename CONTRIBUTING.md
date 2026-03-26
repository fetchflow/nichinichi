# Contributing to Nichinichi

Thanks for your interest in contributing. This document covers how to build, test, and submit changes.

---

## Prerequisites

- **Rust** (stable, 1.77+): `rustup update stable`
- **pnpm**: `npm install -g pnpm`
- **macOS**: Xcode command line tools (`xcode-select --install`)
- **Linux**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev` (for desktop)

---

## Building

```bash
# Check everything compiles
cargo check

# Build all crates
cargo build

# Run the CLI in dev mode
cargo run -p nichinichi-cli -- "test entry @personal #log"

# Desktop app (from apps/desktop/)
cd apps/desktop
pnpm install
pnpm tauri dev      # dev mode with hot-reload
pnpm tauri build    # production build
```

---

## Testing

```bash
# Run all tests
cargo test

# Run tests for a specific crate
cargo test -p nichinichi-parser
cargo test -p nichinichi-sync

# TypeScript type check
cd apps/desktop && pnpm tsc --noEmit
```

All tests must pass before submitting a PR. See [docs/testing.md](docs/testing.md) for the test strategy.

---

## Codebase overview

```
crates/
  types/    # shared structs (ParsedEntry, Goal, Config…)
  parser/   # markdown parsers — entries, goals, playbooks, digests
  sync/     # SQLite writer, file watcher, SyncTarget trait
  ai/       # FTS5 query builder, OpenAI-compatible streaming client
apps/
  cli/      # nichinichi binary (clap)
  desktop/  # Tauri v2 desktop app (React + TypeScript + Tailwind)
```

See the [codebase structure section in the README](README.md#codebase-structure) and [docs/development.md](docs/development.md) for a deeper walkthrough.

---

## Commit convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add weekly digest generation
fix: handle missing org tag in parser
refactor: extract entry ID generation to types crate
docs: update file format spec
test: add parser tests for approximate timestamps
chore: add license to Cargo.toml files
```

Keep the subject line under 72 characters. Add a body if the change needs explanation.

---

## Submitting a PR

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Make your changes. Keep each PR focused on one thing.
3. Run `cargo test` and confirm everything passes.
4. Push and open a PR against `main`.
5. Fill in the PR template — describe what changed and why.

PRs that touch the parser should include new or updated tests in `crates/parser/tests/`.

---

## Reporting bugs

Open a [GitHub issue](../../issues) using the bug report template. Include your OS, Rust version, and steps to reproduce.

## Feature requests

Open a [GitHub issue](../../issues) using the feature request template. Describe the problem you're trying to solve, not just the solution.
