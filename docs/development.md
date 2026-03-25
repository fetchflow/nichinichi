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
cargo run -p nichinichi-cli -- --help

# Run parser tests
cargo test -p nichinichi-parser

# Run sync tests (requires temp SQLite)
cargo test -p nichinichi-sync

# Start the desktop app (hot-reload)
cd apps/desktop
pnpm install
pnpm tauri dev
```

## Repository structure

```
nichinichi/
├── Cargo.toml                  # Workspace root (resolver = "2")
├── crates/
│   ├── types/                  # Shared domain structs (ParsedEntry, Goal, ChatMessage…)
│   ├── parser/                 # Markdown parsers
│   ├── sync/                   # SQLite + file watcher
│   └── ai/                     # FTS5 search + OpenAI-compatible SSE streaming
│                               #   + conversation save / load / list
├── apps/
│   ├── cli/                    # `nichinichi` binary
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
AI_API_KEY=...                         # API key for your AI provider
AI_BASE_URL=http://localhost:11434     # Ollama default; Open WebUI default is http://localhost:3000
AI_MODEL=llama3.2
```

The desktop app reads from `~/.nichinichi.yml` (configured via Settings UI). Environment variables are only used as a fallback when no config file exists.

## AI provider routing

The `crates/ai` crate routes requests based on `AiConfig.provider` (`AiProvider::Ollama` or `AiProvider::Openwebui`):

| Provider | Chat endpoint | Model list endpoint |
|---|---|---|
| `Ollama` (default) | `/v1/chat/completions` | `/v1/models` (fallback: `/api/tags`) |
| `Openwebui` | `/api/chat/completions` | `/api/models` |

`AiProvider` uses `#[serde(default)]` so existing `~/.nichinichi.yml` files without a `provider` field continue to work (defaults to Ollama).

## Database

`~/nichinichi/nichinichi.db` is a SQLite file that is always reconstructable:

```bash
nichinichi sync --rebuild
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

Output is in `target/release/bundle/` (at the Cargo workspace root, not inside `apps/desktop`).
