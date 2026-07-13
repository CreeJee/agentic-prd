# @agentic-prd/dev-plugin

Dev-only Vite sidecar for [`@agentic-prd/widget`](https://www.npmjs.com/package/@agentic-prd/widget).
Runs inside your Vite dev server (no extra process), stores widget comments/specs
in `.agentic-prd/*.json` at your project root, and exposes a local HTTP API that
coding agents (Claude Code skill) consume: list/inspect threads, resolve, reply,
locate the source behind a pin, sync spec docs.

## Install

```bash
npm i -D @agentic-prd/dev-plugin
```

```ts
// vite.config.ts
import agenticPRDDev from "@agentic-prd/dev-plugin";

export default defineConfig({
  plugins: [react(), agenticPRDDev()],
});
```

Dev-only: applied with `apply: "serve"` — nothing ships in your production build.

## Options

```ts
agenticPRDDev({
  specSyncDir: "docs/specs",   // where /specs/sync writes markdown (default: docs/specs)
  projectRoot: ".",            // source root for pin→source location (default: auto)
  prefix: "/__agentic-prd",    // HTTP prefix (default)
});
```

## HTTP API (localhost only)

Discovery: the plugin writes `.agentic-prd.dev.json` (`{ port, prefix }`) at your
project root while the dev server runs. Base URL: `http://localhost:{port}{prefix}`.

- `GET /threads?path=&resolved=&limit=` / `GET /threads/:id`
- `POST /threads` / `PATCH /threads/:id` / `DELETE /threads/:id`
- `POST /threads/:id/comments` — append a reply (agents use this to report fixes)
- `POST /threads/:id/resolve` / `POST /threads/:id/unresolve`
- `GET /threads/:id/location` — ranked source-location candidates for the pin
- `GET /specs?path=` / `GET /specs/:id` / `PUT /specs/:id` / `DELETE /specs/:id`
- `POST /specs/sync` / `POST /specs/:id/sync` — write specs to local markdown

## Claude Code skill

```
/plugin marketplace add CreeJee/agentic-prd
/plugin install agentic-prd@agentic-prd
```
