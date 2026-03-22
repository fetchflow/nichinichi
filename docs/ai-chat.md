# AI Chat

The desktop app includes a persistent AI chat panel powered by any OpenAI-compatible backend (Open WebUI, Ollama, LiteLLM, a hosted API, etc.).

---

## Setup

In **Settings**, fill in:

| Field | Example | Notes |
|---|---|---|
| Base URL | `http://localhost:3000` | URL of your AI backend — no path suffix needed |
| API Key | _(your key)_ | Passed as `Authorization: Bearer {key}` |
| Model | `llama3.2` | Any model available in your backend |

The client posts to `{base_url}/api/chat/completions` using the standard OpenAI chat completions format with SSE streaming.

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

The model selector (shown in the header) lets you switch models per-conversation while not streaming.

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

Each suggested entry appears as an amber card showing the entry body text. Cards behave as follows:

- **Add to journal** — logs the entry with the current timestamp and disables the button permanently
- **Added ✓** — the button turns green and is disabled; the entry has been written to today's file
- If the add fails, a red error message appears next to the button

You can add some entries and skip others — each card is independent.

### Tips

- You can ask for entries in bulk: _"Create entries for everything I described in this conversation"_
- The AI will not invent org or type tags unless you specify them or they are clear from context
- The timestamp is always the current time when you click **Add to journal**, not the time mentioned in the conversation
- Entries are added to `~/nichinichi/YYYY-MM-DD.md` (today's file) and indexed into SQLite immediately

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
