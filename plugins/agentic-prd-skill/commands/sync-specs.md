---
name: sync-specs
description: Pull spec markdown files from the dev server into local docs/specs/.
---

Args: `[path]` (optional). If provided, only sync specs for that widget path.

```bash
curl -sf -X POST "http://127.0.0.1:{port}{prefix}/specs/sync?path={path}"
```

Present the returned `synced[]` (id → localPath) and `removed[]` file names.
