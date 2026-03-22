# Demo Data

This directory contains a pre-populated devlog repository for demonstrating all features
of the DevLog app. It includes realistic entries, goals, playbooks, digests, and saved
AI conversations — all in the correct markdown format.

## Setup

### Option 1: CLI

```bash
# Point devlog at the demo repo
export DEVLOG_REPO=/absolute/path/to/devlog-mark-02/demo/devlog

# Rebuild the SQLite index from the demo files
cargo run -p devlog-cli -- sync --rebuild

# Try a query
cargo run -p devlog-cli -- ask "what decisions did I make about auth"
```

### Option 2: Desktop app

1. Open the app and go to **Settings**
2. Set **Repo path** to the absolute path of `demo/devlog/` in this repository
3. Click **Rebuild index**
4. Navigate to the Dashboard — all data will load

Or set it in `~/.devlog.yml`:

```yaml
repo: /absolute/path/to/devlog-mark-02/demo/devlog
```

## What's included

| Feature | Demo content |
|---|---|
| All 6 entry types | log, solution, decision, reflection, score, ai |
| Two orgs | @acme (work), @personal (side projects) |
| Type inference | 2026-03-12 entries have no explicit #type tags |
| Approximate timestamps | `~14:30` in 2026-03-19 |
| Detail blocks | solution and decision entries with multi-line context |
| Active goals | staff engineer (career, @acme), distributed systems (learning, paused) |
| Archived goal | learn TypeScript (done, with completion_date) |
| All progress signals | breakthrough → strong → steady → moderate → struggling → quiet |
| Progress entry refs | `refs:` in become-staff-engineer.md links specific log entries to progress updates |
| Playbooks | memory leaks, feature checklist, incident runbook |
| Digests | weekly, monthly, quarterly review |
| Saved AI conversations | jwt bug query, auth decisions query |
| Private entries | `.quiet/2026-03-21.md` — never appears in any view |
| Archived entries | `archive/2025/` — year-end entries, still searchable |
| Heatmap data | 13 days across 3 weeks with varying density |

## Returning to your real data

Change `repo:` back to `~/devlog` (or your actual repo path) in `~/.devlog.yml`
or the Settings UI, then run **Rebuild index** again.
