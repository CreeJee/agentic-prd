# @agentic-prd/widget

Drop-in comment-pin + spec-doc overlay for any React app. Pin threaded comments
to any DOM element (inside modals and nested overlays too) and attach per-screen
spec documents. Built for an agentic loop: your teammates (or you) pin feedback,
and a coding agent reads/fixes/replies via [`@agentic-prd/dev-plugin`](https://www.npmjs.com/package/@agentic-prd/dev-plugin).

## Install

```bash
npm i @agentic-prd/widget
npm i -D @agentic-prd/dev-plugin
```

## Use (zero-config)

```tsx
import { CommentWidget } from "@agentic-prd/widget";

// anywhere inside your app (once, e.g. app root)
<CommentWidget pageKey={location.pathname} />
```

```ts
// vite.config.ts
import agenticPRDDev from "@agentic-prd/dev-plugin";

export default defineConfig({
  plugins: [react(), agenticPRDDev()],
});
```

No backend needed: comments/specs are stored in `.agentic-prd/*.json` at your
project root by the dev plugin. Commit the folder to share with your team, or
gitignore it to keep it personal.

## Styling (Tailwind v4 host)

The widget ships no CSS bundle — your app's Tailwind scans its sources. Add to
your CSS entry:

```css
@source "../node_modules/@agentic-prd/widget/src";
```

(Adjust the relative path from your CSS file to `node_modules`.)

## Custom storage

Pass any `StorageAdapter` implementation to plug a different backend:

```tsx
import { CommentWidget, type StorageAdapter } from "@agentic-prd/widget";

<CommentWidget config={{ storage: myAdapter }} pageKey={pathname} />
```

## Claude Code skill

Install the companion skill to drive the loop from Claude Code
(`/agentic-prd:setup`, `/agentic-prd:work`, `/agentic-prd:list-threads`, ...):

```
/plugin marketplace add CreeJee/agentic-prd
/plugin install agentic-prd@agentic-prd
```
