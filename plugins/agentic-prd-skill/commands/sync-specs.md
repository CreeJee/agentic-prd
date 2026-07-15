---
name: sync-specs
description: Pull spec markdown files from the dev server into local docs/specs/.
argument-hint: [path]
---

Args: `[path]` (optional). If provided, only sync specs for that widget path.

Read `.agentic-prd.dev.json` (walk up from cwd to find it), then:

```bash
curl -sf -X POST "http://localhost:{port}{prefix}/specs/sync?path={path}"
```

Present the returned `synced[]` (id → localPath) and `removed[]` file names.
After syncing, verify the reported `localPath` files actually exist before
reading them — re-run if missing.
