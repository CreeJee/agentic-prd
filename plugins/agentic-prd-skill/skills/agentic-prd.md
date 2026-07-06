---
name: agentic-prd
description: Use when the user wants to list, inspect, resolve, or sync comments and spec docs from a running agentic-prd widget dev server. Requires the workspace to have @agentic-prd/dev-plugin configured and `pnpm play` running.
---

# agentic-prd skill

Discover the running dev server by walking up from the cwd until you find `pnpm-workspace.yaml`. In the same directory, look for `.agentic-prd.dev.json`:

```json
{ "port": 5173, "prefix": "/__agentic-prd" }
```

The actual `port` reflects wherever Vite actually bound (Vite auto-picks the next free port if the configured one is taken), so always read it from the file rather than assuming.

The base URL is `http://localhost:{port}{prefix}`. Use the `localhost` hostname, not `127.0.0.1` — Vite may bind only to the IPv6 loopback (`[::1]`), in which case `127.0.0.1` is refused while `localhost` resolves correctly.

If the file is missing, tell the user:

> `.agentic-prd.dev.json` not found. Start the dev server with `pnpm play` from the workspace root.

## Commands

- `/agentic-prd:list-threads` — list open (unresolved) threads.
- `/agentic-prd:thread <id>` — thread detail + candidate source locations.
- `/agentic-prd:resolve <id>` / `/agentic-prd:unresolve <id>` — toggle resolved.
- `/agentic-prd:sync-specs [path]` — pull spec markdown files into local `docs/specs/`.

## Caveats

- `resolve`/`unresolve`/`thread` take the **thread id** (top-level `id` from the threads list) — do not confuse it with `comments[].id`, which shares the same prefix.
- Location candidates are ranked by confidence, but a top candidate pointing into `packages/widget/dist/` or `node_modules/` is a bundle false-positive — prefer the `testid`/app-source candidate below it. An empty candidate list can happen; fall back to the anchor's `selector` (grep the `data-testid`) and the screen's PRD.
- After `sync-specs`, verify the reported `localPath` files actually exist before reading them (a first call can report success before files land — re-run if missing).
