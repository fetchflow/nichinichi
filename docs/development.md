# Development Guide

## Prerequisites

- Rust (stable, 1.77+): `rustup update stable`
- Node.js 20+ and pnpm: `npm install -g pnpm`
- Tauri CLI: installed via pnpm in `apps/desktop`
- macOS: Xcode command line tools

## Quick start

```bash
# Build all Rust crates
cargo build

# Run the CLI in dev mode
cargo run -p devlog-cli -- --help

# Run parser tests
cargo test -p devlog-parser

# Run sync tests (requires temp SQLite)
cargo test -p devlog-sync

# Start the desktop app (hot-reload)
cd apps/desktop
pnpm install
pnpm tauri dev
```

## Repository structure

```
devlog-mark-02/
├── Cargo.toml                  # Workspace root (resolver = "2")
├── crates/
│   ├── types/                  # Shared domain structs
│   ├── parser/                 # Markdown parsers
│   ├── sync/                   # SQLite + file watcher
│   └── ai/                     # FTS5 search + Claude streaming
├── apps/
│   ├── cli/                    # `devlog` binary
│   └── desktop/
│       ├── src-tauri/          # Tauri Rust backend
│       └── src/                # React/TypeScript frontend
└── docs/
```

## Crate dependency order

```
types  ←  parser  ←  sync  ←  ai
  ↑          ↑        ↑       ↑
  └──────────┴────────┴───────┴── cli
  └──────────┴────────┴───────┴── desktop/src-tauri
```

## Key environment variables (CLI only)

```bash
AI_API_KEY=sk-ant-...
AI_BASE_URL=https://api.anthropic.com
AI_MODEL=claude-sonnet-4-5
```

The desktop app reads from `~/.devlog.yml` (set via Settings UI).

## Database

`~/devlog/devlog.db` is a SQLite file that is always reconstructable:

```bash
devlog sync --rebuild
```

It is gitignored. Never commit it.

## Adding a new Tauri command

1. Add the function to `apps/desktop/src-tauri/src/commands.rs`
2. Register it in the `tauri::generate_handler![]` list in `lib.rs`
3. Add the corresponding TypeScript `invoke()` call in the frontend hook or view

## Adding a new Tauri plugin

1. Add the Rust crate to `[workspace.dependencies]` in the root `Cargo.toml`
2. Add it to `apps/desktop/src-tauri/Cargo.toml` `[dependencies]`
3. Register `.plugin(plugin::init())` in `lib.rs` before `.setup(...)`
4. Add the required permission to `apps/desktop/src-tauri/capabilities/default.json`
5. Add the npm package to `apps/desktop/package.json` and run `pnpm install`

## Running a production build

```bash
cd apps/desktop
pnpm tauri build
```

Output is in `apps/desktop/src-tauri/target/release/bundle/`.
