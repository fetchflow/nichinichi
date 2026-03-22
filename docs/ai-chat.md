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

Ask the AI to log something and it will suggest a formatted entry:

> "Log that I fixed the auth middleware bug @acme"
> "Create a score entry for shipping the billing page"

The AI responds with an amber **entry card** showing the proposed body text. Click **Add to journal** to create the entry with the current timestamp. The button shows **Added ✓** on success.

The entry format the AI uses internally:

```
nichinichi-entry
body text @org #type
```

This is a standard fenced code block with a custom language tag that the chat panel intercepts and renders as an interactive card. The timestamp is added automatically by the `add_entry` command.

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
