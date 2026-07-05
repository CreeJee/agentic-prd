---
name: resolve
description: Mark a thread as resolved.
---

Args: `<thread-id>`.

Read `.agentic-prd.dev.json`, then:

```bash
curl -sf -X POST "http://127.0.0.1:{port}{prefix}/threads/{id}/resolve"
```

Confirm the returned thread has `resolved: true`.
