# AI Chat

The desktop app includes a persistent AI chat panel powered by any OpenAI-compatible backend (Ollama, Open WebUI, LiteLLM, a hosted API, etc.).

---

## Setup

In **Settings → AI Settings**:

1. **Provider** — choose **Ollama** (default) or **Open WebUI**. This controls which endpoint paths are used; the Base URL auto-fills with the canonical default when switching.
2. **Base URL** — URL of your AI backend (no path suffix).
3. **Model** — click **↻** to load available models from the backend, then select one. Changing the model takes effect immediately — no Save required.
4. **API Key** — click **Save** to persist the key (and the current base URL) to `~/.nichinichi.yml`.

| Provider | Default Base URL | Chat endpoint |
|---|---|---|
| Ollama | `http://localhost:11434` | `{base_url}/v1/chat/completions` |
| Open WebUI | `http://localhost:3000` | `{base_url}/api/chat/completions` |

Open WebUI can also proxy cloud models (Anthropic, OpenAI, etc.) through the same interface.

---

## Opening the panel

Click the sparkle icon (✦) in the top-right of the header bar to toggle the panel open or closed. The panel opens on the right side of the main content area.

**Resize**: drag the left edge of the panel to adjust its width (minimum 240 px, maximum 640 px).

---

## Chat interface

### Sending a message

Type in the textarea at the bottom of the panel:

- **Enter** — send the message
- **Shift+Enter** — insert a newline
- The textarea auto-expands as you type

The active model is set in **Settings → AI Settings** and applies to all queries. Change it at any time — no Save required.

### What Nichinichi knows

Every query is automatically enriched with relevant journal entries retrieved via FTS5 full-text search. The AI sees your entries as context but never reads `.quiet/` files. When an org filter is active in the sidebar, only that org's entries are included.

### Responses

Responses stream in token-by-token and are rendered as Markdown — headings, lists, code blocks, tables, and inline code all display correctly.

---

## Conversation history

Conversations are **auto-saved** to `~/nichinichi/ai/YYYY-MM-DD-{slug}.md` after every AI response — no manual action needed.

### Browsing history

Click the **clock icon** in the panel header to open the history list. Each entry shows the date and first user message. Click any entry to load and resume that conversation.

### Managing conversations

Hover over a history entry to reveal the **⋯ menu**:

| Action | Effect |
|---|---|
| **Rename** | Updates the title shown in the history list and in the pinned conversation header |
| **Archive** | Moves the file to `~/nichinichi/ai/archive/` |
| **Delete** | Permanently removes the file |

### Conversation title

The pinned title bar above the message list shows:
- The **renamed title** (if set), or
- The **first user message** as a fallback

For loaded conversations, click the **pencil icon** (appears on hover) to edit the title inline. Press Enter or click away to save; Escape to cancel.

---

## Multi-turn conversations

All prior turns are sent as history on every request, so the model can refer back to earlier messages. Loading a past conversation from history and asking a follow-up continues the conversation with full context.

---

## Creating journal entries from chat

You can ask the AI to create journal entries directly from the chat panel. The AI will suggest one or more formatted entries as interactive cards — review them, then click **Add to journal** to log each one.

### How to ask

Be direct about what you want logged. You can mention an org (`@acme`), a type (`#solution`, `#score`, etc.), or leave them out and the AI will infer them from context.

**Single entry:**
```
Log that I fixed the auth middleware bug @acme
```

**Multiple entries at once:**
```
Create 3 entries for today: fixed a bug in the auth middleware,
reviewed a PR from a teammate, and joined standup @acme
```

**With a specific type:**
```
Add a #solution entry for solving the memory leak in the worker process @acme
```

**Let the AI infer everything:**
```
I spent the morning debugging a race condition and finally found the fix.
Log that for me.
```

**Logging a decision:**
```
We decided to use Postgres over MySQL for the new service. Log that as a decision @acme
```

### Entry cards

Each suggested entry appears as an amber card. Review the body text, then click **Add to journal** to log it. The button turns green and is permanently disabled after saving — one click per entry. Each card is independent; you can add some and skip others.

### Tips

- Ask for entries in bulk: _"Create entries for everything I described in this conversation"_
- The AI will not invent org or type tags unless you specify them or they are clear from context
- The timestamp is always the current time when you click **Add to journal**
- Entries are written to `~/nichinichi/YYYY-MM-DD.md` (today's file) and indexed immediately

---

## Creating goals from chat

```
Create a goal to become a staff engineer with 3 steps @acme
Add a learning goal for mastering distributed systems
```

The AI responds with an **indigo goal card** pre-filled with:
- **Title** (required) — editable text input
- **Type** — `career` or `learning` select
- **Org** — dropdown from your existing workspaces
- **Horizon** — optional target date or milestone
- **Why** — optional motivation text
- **Steps** — editable list; add or remove steps before saving

Click **Add goal** to write the file to `goals/active/{slug}.md` and sync to SQLite. The goal immediately appears in the Goals view.

---

## Creating playbooks from chat

```
Create a playbook for debugging Node.js memory leaks
Write a runbook for deploying to Kubernetes @acme
```

The AI responds with a **violet playbook card** pre-filled with:
- **Title** (required) — editable text input
- **Tags** — comma-separated, editable
- **Org** — dropdown from your existing workspaces
- **Content** — resizable textarea with the numbered steps body

Click **Add playbook** to write the file to `playbooks/{slug}.md`. The playbook immediately appears in the Playbooks view.

---

## Generating reports from chat

```
Generate a weekly report for this week @acme
Summarise my work this month
Create a quarterly review for Q1 2026
```

The AI responds with a **teal report card** pre-filled with:
- **Type** — `weekly`, `monthly`, or `review` select
- **Org** — dropdown from your existing workspaces
- **Period start / end** — editable date fields (`YYYY-MM-DD`)
- **Content** — resizable textarea with the AI-generated report body

Review and edit the content before saving. Click **Save report** to write the file to `digests/{period_end}-{type}.md`. The report immediately appears in the Reports view.

> **Note:** Report content is based on whatever journal entries FTS5 returns for your query. For a richer report, follow up with specific time ranges or topics in the conversation before saving.

---

## Card behaviour (all types)

| State | Appearance |
|---|---|
| Default | Coloured card with editable fields and **Add** / **Save** button |
| Loading | Button dimmed, label shows "Adding…" / "Saving…" |
| Success | Button turns green, label shows "Added ✓" / "Saved ✓", fields disabled |
| Error | Red error message appears next to the button |

The **org field** in every card is a dropdown populated from your existing workspaces (Settings → Tags & Workspaces) and orgs discovered from your journal entries.

Card state persists for the lifetime of the panel session — closing and reopening the AI panel resets it, but switching conversations does not.

---

## Panel header reference

| Button | Action |
|---|---|
| **+** | New chat — clears current messages and refocuses the input |
| **Clock** | Toggle conversation history list (hidden when no saved conversations exist) |
| **×** | Close the AI panel |

---

## File format

See [file-formats.md](file-formats.md#saved-ai-conversation) for the on-disk format of saved conversations.
