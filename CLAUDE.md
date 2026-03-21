# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

---

## Project Overview

**DevLog** is a local-first developer personal knowledge base and journal
with an AI layer. Developers log daily activities via CLI or desktop app.
All data lives as markdown files on the local filesystem. SQLite is a
reconstructable query index — never the source of truth. There is no
login screen and no network dependency for core features.

---

## Tiers

### Free tier (MVP — what this codebase implements)
- No authentication, no account required
- All data local: markdown files + SQLite
- FTS via SQLite FTS5
- AI via user-supplied API key (entered in Settings UI, saved to
  `~/.devlog.yml`)
- Git is the backup and multi-machine sync mechanism
- The app opens directly to the dashboard — no login gate

### Cloud tier (Phase 2 — architecture prepared, not yet built)
- Supabase auth (email + GitHub OAuth)
- Delta sync from local SQLite to Supabase
- Cloud FTS via Postgres
- Optional cloud AI (user doesn't need own key)
- The seam lives in the `sync` crate via the `SyncTarget` trait —
  swapping in `SupabaseSync` must not require changes to Tauri commands
  or CLI commands

---

## Stack

- All backend logic (parser, sync, AI, CLI) is **Rust**
- Desktop UI is **Tauri v2** (Rust backend + React/TypeScript/Tailwind
  frontend)
- The `devlog` CLI binary and Tauri desktop app share the same Rust
  crates
- No separate web server, no Python packages, no Node.js backend

---

## Repository Structure

```
devlog/
├── Cargo.toml                   # Cargo workspace root (resolver = "2")
├── crates/
│   ├── types/                   # Shared structs: ParsedEntry, Goal,
│   │                            #   GoalStep, Config, EntryType, OrgScope
│   ├── parser/                  # All markdown parsers — fully tested
│   │                            #   entries, goals, playbooks, digests
│   ├── sync/                    # SQLite writer + file watcher + rebuild
│   │                            #   SyncTarget trait (Local impl only)
│   └── ai/                      # FTS5 query builder + Claude SSE stream
├── apps/
│   ├── cli/                     # `devlog` binary — clap
│   └── desktop/                 # Tauri v2 desktop app
│       ├── src-tauri/
│       │   ├── Cargo.toml
│       │   └── src/
│       │       ├── lib.rs       # Tauri setup: plugins, tray, file watcher
│       │       ├── main.rs
│       │       └── commands.rs  # All Tauri IPC commands
│       ├── src/
│       │   ├── App.tsx          # Root: section routing (no auth gate)
│       │   ├── types/           # TypeScript types (Entry, Goal, Theme…)
│       │   ├── hooks/           # useEntries, useGoals, useTheme, useOrg
│       │   ├── views/           # DashboardView, LogView, GoalsView,
│       │   │                    #   PlaybooksView, ReportsView, SettingsView
│       │   └── components/      # feed/, composer/, stats/, ai/, graphs/,
│       │                        #   Skeleton.tsx
│       └── package.json         # pnpm
├── docs/
│   ├── development.md
│   ├── file-formats.md          # Canonical format for all markdown files
│   └── testing.md
├── .gitignore                   # includes devlog.db
└── package.json                 # pnpm workspace root
```

---

## Crate Dependency Graph

```
types  ←  parser  ←  sync  ←  ai
  ↑          ↑        ↑       ↑
  └──────────┴────────┴───────┴── cli (binary)
  └──────────┴────────┴───────┴── desktop/src-tauri (Tauri binary)
```

---

## Commands

```bash
# Rust (Cargo workspace root)
cargo build
cargo test
cargo test -p devlog-parser          # parser unit tests
cargo test -p devlog-sync            # sync + SQLite tests
cargo run -p devlog-cli -- "text"    # run CLI in dev mode
cargo install --path apps/cli        # install `devlog` globally

# Desktop (apps/desktop/)
cd apps/desktop && pnpm install
pnpm tauri dev                       # dev mode — hot-reload frontend + Rust
pnpm tauri build                     # production .app / .exe
```

---

## Filesystem Layout (user data)

```
~/devlog/
│
├── YYYY-MM-DD.md              # daily entries (current year, root level)
├── .quiet/
│   └── YYYY-MM-DD.md          # private entries — never indexed, never AI
│
├── goals/
│   ├── active/                # status: active or paused
│   │   ├── become-staff-engineer.md
│   │   └── distributed-systems.md
│   └── archive/               # status: done or abandoned
│       └── 2025-learn-typescript.md
│
├── playbooks/
│   ├── debugging-memory-leaks.md
│   └── new-feature-checklist.md
│
├── digests/                   # AI-generated weekly/monthly/review outputs
│   ├── 2026-03-17-weekly.md
│   ├── 2026-03-31-monthly.md
│   └── 2026-Q1-review.md
│
├── ai/                        # saved AI conversations (opt-in capture)
│   └── 2026-03-17-jwt-refresh-pattern.md
│
├── archive/
│   └── 2025/                  # previous years' daily files
│       ├── 2025-01-03.md
│       └── ...
│
├── devlog.db                  # SQLite index — GITIGNORED, fully reconstructable
└── .devlog.yml                # user config (AI key, editor, default org…)
```

**`devlog.db` is gitignored.** It is always reconstructable by running
`devlog sync --rebuild`. The markdown files are the only data that needs
to be backed up. Users commit and push `~/devlog/` (excluding `devlog.db`)
to their own private git remote.

---

## File Formats

### Daily entry file (`YYYY-MM-DD.md`)

```markdown
# 2026-03-17

---
09:05 | picking up the auth refactor @acme #log
---
11:32 | jwt refresh swallowing errors — fixed @acme #solution

       Root cause: expiry check after decode, not before
       Fix: move expiry check to top of middleware
       Time lost: 2hrs. Check expiry BEFORE decode, always.
---
14:15 | claude suggested localStorage — rejected, xss risk @acme #ai
---
16:48 | fixed, merged, Sarah unblocked @acme #score
---
17:30 | slow morning but strong finish #reflection
---
```

### Goal file (`goals/active/slug.md`)

```markdown
---
type: career
org: acme
horizon: end of 2027
status: active
why: want to lead technical direction, not just implement
created: 2026-01-05
---

# become a staff engineer

## steps

- [x] mentor a junior through a full feature end to end
      notes: David's auth PR — Mar 2026
- [ ] lead a cross-team technical initiative
      notes: devlog platform counts — spans 3 projects
- [ ] write and publish a technical design doc
      due: 2026-06-01

## progress

### 2026-03-17
signal: strong
note: Strong impact signal this week. Shipping with measurable outcomes
and documented decisions are exactly the staff-level evidence to
accumulate.

### 2026-03-10
signal: moderate
note: One mentorship entry. Early signal in the right direction.
```

### Digest file (`digests/YYYY-MM-DD-type.md`)

```markdown
---
type: weekly
period_start: 2026-03-11
period_end: 2026-03-17
entries: 19
org: null
generated: 2026-03-17T18:00:00
---

3 score entries this week — solid delivery. 4 decisions logged,
3 with explicit reasoning. Entry count up 2 from last week...
```

### Saved AI conversation (`ai/YYYY-MM-DD-slug.md`)

```markdown
---
type: ai-conversation
date: 2026-03-17
query: when did i fix a jwt bug
org: acme
---

**you:** when did i fix a jwt bug

**devlog:** Based on your entries: jwt refresh bug fixed March 17...
```

### Playbook file (`playbooks/slug.md`)

```markdown
---
title: debugging node.js memory leaks
tags: [node, memory]
forked_from: null
org: null
created: 2026-02-10
---

## steps

1. Run `node --inspect` and open Chrome DevTools Memory tab
2. Take heap snapshot before and after suspected leak
3. Compare retained objects — look for detached DOM nodes or closures
...
```

### Config file (`~/.devlog.yml`)

```yaml
repo: ~/devlog
editor: vim           # $EDITOR fallback

ai:
  base_url: https://api.anthropic.com
  api_key: sk-ant-...          # entered via Settings UI, saved here
  model: claude-sonnet-4-5

# default org for entries with no @org tag and no project .devlog.yml
default_org: personal

# project-level .devlog.yml (in any project root)
# project: api-refactor
# org: acme
```

---

## Parser Rules (`crates/parser`)

### Entry parser

- File header: `# YYYY-MM-DD`
- Entry delimiter: `---` on its own line (opens and closes each entry)
- Entry first line: `HH:MM | body text @org #type #extra-tags`
- Approximate timestamp: `~HH:MM` — stored with `approximate: true`
- `@word` → `org` field (first `@mention` wins; overrides `.devlog.yml`
  default)
- `#word` → type tag if it matches a known type, otherwise pushed to
  `tags[]`
- Known types: `log`, `solution`, `decision`, `reflection`, `score`, `ai`
- If no type tag: infer from body keywords (see type inference rules below)
- Detail block: indented lines below the first line (optional)
- Idempotent upsert key: `(date, time, body)` — no `user_id` in local mode

### Type inference rules

```
body contains "fixed","solved","workaround","the fix"  → solution
body contains "chose","decided","rejected","picked"    → decision
body contains "clicked","realised","learned","finally" → reflection
body contains "shipped","merged","closed","unblocked"  → score
body contains "claude","gpt","ai","prompt","copilot"   → ai
else                                                    → log
```

### Goal parser

- YAML frontmatter block between `---` delimiters
- `## steps` section: `- [ ]` / `- [x]` checkboxes
- Step metadata (notes, due) as indented key-value lines below each step
- `## progress` section: `### YYYY-MM-DD` subsections with `signal:` and
  `note:` fields
- Signal values: `breakthrough`, `strong`, `steady`, `moderate`,
  `struggling`, `quiet`

### Digest / AI conversation parser

- YAML frontmatter only; body is raw markdown content
- Indexed into SQLite `digests` table for dashboard queries
- Body stored verbatim — not re-parsed for entries

### Org resolution order (for any file)

1. Inline `@org` tag in the entry line
2. `org:` in the nearest `.devlog.yml` walking up from `process.cwd()`
3. `default_org` in `~/.devlog.yml`
4. `null` (unscoped / personal)

---

## SQLite Schema (`~/devlog/devlog.db`)

This database is **always reconstructable** from the markdown files via
`devlog sync --rebuild`. Never treat it as a source of truth.
It is gitignored.

```sql
-- entries (reconstructed from daily markdown files)
CREATE TABLE entries (
  id          TEXT PRIMARY KEY,  -- sha256 of (date || time || body)
  date        TEXT NOT NULL,
  time        TEXT NOT NULL,
  body        TEXT NOT NULL,
  detail      TEXT,
  type        TEXT CHECK(type IN
                ('log','solution','decision','reflection','score','ai')),
  tags        TEXT DEFAULT '[]',  -- JSON array
  project     TEXT,
  org         TEXT,               -- from @mention or .devlog.yml
  approximate INTEGER DEFAULT 0,
  raw_line    TEXT,
  source      TEXT DEFAULT 'sync',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- FTS5 index (reconstructed alongside entries)
CREATE VIRTUAL TABLE entries_fts USING fts5(
  body, detail, project, org, tags,
  content='entries',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, body, detail, project, org, tags)
  VALUES (new.rowid, new.body, new.detail, new.project, new.org, new.tags);
END;
CREATE TRIGGER entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, body, detail, project, org, tags)
  VALUES ('delete', old.rowid, old.body, old.detail, old.project, old.org, old.tags);
END;
CREATE TRIGGER entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, body, detail, project, org, tags)
  VALUES ('delete', old.rowid, old.body, old.detail, old.project, old.org, old.tags);
  INSERT INTO entries_fts(rowid, body, detail, project, org, tags)
  VALUES (new.rowid, new.body, new.detail, new.project, new.org, new.tags);
END;

-- goals (reconstructed from goals/active/*.md and goals/archive/*.md)
CREATE TABLE goals (
  id          TEXT PRIMARY KEY,   -- slug from filename
  title       TEXT NOT NULL,
  type        TEXT CHECK(type IN ('career','learning')),
  horizon     TEXT,
  status      TEXT CHECK(status IN ('active','paused','done','abandoned'))
              DEFAULT 'active',
  why         TEXT,
  org         TEXT,
  file_path   TEXT NOT NULL,
  created_at  TEXT,
  updated_at  TEXT
);

-- goal steps (reconstructed from goal file ## steps section)
CREATE TABLE goal_steps (
  id          TEXT PRIMARY KEY,   -- sha256 of (goal_id || title)
  goal_id     TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  status      TEXT CHECK(status IN ('not_started','in_progress','done'))
              DEFAULT 'not_started',
  notes       TEXT,
  due_date    TEXT,
  position    INTEGER NOT NULL
);

-- goal step ↔ entry links (set via UI, written back to goal markdown)
CREATE TABLE goal_step_entries (
  step_id     TEXT REFERENCES goal_steps(id) ON DELETE CASCADE,
  entry_id    TEXT REFERENCES entries(id) ON DELETE CASCADE,
  PRIMARY KEY (step_id, entry_id)
);

-- goal progress (reconstructed from goal file ## progress section)
CREATE TABLE goal_progress (
  id           TEXT PRIMARY KEY,
  goal_id      TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  signal       TEXT CHECK(signal IN
                 ('breakthrough','strong','steady','moderate',
                  'struggling','quiet')),
  note         TEXT,
  created_at   TEXT
);

-- playbooks (reconstructed from playbooks/*.md)
CREATE TABLE playbooks (
  id          TEXT PRIMARY KEY,   -- slug from filename
  title       TEXT NOT NULL,
  content     TEXT,               -- full markdown body
  tags        TEXT DEFAULT '[]',  -- JSON array
  org         TEXT,
  forked_from TEXT,
  file_path   TEXT NOT NULL,
  updated_at  TEXT
);

-- digests (reconstructed from digests/*.md)
CREATE TABLE digests (
  id           TEXT PRIMARY KEY,
  type         TEXT CHECK(type IN ('weekly','monthly','review')),
  content      TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  entry_count  INTEGER,
  org          TEXT,
  file_path    TEXT NOT NULL,
  created_at   TEXT
);

-- goal suggestions (AI-generated, ephemeral — NOT written to markdown)
-- Cleared on rebuild. User accepts (→ appended to goal .md) or dismisses.
CREATE TABLE goal_suggestions (
  id          TEXT PRIMARY KEY,
  goal_id     TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT CHECK(status IN ('pending','accepted','dismissed'))
              DEFAULT 'pending',
  created_at  TEXT DEFAULT (datetime('now'))
);

-- settings (UI state — NOT reconstructed from markdown)
-- Cleared on rebuild with sensible defaults restored.
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Keys: theme, active_org, window_width, window_height,
--       autostart, last_sync_at

-- indexes
CREATE INDEX entries_date  ON entries(date);
CREATE INDEX entries_type  ON entries(type);
CREATE INDEX entries_org   ON entries(org);
CREATE INDEX entries_proj  ON entries(project);
CREATE INDEX goals_status  ON goals(status);
CREATE INDEX goals_org     ON goals(org);
CREATE INDEX digests_type  ON digests(type);
```

---

## Architecture

### Data flow (CLI)

```
devlog "text @acme #solution"
  → resolves org from @mention or nearest .devlog.yml
  → appends entry to ~/devlog/YYYY-MM-DD.md
  → triggers sync: parser reads file → upserts to SQLite
```

### Data flow (Desktop)

```
Frontend invoke()
  → Tauri command (Rust)
  → same parser/sync/ai crates
  → reads/writes markdown files
  → upserts to SQLite
  → returns result to frontend
```

### Sync / rebuild flow

```
devlog sync --rebuild
  → drops all reconstructable tables (entries, goals, playbooks,
    digests, goal_steps, goal_progress, goal_step_entries)
  → walks ~/devlog/ recursively (excluding .quiet/, devlog.db)
  → parses every .md file by type (daily | goal | playbook | digest | ai)
  → upserts all parsed records into SQLite
  → rebuilds FTS5 index
  → preserves: goal_suggestions, settings (non-reconstructable)
```

### File watcher

Spawned as a tokio background task in `lib.rs::start_file_watcher`.
Uses a dedicated `std::thread` for the blocking `notify` event loop,
forwarding triggers via `tokio::sync::mpsc` channel (capacity 1,
`try_send` deduplicates rapid saves). Excludes `.quiet/` and
`devlog.db`. On change: re-parses the affected file and upserts to
SQLite. Does not require a full rebuild for single-file changes.

### AI streaming

- CLI: SSE chunks printed to stdout as they arrive
- Desktop: Rust emits `ai-chunk` / `ai-done` Tauri events →
  frontend `listen()`s and appends to conversation
- Queries use SQLite FTS5 (`MATCH` queries) to build context
- `.quiet/` entries never included in AI context under any circumstances
- Org filter applied to AI queries when an org is active

### Save AI conversation (opt-in)

When the user saves an AI conversation (CLI flag or desktop button):
- Rust writes a new file to `~/devlog/ai/YYYY-MM-DD-slug.md`
- File watcher picks it up and indexes it into SQLite
- Slug auto-generated from the query text (lowercase, hyphenated,
  truncated to 60 chars) unless user provides one

### Write-back (UI → markdown)

When the user modifies a goal's steps, progress, or metadata via the
desktop UI, the Tauri command writes the change back to the goal's
`.md` file directly. SQLite is updated in the same transaction.
The file watcher debounces to avoid re-parsing a file that was just
written by the app itself (skip if modified_by == 'app').

### System tray

Built via `tauri::tray::TrayIconBuilder` (requires `tray-icon`
feature). Menu: Sync now, Quit. Left-click shows/focuses the window.

### Auto-launch

`tauri-plugin-autostart` with `MacosLauncher::LaunchAgent`. Toggle in
Settings UI (saved to `settings` table). Only functional in bundled
builds. `bundle.active: false` in `tauri.conf.json` for dev.

### Skeleton loading states

`Skeleton.tsx` (`SkeletonRow`, `SkeletonBlock`) + `.skeleton` CSS class
with `skeleton-pulse` keyframe in `globals.css`. Used in Feed, Stats,
Goals, Dashboard graphs.

---

## SyncTarget Trait (Phase 2 seam)

Define this in `crates/sync` now. Only `LocalSqlite` is implemented in
Phase 1. When cloud sync arrives, `SupabaseSync` implements the same
trait without touching Tauri commands or CLI.

```rust
#[async_trait]
pub trait SyncTarget: Send + Sync {
    async fn upsert_entry(&self, entry: &ParsedEntry) -> Result<()>;
    async fn upsert_goal(&self, goal: &Goal) -> Result<()>;
    async fn upsert_playbook(&self, playbook: &Playbook) -> Result<()>;
    async fn upsert_digest(&self, digest: &Digest) -> Result<()>;
    async fn delete_entry(&self, id: &str) -> Result<()>;
    async fn rebuild(&self) -> Result<()>;
}

pub struct LocalSqlite {
    pub pool: SqlitePool,  // sqlx or rusqlite pool
}

// Phase 2 (not implemented):
// pub struct SupabaseSync { ... }
```

---

## Org Filtering

Orgs are discovered dynamically — no registry needed. The parser
extracts all distinct `org` values encountered across all markdown
files and surfaces them as filter options in the UI.

**UI behaviour:**
- Org switcher in the top bar: All / Personal / [detected orgs]
- Defaults to All, persisted in `settings` table as `active_org`
- Dashboard stats, graphs, heatmap, goals snapshot all respect the
  active org filter
- AI ask panel searches only the active org's entries (or all if All)
- Log feed shows an org pill on each entry card alongside the project
  pill

**CLI behaviour:**
- `devlog ask "query" --org acme` overrides active org for that query
- Org inferred from working directory `.devlog.yml` when not specified

---

## Goal Lifecycle

```
goals/active/slug.md   (status: active | paused)
       ↓  mark done or abandoned via UI or CLI
goals/archive/slug.md  (status: done | abandoned, completion_date added)
```

When a goal is archived:
1. Tauri command renames/moves the file from `goals/active/` to
   `goals/archive/`
2. Adds `completion_date: YYYY-MM-DD` to the frontmatter
3. Updates SQLite `goals.status` and `goals.file_path`

When a goal suggestion is accepted:
1. New step appended to the `## steps` section of the goal `.md` file
2. SQLite `goal_steps` updated
3. `goal_suggestions` row status set to `accepted`

---

## Archive (daily files)

Daily entry files accumulate in the `~/devlog/` root during their
active year. Year rollover is triggered by:
- `devlog archive --year 2025` (explicit)
- Automatically on first launch of a new year (with confirmation prompt)

Archive moves files: `~/devlog/2025-*.md` → `~/devlog/archive/2025/`

The file watcher and parser recurse into `archive/` — archived entries
remain fully searchable. Archiving is organisational only; nothing is
deleted.

---

## Key Crates

```toml
# All crates
serde            = { version = "1",    features = ["derive"] }
serde_json       = "1"
serde_yaml       = "0.9"
tokio            = { version = "1",    features = ["full"] }
thiserror        = "1"       # library crates only
anyhow           = "1"       # binary crates (cli, desktop/src-tauri) only
chrono           = { version = "0.4",  features = ["serde"] }
dirs             = "5"

# parser
sha2             = "0.10"    # entry ID generation

# sync
sqlx             = { version = "0.8", features = ["sqlite", "runtime-tokio",
                   "chrono", "migrate"] }
notify           = "6"
notify-debouncer-mini = "0.4"

# ai
reqwest          = { version = "0.12", features = ["json", "stream"] }
futures          = "0.3"

# cli
clap             = { version = "4",    features = ["derive"] }
colored          = "2"

# desktop/src-tauri
tauri            = { version = "2",    features = ["tray-icon"] }
tauri-plugin-autostart = "2"
open             = "5"
urlencoding      = "2"
```

**Note:** `sqlx` with the `sqlite` feature replaces the previous
`rusqlite` direct usage. Use `sqlx::SqlitePool` with
`tokio::task::spawn_blocking` where blocking calls are unavoidable.
Migrations live in `crates/sync/migrations/`.

---

## Config (`~/.devlog.yml`)

```yaml
repo: ~/devlog
editor: vim          # $EDITOR fallback

ai:
  base_url: https://api.anthropic.com  # or Ollama, LiteLLM, Open WebUI
  api_key: ""                          # entered via Settings UI
  model: claude-sonnet-4-5

default_org: personal                  # fallback when no @org and no
                                       # project .devlog.yml
```

AI key is entered once in the Settings UI and written to this file.
No environment variables required for normal desktop use. CLI falls
back to `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` env vars if the
config file is absent.

---

## Environment Variables (CLI fallback only)

```bash
AI_BASE_URL=https://api.anthropic.com
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-5
```

These are only needed for CLI use without a `~/.devlog.yml`. The
desktop app always reads from the config file.

---

## Key Decisions

- Cargo workspace `resolver = "2"` — required for Tauri v2
- `thiserror` in library crates, `anyhow` in binary crates only
- `sqlx` (not `rusqlite`) for async-native SQLite access
- SQLite is a reconstructable query index — markdown files are the
  source of truth for all entries, goals, playbooks, and digests
- `devlog.db` is gitignored — reconstruction via `devlog sync --rebuild`
  is the recovery path on any new machine
- `goal_suggestions` and `settings` are the only SQLite-only data —
  they are not written to markdown and are cleared on rebuild
- `@org` tags are first-class parsed fields, not stored in `tags[]`
- Orgs are discovered dynamically from file content — no org registry
- `SyncTarget` trait defined now with only `LocalSqlite` implemented —
  `SupabaseSync` will implement the same trait in Phase 2 with no
  changes to commands or CLI
- Goal write-back: UI changes to goals are written to the `.md` file
  first, SQLite second — file is always authoritative
- File watcher skips re-parsing files modified by the app itself
  (write-back guard) to avoid parse→write→parse loops
- `tauri::Manager` must be in scope to call `get_webview_window`
- `tauri::Emitter` must be in scope to call `app.emit()`
- File watcher uses `std::thread` for blocking notify loop +
  `tokio::sync::mpsc` for async bridge
- `bundle.active: false` in `tauri.conf.json` for dev; autostart
  requires a bundled build
- No authentication in Phase 1 — app opens directly to dashboard
- `.quiet/` entries are never indexed, never sent to AI, never synced
  under any circumstances — this is enforced in the file watcher and
  the sync rebuild, not just the UI
