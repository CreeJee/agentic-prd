# Dev-Plugin Implementation Plan (Monorepo + Vite Plugin + Claude Skill)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move to pnpm+turborepo monorepo (`@agentic-prd/widget` + `@agentic-prd/dev-plugin` + `apps/playground` + `plugins/agentic-prd-skill`), then ship a Vite dev-server sidecar that exposes HTTP endpoints for reading comments/specs, resolving anchor → source file:line, syncing spec markdown locally, and a Claude Code skill that consumes it.

**Architecture:** Phase 1 restructures the repo into pnpm workspaces with turborepo pipelines. Phase 2 builds the dev-plugin as a Vite Plugin (`configureServer` middleware only — no separate process), with per-module vitest tests. Phase 3 adds the Claude Code skill that discovers `.agentic-prd.dev.json` and curl-drives the local dev endpoints.

**Tech Stack:** pnpm workspaces · turborepo · Vite (`configureServer`) · `@supabase/supabase-js` · TypeScript (strictest) · vitest · biome · Claude Code plugin manifest.

---

## Prerequisites

- The spec at `docs/superpowers/specs/2026-07-05-dev-plugin-design.md` (commit `d9f32b3`) is the source of truth for endpoint shapes, file naming, and DTOs.
- Playground currently runs against Supabase `https://rcspbbhdwffpnimefyeu.supabase.co` with `publicKey` `sb_publishable_1xY8wrIcq36-nf4DULOWGg_o2NTWzdJ`. Reuse those in playground config after migration.
- Working directory: `C:/Users/CreeJee/Desktop/open-source/agentic-prd`. Windows: use `cd "..." && ...` in bash commands (no persistent cwd between tools).

---

## File Structure

**Phase 1 — Monorepo migration** (moves and adds workspace tooling)

- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Rewrite: `package.json` (root, workspace shell)
- Move: `src/**` → `packages/widget/src/**`
- Move: `playground/**` → `apps/playground/**`
- Create: `packages/widget/package.json`
- Create: `packages/widget/tsconfig.json`
- Create: `packages/widget/tsdown.config.ts`
- Create: `packages/widget/vitest.config.ts`
- Create: `packages/widget/vitest.setup.ts`
- Create: `apps/playground/package.json`
- Modify: `apps/playground/vite.config.ts` — root becomes `.`, react/tailwind plugins
- Modify: `apps/playground/src/App.tsx` — import from `@agentic-prd/widget`
- Delete: root `tsconfig.json`, root `vite.config.ts`, root `vitest.config.ts`, root `vitest.setup.ts`, root `tsdown.config.ts` (replaced by package-level ones)
- Modify: `.gitignore` — add `.turbo`, `**/dist`, `.agentic-prd.dev.json`

**Phase 2 — dev-plugin package**

- Create: `packages/dev-plugin/package.json`
- Create: `packages/dev-plugin/tsconfig.json`
- Create: `packages/dev-plugin/tsdown.config.ts`
- Create: `packages/dev-plugin/vitest.config.ts`
- Create: `packages/dev-plugin/src/index.ts`
- Create: `packages/dev-plugin/src/types.ts`
- Create: `packages/dev-plugin/src/slug.ts` + `packages/dev-plugin/src/__tests__/slug.test.ts`
- Create: `packages/dev-plugin/src/manifest.ts` + `packages/dev-plugin/src/__tests__/manifest.test.ts`
- Create: `packages/dev-plugin/src/anchor-resolver.ts` + `packages/dev-plugin/src/__tests__/anchor-resolver.test.ts`
- Create: `packages/dev-plugin/src/supabase.ts`
- Create: `packages/dev-plugin/src/handlers/threads.ts` + `packages/dev-plugin/src/__tests__/threads.test.ts`
- Create: `packages/dev-plugin/src/handlers/specs.ts` + `packages/dev-plugin/src/__tests__/specs.test.ts`
- Create: `packages/dev-plugin/src/router.ts` + `packages/dev-plugin/src/__tests__/router.test.ts`
- Create: `packages/dev-plugin/src/plugin.ts`
- Modify: `apps/playground/vite.config.ts` — wire `agenticPRDDev()` plugin

**Phase 3 — Claude Code skill**

- Create: `plugins/agentic-prd-skill/plugin.json`
- Create: `plugins/agentic-prd-skill/skills/agentic-prd.md`
- Create: `plugins/agentic-prd-skill/commands/list-threads.md`
- Create: `plugins/agentic-prd-skill/commands/thread.md`
- Create: `plugins/agentic-prd-skill/commands/resolve.md`
- Create: `plugins/agentic-prd-skill/commands/unresolve.md`
- Create: `plugins/agentic-prd-skill/commands/sync-specs.md`
- Create: `plugins/agentic-prd-skill/README.md` — install steps

**Phase 4 — Docs update**

- Modify: `AGENTS.md` — new monorepo layout, commands change (turbo)
- Modify: `CLAUDE.md` — no functional change but heading update if needed

---

# Phase 1 — Monorepo Migration

### Task 1: Add workspace tooling files (yaml/turbo/tsconfig-base) and root package.json

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Modify: `package.json`

- [ ] **Step 1: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    },
    "play": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 3: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "module": "preserve",
    "target": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "lib": ["es2023", "DOM", "DOM.Iterable"],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  }
}
```

- [ ] **Step 4: Replace root `package.json` with workspace shell**

```json
{
  "name": "agentic-prd-monorepo",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "play": "turbo run play --filter agentic-prd-playground"
  },
  "devDependencies": {
    "@biomejs/biome": "2.1.1",
    "turbo": "^2.5.0",
    "typescript": "7.0.1-rc",
    "@typescript/native-preview": "7.0.0-dev.20260705.1"
  },
  "packageManager": "pnpm@10.33.0"
}
```

- [ ] **Step 5: Install turbo at root**

Run:
```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm install
```

Expected: `Done` with `turbo` installed at root.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add pnpm-workspace.yaml turbo.json tsconfig.base.json package.json pnpm-lock.yaml && git commit -m "chore: bootstrap pnpm workspaces + turborepo scaffolding"
```

---

### Task 2: Move widget source into `packages/widget/`

**Files:**
- Move: root `src/**` → `packages/widget/src/**`
- Create: `packages/widget/package.json`
- Create: `packages/widget/tsconfig.json`
- Create: `packages/widget/tsdown.config.ts`
- Create: `packages/widget/vitest.config.ts`
- Create: `packages/widget/vitest.setup.ts`
- Delete: root `tsconfig.json`, root `tsdown.config.ts`, root `vitest.config.ts`, root `vitest.setup.ts`

- [ ] **Step 1: Move src → packages/widget/src**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && mkdir -p packages/widget && git mv src packages/widget/src
```

- [ ] **Step 2: Move root vitest configs into widget**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git mv vitest.config.ts packages/widget/vitest.config.ts && git mv vitest.setup.ts packages/widget/vitest.setup.ts
```

- [ ] **Step 3: Write `packages/widget/package.json`**

```json
{
  "name": "@agentic-prd/widget",
  "version": "0.0.0",
  "type": "module",
  "description": "Drop-in comment-pin widget",
  "license": "MIT",
  "sideEffects": ["**/*.css"],
  "types": "./src/index.ts",
  "exports": {
    ".": "./dist/index.js",
    "./package.json": "./package.json"
  },
  "files": ["dist", "src"],
  "publishConfig": {
    "access": "public",
    "main": "./dist/index.js",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
      "./package.json": "./package.json"
    }
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "typecheck": "tsgo -p ./tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests",
    "lint": "pnpm biome check . --diagnostic-level=error --max-diagnostics=200"
  },
  "peerDependencies": {
    "react": "*",
    "react-dom": "*"
  },
  "dependencies": {
    "@base-ui/react": "^1.6.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/modifiers": "9.0.0",
    "@dnd-kit/utilities": "3.2.2",
    "@fontsource-variable/inter": "^5.2.8",
    "@hookform/resolvers": "5.4.0",
    "@lexical/code": "^0.46.0",
    "@lexical/extension": "^0.46.0",
    "@lexical/history": "^0.46.0",
    "@lexical/link": "^0.46.0",
    "@lexical/list": "^0.46.0",
    "@lexical/markdown": "^0.46.0",
    "@lexical/react": "^0.46.0",
    "@lexical/rich-text": "^0.46.0",
    "@lexical/selection": "^0.46.0",
    "@lexical/table": "^0.46.0",
    "@lexical/utils": "^0.46.0",
    "@supabase/supabase-js": "^2.110.0",
    "@tanstack/react-query": "^5.101.2",
    "bippy": "0.5.41",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "es-toolkit": "^1.49.0",
    "jotai": "2.20.1",
    "lexical": "^0.46.0",
    "lucide-react": "^1.23.0",
    "overlay-kit": "^1.9.0",
    "react-hook-form": "^7.81.0",
    "tabbable": "6.5.0",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "valibot": "^1.4.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@tsconfig/strictest": "^2.0.8",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "jsdom": "^29.1.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "tsdown": "^0.22.3",
    "vite": "^8.1.3",
    "vitest": "4.1.9"
  }
}
```

- [ ] **Step 4: Write `packages/widget/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "types": ["node", "vitest/globals"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Write `packages/widget/tsdown.config.ts`**

Copy from root's existing `tsdown.config.ts` (verify contents first). If root file no longer exists, use this baseline:

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true
});
```

Then delete root `tsdown.config.ts` if it exists:

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && test -f tsdown.config.ts && git rm tsdown.config.ts || true
```

- [ ] **Step 6: Delete root tsconfig.json**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git rm tsconfig.json
```

- [ ] **Step 7: Install per-workspace**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm install
```

Expected: workspace picks up `packages/widget` and installs its deps.

- [ ] **Step 8: Verify widget typecheck runs**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/widget typecheck
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add -A && git commit -m "refactor: move widget source into packages/widget (@agentic-prd/widget)"
```

---

### Task 3: Move playground into `apps/playground/`

**Files:**
- Move: root `playground/**` → `apps/playground/**`
- Create: `apps/playground/package.json`
- Modify: `apps/playground/vite.config.ts`
- Modify: `apps/playground/src/App.tsx`
- Delete: root `vite.config.ts`

- [ ] **Step 1: Move playground → apps/playground**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && mkdir -p apps && git mv playground apps/playground
```

- [ ] **Step 2: Move root vite config into playground**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git mv vite.config.ts apps/playground/vite.config.ts
```

- [ ] **Step 3: Rewrite `apps/playground/vite.config.ts`**

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * 위젯 개발용 플레이그라운드. root 는 이 디렉터리이며 워크스페이스에서
 * @agentic-prd/widget 을 그대로 import 한다(빌드 불필요).
 */
export default defineConfig({
  plugins: [tailwindcss(), react()]
});
```

- [ ] **Step 4: Update `apps/playground/src/App.tsx` imports**

Replace `import { CommentWidget } from "../../src";` with `import { CommentWidget } from "@agentic-prd/widget";`. Same for any `../../src/...` shadcn UI imports (change to `@agentic-prd/widget` re-exports if the widget exposes them, otherwise leave `../../src/components/ui/...`; check `packages/widget/src/index.ts` for what's exported).

If widget's index only exports `CommentWidget` etc., add re-exports for the playground's needs (see Task 4).

- [ ] **Step 5: Write `apps/playground/package.json`**

```json
{
  "name": "agentic-prd-playground",
  "private": true,
  "type": "module",
  "scripts": {
    "play": "vite",
    "build": "vite build",
    "typecheck": "tsgo -p ./tsconfig.json --noEmit"
  },
  "dependencies": {
    "@agentic-prd/widget": "workspace:*",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.2",
    "@vitejs/plugin-react": "^6.0.3",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "tailwindcss": "^4.3.2",
    "vite": "^8.1.3"
  }
}
```

- [ ] **Step 6: Write `apps/playground/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*", "vite.config.ts"]
}
```

- [ ] **Step 7: Update `apps/playground/src/style.css` `@source` path**

Currently references `../../src`. Change to `../../../packages/widget/src`:

```css
@source "../../../packages/widget/src";
```

Keep the rest of the file intact.

- [ ] **Step 8: Install**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm install
```

- [ ] **Step 9: Verify play boots**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm play &
sleep 5 && curl -sf http://localhost:5173 > /dev/null && echo "OK" || echo "FAIL"
kill %1 || true
```

Expected: `OK`.

- [ ] **Step 10: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add -A && git commit -m "refactor: move playground into apps/playground consuming @agentic-prd/widget"
```

---

### Task 4: Add missing widget re-exports (shadcn UI, hooks, canvas types)

**Files:**
- Modify: `packages/widget/src/index.ts`

The playground currently imports `../../src/components/ui/dialog` etc. After Task 3, those need to come from `@agentic-prd/widget`. Re-export them from the widget's entry.

- [ ] **Step 1: Read current `packages/widget/src/index.ts`**

Read the file.

- [ ] **Step 2: Add re-exports for shadcn UI primitives + related utilities**

Append to `packages/widget/src/index.ts`:

```ts
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
```

- [ ] **Step 3: Update `apps/playground/src/App.tsx` to use the widget package for those**

Replace lines:
```ts
import { … } from "../../src/components/ui/dialog";
import { … } from "../../src/components/ui/select";
```
with:
```ts
import { … } from "@agentic-prd/widget";
```

Merge duplicated import lines. Keep `CommentWidget` import from the same package.

- [ ] **Step 4: typecheck both packages**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/widget typecheck && pnpm --filter agentic-prd-playground typecheck
```

Expected: 0 errors on both.

- [ ] **Step 5: Boot smoke**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm play &
sleep 5 && curl -sf http://localhost:5173 > /dev/null && echo "OK" || echo "FAIL"
kill %1 || true
```

Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add -A && git commit -m "refactor(widget): re-export shadcn ui + wire playground imports"
```

---

### Task 5: `.gitignore` update + full turbo verification

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append monorepo entries**

Add to `.gitignore`:

```
# Turborepo
.turbo/

# Package outputs
packages/*/dist/
apps/*/dist/

# Dev-plugin discovery file
.agentic-prd.dev.json
```

- [ ] **Step 2: Run turbo pipelines**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm typecheck && pnpm test && pnpm build
```

Expected: all commands pass. Test: existing popover container test passes. Build: `packages/widget/dist/` produced.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add .gitignore && git commit -m "chore: gitignore turbo cache, per-package dist, dev discovery file"
```

---

# Phase 2 — dev-plugin package

### Task 6: Bootstrap `packages/dev-plugin/` package

**Files:**
- Create: `packages/dev-plugin/package.json`
- Create: `packages/dev-plugin/tsconfig.json`
- Create: `packages/dev-plugin/tsdown.config.ts`
- Create: `packages/dev-plugin/vitest.config.ts`
- Create: `packages/dev-plugin/src/index.ts`

- [ ] **Step 1: Write `packages/dev-plugin/package.json`**

```json
{
  "name": "@agentic-prd/dev-plugin",
  "version": "0.0.0",
  "type": "module",
  "description": "Vite dev-server sidecar for reading @agentic-prd/widget comments and specs",
  "license": "MIT",
  "exports": {
    ".": "./dist/index.js",
    "./package.json": "./package.json"
  },
  "files": ["dist", "src"],
  "publishConfig": {
    "access": "public",
    "main": "./dist/index.js",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
      "./package.json": "./package.json"
    }
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "typecheck": "tsgo -p ./tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests",
    "lint": "pnpm biome check . --diagnostic-level=error --max-diagnostics=200"
  },
  "peerDependencies": {
    "vite": ">=5"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.110.0"
  },
  "devDependencies": {
    "@types/node": "^26.1.0",
    "tsdown": "^0.22.3",
    "vite": "^8.1.3",
    "vitest": "4.1.9"
  }
}
```

- [ ] **Step 2: Write `packages/dev-plugin/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "types": ["node", "vitest/globals"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `packages/dev-plugin/tsdown.config.ts`**

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  platform: "node",
  format: ["esm"],
  external: ["vite", "@supabase/supabase-js"],
  dts: true,
  clean: true
});
```

- [ ] **Step 4: Write `packages/dev-plugin/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false
  }
});
```

- [ ] **Step 5: Stub `packages/dev-plugin/src/index.ts`**

```ts
/**
 * @agentic-prd/dev-plugin entry.
 * 실제 Vite Plugin 팩토리는 Task 14 에서 채운다.
 */
export {};
```

- [ ] **Step 6: Install**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm install
```

- [ ] **Step 7: Typecheck**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin typecheck
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add -A && git commit -m "chore(dev-plugin): scaffold @agentic-prd/dev-plugin package"
```

---

### Task 7: `slug.ts` — title → slug + collision judgement (TDD)

**Files:**
- Create: `packages/dev-plugin/src/slug.ts`
- Create: `packages/dev-plugin/src/__tests__/slug.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/dev-plugin/src/__tests__/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { slugify, resolveCollisions } from "../slug";

describe("slugify", () => {
  it("kebab-cases ASCII input", () => {
    expect(slugify("Checkout Flow")).toBe("checkout-flow");
  });

  it("preserves Korean characters", () => {
    expect(slugify("결제 흐름")).toBe("결제-흐름");
  });

  it("collapses whitespace/dashes and trims", () => {
    expect(slugify("  Multi   Word   Title  ")).toBe("multi-word-title");
    expect(slugify("-a---b-")).toBe("a-b");
  });

  it("returns 'untitled' for empty input", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("   ")).toBe("untitled");
  });
});

describe("resolveCollisions", () => {
  it("returns <slug>.md for unique slug", () => {
    const result = resolveCollisions([
      { id: "aaaaaaaa1111", title: "Checkout" }
    ]);
    expect(result.get("aaaaaaaa1111")).toBe("checkout.md");
  });

  it("returns <slug>-<idShort>.md for every colliding entry", () => {
    const result = resolveCollisions([
      { id: "aaaaaaaa1111", title: "Checkout" },
      { id: "bbbbbbbb2222", title: "checkout" }
    ]);
    expect(result.get("aaaaaaaa1111")).toBe("checkout-aaaaaaaa.md");
    expect(result.get("bbbbbbbb2222")).toBe("checkout-bbbbbbbb.md");
  });

  it("does not collide when slugs differ", () => {
    const result = resolveCollisions([
      { id: "id1", title: "A" },
      { id: "id2", title: "B" }
    ]);
    expect(result.get("id1")).toBe("a.md");
    expect(result.get("id2")).toBe("b.md");
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test slug
```

Expected: FAIL — module `../slug` not found.

- [ ] **Step 3: Implement `packages/dev-plugin/src/slug.ts`**

```ts
/**
 * Title → 파일명용 slug 변환 및 collision 판정.
 */

export function slugify(title: string): string {
  const normalized = title
    .normalize("NFKC")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "untitled";
}

export interface SlugEntry {
  id: string;
  title: string;
}

/**
 * spec 목록에 대해 slug 를 계산하고, 같은 slug 를 갖는 그룹의 모든 spec 은
 * `<slug>-<idShort>.md` 로, 유일한 것은 `<slug>.md` 로 매핑한다.
 * idShort = UUID 앞 8자.
 */
export function resolveCollisions(entries: SlugEntry[]): Map<string, string> {
  const groups = new Map<string, SlugEntry[]>();
  for (const entry of entries) {
    const slug = slugify(entry.title);
    const bucket = groups.get(slug);
    if (bucket) bucket.push(entry);
    else groups.set(slug, [entry]);
  }
  const filenameById = new Map<string, string>();
  for (const [slug, group] of groups) {
    if (group.length === 1) {
      const only = group[0];
      if (only) filenameById.set(only.id, `${slug}.md`);
    } else {
      for (const entry of group) {
        const idShort = entry.id.slice(0, 8);
        filenameById.set(entry.id, `${slug}-${idShort}.md`);
      }
    }
  }
  return filenameById;
}
```

- [ ] **Step 4: Run tests to see them pass**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test slug
```

Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add packages/dev-plugin/src/slug.ts packages/dev-plugin/src/__tests__/slug.test.ts && git commit -m "feat(dev-plugin): slugify + collision resolution"
```

---

### Task 8: `manifest.ts` — read/write `<specSyncDir>/.sync.json`

**Files:**
- Create: `packages/dev-plugin/src/manifest.ts`
- Create: `packages/dev-plugin/src/__tests__/manifest.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/dev-plugin/src/__tests__/manifest.test.ts`:

```ts
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadManifest, saveManifest, MANIFEST_NAME } from "../manifest";

let dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "manifest-test-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  dirs = [];
});

describe("manifest", () => {
  it("returns empty manifest when file missing", async () => {
    const dir = tmp();
    const manifest = await loadManifest(dir);
    expect(manifest.byId).toEqual({});
  });

  it("round-trips manifest to disk", async () => {
    const dir = tmp();
    await saveManifest(dir, {
      byId: {
        "abc": { file: "checkout.md", syncedAt: 100 }
      }
    });
    const raw = readFileSync(join(dir, MANIFEST_NAME), "utf8");
    expect(JSON.parse(raw)).toEqual({
      byId: {
        "abc": { file: "checkout.md", syncedAt: 100 }
      }
    });
    const roundTripped = await loadManifest(dir);
    expect(roundTripped.byId["abc"]?.file).toBe("checkout.md");
  });

  it("survives malformed manifest by returning empty", async () => {
    const dir = tmp();
    writeFileSync(join(dir, MANIFEST_NAME), "{ not json");
    const manifest = await loadManifest(dir);
    expect(manifest.byId).toEqual({});
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test manifest
```

Expected: module not found.

- [ ] **Step 3: Implement `packages/dev-plugin/src/manifest.ts`**

```ts
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const MANIFEST_NAME = ".sync.json";

export interface ManifestEntry {
  file: string;
  syncedAt: number;
}

export interface Manifest {
  byId: Record<string, ManifestEntry>;
}

/**
 * <specSyncDir>/.sync.json 을 읽는다. 파일 없거나 파싱 실패 시 빈 manifest 반환.
 */
export async function loadManifest(specSyncDir: string): Promise<Manifest> {
  try {
    const raw = await readFile(join(specSyncDir, MANIFEST_NAME), "utf8");
    const parsed = JSON.parse(raw) as Manifest;
    if (parsed && typeof parsed === "object" && parsed.byId) {
      return { byId: parsed.byId };
    }
  } catch {
    // 파일 없음 or JSON 파싱 실패 → 빈 manifest
  }
  return { byId: {} };
}

/** manifest 를 <specSyncDir>/.sync.json 에 덮어쓴다. */
export async function saveManifest(
  specSyncDir: string,
  manifest: Manifest
): Promise<void> {
  await writeFile(
    join(specSyncDir, MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}
```

- [ ] **Step 4: Run to pass**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test manifest
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add packages/dev-plugin/src/manifest.ts packages/dev-plugin/src/__tests__/manifest.test.ts && git commit -m "feat(dev-plugin): sync manifest read/write"
```

---

### Task 9: `anchor-resolver.ts` — selector/reactPath grep → file:line

**Files:**
- Create: `packages/dev-plugin/src/anchor-resolver.ts`
- Create: `packages/dev-plugin/src/__tests__/anchor-resolver.test.ts`
- Create: `packages/dev-plugin/src/types.ts`

- [ ] **Step 1: Write `packages/dev-plugin/src/types.ts` (DTO shared across handlers/resolver)**

```ts
/** widget 이 저장하는 anchor 형태. widget 의 store.ts 와 shape 일치. */
export interface WidgetAnchor {
  scopeChain?: unknown[];
  selector: string;
  relX: number;
  relY: number;
  reactPath?: string[];
  reactSource?: {
    componentName: string;
    key?: string;
    ownerName?: string;
    fileName: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

export type LocationKind =
  | "reactSource"
  | "testid"
  | "id-attr"
  | "reactPath";

export interface LocationCandidate {
  file: string;
  line: number;
  evidence: string;
  kind: LocationKind;
  confidence: number;
}
```

- [ ] **Step 2: Write failing tests**

`packages/dev-plugin/src/__tests__/anchor-resolver.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAnchorLocation } from "../anchor-resolver";

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "anchor-test-"));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, contents, "utf8");
  }
  return root;
}

describe("resolveAnchorLocation", () => {
  it("returns reactSource directly when populated", async () => {
    const root = makeProject({});
    const result = await resolveAnchorLocation(root, {
      selector: "*",
      relX: 0,
      relY: 0,
      reactSource: {
        componentName: "App",
        fileName: "apps/playground/src/App.tsx",
        lineNumber: 42,
        columnNumber: 3
      }
    });
    expect(result[0]).toMatchObject({
      file: "apps/playground/src/App.tsx",
      line: 42,
      kind: "reactSource",
      confidence: 1
    });
  });

  it("grep-locates data-testid attribute value", async () => {
    const root = makeProject({
      "apps/playground/src/App.tsx": [
        "export function App() {",
        "  return <li data-testid=\"row-11\">항목 12</li>;",
        "}"
      ].join("\n")
    });
    const result = await resolveAnchorLocation(root, {
      selector: "[data-testid=\"row-11\"]",
      relX: 0,
      relY: 0
    });
    expect(result[0]).toMatchObject({
      file: "apps/playground/src/App.tsx",
      line: 2,
      kind: "testid",
      confidence: 0.8
    });
  });

  it("grep-locates named function component via reactPath", async () => {
    const root = makeProject({
      "packages/widget/src/CommentWidget.tsx": [
        "export function CommentWidget() {",
        "  return null;",
        "}"
      ].join("\n")
    });
    const result = await resolveAnchorLocation(root, {
      selector: "div",
      relX: 0,
      relY: 0,
      reactPath: ["CommentWidget", "App"]
    });
    expect(result[0]).toMatchObject({
      file: "packages/widget/src/CommentWidget.tsx",
      line: 1,
      kind: "reactPath",
      confidence: 0.5
    });
  });

  it("returns empty when nothing matches", async () => {
    const root = makeProject({});
    const result = await resolveAnchorLocation(root, {
      selector: "*",
      relX: 0,
      relY: 0
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to fail**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test anchor-resolver
```

Expected: module not found.

- [ ] **Step 4: Implement `packages/dev-plugin/src/anchor-resolver.ts`**

```ts
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type {
  LocationCandidate,
  WidgetAnchor
} from "./types";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".git",
  "docs",
  ".next",
  ".vite",
  "plugins"
]);
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);
const MAX_CANDIDATES = 5;

async function walkSources(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        const dotIdx = entry.name.lastIndexOf(".");
        const ext = dotIdx >= 0 ? entry.name.slice(dotIdx) : "";
        if (SOURCE_EXT.has(ext)) files.push(full);
      }
    }
  }
  const rootStat = await stat(root).catch(() => null);
  if (rootStat?.isDirectory()) await walk(root);
  return files;
}

interface Match {
  file: string;
  line: number;
  evidence: string;
}

async function grepAll(
  files: string[],
  regex: RegExp,
  evidenceFrom: (match: RegExpMatchArray, lineText: string) => string
): Promise<Match[]> {
  const results: Match[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8").catch(() => "");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i] ?? "";
      const match = lineText.match(regex);
      if (match) {
        results.push({
          file,
          line: i + 1,
          evidence: evidenceFrom(match, lineText)
        });
        if (results.length >= MAX_CANDIDATES) return results;
      }
    }
  }
  return results;
}

function extractSelectorAttribute(
  selector: string,
  attr: string
): string | undefined {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[${escaped}=(?:"|')([^"'\\]]+)(?:"|')\\]`);
  const match = selector.match(re);
  return match?.[1];
}

export async function resolveAnchorLocation(
  projectRoot: string,
  anchor: WidgetAnchor
): Promise<LocationCandidate[]> {
  const out: LocationCandidate[] = [];

  if (anchor.reactSource?.fileName) {
    out.push({
      file: anchor.reactSource.fileName,
      line: anchor.reactSource.lineNumber ?? 1,
      evidence: `reactSource ${anchor.reactSource.componentName}`,
      kind: "reactSource",
      confidence: 1
    });
    if (out.length >= MAX_CANDIDATES) return out;
  }

  const files = await walkSources(projectRoot);

  const testid = extractSelectorAttribute(anchor.selector, "data-testid");
  if (testid) {
    const re = new RegExp(`data-testid=(?:"|')${testid}(?:"|')`);
    for (const match of await grepAll(
      files,
      re,
      () => `data-testid="${testid}"`
    )) {
      out.push({
        file: relative(projectRoot, match.file).replace(/\\/g, "/"),
        line: match.line,
        evidence: match.evidence,
        kind: "testid",
        confidence: 0.8
      });
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }

  const idAttr = extractSelectorAttribute(anchor.selector, "id");
  if (idAttr) {
    const re = new RegExp(`id=(?:"|')${idAttr}(?:"|')`);
    for (const match of await grepAll(files, re, () => `id="${idAttr}"`)) {
      out.push({
        file: relative(projectRoot, match.file).replace(/\\/g, "/"),
        line: match.line,
        evidence: match.evidence,
        kind: "id-attr",
        confidence: 0.8
      });
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }

  if (anchor.reactPath && anchor.reactPath.length > 0) {
    for (const name of anchor.reactPath) {
      const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `(?:export\\s+(?:default\\s+)?function\\s+${safe}\\s*\\(|function\\s+${safe}\\s*\\(|const\\s+${safe}\\s*=\\s*(?:memo\\(|forwardRef\\(|\\())`
      );
      for (const match of await grepAll(
        files,
        re,
        (m) => `matched component ${name}: ${m[0].slice(0, 50)}`
      )) {
        out.push({
          file: relative(projectRoot, match.file).replace(/\\/g, "/"),
          line: match.line,
          evidence: match.evidence,
          kind: "reactPath",
          confidence: 0.5
        });
        if (out.length >= MAX_CANDIDATES) return out;
      }
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }

  return out;
}
```

- [ ] **Step 5: Run to pass**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test anchor-resolver
```

Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add packages/dev-plugin/src/anchor-resolver.ts packages/dev-plugin/src/__tests__/anchor-resolver.test.ts packages/dev-plugin/src/types.ts && git commit -m "feat(dev-plugin): anchor → source file:line resolver"
```

---

### Task 10: `supabase.ts` — server-side Supabase client wrapper

**Files:**
- Create: `packages/dev-plugin/src/supabase.ts`

- [ ] **Step 1: Implement wrapper**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface StorageConfig {
  url: string;
  publicKey: string;
}

export interface ThreadRow {
  id: string;
  path: string;
  x_pct: number;
  y_pct: number;
  anchor: unknown;
  resolved: boolean;
  comments: unknown;
  updated_at: string;
}

export interface SpecRow {
  id: string;
  path: string;
  title: string;
  status: "DRAFT" | "REVIEW" | "CONFIRMED";
  sections: { body?: string } | null;
  updated_by: string;
  updated_at: string;
}

const THREAD_TABLE = "demo_comments";
const SPEC_TABLE = "demo_specs";

export interface DevSupabase {
  listThreads(filter: {
    path?: string;
    resolved?: boolean;
    limit?: number;
  }): Promise<ThreadRow[]>;
  getThread(id: string): Promise<ThreadRow | null>;
  setThreadResolved(id: string, resolved: boolean): Promise<ThreadRow>;
  listSpecs(filter: { path?: string }): Promise<SpecRow[]>;
  getSpec(id: string): Promise<SpecRow | null>;
}

export function createDevSupabase(config: StorageConfig): DevSupabase {
  const client: SupabaseClient = createClient(config.url, config.publicKey, {
    auth: { persistSession: false }
  });

  return {
    async listThreads({ path, resolved, limit = 100 }) {
      let query = client.from(THREAD_TABLE).select("*").limit(limit);
      if (path) query = query.eq("path", path);
      if (typeof resolved === "boolean") query = query.eq("resolved", resolved);
      const { data, error } = await query.order("updated_at", {
        ascending: false
      });
      if (error) throw error;
      return (data ?? []) as ThreadRow[];
    },
    async getThread(id) {
      const { data, error } = await client
        .from(THREAD_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as ThreadRow | null) ?? null;
    },
    async setThreadResolved(id, resolved) {
      const { data, error } = await client
        .from(THREAD_TABLE)
        .update({
          resolved,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ThreadRow;
    },
    async listSpecs({ path }) {
      let query = client.from(SPEC_TABLE).select("*");
      if (path) query = query.eq("path", path);
      const { data, error } = await query.order("updated_at", {
        ascending: false
      });
      if (error) throw error;
      return (data ?? []) as SpecRow[];
    },
    async getSpec(id) {
      const { data, error } = await client
        .from(SPEC_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as SpecRow | null) ?? null;
    }
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add packages/dev-plugin/src/supabase.ts && git commit -m "feat(dev-plugin): server-side supabase client wrapper"
```

---

### Task 11: `handlers/threads.ts` — list/get/resolve/unresolve/location

**Files:**
- Create: `packages/dev-plugin/src/handlers/threads.ts`
- Create: `packages/dev-plugin/src/__tests__/threads.test.ts`

- [ ] **Step 1: Write failing tests using an in-memory fake supabase**

`packages/dev-plugin/src/__tests__/threads.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  handleListThreads,
  handleGetThread,
  handleSetResolved,
  handleThreadLocation
} from "../handlers/threads";
import type { DevSupabase, ThreadRow } from "../supabase";

function makeFake(rows: ThreadRow[]): DevSupabase {
  const store = new Map(rows.map((r) => [r.id, { ...r }]));
  return {
    async listThreads({ path, resolved }) {
      return Array.from(store.values()).filter(
        (r) =>
          (!path || r.path === path) &&
          (typeof resolved !== "boolean" || r.resolved === resolved)
      );
    },
    async getThread(id) {
      return store.get(id) ?? null;
    },
    async setThreadResolved(id, resolved) {
      const row = store.get(id);
      if (!row) throw new Error("not found");
      row.resolved = resolved;
      return row;
    },
    async listSpecs() {
      return [];
    },
    async getSpec() {
      return null;
    }
  };
}

const row: ThreadRow = {
  id: "t1",
  path: "/",
  x_pct: 0,
  y_pct: 0,
  anchor: {
    selector: "[data-testid=\"row-1\"]",
    relX: 0,
    relY: 0,
    reactPath: ["App"]
  },
  resolved: false,
  comments: [{ id: "c1", author: "A", text: "hi", at: 1 }],
  updated_at: new Date(0).toISOString()
};

describe("threads handlers", () => {
  it("lists unresolved threads only when filter set", async () => {
    const s = makeFake([row, { ...row, id: "t2", resolved: true }]);
    const res = await handleListThreads(s, { resolved: false });
    expect(res.map((t) => t.id)).toEqual(["t1"]);
  });

  it("returns a single thread with normalized comments", async () => {
    const s = makeFake([row]);
    const res = await handleGetThread(s, "t1");
    expect(res?.id).toBe("t1");
    expect(res?.comments[0]?.text).toBe("hi");
  });

  it("toggles resolved via setResolved handler", async () => {
    const s = makeFake([row]);
    const res = await handleSetResolved(s, "t1", true);
    expect(res.resolved).toBe(true);
  });

  it("returns location candidates for anchor testid", async () => {
    const s = makeFake([row]);
    const tmpRoot = mkdtempSync(join(tmpdir(), "threads-loc-"));
    const res = await handleThreadLocation(s, tmpRoot, "t1");
    expect(res).toEqual({ candidates: [] });
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test threads
```

Expected: module not found.

- [ ] **Step 3: Implement `packages/dev-plugin/src/handlers/threads.ts`**

```ts
import { resolveAnchorLocation } from "../anchor-resolver";
import type { DevSupabase, ThreadRow } from "../supabase";
import type { LocationCandidate, WidgetAnchor } from "../types";

export interface CommentDTO {
  id: string;
  author: string;
  text: string;
  at: number;
}
export interface ThreadDTO {
  id: string;
  path: string;
  resolved: boolean;
  updatedAt: number;
  comments: CommentDTO[];
  anchor?: WidgetAnchor;
}

function toDTO(row: ThreadRow): ThreadDTO {
  const comments = Array.isArray(row.comments)
    ? (row.comments as CommentDTO[])
    : [];
  return {
    id: row.id,
    path: row.path,
    resolved: row.resolved,
    updatedAt: new Date(row.updated_at).getTime(),
    comments,
    anchor: (row.anchor as WidgetAnchor) ?? undefined
  };
}

export async function handleListThreads(
  supabase: DevSupabase,
  filter: { path?: string; resolved?: boolean; limit?: number }
): Promise<ThreadDTO[]> {
  const rows = await supabase.listThreads(filter);
  return rows.map(toDTO);
}

export async function handleGetThread(
  supabase: DevSupabase,
  id: string
): Promise<ThreadDTO | null> {
  const row = await supabase.getThread(id);
  return row ? toDTO(row) : null;
}

export async function handleSetResolved(
  supabase: DevSupabase,
  id: string,
  resolved: boolean
): Promise<ThreadDTO> {
  const row = await supabase.setThreadResolved(id, resolved);
  return toDTO(row);
}

export async function handleThreadLocation(
  supabase: DevSupabase,
  projectRoot: string,
  id: string
): Promise<{ candidates: LocationCandidate[] }> {
  const row = await supabase.getThread(id);
  if (!row?.anchor) return { candidates: [] };
  const candidates = await resolveAnchorLocation(
    projectRoot,
    row.anchor as WidgetAnchor
  );
  return { candidates };
}
```

- [ ] **Step 4: Run to pass**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test threads
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add packages/dev-plugin/src/handlers/threads.ts packages/dev-plugin/src/__tests__/threads.test.ts && git commit -m "feat(dev-plugin): thread handlers (list/get/setResolved/location)"
```

---

### Task 12: `handlers/specs.ts` — list/get/sync-one/sync-all

**Files:**
- Create: `packages/dev-plugin/src/handlers/specs.ts`
- Create: `packages/dev-plugin/src/__tests__/specs.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/dev-plugin/src/__tests__/specs.test.ts`:

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handleListSpecs, handleGetSpec, handleSyncAll } from "../handlers/specs";
import type { DevSupabase, SpecRow } from "../supabase";

function makeFake(rows: SpecRow[]): DevSupabase {
  const store = new Map(rows.map((r) => [r.id, r]));
  return {
    async listThreads() { return []; },
    async getThread() { return null; },
    async setThreadResolved() { throw new Error("unused"); },
    async listSpecs({ path }) {
      return Array.from(store.values()).filter(
        (r) => !path || r.path === path
      );
    },
    async getSpec(id) {
      return store.get(id) ?? null;
    }
  };
}

const row: SpecRow = {
  id: "aaaaaaaa1111",
  path: "/",
  title: "Checkout",
  status: "DRAFT",
  sections: { body: "# hello" },
  updated_by: "tester",
  updated_at: new Date(0).toISOString()
};

describe("specs handlers", () => {
  it("lists specs", async () => {
    const s = makeFake([row]);
    const res = await handleListSpecs(s, {});
    expect(res).toHaveLength(1);
    expect(res[0]?.title).toBe("Checkout");
  });

  it("returns single spec with body", async () => {
    const s = makeFake([row]);
    const res = await handleGetSpec(s, "aaaaaaaa1111");
    expect(res?.body).toBe("# hello");
  });

  it("syncs unique-slug spec to <slug>.md", async () => {
    const s = makeFake([row]);
    const dir = mkdtempSync(join(tmpdir(), "sync-"));
    const res = await handleSyncAll(s, dir, {});
    expect(res.synced[0]?.localPath.endsWith("checkout.md")).toBe(true);
    expect(res.synced[0]?.collided).toBe(false);
    const file = readFileSync(res.synced[0]!.localPath, "utf8");
    expect(file).toContain("agentic-prd:spec id=aaaaaaaa1111");
    expect(file).toContain("# Checkout");
    expect(file).toContain("# hello");
  });

  it("syncs colliding specs with idShort suffix", async () => {
    const s = makeFake([
      row,
      { ...row, id: "bbbbbbbb2222", title: "checkout" }
    ]);
    const dir = mkdtempSync(join(tmpdir(), "sync2-"));
    const res = await handleSyncAll(s, dir, {});
    const names = res.synced.map((r) => r.localPath.split(/[\\/]/).pop());
    expect(names).toContain("checkout-aaaaaaaa.md");
    expect(names).toContain("checkout-bbbbbbbb.md");
    expect(res.synced.every((r) => r.collided)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test specs
```

Expected: module not found.

- [ ] **Step 3: Implement `packages/dev-plugin/src/handlers/specs.ts`**

```ts
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadManifest, saveManifest } from "../manifest";
import { resolveCollisions } from "../slug";
import type { DevSupabase, SpecRow } from "../supabase";

export interface SpecDTO {
  id: string;
  path: string;
  title: string;
  status: SpecRow["status"];
  body: string;
  externalUrl?: string;
  updatedBy: string;
  updatedAt: number;
}

export interface SyncedSpec {
  id: string;
  localPath: string;
  collided: boolean;
}

function toDTO(row: SpecRow): SpecDTO {
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    status: row.status,
    body: row.sections?.body ?? "",
    updatedBy: row.updated_by,
    updatedAt: new Date(row.updated_at).getTime()
  };
}

function fileHeader(spec: SpecDTO): string {
  const iso = new Date(spec.updatedAt).toISOString();
  return `<!-- agentic-prd:spec id=${spec.id} updatedAt=${iso} status=${spec.status} -->\n\n# ${spec.title}\n\n`;
}

export async function handleListSpecs(
  supabase: DevSupabase,
  filter: { path?: string }
): Promise<SpecDTO[]> {
  const rows = await supabase.listSpecs(filter);
  return rows.map(toDTO);
}

export async function handleGetSpec(
  supabase: DevSupabase,
  id: string
): Promise<SpecDTO | null> {
  const row = await supabase.getSpec(id);
  return row ? toDTO(row) : null;
}

export async function handleSyncAll(
  supabase: DevSupabase,
  specSyncDir: string,
  filter: { path?: string }
): Promise<{ synced: SyncedSpec[]; removed: string[] }> {
  const rows = await supabase.listSpecs(filter);
  const specs = rows.map(toDTO);

  await mkdir(specSyncDir, { recursive: true });
  const manifest = await loadManifest(specSyncDir);
  const filenameById = resolveCollisions(
    specs.map(({ id, title }) => ({ id, title }))
  );

  const synced: SyncedSpec[] = [];
  const writtenFiles = new Set<string>();
  for (const spec of specs) {
    const filename = filenameById.get(spec.id);
    if (!filename) continue;
    const localPath = join(specSyncDir, filename);
    const body = `${fileHeader(spec)}${spec.body}\n`;
    await writeFile(localPath, body, "utf8");
    const nameWithoutExt = filename.slice(0, -3);
    const baseSlug = nameWithoutExt.replace(/-[0-9a-f]{8}$/, "");
    synced.push({
      id: spec.id,
      localPath,
      collided: nameWithoutExt !== baseSlug
    });
    manifest.byId[spec.id] = { file: filename, syncedAt: Date.now() };
    writtenFiles.add(filename);
  }

  const removed: string[] = [];
  for (const [id, entry] of Object.entries(manifest.byId)) {
    if (!filenameById.has(id) || !writtenFiles.has(entry.file)) {
      const stale = join(specSyncDir, entry.file);
      await unlink(stale).catch(() => undefined);
      removed.push(entry.file);
      delete manifest.byId[id];
    }
  }

  await saveManifest(specSyncDir, manifest);
  return { synced, removed };
}

export async function handleSyncOne(
  supabase: DevSupabase,
  specSyncDir: string,
  id: string
): Promise<SyncedSpec | null> {
  const target = await supabase.getSpec(id);
  if (!target) return null;
  const siblings = await supabase.listSpecs({ path: target.path });
  const filenameById = resolveCollisions(
    siblings.map((r) => ({ id: r.id, title: r.title }))
  );
  const filename = filenameById.get(id);
  if (!filename) return null;
  await mkdir(specSyncDir, { recursive: true });
  const spec = toDTO(target);
  const localPath = join(specSyncDir, filename);
  await writeFile(localPath, `${fileHeader(spec)}${spec.body}\n`, "utf8");
  const manifest = await loadManifest(specSyncDir);
  manifest.byId[id] = { file: filename, syncedAt: Date.now() };
  await saveManifest(specSyncDir, manifest);
  const nameWithoutExt = filename.slice(0, -3);
  const baseSlug = nameWithoutExt.replace(/-[0-9a-f]{8}$/, "");
  return { id, localPath, collided: nameWithoutExt !== baseSlug };
}
```

- [ ] **Step 4: Run to pass**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test specs
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add packages/dev-plugin/src/handlers/specs.ts packages/dev-plugin/src/__tests__/specs.test.ts && git commit -m "feat(dev-plugin): spec handlers (list/get/sync-one/sync-all)"
```

---

### Task 13: `router.ts` — method + path match dispatch

**Files:**
- Create: `packages/dev-plugin/src/router.ts`
- Create: `packages/dev-plugin/src/__tests__/router.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/dev-plugin/src/__tests__/router.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchRoute } from "../router";

describe("matchRoute", () => {
  it("matches GET /threads", () => {
    const r = matchRoute("GET", "/threads");
    expect(r?.kind).toBe("listThreads");
    expect(r?.params).toEqual({});
  });

  it("captures :id in GET /threads/:id", () => {
    const r = matchRoute("GET", "/threads/abc");
    expect(r?.kind).toBe("getThread");
    expect(r?.params).toEqual({ id: "abc" });
  });

  it("distinguishes POST /threads/:id/resolve and /unresolve", () => {
    expect(matchRoute("POST", "/threads/x/resolve")?.kind).toBe(
      "resolveThread"
    );
    expect(matchRoute("POST", "/threads/x/unresolve")?.kind).toBe(
      "unresolveThread"
    );
  });

  it("captures :id in GET /threads/:id/location", () => {
    const r = matchRoute("GET", "/threads/xyz/location");
    expect(r?.kind).toBe("threadLocation");
    expect(r?.params).toEqual({ id: "xyz" });
  });

  it("matches specs routes", () => {
    expect(matchRoute("GET", "/specs")?.kind).toBe("listSpecs");
    expect(matchRoute("GET", "/specs/1")?.kind).toBe("getSpec");
    expect(matchRoute("POST", "/specs/sync")?.kind).toBe("syncSpecs");
    expect(matchRoute("POST", "/specs/1/sync")?.kind).toBe("syncOneSpec");
  });

  it("returns null on unknown route", () => {
    expect(matchRoute("PUT", "/threads")).toBeNull();
    expect(matchRoute("GET", "/nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test router
```

Expected: module not found.

- [ ] **Step 3: Implement `packages/dev-plugin/src/router.ts`**

```ts
export type RouteKind =
  | "listThreads"
  | "getThread"
  | "resolveThread"
  | "unresolveThread"
  | "threadLocation"
  | "listSpecs"
  | "getSpec"
  | "syncSpecs"
  | "syncOneSpec";

export interface Route {
  kind: RouteKind;
  params: Record<string, string>;
}

interface Def {
  method: "GET" | "POST";
  pattern: RegExp;
  kind: RouteKind;
  paramNames: string[];
}

const DEFS: Def[] = [
  { method: "GET", pattern: /^\/threads\/?$/, kind: "listThreads", paramNames: [] },
  { method: "GET", pattern: /^\/threads\/([^/]+)\/location\/?$/, kind: "threadLocation", paramNames: ["id"] },
  { method: "POST", pattern: /^\/threads\/([^/]+)\/resolve\/?$/, kind: "resolveThread", paramNames: ["id"] },
  { method: "POST", pattern: /^\/threads\/([^/]+)\/unresolve\/?$/, kind: "unresolveThread", paramNames: ["id"] },
  { method: "GET", pattern: /^\/threads\/([^/]+)\/?$/, kind: "getThread", paramNames: ["id"] },
  { method: "GET", pattern: /^\/specs\/?$/, kind: "listSpecs", paramNames: [] },
  { method: "POST", pattern: /^\/specs\/sync\/?$/, kind: "syncSpecs", paramNames: [] },
  { method: "POST", pattern: /^\/specs\/([^/]+)\/sync\/?$/, kind: "syncOneSpec", paramNames: ["id"] },
  { method: "GET", pattern: /^\/specs\/([^/]+)\/?$/, kind: "getSpec", paramNames: ["id"] }
];

export function matchRoute(method: string, path: string): Route | null {
  for (const def of DEFS) {
    if (def.method !== method) continue;
    const match = path.match(def.pattern);
    if (!match) continue;
    const params: Record<string, string> = {};
    def.paramNames.forEach((name, i) => {
      const value = match[i + 1];
      if (value !== undefined) params[name] = value;
    });
    return { kind: def.kind, params };
  }
  return null;
}
```

- [ ] **Step 4: Run to pass**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin test router
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add packages/dev-plugin/src/router.ts packages/dev-plugin/src/__tests__/router.test.ts && git commit -m "feat(dev-plugin): route matching"
```

---

### Task 14: `plugin.ts` — Vite Plugin object with `configureServer` + discovery file

**Files:**
- Create: `packages/dev-plugin/src/plugin.ts`
- Modify: `packages/dev-plugin/src/index.ts`

- [ ] **Step 1: Implement `packages/dev-plugin/src/plugin.ts`**

```ts
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import {
  handleGetThread,
  handleListThreads,
  handleSetResolved,
  handleThreadLocation
} from "./handlers/threads";
import {
  handleGetSpec,
  handleListSpecs,
  handleSyncAll,
  handleSyncOne
} from "./handlers/specs";
import { matchRoute } from "./router";
import { createDevSupabase, type StorageConfig } from "./supabase";

export interface AgenticPRDDevOptions {
  storage: StorageConfig;
  specSyncDir?: string;
  projectRoot?: string;
  prefix?: string;
}

const DISCOVERY_FILE = ".agentic-prd.dev.json";

function findWorkspaceRoot(start: string): string {
  let current = start;
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

function isLocal(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress ?? "";
  return (
    addr === "127.0.0.1" ||
    addr === "::1" ||
    addr === "::ffff:127.0.0.1"
  );
}

function sendJSON(
  res: ServerResponse,
  status: number,
  body: unknown
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJSON(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseQuery(url: string): URLSearchParams {
  const qIdx = url.indexOf("?");
  if (qIdx < 0) return new URLSearchParams();
  return new URLSearchParams(url.slice(qIdx + 1));
}

export default function agenticPRDDev(options: AgenticPRDDevOptions): Plugin {
  const prefix = options.prefix ?? "/__agentic-prd";
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  const projectRoot = options.projectRoot
    ? isAbsolute(options.projectRoot)
      ? options.projectRoot
      : resolve(workspaceRoot, options.projectRoot)
    : workspaceRoot;
  const specSyncDir = options.specSyncDir
    ? isAbsolute(options.specSyncDir)
      ? options.specSyncDir
      : resolve(workspaceRoot, options.specSyncDir)
    : resolve(workspaceRoot, "docs/specs");
  const supabase = createDevSupabase(options.storage);
  const discoveryPath = join(workspaceRoot, DISCOVERY_FILE);

  return {
    name: "agentic-prd:dev",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      const port = server.config.server?.port ?? 5173;
      writeFileSync(
        discoveryPath,
        `${JSON.stringify({ port, prefix }, null, 2)}\n`,
        "utf8"
      );
      const cleanup = () => {
        try {
          if (existsSync(discoveryPath)) unlinkSync(discoveryPath);
        } catch {
          // best effort
        }
      };
      server.httpServer?.on("close", cleanup);
      process.once("SIGINT", cleanup);
      process.once("SIGTERM", cleanup);
      process.once("exit", cleanup);

      server.middlewares.use(prefix, async (req, res, next) => {
        try {
          if (!isLocal(req)) {
            sendJSON(res, 403, {
              error: "forbidden",
              message: "localhost only"
            });
            return;
          }
          const url = req.url ?? "";
          const method = req.method ?? "GET";
          const pathname = url.split("?", 1)[0] ?? "/";
          const route = matchRoute(method, pathname);
          if (!route) {
            next();
            return;
          }
          const query = parseQuery(url);

          switch (route.kind) {
            case "listThreads": {
              const resolved = query.get("resolved");
              const result = await handleListThreads(supabase, {
                path: query.get("path") ?? undefined,
                resolved:
                  resolved === null ? undefined : resolved === "true",
                limit: query.get("limit")
                  ? Number.parseInt(query.get("limit") ?? "0", 10)
                  : undefined
              });
              sendJSON(res, 200, result);
              return;
            }
            case "getThread": {
              const id = route.params.id ?? "";
              const thread = await handleGetThread(supabase, id);
              if (!thread) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id
                });
                return;
              }
              sendJSON(res, 200, thread);
              return;
            }
            case "threadLocation": {
              const id = route.params.id ?? "";
              const result = await handleThreadLocation(
                supabase,
                projectRoot,
                id
              );
              sendJSON(res, 200, result);
              return;
            }
            case "resolveThread":
            case "unresolveThread": {
              const id = route.params.id ?? "";
              const resolvedFlag = route.kind === "resolveThread";
              const result = await handleSetResolved(supabase, id, resolvedFlag);
              sendJSON(res, 200, result);
              return;
            }
            case "listSpecs": {
              const result = await handleListSpecs(supabase, {
                path: query.get("path") ?? undefined
              });
              sendJSON(res, 200, result);
              return;
            }
            case "getSpec": {
              const id = route.params.id ?? "";
              const spec = await handleGetSpec(supabase, id);
              if (!spec) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "spec",
                  id
                });
                return;
              }
              sendJSON(res, 200, spec);
              return;
            }
            case "syncSpecs": {
              // 사이드 이펙트: readJSON 은 안 씀. 쿼리 path 만 본다.
              void (await readJSON(req));
              const result = await handleSyncAll(supabase, specSyncDir, {
                path: query.get("path") ?? undefined
              });
              sendJSON(res, 200, result);
              return;
            }
            case "syncOneSpec": {
              const id = route.params.id ?? "";
              const result = await handleSyncOne(supabase, specSyncDir, id);
              if (!result) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "spec",
                  id
                });
                return;
              }
              sendJSON(res, 200, result);
              return;
            }
          }
        } catch (err) {
          const error = err as Error;
          sendJSON(res, 500, {
            error: "internal",
            message: error.message,
            stack: error.stack
          });
        }
      });
    }
  };
}
```

- [ ] **Step 2: Update `packages/dev-plugin/src/index.ts`**

```ts
export { default } from "./plugin";
export type { AgenticPRDDevOptions } from "./plugin";
export type {
  ThreadDTO,
  CommentDTO,
  SyncedSpec,
  SpecDTO
} from "./handlers/specs";
export type {
  LocationCandidate,
  LocationKind,
  WidgetAnchor
} from "./types";
```

*Note: this pulls both `SyncedSpec`/`SpecDTO` from `handlers/specs.ts` and `ThreadDTO`/`CommentDTO` from `handlers/threads.ts`. Split the re-exports accordingly:*

Actually replace step 2 body with:

```ts
export { default } from "./plugin";
export type { AgenticPRDDevOptions } from "./plugin";
export type { CommentDTO, ThreadDTO } from "./handlers/threads";
export type { SpecDTO, SyncedSpec } from "./handlers/specs";
export type {
  LocationCandidate,
  LocationKind,
  WidgetAnchor
} from "./types";
```

- [ ] **Step 3: Typecheck**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Build**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm --filter @agentic-prd/dev-plugin build
```

Expected: `dist/index.js` and `dist/index.d.ts` produced.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add packages/dev-plugin/src/plugin.ts packages/dev-plugin/src/index.ts && git commit -m "feat(dev-plugin): Vite Plugin middleware + discovery file"
```

---

### Task 15: Wire dev-plugin into playground + end-to-end smoke

**Files:**
- Modify: `apps/playground/vite.config.ts`
- Modify: `apps/playground/package.json`

- [ ] **Step 1: Add workspace dep to playground**

Edit `apps/playground/package.json`, add to `dependencies`:

```json
    "@agentic-prd/dev-plugin": "workspace:*",
```

- [ ] **Step 2: Update `apps/playground/vite.config.ts`**

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import agenticPRDDev from "@agentic-prd/dev-plugin";

/**
 * 위젯 개발용 플레이그라운드. @agentic-prd/dev-plugin 이 dev 서버에 사이드카로
 * 붙어 코멘트/스펙 조회 endpoint 를 열어준다.
 */
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    agenticPRDDev({
      storage: {
        url: "https://rcspbbhdwffpnimefyeu.supabase.co",
        publicKey: "sb_publishable_1xY8wrIcq36-nf4DULOWGg_o2NTWzdJ"
      },
      specSyncDir: "docs/specs"
    })
  ]
});
```

- [ ] **Step 3: Install workspace refresh**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm install
```

- [ ] **Step 4: Boot + curl smoke**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm play &
sleep 8
curl -sf "http://127.0.0.1:5173/__agentic-prd/threads?resolved=false" | head -c 500
echo
curl -sf "http://127.0.0.1:5173/__agentic-prd/specs" | head -c 500
kill %1 || true
```

Expected: both curls return JSON arrays. Discovery file `.agentic-prd.dev.json` created at repo root during boot, removed on shutdown.

- [ ] **Step 5: Verify discovery file lifecycle**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && pnpm play &
sleep 5
test -f ".agentic-prd.dev.json" && cat ".agentic-prd.dev.json" && echo "created"
kill %1 || true
sleep 2
test -f ".agentic-prd.dev.json" || echo "removed on exit"
```

Expected: file exists during play, removed on exit.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add -A && git commit -m "feat(playground): wire @agentic-prd/dev-plugin sidecar"
```

---

# Phase 3 — Claude Code Skill

### Task 16: Skill scaffold + list-threads command

**Files:**
- Create: `plugins/agentic-prd-skill/plugin.json`
- Create: `plugins/agentic-prd-skill/skills/agentic-prd.md`
- Create: `plugins/agentic-prd-skill/commands/list-threads.md`
- Create: `plugins/agentic-prd-skill/README.md`

- [ ] **Step 1: Write `plugins/agentic-prd-skill/plugin.json`**

```json
{
  "name": "agentic-prd",
  "version": "0.1.0",
  "description": "Talk to a running @agentic-prd/dev-plugin from Claude Code. List comments, resolve threads, sync specs."
}
```

- [ ] **Step 2: Write `plugins/agentic-prd-skill/skills/agentic-prd.md`**

```markdown
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
```

- [ ] **Step 3: Write `plugins/agentic-prd-skill/commands/list-threads.md`**

```markdown
---
name: list-threads
description: List unresolved comment threads on the running dev server.
---

Read `.agentic-prd.dev.json` at the workspace root, then run:

```bash
curl -sf "http://127.0.0.1:{port}{prefix}/threads?resolved=false"
```

Present each thread's `path`, first comment `text` (truncated to 80 chars), and `id`. Sort by most recent `updatedAt` first.
```

- [ ] **Step 4: Write README**

`plugins/agentic-prd-skill/README.md`:

```markdown
# agentic-prd Claude Code skill

Companion skill for [`@agentic-prd/dev-plugin`](../../packages/dev-plugin). Use natural language commands inside Claude Code to interact with a running widget dev server.

## Install

Copy or symlink this directory into `~/.claude/plugins/`:

```bash
ln -s "$(pwd)/plugins/agentic-prd-skill" "$HOME/.claude/plugins/agentic-prd-skill"
```

Restart Claude Code. Verify the skill loads by running `/agentic-prd:list-threads` from a workspace that has `pnpm play` running.
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add plugins/agentic-prd-skill && git commit -m "feat(skill): agentic-prd Claude Code skill scaffold + list-threads"
```

---

### Task 17: Add remaining skill commands (thread, resolve, unresolve, sync-specs)

**Files:**
- Create: `plugins/agentic-prd-skill/commands/thread.md`
- Create: `plugins/agentic-prd-skill/commands/resolve.md`
- Create: `plugins/agentic-prd-skill/commands/unresolve.md`
- Create: `plugins/agentic-prd-skill/commands/sync-specs.md`

- [ ] **Step 1: `commands/thread.md`**

```markdown
---
name: thread
description: Show a thread's full comments plus candidate source locations.
---

Args: `<thread-id>`.

Read `.agentic-prd.dev.json`, then run these two calls in parallel:

```bash
curl -sf "http://127.0.0.1:{port}{prefix}/threads/{id}"
curl -sf "http://127.0.0.1:{port}{prefix}/threads/{id}/location"
```

Present the thread's `path`, `resolved` state, and every comment (`author`: `text`) in chronological order. Then list the location candidates as `<file>:<line>` grouped by `kind`, with `evidence` in parens.
```

- [ ] **Step 2: `commands/resolve.md`**

```markdown
---
name: resolve
description: Mark a thread as resolved.
---

Args: `<thread-id>`.

Read `.agentic-prd.dev.json`, then:

```bash
curl -sf -X POST "http://127.0.0.1:{port}{prefix}/threads/{id}/resolve"
```

Confirm the returned thread has `resolved: true`.
```

- [ ] **Step 3: `commands/unresolve.md`**

```markdown
---
name: unresolve
description: Reopen a resolved thread.
---

Args: `<thread-id>`.

```bash
curl -sf -X POST "http://127.0.0.1:{port}{prefix}/threads/{id}/unresolve"
```

Confirm the returned thread has `resolved: false`.
```

- [ ] **Step 4: `commands/sync-specs.md`**

```markdown
---
name: sync-specs
description: Pull spec markdown files from the dev server into local docs/specs/.
---

Args: `[path]` (optional). If provided, only sync specs for that widget path.

```bash
curl -sf -X POST "http://127.0.0.1:{port}{prefix}/specs/sync?path={path}"
```

Present the returned `synced[]` (id → localPath) and `removed[]` file names.
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add plugins/agentic-prd-skill/commands && git commit -m "feat(skill): thread/resolve/unresolve/sync-specs commands"
```

---

# Phase 4 — Docs update

### Task 18: Update AGENTS.md + CLAUDE.md for monorepo layout

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read current `AGENTS.md`**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && head -60 AGENTS.md
```

Note current heading and command section — they refer to root-level scripts.

- [ ] **Step 2: Update AGENTS.md heading + Commands + 구조 섹션**

Replace the `## Commands` block with:

```markdown
## Commands

pnpm 워크스페이스 루트에서 실행:

```bash
pnpm typecheck       # turbo run typecheck (모든 패키지)
pnpm lint            # turbo run lint
pnpm test            # turbo run test
pnpm build           # turbo run build
pnpm play            # turbo run play --filter agentic-prd-playground
```

특정 패키지만:

```bash
pnpm --filter @agentic-prd/widget typecheck
pnpm --filter @agentic-prd/dev-plugin test
```

biome 은 워크스페이스 루트 `biome.json` 을 공유하며 각 패키지가 자기 scope 로 호출한다.
```

Replace the `## 구조` block with a summary of the monorepo layout that matches the spec's Section "모노레포 레이아웃".

- [ ] **Step 3: Update CLAUDE.md heading only**

`CLAUDE.md` H1 → `# Claude Code Instructions — agentic-prd (monorepo)`. Body unchanged (still `See @AGENTS.md`).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd" && git add AGENTS.md CLAUDE.md && git commit -m "docs: reflect monorepo layout and turbo commands"
```

---

# Verification (final)

Run all four pipelines end-to-end from the workspace root:

```bash
cd "C:/Users/CreeJee/Desktop/open-source/agentic-prd"
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all pass. Then boot playground and hit endpoints:

```bash
pnpm play &
sleep 8
curl -sf "http://127.0.0.1:5173/__agentic-prd/threads?resolved=false" | head -c 500
curl -sf "http://127.0.0.1:5173/__agentic-prd/specs" | head -c 500
kill %1 || true
```

Skill smoke: from within Claude Code (external), invoke `/agentic-prd:list-threads` in the workspace and observe the response summary.

---

## Self-Review

**Spec coverage**
- 모노레포 레이아웃 → Tasks 1–5 ✓
- Vite Plugin `configureServer` 사이드카 → Task 14 ✓
- Discovery file `.agentic-prd.dev.json` (워크스페이스 루트) → Task 14 (writes) + Task 15 (verify lifecycle) ✓
- HTTP endpoints (threads×5, specs×4) → Task 13 (router) + Tasks 11–12 (handlers) + Task 14 (glue) ✓
- Anchor 리졸버 우선순위 (reactSource / testid / id-attr / reactPath) → Task 9 ✓
- Spec sync `<slug>.md` + collision `<slug>-<idShort>.md` → Task 7 (slug) + Task 12 (specs handler) ✓
- Manifest `.sync.json` → Task 8 (io) + Task 12 (usage) ✓
- File header `<!-- agentic-prd:spec id=... -->` → Task 12 ✓
- Auth: localhost only → Task 14 `isLocal` ✓
- Skill 자연어 명령 5개 → Tasks 16–17 ✓
- Docs (AGENTS/CLAUDE) → Task 18 ✓

No gaps.

**Placeholder scan**
- Task 4 mentions "If widget's index only exports CommentWidget etc., add re-exports for the playground's needs" — that's actionable (Task 4 has explicit re-export code). ✓
- Task 18's "구조 섹션 을 모노레포 레이아웃과 일치하도록" refers to spec section. Acceptable as it's a doc rewrite step and the spec section is committed. ✓
- Task 3 Step 4: says "Same for any `../../src/...` shadcn UI imports" but resolves via Task 4 explicit re-export list. Fine.

**Type consistency**
- `ThreadDTO`, `CommentDTO` from `handlers/threads.ts` ✓
- `SpecDTO`, `SyncedSpec` from `handlers/specs.ts` ✓
- `LocationCandidate`, `LocationKind`, `WidgetAnchor` from `types.ts` ✓
- `RouteKind` from `router.ts`, used in `plugin.ts` switch — kinds match: listThreads/getThread/resolveThread/unresolveThread/threadLocation/listSpecs/getSpec/syncSpecs/syncOneSpec ✓
- `StorageConfig`, `DevSupabase`, `ThreadRow`, `SpecRow` from `supabase.ts` ✓
- `manifest.ts` exports `MANIFEST_NAME`, `Manifest`, `ManifestEntry` — used consistently in `handlers/specs.ts` ✓
- `slug.ts` exports `slugify`, `resolveCollisions` — used in `handlers/specs.ts` ✓
