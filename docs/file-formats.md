# File Formats

All user data lives as plain markdown files in `~/nichinichi/`. The SQLite
database is always reconstructable from these files.

## Daily entry file (`YYYY-MM-DD.md`)

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

**Rules:**
- Header: `# YYYY-MM-DD`
- Entry delimiter: `---` on its own line
- First line: `HH:MM | body @org #type #tags`
- Approximate time: `~HH:MM`
- `@word` → org field (first mention wins)
- `#word` → type if known, else pushed to tags
- Known types: `log`, `solution`, `decision`, `reflection`, `score`, `ai`
- Indented lines below the first line → `detail` block

**Type inference (if no type tag):**

| Body contains | Inferred type |
|---|---|
| fixed, solved, workaround, the fix | solution |
| chose, decided, rejected, picked | decision |
| clicked, realised, learned, finally | reflection |
| shipped, merged, closed, unblocked | score |
| claude, gpt, ai, prompt, copilot | ai |
| (none of the above) | log |

## Goal file (`goals/active/slug.md`)

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
      notes: nichinichi platform counts — spans 3 projects
- [ ] write and publish a technical design doc
      due: 2026-06-01

## progress

### 2026-03-17
signal: strong
note: Strong impact signal this week. Shipping with measurable outcomes
and documented decisions are exactly the staff-level evidence to accumulate.
refs: [2026-03-17 11:32, 2026-03-17 16:48]

### 2026-03-10
signal: moderate
note: One mentorship entry. Early signal in the right direction.
```

**Frontmatter fields:** `type` (career|learning), `org`, `horizon`, `status`
(active|paused|done|abandoned), `why`, `created`, `completion_date` (added on
archive)

**Progress signals:** `breakthrough`, `strong`, `steady`, `moderate`,
`struggling`, `quiet`

**`refs:`** optional list of log entry timestamps (`YYYY-MM-DD HH:MM`) linking
specific daily entries to a progress update. The desktop UI shows the entry
body inline next to each ref. Refs are written as `refs: [2026-03-17 11:32, 2026-03-17 16:48]`
and match the `date` + `time` columns in the entries table.

## Playbook file (`playbooks/slug.md`)

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
...
```

## Digest file (`digests/YYYY-MM-DD-type.md`)

```markdown
---
type: weekly
period_start: 2026-03-11
period_end: 2026-03-17
entries: 19
org: null
generated: 2026-03-17T18:00:00
---

3 score entries this week — solid delivery...
```

## Saved AI conversation (`ai/YYYY-MM-DD-slug.md`)

Conversations are **auto-saved** after every AI response and can be browsed, resumed, renamed, archived, or deleted from the history panel in the desktop app.

```markdown
---
type: ai-conversation
date: 2026-03-17
query: when did i fix a jwt bug
org: acme
---

**you:** when did i fix a jwt bug

**nichinichi:** Based on your entries: jwt refresh bug fixed March 17...

**you:** what about the refresh token specifically?

**nichinichi:** Looking more closely at your entries from that day...
```

**Frontmatter fields:**
- `query` — first user message (used as the conversation title; updated when renamed via the UI)
- `org` — active org filter at the time the conversation was started
- `date` — date the conversation was first saved

The body serializes all turns as `**you:**` / `**nichinichi:**` blocks so conversations can be fully reconstructed and resumed.

Archived conversations are moved to `ai/archive/`.

## AI entry proposal (`nichinichi-entry` code block)

When the AI is asked to create a journal entry, it responds with a fenced code block using the `nichinichi-entry` language tag:

````markdown
```nichinichi-entry
fixed auth middleware bug, moved expiry check before decode @acme #solution
```
````

The desktop chat panel intercepts this tag and renders an interactive entry card instead of a plain code block. Clicking **Add to journal** calls the `add_entry` Tauri command with the block content as the entry text; the timestamp is set to the current time automatically.

**Format inside the block:** `body text @org #type #extra-tags` — same as the CLI entry format. The `@org` and `#type` fields are optional; the AI infers them from context or leaves them out if unspecified.

## Config file (`~/.nichinichi.yml`)

```yaml
repo: ~/nichinichi
editor: vim

ai:
  base_url: https://api.anthropic.com
  api_key: sk-ant-...
  model: claude-sonnet-4-5

default_org: personal
```

## Private entries (`.quiet/`)

Files in `~/nichinichi/.quiet/` are **never** indexed, never sent to AI, and
never included in sync. This is enforced in the file watcher and rebuild,
not just the UI.
