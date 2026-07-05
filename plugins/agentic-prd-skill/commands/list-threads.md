---
name: list-threads
description: List unresolved comment threads on the running dev server.
---

Read `.agentic-prd.dev.json` at the workspace root, then run:

```bash
curl -sf "http://127.0.0.1:{port}{prefix}/threads?resolved=false"
```

Present each thread's `path`, first comment `text` (truncated to 80 chars), and `id`. Sort by most recent `updatedAt` first.
