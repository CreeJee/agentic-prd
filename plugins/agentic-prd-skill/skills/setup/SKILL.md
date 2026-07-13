---
name: setup
description: Use when the user asks to install/set up agentic-prd (comment widget + dev plugin) in their app. One-shot install - packages, vite wiring, widget mount, Tailwind source, then verify end-to-end.
---

# agentic-prd one-shot setup

Install `@agentic-prd/widget` + `@agentic-prd/dev-plugin` into the current app and
verify the loop works. Follow the steps in order; on any failure stop, report the
cause and the manual fallback (README of the failing package) — never leave the
app half-wired silently.

## 1. Detect the app

- Find `vite.config.{ts,js,mts,mjs}`. If none exists this is not a Vite app —
  stop and tell the user agentic-prd currently supports Vite apps only.
- Detect the package manager from the lockfile: `pnpm-lock.yaml` → pnpm,
  `yarn.lock` → yarn, `bun.lockb`/`bun.lock` → bun, otherwise npm.
- Detect React: `react` in dependencies. If missing, stop — the widget is a React component.

## 2. Install packages

```bash
<pm> add @agentic-prd/widget
<pm> add -D @agentic-prd/dev-plugin
```

(npm: `npm i` / `npm i -D`.)

## 3. Wire vite.config

Add the import and the plugin call (no options needed):

```ts
import agenticPRDDev from "@agentic-prd/dev-plugin";
// inside plugins: [...]
agenticPRDDev(),
```

## 4. Mount the widget

Find the app's root component (the one rendering routes / main layout). Add:

```tsx
import { CommentWidget } from "@agentic-prd/widget";
```

- App uses a router exposing a pathname (react-router `useLocation`, etc.):
  `<CommentWidget pageKey={pathname} />`
- No router: `<CommentWidget />` (the widget falls back to watching
  `location.pathname` itself).

Mount it once, at the root, outside route switching so it survives navigation.

## 5. Tailwind v4 hosts only

If the app's CSS entry uses `@import "tailwindcss"`, add below it (adjust the
relative path from that CSS file to node_modules):

```css
@source "../node_modules/@agentic-prd/widget/src";
```

Without this the widget renders unstyled. If the app doesn't use Tailwind v4,
tell the user the widget's styling requires a Tailwind v4 host for now.

## 6. `.agentic-prd/` git policy

Ask the user: commit `.agentic-prd/` (share comments with the team via git) or
ignore it (personal)? Apply the answer to `.gitignore`.

## 7. Verify (repeat until green)

1. Start the dev server in the background (`<pm> run dev`).
2. Read `.agentic-prd.dev.json` at the project root → `{port, prefix}`.
3. `curl -sf "http://localhost:{port}{prefix}/threads"` → `[]` (HTTP 200).
4. Round-trip: `POST {prefix}/threads` with
   `{"id":"setup_smoke","path":"/","xPct":50,"yPx":100,"comments":[{"id":"c1","author":"setup","text":"smoke","at":1}]}`
   → `GET {prefix}/threads?path=/` contains it → `DELETE {prefix}/threads/setup_smoke`.
5. Run the app's typecheck/build script if present.
6. Any step red → fix the wiring, restart the dev server, verify again. Report a
   short summary (what was installed/changed, verification results) when all green.
