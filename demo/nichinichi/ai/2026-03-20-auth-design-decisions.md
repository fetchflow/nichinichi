---
type: ai-conversation
date: 2026-03-20
query: what decisions did I make about auth this month
org: acme
---

**you:** what decisions did I make about auth this month

**nichinichi:** Here are the auth-related decisions I found in your March entries, in order:

**March 11** — You decided to model permissions as resource:action pairs rather than
role bitmasks. Your rationale: bitmasks are fast but opaque, hard to audit and explain
to stakeholders. The string format like "billing:read" is self-documenting. You noted
the performance difference was negligible at your scale.

**March 17** — You rejected storing the refresh token in localStorage (an AI suggestion)
in favor of httpOnly cookies, citing XSS risk. This shaped the overall token storage
architecture.

**March 18** — You chose Redis over Postgres for the session cache. Your stated reasons:
TTL-native support, sub-millisecond reads, and no need for ACID guarantees on ephemeral
session data.

The three decisions form a coherent auth architecture: resource:action permissions,
httpOnly cookies for tokens, Redis for sessions. That's a defensible, documented stack.

**you:** which of those would be most useful to capture in a design doc

**nichinichi:** The resource:action permission model decision from March 11 is the most
document-worthy. It's the most consequential of the three — it defines the entire
access control model, not just an implementation detail.

The Redis choice and cookie choice are implementation decisions that follow naturally
once the permission model is set. But the permission model itself (why not bitmasks,
why not a full RBAC framework, why string pairs) is the kind of architectural decision
that future engineers will want to understand and that's easy to lose in git history.

A short design doc covering: problem statement, options considered (bitmasks, RBAC
framework, string pairs), and the decision rationale would be high-value and maps
directly to the staff eng track requirement you've set for yourself.
