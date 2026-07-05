---
name: unresolve
description: Reopen a resolved thread.
---

Args: `<thread-id>`.

```bash
curl -sf -X POST "http://127.0.0.1:{port}{prefix}/threads/{id}/unresolve"
```

Confirm the returned thread has `resolved: false`.
