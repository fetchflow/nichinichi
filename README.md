# Nichinichi

A local-first developer journal and personal knowledge base with an AI layer.

Log daily work from the CLI or desktop app. All data lives as plain markdown files on your filesystem. SQLite is a reconstructable query index — never the source of truth. No login screen, no cloud dependency, no account required.

---

## Features

- **CLI + desktop app** — log entries from the terminal or a native GUI
- **Plain markdown** — all data is human-readable files you own
- **Full-text search** — SQLite FTS5 index across all your entries
- **AI assistant** — ask questions about your own work history using your Anthropic API key
- **Goals tracking** — step-by-step goal files with progress signals; steps and progress are editable in the desktop UI with write-back to markdown; progress entries can reference specific log entries via `refs:`
- **Playbooks** — reusable runbooks stored as markdown; create, edit (split editor with live preview), and delete from the desktop UI
- **Composer chip toolbar** — clickable chips for entry types (`#score`, `#solution`, etc.), custom tags, and workspaces (`@acme`) below the log input; clicking inserts the token at cursor
- **Tags & Workspaces** — create custom tags (with color) and workspaces in Settings; tags appear in the composer chip row alongside built-in types; workspace names appear in both the composer and the org switcher
- **Org filtering** — scope entries and AI queries to a project or client; the sidebar switcher merges explicit workspaces with orgs discovered from entries
- **Private entries** — `.quiet/` files are never indexed or sent to AI
- **Git-native backup** — commit and push `~/nichinichi/` to your own private remote

---

## Stack

| Layer | Technology |
|---|---|
| Backend logic | Rust (workspace with shared crates) |
| Desktop UI | Tauri v2 + React 18 + TypeScript + Tailwind CSS |
| CLI | `nichinichi` binary (clap) |
| Database | SQLite via sqlx (reconstructable index) |
| AI | Anthropic Claude API (SSE streaming) |
| Search | SQLite FTS5 |

---

## Getting started

### Prerequisites

- Rust (stable, 1.77+): `rustup update stable`
- pnpm: `npm install -g pnpm`
- macOS: Xcode command line tools

### CLI

```bash
# Install globally
cargo install --path apps/cli

# Log an entry
nichinichi "fixed the JWT refresh bug @acme #solution"

# Log with type inference (no tag needed)
nichinichi "merged the feature branch @acme"   # → inferred: score

# Ask a question (requires API key in ~/.nichinichi.yml)
nichinichi ask "when did I fix something related to auth"

# Goals
nichinichi goals list
nichinichi goals add "become a staff engineer"
nichinichi goals done "become-staff-engineer"

# Sync / rebuild
nichinichi sync
nichinichi sync --rebuild

# Archive last year's files
nichinichi archive --year 2025
```

### Desktop app

```bash
cd apps/desktop
pnpm install
pnpm tauri dev     # dev mode with hot-reload
pnpm tauri build   # production .app / .exe
```

---

## Configuration

Nichinichi reads `~/.nichinichi.yml` on startup. The desktop Settings UI writes to this file automatically. Settings includes a **Browse** button to pick the nichinichi folder with a native directory picker, and a **Tags & Workspaces** section to manage custom tags (with color) and workspace names.

```yaml
repo: ~/nichinichi        # where your markdown files live
editor: vim           # $EDITOR fallback for CLI

ai:
  base_url: https://api.anthropic.com
  api_key: ""         # enter via Settings UI or set AI_API_KEY env var
  model: claude-sonnet-4-5

default_org: personal
```

**CLI env var fallbacks** (when no config file exists):
```bash
export AI_API_KEY=sk-ant-...
export AI_BASE_URL=https://api.anthropic.com
export AI_MODEL=claude-sonnet-4-5
```

---

## Filesystem layout

```
~/nichinichi/
├── 2026-03-17.md          # daily entry files
├── .quiet/                # private entries — never indexed, never AI
│   └── 2026-03-17.md
├── goals/
│   ├── active/
│   │   └── become-staff-engineer.md
│   └── archive/
│       └── 2025-learn-typescript.md
├── playbooks/
│   └── debugging-memory-leaks.md
├── digests/               # AI-generated weekly/monthly reviews
│   └── 2026-03-17-weekly.md
├── ai/                    # saved AI conversations (opt-in)
│   └── 2026-03-17-jwt-refresh-pattern.md
├── archive/
│   └── 2025/              # previous years' daily files
├── nichinichi.db              # SQLite index (gitignored, always reconstructable)
└── .nichinichi.yml            # project-level org override
```

### Entry format

```markdown
# 2026-03-17

---
09:05 | picking up the auth refactor @acme #log
---
11:32 | jwt refresh swallowing errors — fixed @acme #solution

       Root cause: expiry check after decode, not before
       Fix: move expiry check to top of middleware
---
16:48 | fixed, merged, Sarah unblocked @acme #score
---
```

**Entry syntax:** `HH:MM | body @org #type #extra-tags`

Known types: `log`, `solution`, `decision`, `reflection`, `score`, `ai`

If no type tag is given, the type is inferred from keywords in the body.

---

## Codebase structure

```
nichinichi-mark-02/
├── Cargo.toml                   # Cargo workspace root (resolver = "2")
├── crates/
│   ├── types/                   # Shared structs: ParsedEntry, Goal, Config…
│   ├── parser/                  # Markdown parsers — entries, goals, playbooks, digests
│   ├── sync/                    # SQLite writer, file watcher, SyncTarget trait
│   └── ai/                      # FTS5 query builder, Claude SSE client, conversation save
├── apps/
│   ├── cli/                     # `nichinichi` binary
│   └── desktop/
│       ├── src-tauri/           # Tauri Rust backend (commands, tray, file watcher)
│       └── src/                 # React/TypeScript frontend
└── docs/
    ├── development.md
    ├── file-formats.md
    └── testing.md
```

### Crate dependency graph

```
types  ←  parser  ←  sync  ←  ai
  ↑          ↑        ↑       ↑
  └──────────┴────────┴───────┴── cli
  └──────────┴────────┴───────┴── desktop/src-tauri
```

---

## Development

```bash
# Check everything compiles
cargo check

# Run all tests (19 tests)
cargo test

# Run parser tests specifically
cargo test -p nichinichi-parser

# Run the CLI
cargo run -p nichinichi-cli -- "text @org #type"
```

See [docs/development.md](docs/development.md) for the full guide and [docs/testing.md](docs/testing.md) for the test strategy.

---

## Key design decisions

- **Markdown is the source of truth** — SQLite is always reconstructable via `nichinichi sync --rebuild`
- **`nichinichi.db` is gitignored** — back up your data by committing the markdown files
- **`.quiet/` is enforced in the watcher and rebuild**, not just the UI
- **`SyncTarget` trait** provides the seam for a future cloud sync backend without touching CLI or Tauri commands
- **Goal write-back** — UI changes write to the `.md` file first, SQLite second
- **No auth in Phase 1** — the app opens directly to the dashboard

---

## Backup and sync

Commit and push `~/nichinichi/` (excluding `nichinichi.db`) to a private git remote:

```bash
cd ~/nichinichi
git init
echo "nichinichi.db" >> .gitignore
git add .
git commit -m "initial"
git remote add origin git@github.com:you/nichinichi-private.git
git push -u origin main
```

On a new machine: clone the repo, run `nichinichi sync --rebuild` to reconstruct the database.
