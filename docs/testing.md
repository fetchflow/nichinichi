# Testing Guide

## Running tests

```bash
# All tests (40 total)
cargo test

# Parser unit tests (25 tests)
cargo test -p nichinichi-parser

# Sync integration tests (3 tests)
cargo test -p nichinichi-sync

# AI unit tests (8 tests)
cargo test -p nichinichi-ai

# Desktop/Tauri command helper tests (7 tests)
cargo test -p nichinichi-desktop
```

## Parser tests

Tests live in each parser module under `#[cfg(test)]`.

- `entry::tests` — 10 tests: entry count, field extraction, type inference
  for all 6 types, approximate timestamps, default org fallback, ID
  determinism
- `goal::tests` — 3 tests: frontmatter parsing, step parsing (done/not-done,
  notes, due dates), progress signal parsing
- `playbook::tests` — 1 test: title, tags, content
- `digest::tests` — 2 tests: digest and AI conversation frontmatter
- `router::tests` — 7 tests: `parse_file` path routing for all 5 file types
  (goals/active, goals/archive, playbooks, digests, daily entries,
  unrecognised) and `extract_date` edge cases

All tests use inline string fixtures or `tempfile::tempdir()` temp files
matching the examples in `CLAUDE.md`.

## Sync tests

Integration tests use `tempfile::tempdir()` to create a real SQLite database
and exercise the full upsert → query round-trip.

- `local_sqlite::tests::upsert_idempotent` — same entry upserted twice → single row
- `local_sqlite::tests::upsert_then_query` — upsert entry, query by date → body matches
- `local_sqlite::tests::fts_search_finds_entry` — upsert entry, raw FTS5 MATCH query → entry found

## AI tests

- `query::tests` — 3 tests: `build_fts_query` sanitization (special char stripping,
  empty query returns `*`, normal terms preserved)
- `stream::tests` — 3 tests: `extract_delta_text` SSE chunk parsing (valid JSON,
  missing `content` field, empty string)
- `save::tests` — 2 tests: `auto_slug` basic conversion and 60-char truncation

## Desktop command helper tests

Pure string-manipulation helpers in `commands.rs` tested without a Tauri runtime:

- `remove_entry_block` — 3 tests: single entry removal, middle entry removal with
  adjacent-entry integrity check (regression for `---` corruption bug), entry with
  detail block
- `replace_entry_block` — 4 tests: adjacent entry preservation (regression), adding
  detail with 7-space indent, stripping detail when `None`, no-match passthrough

## Manual end-to-end test

```bash
# 1. Set up a test repo
mkdir -p /tmp/nichinichi-test
export NICHINICHI_REPO=/tmp/nichinichi-test

# 2. Log an entry
cargo run -p nichinichi-cli -- "fixed the auth bug @acme #solution"

# 3. Sync and verify
cargo run -p nichinichi-cli -- sync
sqlite3 /tmp/nichinichi-test/nichinichi.db "SELECT body, type FROM entries;"

# 4. Ask a question (requires AI_API_KEY)
cargo run -p nichinichi-cli -- ask "when did I fix something"

# 5. Verify file was written
cat /tmp/nichinichi-test/$(date +%Y-%m-%d).md
```
