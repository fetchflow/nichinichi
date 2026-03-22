# Testing Guide

## Running tests

```bash
# All tests
cargo test

# Parser unit tests (17 tests)
cargo test -p nichinichi-parser

# Sync integration tests
cargo test -p nichinichi-sync

# AI unit tests (slug generation)
cargo test -p nichinichi-ai
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

All tests use inline string fixtures matching the examples in `CLAUDE.md`.

## Sync tests

Integration tests use `tempfile::tempdir()` to create a real SQLite database
and exercise the full upsert → query round-trip.

Planned tests:
- Upsert idempotency: same entry twice → single row
- Rebuild: clears all rows and repopulates from fixtures
- FTS5: `search_entries()` returns expected entries

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
