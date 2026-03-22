---
title: debugging node.js memory leaks
tags: [node, memory, debugging, performance]
forked_from: null
org: null
created: 2026-02-10
---

## Overview

Memory leaks in Node.js are usually caused by unintentional references that prevent garbage
collection: detached DOM nodes, unbounded caches, event listener accumulation, or closures
capturing large objects. This playbook covers the systematic process for finding and fixing them.

## steps

1. Reproduce the leak in isolation
   - Create a minimal reproduction script that triggers the leak
   - Avoid debugging in production — use a controlled environment
   - Monitor heap growth with `process.memoryUsage()` at regular intervals

2. Enable the inspector and take an initial heap snapshot
   - Run with `node --inspect` and open `chrome://inspect` in Chrome
   - Go to Memory tab → Take heap snapshot (baseline)
   - Label it "before"

3. Trigger the suspected leak path multiple times

4. Take a second heap snapshot and compare
   - In Chrome DevTools: select "Comparison" view
   - Sort by "Size Delta" descending
   - Look for objects with large positive deltas that shouldn't accumulate

5. Identify retained objects
   - Focus on: detached DOM nodes, EventEmitter listeners, closures, WeakRef misuse
   - Check the "Retainers" section to trace what's keeping the object alive

6. Apply the fix and verify
   - Common fixes: call `removeEventListener`, clear intervals/timeouts, null out references
   - Re-run the reproduction script and confirm heap stays flat over time

## Common culprits

- `setInterval` without corresponding `clearInterval`
- Event listeners added in a loop without cleanup
- Global caches (Maps, arrays) with no eviction policy
- Closures accidentally capturing large request/response objects
- Third-party libraries that don't clean up on destroy
