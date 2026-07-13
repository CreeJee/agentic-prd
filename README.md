# agentic-prd

Pin comments on your running app, let a coding agent fix exactly that spot.

**For vibe-coders:** click where it's wrong, write a comment, run
`/agentic-prd:work` in Claude Code — the agent finds the source behind the pin,
fixes it, replies in the thread, and resolves it.

**For teams:** PM/QA pin "this exact part is wrong" on the dev build with
per-screen spec docs attached; comments live in `.agentic-prd/*.json` — commit
the folder to share via git. No backend, no accounts.

## Quickstart (3 steps, zero-config)

```bash
npm i @agentic-prd/widget
npm i -D @agentic-prd/dev-plugin
```

```ts
// vite.config.ts
import agenticPRDDev from "@agentic-prd/dev-plugin";

export default defineConfig({
  plugins: [react(), agenticPRDDev()],
});
```

```tsx
// your app root
import { CommentWidget } from "@agentic-prd/widget";

<CommentWidget pageKey={location.pathname} />
```

Tailwind v4 host — add to your CSS entry (adjust the relative path):

```css
@source "../node_modules/@agentic-prd/widget/src";
```

Claude Code skill:

```
/plugin marketplace add CreeJee/agentic-prd
/plugin install agentic-prd@agentic-prd
```

Or let Claude do all of the above in your app: `/agentic-prd:setup`.

## The loop

1. Run your dev server; the toolbar appears. Set your name, pin comments.
2. `/agentic-prd:list-threads` — see open feedback.
3. `/agentic-prd:work` — the agent locates each pin's source, fixes it,
   replies in-thread, resolves. You see the replies in the widget.
4. `/agentic-prd:sync-specs` — pull per-screen spec docs into `docs/specs/`.

## Packages

| Package | What |
| --- | --- |
| [`@agentic-prd/widget`](packages/widget) | React comment-pin + spec-doc overlay |
| [`@agentic-prd/dev-plugin`](packages/dev-plugin) | Vite dev sidecar: local JSON storage + HTTP API for agents |
| [`plugins/agentic-prd-skill`](plugins/agentic-prd-skill) | Claude Code plugin (setup / work / list / resolve / sync) |

Storage is pluggable (`StorageAdapter`) — the local dev server is the default;
a hosted backend can implement the same interface later.

## Developing this repo

pnpm + turborepo. `pnpm install`, then:

```bash
pnpm play        # demo commerce app (apps/playground) with the widget mounted
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

See `AGENTS.md` for architecture and conventions.
