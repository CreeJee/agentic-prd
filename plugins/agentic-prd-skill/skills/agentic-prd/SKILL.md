---
name: agentic-prd
description: Use when the user wants to list, inspect, resolve, reply to, or sync comments and spec docs from a running agentic-prd widget dev server. Requires @agentic-prd/dev-plugin in the host app's vite config and the dev server running.
---

# agentic-prd skill

Discover the running dev server by walking up from the cwd until you find a
`.agentic-prd.dev.json` file (it sits at the host app's project root — the
workspace root in a pnpm monorepo, the Vite root otherwise):

```json
{ "port": 5173, "prefix": "/__agentic-prd" }
```

The actual `port` reflects wherever Vite actually bound (Vite auto-picks the next free port if the configured one is taken), so always read it from the file rather than assuming.

The base URL is `http://localhost:{port}{prefix}`. Use the `localhost` hostname, not `127.0.0.1` — Vite may bind only to the IPv6 loopback (`[::1]`), in which case `127.0.0.1` is refused while `localhost` resolves correctly.

If the file is missing, tell the user:

> `.agentic-prd.dev.json` not found. Start the host app's dev server (`npm run dev` / `pnpm dev`; in this repo `pnpm play`). If it is running, check that `agenticPRDDev()` is registered in vite.config.

Data lives in `.agentic-prd/*.json` next to the discovery file — but always go
through the HTTP API, never edit those files while the server runs.

## Commands

- `/agentic-prd:setup` — install & wire the widget + dev plugin into the current app.
- `/agentic-prd:work` — drain open threads: locate → fix → reply → resolve each.
- `/agentic-prd:list-threads` — list open (unresolved) threads.
- `/agentic-prd:thread <id>` — thread detail + candidate source locations.
- `/agentic-prd:resolve <id>` / `/agentic-prd:unresolve <id>` — toggle resolved.
- `/agentic-prd:sync-specs [path]` — pull spec markdown files into local `docs/specs/`.

## Reply to a thread (agent feedback loop)

After fixing what a thread asks for, append a reply so the reporter sees the
outcome inside the widget:

```bash
curl -sf -X POST "http://localhost:{port}{prefix}/threads/{id}/comments" \
  -H "Content-Type: application/json" \
  -d '{"author":"Claude","text":"수정했습니다 — <무엇을 어떻게, 1-2문장>"}'
```

## Caveats

- `resolve`/`unresolve`/`thread` take the **thread id** (top-level `id` from the threads list) — do not confuse it with `comments[].id`, which shares the same prefix.
- Location candidates are ranked by confidence, but a top candidate pointing into `packages/widget/dist/` or `node_modules/` is a bundle false-positive — prefer the `testid`/app-source candidate below it. An empty candidate list can happen; fall back to the anchor's `selector` (grep the `data-testid`) and the screen's PRD.
- After `sync-specs`, verify the reported `localPath` files actually exist before reading them (a first call can report success before files land — re-run if missing).
