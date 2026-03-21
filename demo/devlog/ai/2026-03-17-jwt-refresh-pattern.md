---
type: ai-conversation
date: 2026-03-17
query: when did i fix a jwt bug
org: acme
---

**you:** when did i fix a jwt bug

**devlog:** Based on your entries, you fixed a jwt refresh bug today, March 17th 2026.

The entry reads: "jwt refresh swallowing errors — fixed @acme #solution"

The root cause you logged was: expiry check ran after decode rather than before.
The fix was moving expiry validation to the top of the middleware chain. You noted
it took roughly 2 hours and left a reminder to always check expiry before decoding.

This unblocked Sarah, who was waiting on it for the mobile auth flow — she's referenced
in the same day's score entry from 16:48.

Is there anything specific about the fix or the timeline you want to explore?

**you:** what did i reject from claude that day

**devlog:** Also on March 17th, you logged an AI entry at 13:10: "claude suggested
localStorage for the token store — rejected, xss risk @acme #ai"

You noted that you asked Claude where to store the refresh token in a SPA and it
suggested localStorage, but you rejected this because localStorage is vulnerable to
XSS attacks. You went with an httpOnly cookie instead, and noted that "AI was wrong
here, context matters."

This is a good example of the pattern worth keeping: using AI for scaffolding and
exploration while applying your own security judgment to the output.
