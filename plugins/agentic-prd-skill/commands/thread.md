---
name: thread
description: Show a thread's full comments plus candidate source locations.
---

Args: `<thread-id>`.

Read `.agentic-prd.dev.json`, then run these two calls in parallel:

```bash
curl -sf "http://localhost:{port}{prefix}/threads/{id}"
curl -sf "http://localhost:{port}{prefix}/threads/{id}/location"
```

Present the thread's `path`, `resolved` state, and every comment (`author`: `text`) in chronological order. Then list the location candidates as `<file>:<line>` grouped by `kind`, with `evidence` in parens.
