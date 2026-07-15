---
name: unresolve
description: Reopen a resolved thread.
argument-hint: <thread-id>
---

Args: `<thread-id>`.

Read `.agentic-prd.dev.json` (walk up from cwd to find it), then:

```bash
curl -sf -X POST "http://localhost:{port}{prefix}/threads/{id}/unresolve"
```

Confirm the returned thread has `resolved: false`.
