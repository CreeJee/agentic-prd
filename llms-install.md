# agentic-prd — installation guide for coding agents

You are an AI coding agent installing the agentic-prd toolkit. Follow the sections that match your goal. Every step lists a **success criterion** — verify it before moving on. All commands are non-interactive.

Repo: `https://github.com/CreeJee/agentic-prd`. No backend is required — comments/specs live in `.agentic-prd/*.json` next to the host app, owned by the dev-plugin.

> Shortcut: if the Claude Code plugin is already installed, `/agentic-prd:setup` performs section 1 end-to-end.

## 0. Prerequisites

```bash
node -v    # >= 20.19
```

The target app must be a **Vite + React** app. This toolkit does not support other bundlers yet.

## 1. Install widget + dev-plugin into a host app

Use the app's package manager (detect from the lockfile):

```bash
npm i @agentic-prd/widget
npm i -D @agentic-prd/dev-plugin
```

Wire the Vite config (no options needed):

```ts
// vite.config.ts
import agenticPRDDev from "@agentic-prd/dev-plugin";

export default defineConfig({
  plugins: [react(), agenticPRDDev()],
});
```

Mount the widget at the app root:

```tsx
import { CommentWidget } from "@agentic-prd/widget";

<CommentWidget pageKey={location.pathname} />
```

If the host uses Tailwind CSS v4, add the widget source to the CSS entry (the widget ships no CSS of its own):

```css
@source "../node_modules/@agentic-prd/widget/src";
```

Start the dev server. Success criteria, in order:

1. The dev server boots and prints a local URL (the port may not be 5173 — never assume it).
2. A `.agentic-prd.dev.json` file appears at the project root (workspace root in a monorepo). Read `{port, prefix}` from it.
3. The agent API answers (**use `localhost`, not `127.0.0.1`** — Vite may bind only the IPv6 loopback `[::1]`):

   ```bash
   curl -sf "http://localhost:{port}{prefix}/threads"
   ```

   returns a JSON array (possibly `[]`).

4. The widget toolbar renders styled in the browser (not unstyled text). If unstyled → the Tailwind `@source` line is missing.

## 2. Install the Claude Code integration

Pick ONE path. Path A also installs the `/agentic-prd:*` slash commands (setup / work / list-threads / thread / resolve / unresolve / sync-specs).

### Path A — full plugin via marketplace (recommended)

```bash
claude plugin marketplace add CreeJee/agentic-prd
claude plugin install agentic-prd@agentic-prd
```

Success: after restarting Claude Code, `/agentic-prd:list-threads` is a known command.

### Path B — skill only, no clone (via `npx skills`)

```bash
npx skills add CreeJee/agentic-prd
```

Success: the CLI reports installed skills. Note: no slash commands — the skill instructions include the raw HTTP API instead.

### Path C — from a clone of this repo

```bash
pnpm skill:install            # symlinks plugins/agentic-prd-skill into ~/.claude/plugins
# flags: --copy (copy instead of symlink), --force (replace existing), --dest <dir>
```

Success: the script prints `linked ...` or `already installed`; after restart `/agentic-prd:list-threads` works.

### Verify (all paths)

With the host dev server running, run `/agentic-prd:list-threads` (or query `GET {base}/threads?resolved=false` for a skill-only install). Success: a thread list (possibly empty), no connection errors.

## 3. Run the loop

1. In the browser, set an author name in the toolbar, then pin a comment on something wrong.
2. `/agentic-prd:work` — drains open threads: locates the source behind each pin, fixes it, replies in-thread (`POST /threads/{id}/comments`), resolves.
3. `/agentic-prd:sync-specs` — pulls per-screen spec docs into `docs/specs/`.

Success: the pinned comment gets a reply in the widget and its thread flips to resolved.

## Developing this repo itself

```bash
pnpm install && pnpm play     # demo app; requires Node >= 20.19, pnpm 10 (corepack enable)
pnpm typecheck && pnpm lint && pnpm test
```

## Troubleshooting quick table

| Symptom | Fix |
| --- | --- |
| `curl` to `127.0.0.1` refused | Use `localhost` (Vite may bind `[::1]` only). |
| `.agentic-prd.dev.json` missing | Start the host dev server; check `agenticPRDDev()` is in vite.config. |
| Widget unstyled | Add the Tailwind `@source` line. |
| Port is not 5173 | The discovery file's `port` is the truth — Vite auto-picks free ports. |
| Threads look stale | Never edit `.agentic-prd/*.json` by hand while the server runs — go through the HTTP API. |
