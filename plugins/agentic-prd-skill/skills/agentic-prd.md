---
name: agentic-prd
description: Use when the user wants to list, inspect, resolve, or sync comments and spec docs from a running agentic-prd widget dev server. Requires the workspace to have @agentic-prd/dev-plugin configured and `pnpm play` running.
---

# agentic-prd skill

Discover the running dev server by walking up from the cwd until you find `pnpm-workspace.yaml`. In the same directory, look for `.agentic-prd.dev.json`:

```json
{ "port": 5174, "prefix": "/__agentic-prd" }
```

The base URL is `http://127.0.0.1:{port}{prefix}`.

If the file is missing, tell the user:

> `.agentic-prd.dev.json` not found. Start the dev server with `pnpm play` from the workspace root.

## Commands

- `/agentic-prd:list-threads` — list open (unresolved) threads.
- `/agentic-prd:thread <id>` — thread detail + candidate source locations.
- `/agentic-prd:resolve <id>` / `/agentic-prd:unresolve <id>` — toggle resolved.
- `/agentic-prd:sync-specs [path]` — pull spec markdown files into local `docs/specs/`.
