---
name: resolve
description: Mark a thread as resolved.
---

Args: `<thread-id>`.

Read `.agentic-prd.dev.json`, then:

```bash
curl -sf -X POST "http://localhost:{port}{prefix}/threads/{id}/resolve"
```

Confirm the returned thread has `resolved: true`.
