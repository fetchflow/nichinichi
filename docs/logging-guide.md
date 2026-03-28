# Logging Guide: Writing Effective and Sustainable Journal Entries

This guide covers how to write entries that are genuinely useful over time —
entries you'll be glad you wrote six months from now when you're writing a
performance review, debugging a recurring problem, or trying to remember why
you made a particular call.

---

## The core idea

An entry is a timestamped fact about your workday. It doesn't need to be
polished. It needs to be specific enough to be retrievable and meaningful
enough to be worth keeping.

A good entry answers: **what happened, why it matters, and what to remember.**

---

## Entry anatomy

```
HH:MM | body text @org #type
       optional detail block (indented)
```

- **Time** — when it happened (`HH:MM`) or approximately (`~HH:MM`)
- **Body** — one line, present tense, specific
- **@org** — the org or project context (e.g. `@acme`, `@personal`)
- **#type** — the category (see below); inferred from keywords if omitted
- **Detail block** — indented lines below the first; free-form, optional

---

## Entry types and when to use them

| Type | When to use | Example body |
|---|---|---|
| `#log` | Routine work in progress; no particular outcome yet | `picking up the auth refactor @acme #log` |
| `#solution` | A bug fixed, a problem solved, a workaround found | `jwt refresh swallowing errors — fixed @acme #solution` |
| `#decision` | A choice made, an option rejected, a tradeoff accepted | `chose postgres over sqlite for multi-tenant — row isolation @acme #decision` |
| `#reflection` | Something you learned, a mental model shift, an observation | `finally understood why idempotency keys matter @acme #reflection` |
| `#score` | Shipped, merged, closed, unblocked someone — visible impact | `v2 search shipped to prod, p99 down 40% @acme #score` |
| `#ai` | An AI interaction worth remembering — useful suggestion or a rejected one | `claude suggested localStorage — rejected, xss risk @acme #ai` |

If you omit the type tag, nichinichi infers it from keywords in the body.
It's fine to rely on inference for `#log` and `#solution`; be explicit for
`#decision` and `#reflection` since those are the entries you'll most want
to surface later.

---

## Writing good bodies

**Be specific, not generic.**

```
# bad
working on the api

# good
debugging why the rate limiter resets on redeploy @acme #log
```

**Name the thing.** Use the actual function, service, ticket, or person's name.

```
# bad
fixed the bug sarah reported

# good
fixed null pointer in UserSession.refresh() — sarah's report was correct @acme #solution
```

**One entry per distinct event.** Don't bundle a log, decision, and solution
into one line. Three short entries are easier to search than one dense blob.

---

## Writing good detail blocks

The detail block is where you put context that won't fit on one line.
Use it for solutions and decisions — the two types you'll search for most.

**For solutions:**

```
11:32 | jwt refresh swallowing errors — fixed @acme #solution

       Root cause: expiry check after decode, not before
       Fix: move expiry check to top of middleware
       Time lost: 2hrs. Check expiry BEFORE decode, always.
```

Structure that works: **Root cause → Fix → Lesson.**

**For decisions:**

```
14:50 | chose postgres over sqlite for multi-tenant data @acme #decision

       Why: row-level isolation, existing ops knowledge, Neon serverless fits budget
       Rejected: sqlite (no row isolation), mysql (unfamiliar tooling)
       Risk: per-schema migrations are slower — acceptable for now
```

Structure that works: **Why → What was rejected → Known risk.**

**For reflections:**

```
17:30 | finally clicked why we use event sourcing here @acme #reflection

       Reading the Stripe payments article made it concrete:
       you never mutate state, you append events and derive state.
       The audit log isn't a side effect — it's the primary data.
```

A single paragraph is fine. Write it like a note to your future self.

---

## Sustainable habits

### Log at the moment, not at end of day

End-of-day summaries lose specificity. A quick `#log` when you switch tasks
costs ten seconds and gives you a timestamped trail you can trust.

### Three entries per day is enough

You don't need to log every keystroke. Aim for:
1. One entry when you start something meaningful
2. One when you solve or ship something
3. One reflection or decision if one arose

If you hit ten entries in a day, you're probably over-logging routine work.

### Use `~HH:MM` when time is approximate

If you're logging retroactively and aren't sure of the exact time, prefix
with `~`. The parser stores `approximate: true` and the UI shows it
differently. It's better to log with a fuzzy timestamp than to skip the entry.

```
~15:00 | realized the cache invalidation was off-by-one @acme #solution
```

### Keep the org tag consistent

Use the same `@org` value across all entries for a project. Org is the
primary filter for AI queries and dashboard stats. Inconsistent spelling
(`@Acme`, `@acme-corp`) fragments your history.

### Log rejected options, not just what you chose

Decisions lose half their value if you only record the outcome. The rejected
option explains the reasoning. Future you — or a new teammate — needs to
know why you didn't take the obvious path.

---

## Patterns to avoid

**Vague bodies that won't survive search:**
```
# avoid
more work on the thing
meeting
stuff
```

**Combining multiple events into one entry:**
```
# avoid
fixed the login bug, updated the readme, and deployed to staging
```

Break this into three entries: one `#solution`, one `#log`, one `#score`.

**Logging tasks instead of events:**
```
# avoid
need to look into the memory leak
```

Log what you did or discovered, not what you plan to do. Use your task
manager for TODOs; use nichinichi for events that happened.

**Skipping detail on hard-won solutions:**
```
# avoid
09:12 | fixed the memory leak #solution
```

If it took more than 30 minutes to figure out, write a detail block. You
will encounter a similar problem again.

---

## Using tags beyond type

Additional `#tags` after the type are stored in the `tags[]` array and
are searchable via FTS. Use them sparingly — a few consistent tags are
more useful than many ad-hoc ones.

Useful patterns:
- `#perf` for performance work
- `#security` for security-relevant changes
- `#debt` for intentional tech debt entries
- `#blocked` for times you were waiting on someone else

```
16:10 | profiled the query, added composite index @acme #solution #perf

       Before: 840ms p95. After: 12ms p95.
       Index: (org_id, created_at DESC) on entries table.
```

---

## What nichinichi does with your entries

Your entries feed three things:

1. **AI queries** — the `ask` command uses FTS5 to find relevant entries
   and builds context for the AI. Specific bodies and detail blocks
   dramatically improve answer quality. Vague entries return noise.

2. **Goal progress** — the Goals view links entries to goal steps. A
   `#solution` or `#score` entry with a clear body is easy to attach to a
   step; a vague `#log` is not.

3. **Digest generation** — weekly and monthly digests summarise your entry
   history. Entries with type `#score` and `#decision` are weighted more
   heavily. If you want your digests to reflect your actual impact, log your
   wins explicitly.

---

## Quick reference

```
# Minimal valid entry
09:05 | picking up the auth refactor @acme

# With explicit type
11:32 | jwt refresh bug — fixed @acme #solution

# With detail block
11:32 | jwt refresh bug — fixed @acme #solution

       Root cause: expiry check after decode, not before
       Fix: moved expiry check to top of middleware

# Approximate time
~15:00 | remembered cache ttl was wrong @acme #reflection

# Multiple tags
16:10 | added composite index, query down to 12ms @acme #solution #perf

# Decision with rejected option
14:50 | chose postgres over sqlite @acme #decision

       Why: row isolation needed for multi-tenant
       Rejected: sqlite — no row-level isolation
```
