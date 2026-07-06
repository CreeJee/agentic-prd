---
name: unresolve
description: Reopen a resolved thread.
---

Args: `<thread-id>`.

```bash
curl -sf -X POST "http://localhost:{port}{prefix}/threads/{id}/unresolve"
```

Confirm the returned thread has `resolved: false`.
