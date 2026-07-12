# No-clone 설치 사용성 구현 계획 (Supabase 제거 + 로컬 스토리지 + 마켓플레이스 + setup/work skill)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** repo 를 clone 하지 않은 유저가 npm 패키지 2개 + Claude Code 마켓플레이스 플러그인으로 agentic-prd 를 zero-config(외부 서비스 없이) 설치·사용할 수 있게 한다.

**Architecture:** Supabase 를 완전히 제거한다. dev-plugin 이 앱 루트 `.agentic-prd/` JSON 파일을 단일 원천으로 삼아 읽기+쓰기 HTTP API 를 제공하고, 위젯은 `StorageAdapter` 인터페이스(기본 구현 `devServerStorage()` = 같은 origin 의 dev-plugin 으로 fetch)를 통해 저장한다. repo 루트는 Claude Code 플러그인 마켓플레이스가 된다.

**Tech Stack:** TypeScript(tsgo/strictest), Vite plugin(node), react-query+jotai(widget), vitest, tsdown, Claude Code plugin 표준(.claude-plugin).

**Spec:** `docs/superpowers/specs/2026-07-12-no-clone-install-usability-design.md`

**커밋 정책:** AGENTS.md 규칙상 커밋은 사용자가 명시 요청할 때만. 실행 시작 전에 태스크별 커밋 여부를 사용자에게 1회 확인하고, 승인된 경우에만 각 태스크의 커밋 스텝을 수행한다. 미승인이면 커밋 스텝은 건너뛴다(작업 트리에 누적).

**검증 공통 명령:**
- dev-plugin: `pnpm --filter @agentic-prd/dev-plugin test` / `typecheck` / `lint`
- widget: `pnpm --filter @agentic-prd/widget test` / `typecheck` / `lint`
- 전체: `pnpm typecheck && pnpm lint`

---

### Task 1: dev-plugin 로컬 JSON 스토리지 (`src/storage.ts`)

Supabase 백엔드를 대체하는 파일 기반 저장소. `ThreadRow`/`SpecRow` 타입의 새 보금자리가 된다 (기존엔 `src/supabase.ts` 에 있었음).

**Files:**
- Create: `packages/dev-plugin/src/storage.ts`
- Create: `packages/dev-plugin/src/storage.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `packages/dev-plugin/src/storage.test.ts`

```ts
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileStorage, type ThreadRow } from "./storage.js";

function tmpDataDir(): string {
  return join(mkdtempSync(join(tmpdir(), "agentic-prd-")), ".agentic-prd");
}

function threadRow(id: string, path = "/products", resolved = false): ThreadRow {
  return {
    id,
    path,
    x_pct: 10,
    y_pct: 20,
    anchor: null,
    resolved,
    comments: [{ id: `${id}_c1`, author: "a", text: "t", at: 1 }],
    updated_at: "2026-07-12T00:00:00.000Z",
  };
}

describe("createFileStorage threads", () => {
  it("insertThread 후 getThread/listThreads 로 왕복된다", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1"));
    expect(await storage.getThread("t1")).toMatchObject({ id: "t1", path: "/products" });
    expect(await storage.listThreads({})).toHaveLength(1);
  });

  it("path / resolved / limit 필터가 동작한다", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1", "/products", false));
    await storage.insertThread(threadRow("t2", "/cart", true));
    expect(await storage.listThreads({ path: "/cart" })).toHaveLength(1);
    expect(await storage.listThreads({ resolved: false })).toHaveLength(1);
    expect(await storage.listThreads({ limit: 1 })).toHaveLength(1);
  });

  it("patchThread 는 부분 갱신하고 updated_at 을 갱신하며, 없는 id 는 null", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1"));
    const patched = await storage.patchThread("t1", { resolved: true });
    expect(patched?.resolved).toBe(true);
    expect(patched?.x_pct).toBe(10);
    expect(patched?.updated_at).not.toBe("2026-07-12T00:00:00.000Z");
    expect(await storage.patchThread("nope", { resolved: true })).toBeNull();
  });

  it("appendComment 는 comments 배열 끝에 추가한다", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1"));
    const next = await storage.appendComment("t1", {
      id: "c2",
      author: "agent",
      text: "수정했습니다",
      at: 2,
    });
    expect(next?.comments).toHaveLength(2);
    expect(await storage.appendComment("nope", { id: "c", author: "a", text: "t", at: 1 })).toBeNull();
  });

  it("deleteThread 는 성공 시 true, 없는 id 는 false", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1"));
    expect(await storage.deleteThread("t1")).toBe(true);
    expect(await storage.deleteThread("t1")).toBe(false);
  });
});

describe("createFileStorage specs", () => {
  it("upsertSpec → getSpec/listSpecs/deleteSpec 왕복", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.upsertSpec({
      id: "s1",
      path: "/products",
      title: "정책",
      status: "DRAFT",
      sections: { body: "## 본문" },
      updated_by: "me",
      updated_at: "2026-07-12T00:00:00.000Z",
    });
    expect(await storage.getSpec("s1")).toMatchObject({ title: "정책" });
    expect(await storage.listSpecs({ path: "/products" })).toHaveLength(1);
    expect(await storage.deleteSpec("s1")).toBe(true);
    expect(await storage.getSpec("s1")).toBeNull();
  });
});

describe("createFileStorage 손상 복구", () => {
  it("깨진 JSON 은 .bak 으로 백업하고 빈 저장소로 시작한다", async () => {
    const dataDir = tmpDataDir();
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "comments.json"), "{ broken", "utf8");
    const storage = createFileStorage(dataDir);
    expect(await storage.listThreads({})).toEqual([]);
    expect(existsSync(join(dataDir, "comments.json.bak"))).toBe(true);
  });

  it("쓰기는 pretty JSON 파일로 남는다 (git diff 가능)", async () => {
    const dataDir = tmpDataDir();
    const storage = createFileStorage(dataDir);
    await storage.insertThread(threadRow("t1"));
    const raw = readFileSync(join(dataDir, "comments.json"), "utf8");
    expect(raw).toContain('\n  "');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @agentic-prd/dev-plugin test`
Expected: FAIL — `Cannot find module './storage.js'`

- [ ] **Step 3: 구현** — `packages/dev-plugin/src/storage.ts`

```ts
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

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
  sections: { body?: string; externalUrl?: string } | null;
  updated_by: string;
  updated_at: string;
}

export interface CommentEntry {
  id: string;
  author: string;
  text: string;
  at: number;
}

export interface ThreadPatch {
  x_pct?: number;
  y_pct?: number;
  anchor?: unknown;
  resolved?: boolean;
  comments?: unknown;
}

export interface DevStorage {
  listThreads(filter: {
    path?: string;
    resolved?: boolean;
    limit?: number;
  }): Promise<ThreadRow[]>;
  getThread(id: string): Promise<ThreadRow | null>;
  insertThread(row: ThreadRow): Promise<ThreadRow>;
  patchThread(id: string, patch: ThreadPatch): Promise<ThreadRow | null>;
  appendComment(id: string, comment: CommentEntry): Promise<ThreadRow | null>;
  deleteThread(id: string): Promise<boolean>;
  setThreadResolved(id: string, resolved: boolean): Promise<ThreadRow | null>;
  listSpecs(filter: { path?: string }): Promise<SpecRow[]>;
  getSpec(id: string): Promise<SpecRow | null>;
  upsertSpec(row: SpecRow): Promise<SpecRow>;
  deleteSpec(id: string): Promise<boolean>;
}

/**
 * 파싱 실패 시 원본을 `.bak` 으로 백업하고 빈 저장소로 시작한다 —
 * 손상된 파일 때문에 dev 서버 전체가 죽으면 안 된다.
 */
function readTable<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  const raw = readFileSync(file, "utf8");
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    renameSync(file, `${file}.bak`);
    console.warn(
      `[agentic-prd] ${file} JSON 파싱 실패 — ${file}.bak 으로 백업하고 빈 저장소로 시작합니다.`,
    );
    return [];
  }
}

/** tmp 파일에 먼저 쓰고 rename — 중간에 프로세스가 죽어도 반쪽 파일이 남지 않는다. */
function writeTable<T>(dir: string, file: string, rows: T[]): void {
  mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  renameSync(tmp, file);
}

/**
 * `.agentic-prd/` 디렉터리의 JSON 파일을 단일 원천으로 쓰는 dev 저장소.
 * 매 호출마다 파일을 다시 읽는다 — dev 규모에서 충분히 싸고, e2e 시드나
 * git pull 로 파일이 바깥에서 바뀌어도 즉시 반영된다.
 */
export function createFileStorage(dataDir: string): DevStorage {
  const threadsFile = join(dataDir, "comments.json");
  const specsFile = join(dataDir, "specs.json");
  const readThreads = () => readTable<ThreadRow>(threadsFile);
  const writeThreads = (rows: ThreadRow[]) =>
    writeTable(dataDir, threadsFile, rows);
  const readSpecs = () => readTable<SpecRow>(specsFile);
  const writeSpecs = (rows: SpecRow[]) => writeTable(dataDir, specsFile, rows);
  const now = () => new Date().toISOString();

  async function patchThread(
    id: string,
    patch: ThreadPatch,
  ): Promise<ThreadRow | null> {
    const rows = readThreads();
    const idx = rows.findIndex((r) => r.id === id);
    const current = rows[idx];
    if (idx < 0 || !current) return null;
    const next: ThreadRow = {
      ...current,
      ...(patch.x_pct !== undefined ? { x_pct: patch.x_pct } : {}),
      ...(patch.y_pct !== undefined ? { y_pct: patch.y_pct } : {}),
      ...(patch.anchor !== undefined ? { anchor: patch.anchor } : {}),
      ...(patch.resolved !== undefined ? { resolved: patch.resolved } : {}),
      ...(patch.comments !== undefined ? { comments: patch.comments } : {}),
      updated_at: now(),
    };
    rows[idx] = next;
    writeThreads(rows);
    return next;
  }

  return {
    async listThreads({ path, resolved, limit = 100 }) {
      let rows = readThreads();
      if (path) rows = rows.filter((r) => r.path === path);
      if (typeof resolved === "boolean")
        rows = rows.filter((r) => r.resolved === resolved);
      return rows
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .slice(0, limit);
    },
    async getThread(id) {
      return readThreads().find((r) => r.id === id) ?? null;
    },
    async insertThread(row) {
      const rows = readThreads().filter((r) => r.id !== row.id);
      rows.push(row);
      writeThreads(rows);
      return row;
    },
    patchThread,
    async appendComment(id, comment) {
      const current = readThreads().find((r) => r.id === id);
      if (!current) return null;
      const comments = Array.isArray(current.comments)
        ? [...(current.comments as CommentEntry[]), comment]
        : [comment];
      return patchThread(id, { comments });
    },
    async deleteThread(id) {
      const rows = readThreads();
      const next = rows.filter((r) => r.id !== id);
      if (next.length === rows.length) return false;
      writeThreads(next);
      return true;
    },
    async setThreadResolved(id, resolved) {
      return patchThread(id, { resolved });
    },
    async listSpecs({ path }) {
      let rows = readSpecs();
      if (path) rows = rows.filter((r) => r.path === path);
      return rows.sort(
        (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
      );
    },
    async getSpec(id) {
      return readSpecs().find((r) => r.id === id) ?? null;
    },
    async upsertSpec(row) {
      const rows = readSpecs().filter((r) => r.id !== row.id);
      rows.push(row);
      writeSpecs(rows);
      return row;
    },
    async deleteSpec(id) {
      const rows = readSpecs();
      const next = rows.filter((r) => r.id !== id);
      if (next.length === rows.length) return false;
      writeSpecs(next);
      return true;
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @agentic-prd/dev-plugin test`
Expected: PASS (storage.test.ts 전부 green). 이 시점에 다른 파일은 아직 supabase.ts 를 쓰므로 typecheck 는 건드리지 않는다.

- [ ] **Step 5: (커밋 승인 시) 커밋**

```bash
git add packages/dev-plugin/src/storage.ts packages/dev-plugin/src/storage.test.ts
git commit -m "feat(dev-plugin): file-backed local storage (.agentic-prd JSON)"
```

---

### Task 2: dev-plugin 라우터 확장 (쓰기 라우트)

**Files:**
- Modify: `packages/dev-plugin/src/router.ts`
- Create: `packages/dev-plugin/src/router.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `packages/dev-plugin/src/router.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { matchRoute } from "./router.js";

describe("matchRoute 쓰기 라우트", () => {
  it("POST /threads → createThread", () => {
    expect(matchRoute("POST", "/threads")).toMatchObject({ kind: "createThread" });
  });
  it("PATCH /threads/:id → patchThread", () => {
    expect(matchRoute("PATCH", "/threads/t1")).toMatchObject({
      kind: "patchThread",
      params: { id: "t1" },
    });
  });
  it("DELETE /threads/:id → deleteThread", () => {
    expect(matchRoute("DELETE", "/threads/t1")).toMatchObject({ kind: "deleteThread" });
  });
  it("POST /threads/:id/comments → appendComment", () => {
    expect(matchRoute("POST", "/threads/t1/comments")).toMatchObject({
      kind: "appendComment",
      params: { id: "t1" },
    });
  });
  it("PUT /specs/:id → putSpec, DELETE /specs/:id → deleteSpec", () => {
    expect(matchRoute("PUT", "/specs/s1")).toMatchObject({ kind: "putSpec" });
    expect(matchRoute("DELETE", "/specs/s1")).toMatchObject({ kind: "deleteSpec" });
  });
  it("기존 라우트 회귀: resolve/sync 는 그대로", () => {
    expect(matchRoute("POST", "/threads/t1/resolve")).toMatchObject({ kind: "resolveThread" });
    expect(matchRoute("POST", "/specs/sync")).toMatchObject({ kind: "syncSpecs" });
    expect(matchRoute("GET", "/threads/t1")).toMatchObject({ kind: "getThread" });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @agentic-prd/dev-plugin test`
Expected: FAIL — 새 kind 들이 null 매치.

- [ ] **Step 3: 구현** — `packages/dev-plugin/src/router.ts` 전체 교체

```ts
export type RouteKind =
  | "listThreads"
  | "getThread"
  | "createThread"
  | "patchThread"
  | "deleteThread"
  | "appendComment"
  | "resolveThread"
  | "unresolveThread"
  | "threadLocation"
  | "listSpecs"
  | "getSpec"
  | "putSpec"
  | "deleteSpec"
  | "syncSpecs"
  | "syncOneSpec";

export interface Route {
  kind: RouteKind;
  params: Record<string, string>;
}

interface Def {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  pattern: RegExp;
  kind: RouteKind;
  paramNames: string[];
}

const DEFS: Def[] = [
  { method: "GET", pattern: /^\/threads\/?$/, kind: "listThreads", paramNames: [] },
  { method: "POST", pattern: /^\/threads\/?$/, kind: "createThread", paramNames: [] },
  { method: "GET", pattern: /^\/threads\/([^/]+)\/location\/?$/, kind: "threadLocation", paramNames: ["id"] },
  { method: "POST", pattern: /^\/threads\/([^/]+)\/comments\/?$/, kind: "appendComment", paramNames: ["id"] },
  { method: "POST", pattern: /^\/threads\/([^/]+)\/resolve\/?$/, kind: "resolveThread", paramNames: ["id"] },
  { method: "POST", pattern: /^\/threads\/([^/]+)\/unresolve\/?$/, kind: "unresolveThread", paramNames: ["id"] },
  { method: "GET", pattern: /^\/threads\/([^/]+)\/?$/, kind: "getThread", paramNames: ["id"] },
  { method: "PATCH", pattern: /^\/threads\/([^/]+)\/?$/, kind: "patchThread", paramNames: ["id"] },
  { method: "DELETE", pattern: /^\/threads\/([^/]+)\/?$/, kind: "deleteThread", paramNames: ["id"] },
  { method: "GET", pattern: /^\/specs\/?$/, kind: "listSpecs", paramNames: [] },
  { method: "POST", pattern: /^\/specs\/sync\/?$/, kind: "syncSpecs", paramNames: [] },
  { method: "POST", pattern: /^\/specs\/([^/]+)\/sync\/?$/, kind: "syncOneSpec", paramNames: ["id"] },
  { method: "GET", pattern: /^\/specs\/([^/]+)\/?$/, kind: "getSpec", paramNames: ["id"] },
  { method: "PUT", pattern: /^\/specs\/([^/]+)\/?$/, kind: "putSpec", paramNames: ["id"] },
  { method: "DELETE", pattern: /^\/specs\/([^/]+)\/?$/, kind: "deleteSpec", paramNames: ["id"] }
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

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @agentic-prd/dev-plugin test`
Expected: PASS.

- [ ] **Step 5: (커밋 승인 시) 커밋**

```bash
git add packages/dev-plugin/src/router.ts packages/dev-plugin/src/router.test.ts
git commit -m "feat(dev-plugin): write routes (create/patch/delete thread, append comment, put/delete spec)"
```

---

### Task 3: dev-plugin 핸들러를 DevStorage 로 교체 + 쓰기 핸들러

**Files:**
- Modify: `packages/dev-plugin/src/handlers/threads.ts`
- Modify: `packages/dev-plugin/src/handlers/specs.ts`

- [ ] **Step 1: `handlers/threads.ts` 전체 교체**

DTO 에 `xPct`/`yPx` 를 추가한다 (위젯 devServerStorage 가 좌표를 필요로 함 — 기존 skill 소비자는 필드 추가라 비파괴).

```ts
import { resolveAnchorLocation } from "../anchor-resolver.js";
import type { CommentEntry, DevStorage, ThreadRow } from "../storage.js";
import type { LocationCandidate, WidgetAnchor } from "../types.js";

export interface CommentDTO {
  id: string;
  author: string;
  text: string;
  at: number;
}

export interface ThreadDTO {
  id: string;
  path: string;
  xPct: number;
  yPx: number;
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
    xPct: row.x_pct,
    yPx: row.y_pct,
    resolved: row.resolved,
    updatedAt: new Date(row.updated_at).getTime(),
    comments,
    anchor: (row.anchor as WidgetAnchor) ?? undefined,
  };
}

export async function handleListThreads(
  storage: DevStorage,
  filter: { path?: string; resolved?: boolean; limit?: number },
): Promise<ThreadDTO[]> {
  const rows = await storage.listThreads(filter);
  return rows.map(toDTO);
}

export async function handleGetThread(
  storage: DevStorage,
  id: string,
): Promise<ThreadDTO | null> {
  const row = await storage.getThread(id);
  return row ? toDTO(row) : null;
}

export interface CreateThreadInput {
  id: string;
  path: string;
  xPct: number;
  yPx: number;
  anchor?: unknown;
  resolved?: boolean;
  comments?: unknown;
}

export async function handleCreateThread(
  storage: DevStorage,
  input: CreateThreadInput,
): Promise<ThreadDTO> {
  const row = await storage.insertThread({
    id: input.id,
    path: input.path,
    x_pct: input.xPct,
    y_pct: input.yPx,
    anchor: input.anchor ?? null,
    resolved: input.resolved ?? false,
    comments: Array.isArray(input.comments) ? input.comments : [],
    updated_at: new Date().toISOString(),
  });
  return toDTO(row);
}

export interface ThreadPatchInput {
  xPct?: number;
  yPx?: number;
  anchor?: unknown;
  resolved?: boolean;
  comments?: unknown;
}

export async function handlePatchThread(
  storage: DevStorage,
  id: string,
  patch: ThreadPatchInput,
): Promise<ThreadDTO | null> {
  const row = await storage.patchThread(id, {
    ...(patch.xPct !== undefined ? { x_pct: patch.xPct } : {}),
    ...(patch.yPx !== undefined ? { y_pct: patch.yPx } : {}),
    ...(patch.anchor !== undefined ? { anchor: patch.anchor } : {}),
    ...(patch.resolved !== undefined ? { resolved: patch.resolved } : {}),
    ...(patch.comments !== undefined ? { comments: patch.comments } : {}),
  });
  return row ? toDTO(row) : null;
}

export interface AppendCommentInput {
  id?: string;
  author: string;
  text: string;
  at?: number;
}

export async function handleAppendComment(
  storage: DevStorage,
  threadId: string,
  input: AppendCommentInput,
): Promise<ThreadDTO | null> {
  const comment: CommentEntry = {
    id:
      input.id ??
      `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    author: input.author,
    text: input.text,
    at: input.at ?? Date.now(),
  };
  const row = await storage.appendComment(threadId, comment);
  return row ? toDTO(row) : null;
}

export async function handleDeleteThread(
  storage: DevStorage,
  id: string,
): Promise<boolean> {
  return storage.deleteThread(id);
}

export async function handleSetResolved(
  storage: DevStorage,
  id: string,
  resolved: boolean,
): Promise<ThreadDTO | null> {
  const row = await storage.setThreadResolved(id, resolved);
  return row ? toDTO(row) : null;
}

export async function handleThreadLocation(
  storage: DevStorage,
  projectRoot: string,
  id: string,
): Promise<{ candidates: LocationCandidate[] }> {
  const row = await storage.getThread(id);
  if (!row?.anchor) return { candidates: [] };
  const candidates = await resolveAnchorLocation(
    projectRoot,
    row.anchor as WidgetAnchor,
  );
  return { candidates };
}
```

- [ ] **Step 2: `handlers/specs.ts` 수정**

import 를 storage 로 바꾸고, `toDTO` 에 `externalUrl` 을 추가하고, `handlePutSpec`/`handleDeleteSpec` 을 추가한다. 파일 상단 import 와 DTO/함수만 교체 — sync 로직(handleSyncAll/handleSyncOne)은 파라미터 타입명(`DevSupabase`→`DevStorage`, 인자명 `supabase`→`storage`)만 바꾸고 본문 유지.

```ts
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadManifest, saveManifest } from "../manifest.js";
import { resolveCollisions } from "../slug.js";
import type { DevStorage, SpecRow } from "../storage.js";

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

function toDTO(row: SpecRow): SpecDTO {
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    status: row.status,
    body: row.sections?.body ?? "",
    ...(row.sections?.externalUrl
      ? { externalUrl: row.sections.externalUrl }
      : {}),
    updatedBy: row.updated_by,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
```

새 핸들러 (파일 끝에 추가):

```ts
export interface SpecPutInput {
  path: string;
  title?: string;
  status?: SpecRow["status"];
  body?: string;
  externalUrl?: string;
  updatedBy?: string;
}

export async function handlePutSpec(
  storage: DevStorage,
  id: string,
  input: SpecPutInput,
): Promise<SpecDTO> {
  const row = await storage.upsertSpec({
    id,
    path: input.path,
    title: input.title ?? "",
    status: input.status ?? "DRAFT",
    sections: {
      body: input.body ?? "",
      ...(input.externalUrl ? { externalUrl: input.externalUrl } : {}),
    },
    updated_by: input.updatedBy ?? "",
    updated_at: new Date().toISOString(),
  });
  return toDTO(row);
}

export async function handleDeleteSpec(
  storage: DevStorage,
  id: string,
): Promise<boolean> {
  return storage.deleteSpec(id);
}
```

- [ ] **Step 3: 부분 확인**

Run: `pnpm --filter @agentic-prd/dev-plugin test`
Expected: PASS (storage/router 테스트). typecheck 는 plugin.ts 가 아직 구버전이라 Task 4 후에 확인.

---

### Task 4: dev-plugin `plugin.ts` 재배선 + supabase 삭제

**Files:**
- Modify: `packages/dev-plugin/src/plugin.ts` (전체 교체)
- Delete: `packages/dev-plugin/src/supabase.ts`
- Modify: `packages/dev-plugin/src/index.ts`
- Modify: `packages/dev-plugin/package.json` (`dependencies` 의 `@supabase/supabase-js` 제거)

- [ ] **Step 1: `plugin.ts` 전체 교체**

핵심 변경: (a) `storage` 옵션 제거, (b) 루트 결정을 `configResolved` 의 `config.root` 기준으로(모노레포 마커 있으면 workspace 루트), (c) JSON body 파서, (d) 쓰기 라우트 케이스, (e) resolve 404.

```ts
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import {
  type AppendCommentInput,
  type CreateThreadInput,
  handleAppendComment,
  handleCreateThread,
  handleDeleteThread,
  handleGetThread,
  handleListThreads,
  handlePatchThread,
  handleSetResolved,
  handleThreadLocation,
  type ThreadPatchInput
} from "./handlers/threads.js";
import {
  handleDeleteSpec,
  handleGetSpec,
  handleListSpecs,
  handlePutSpec,
  handleSyncAll,
  handleSyncOne,
  type SpecPutInput
} from "./handlers/specs.js";
import { matchRoute } from "./router.js";
import { createFileStorage, type DevStorage } from "./storage.js";

export interface AgenticPRDDevOptions {
  specSyncDir?: string;
  projectRoot?: string;
  prefix?: string;
}

const DISCOVERY_FILE = ".agentic-prd.dev.json";
const DATA_DIR = ".agentic-prd";

/**
 * 데이터/디스커버리 루트. pnpm-workspace.yaml 이 있으면 workspace 루트(모노레포에서
 * skill 이 워크스페이스 루트를 탐색하는 기존 흐름 호환), 없으면 Vite config.root —
 * npm/yarn 단일 앱에서 process.cwd 가 어디든 앱 루트에 고정되도록.
 */
function resolveDataRoot(configRoot: string): string {
  let current = configRoot;
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) return configRoot;
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

function parseQuery(url: string): URLSearchParams {
  const qIdx = url.indexOf("?");
  if (qIdx < 0) return new URLSearchParams();
  return new URLSearchParams(url.slice(qIdx + 1));
}

const MAX_BODY_BYTES = 1024 * 1024;

function readJSONBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolveBody(undefined);
        return;
      }
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export default function agenticPRDDev(
  options: AgenticPRDDevOptions = {}
): Plugin {
  const prefix = options.prefix ?? "/__agentic-prd";
  let storage: DevStorage | null = null;
  let projectRoot = "";
  let specSyncDir = "";
  let discoveryPath = "";

  return {
    name: "agentic-prd:dev",
    apply: "serve",
    configResolved(config) {
      const dataRoot = resolveDataRoot(config.root);
      projectRoot = options.projectRoot
        ? isAbsolute(options.projectRoot)
          ? options.projectRoot
          : resolve(dataRoot, options.projectRoot)
        : dataRoot;
      specSyncDir = options.specSyncDir
        ? isAbsolute(options.specSyncDir)
          ? options.specSyncDir
          : resolve(dataRoot, options.specSyncDir)
        : resolve(dataRoot, "docs/specs");
      storage = createFileStorage(join(dataRoot, DATA_DIR));
      discoveryPath = join(dataRoot, DISCOVERY_FILE);
    },
    configureServer(server: ViteDevServer) {
      const configuredPort = server.config.server?.port ?? 5173;
      const cleanup = () => {
        try {
          if (discoveryPath && existsSync(discoveryPath))
            unlinkSync(discoveryPath);
        } catch {
          /* best effort */
        }
      };
      const writeDiscovery = (port: number) => {
        writeFileSync(
          discoveryPath,
          `${JSON.stringify({ port, prefix }, null, 2)}\n`,
          "utf8",
        );
      };
      /**
       * Vite 는 요청 port 가 사용 중이면 자동으로 다음 port 로 fallback 한다.
       * 그래서 discovery 파일은 실제로 listen 이 성립한 시점에 실주소로 기록해야
       * skill 이 올바른 port 로 curl 할 수 있다.
       */
      const httpServer = server.httpServer;
      if (httpServer?.listening) {
        const address = httpServer.address();
        writeDiscovery(
          typeof address === "object" && address ? address.port : configuredPort,
        );
      } else if (httpServer) {
        httpServer.once("listening", () => {
          const address = httpServer.address();
          writeDiscovery(
            typeof address === "object" && address
              ? address.port
              : configuredPort,
          );
        });
      } else {
        writeDiscovery(configuredPort);
      }
      server.httpServer?.on("close", cleanup);
      process.once("SIGINT", cleanup);
      process.once("SIGTERM", cleanup);
      process.once("exit", cleanup);

      server.middlewares.use(prefix, async (req, res, next) => {
        try {
          const store = storage;
          if (!store) {
            sendJSON(res, 500, {
              error: "internal",
              message: "storage not initialized"
            });
            return;
          }
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
              const resolvedParam = query.get("resolved");
              const result = await handleListThreads(store, {
                path: query.get("path") ?? undefined,
                resolved:
                  resolvedParam === null ? undefined : resolvedParam === "true",
                limit: query.get("limit")
                  ? Number.parseInt(query.get("limit") ?? "0", 10)
                  : undefined
              });
              sendJSON(res, 200, result);
              return;
            }
            case "getThread": {
              const id = route.params["id"] ?? "";
              const thread = await handleGetThread(store, id);
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
            case "createThread": {
              const body = (await readJSONBody(req)) as
                | Partial<CreateThreadInput>
                | undefined;
              if (
                !body ||
                typeof body.id !== "string" ||
                typeof body.path !== "string" ||
                typeof body.xPct !== "number" ||
                typeof body.yPx !== "number"
              ) {
                sendJSON(res, 400, {
                  error: "bad-request",
                  message: "id/path/xPct/yPx required"
                });
                return;
              }
              const created = await handleCreateThread(
                store,
                body as CreateThreadInput
              );
              sendJSON(res, 201, created);
              return;
            }
            case "patchThread": {
              const id = route.params["id"] ?? "";
              const body = (await readJSONBody(req)) as
                | ThreadPatchInput
                | undefined;
              const patched = await handlePatchThread(store, id, body ?? {});
              if (!patched) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id
                });
                return;
              }
              sendJSON(res, 200, patched);
              return;
            }
            case "deleteThread": {
              const id = route.params["id"] ?? "";
              const deleted = await handleDeleteThread(store, id);
              if (!deleted) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id
                });
                return;
              }
              sendJSON(res, 200, { ok: true });
              return;
            }
            case "appendComment": {
              const id = route.params["id"] ?? "";
              const body = (await readJSONBody(req)) as
                | Partial<AppendCommentInput>
                | undefined;
              if (
                !body ||
                typeof body.author !== "string" ||
                typeof body.text !== "string"
              ) {
                sendJSON(res, 400, {
                  error: "bad-request",
                  message: "author/text required"
                });
                return;
              }
              const appended = await handleAppendComment(
                store,
                id,
                body as AppendCommentInput
              );
              if (!appended) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id
                });
                return;
              }
              sendJSON(res, 200, appended);
              return;
            }
            case "resolveThread":
            case "unresolveThread": {
              const id = route.params["id"] ?? "";
              const resolvedFlag = route.kind === "resolveThread";
              const result = await handleSetResolved(store, id, resolvedFlag);
              if (!result) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id
                });
                return;
              }
              sendJSON(res, 200, result);
              return;
            }
            case "listSpecs": {
              const result = await handleListSpecs(store, {
                path: query.get("path") ?? undefined
              });
              sendJSON(res, 200, result);
              return;
            }
            case "getSpec": {
              const id = route.params["id"] ?? "";
              const spec = await handleGetSpec(store, id);
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
            case "putSpec": {
              const id = route.params["id"] ?? "";
              const body = (await readJSONBody(req)) as
                | Partial<SpecPutInput>
                | undefined;
              if (!body || typeof body.path !== "string") {
                sendJSON(res, 400, {
                  error: "bad-request",
                  message: "path required"
                });
                return;
              }
              const saved = await handlePutSpec(store, id, body as SpecPutInput);
              sendJSON(res, 200, saved);
              return;
            }
            case "deleteSpec": {
              const id = route.params["id"] ?? "";
              const deleted = await handleDeleteSpec(store, id);
              if (!deleted) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "spec",
                  id
                });
                return;
              }
              sendJSON(res, 200, { ok: true });
              return;
            }
            case "syncSpecs": {
              const result = await handleSyncAll(store, specSyncDir, {
                path: query.get("path") ?? undefined,
              });
              sendJSON(res, 200, result);
              return;
            }
            case "syncOneSpec": {
              const id = route.params["id"] ?? "";
              const result = await handleSyncOne(store, specSyncDir, id);
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
          const includeStack = process.env["NODE_ENV"] !== "production";
          sendJSON(res, 500, {
            error: "internal",
            message: error.message,
            stack: includeStack ? error.stack : undefined,
          });
        }
      });
    }
  };
}
```

- [ ] **Step 2: `src/supabase.ts` 삭제 + `index.ts`/`package.json` 정리**

```bash
rm packages/dev-plugin/src/supabase.ts
```

`packages/dev-plugin/src/index.ts` 전체 교체:

```ts
export { default } from "./plugin.js";
export type { AgenticPRDDevOptions } from "./plugin.js";
export type { CommentDTO, ThreadDTO } from "./handlers/threads.js";
export type { SpecDTO, SyncedSpec } from "./handlers/specs.js";
export type { DevStorage, SpecRow, ThreadRow } from "./storage.js";
export type {
  LocationCandidate,
  LocationKind,
  WidgetAnchor
} from "./types.js";
```

`packages/dev-plugin/package.json` 에서 `"dependencies": { "@supabase/supabase-js": ... }` 블록 제거 (dependencies 필드 자체를 삭제).
`tsdown.config.ts` 의 neverBundle 은 `packageJSON.dependencies ?? {}` 를 읽으므로 수정 불필요.

- [ ] **Step 3: 검증**

Run: `pnpm install && pnpm --filter @agentic-prd/dev-plugin typecheck && pnpm --filter @agentic-prd/dev-plugin test && pnpm --filter @agentic-prd/dev-plugin lint`
Expected: 모두 PASS. (handlers/specs.ts 의 `DevSupabase` 잔재가 있으면 typecheck 이 잡는다.)

- [ ] **Step 4: (커밋 승인 시) 커밋**

```bash
git add packages/dev-plugin
git commit -m "feat(dev-plugin)!: local JSON storage replaces Supabase; config.root-based discovery"
```

---

### Task 5: widget `StorageAdapter` + `devServerStorage`

**Files:**
- Create: `packages/widget/src/storage.ts`
- Create: `packages/widget/src/storage.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `packages/widget/src/storage.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { devServerStorage } from "./storage";

function mockFetchOnce(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("devServerStorage", () => {
  it("fetchThreads 는 DTO 를 CommentThread 로 매핑하고 updatedAt 오름차순 정렬한다", async () => {
    mockFetchOnce(200, [
      { id: "b", path: "/p", xPct: 1, yPx: 2, resolved: false, updatedAt: 2, comments: [], anchor: null },
      { id: "a", path: "/p", xPct: 3, yPx: 4, resolved: true, updatedAt: 1, comments: [], anchor: null },
    ]);
    const threads = await devServerStorage().fetchThreads("/p");
    expect(threads.map((t) => t.id)).toEqual(["a", "b"]);
    expect(threads[0]).toMatchObject({ xPct: 3, yPx: 4, resolved: true });
  });

  it("insertThread 는 POST /threads 로 보낸다", async () => {
    const fn = mockFetchOnce(201, { id: "t1" });
    await devServerStorage().insertThread({
      id: "t1", path: "/p", xPct: 1, yPx: 2, anchor: null, resolved: false, comments: [],
    });
    expect(fn).toHaveBeenCalledWith(
      "/__agentic-prd/threads",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("엔드포인트 실패 시 throw 하지 않고 빈 결과 + console.warn 1회", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = devServerStorage();
    expect(await storage.fetchThreads("/p")).toEqual([]);
    expect(await storage.fetchSpecs("/p")).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("prefix 커스텀이 URL 에 반영된다", async () => {
    const fn = mockFetchOnce(200, []);
    await devServerStorage("/__custom").fetchThreads("/p");
    expect(fn).toHaveBeenCalledWith(
      "/__custom/threads?path=%2Fp",
      expect.anything()
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @agentic-prd/widget test`
Expected: FAIL — `Cannot find module './storage'`.

- [ ] **Step 3: 구현** — `packages/widget/src/storage.ts`

```ts
import { normalizeDoc, type SpecDoc } from "./specs/store";
import type { CommentEntry, CommentThread, StoredAnchor } from "./store";

/**
 * 코멘트/기획문서 저장소 경계. 기본 구현은 devServerStorage(같은 origin 의
 * @agentic-prd/dev-plugin 미들웨어). 원격 협업 백엔드는 이 인터페이스를
 * 구현해 config.storage 로 주입하면 된다.
 */
export interface StorageAdapter {
  /** 해당 화면(path)의 스레드만 가져온다(payload 최소화) */
  fetchThreads(path: string): Promise<CommentThread[]>;
  insertThread(thread: CommentThread): Promise<void>;
  patchThread(
    id: string,
    patch: {
      resolved?: boolean;
      comments?: CommentEntry[];
      /** 재앵커(재배치)용: 엘리먼트 앵커 + 폴백 좌표 */
      anchor?: StoredAnchor | null;
      xPct?: number;
      yPx?: number;
    }
  ): Promise<void>;
  deleteThread(id: string): Promise<void>;
  /** 해당 화면(path)의 기획 문서만 가져온다 */
  fetchSpecs(path: string): Promise<SpecDoc[]>;
  upsertSpec(doc: SpecDoc): Promise<void>;
  deleteSpec(id: string): Promise<void>;
}

interface ThreadDTO {
  id: string;
  path: string;
  xPct: number;
  yPx: number;
  resolved: boolean;
  updatedAt: number;
  comments: CommentEntry[] | null;
  anchor?: unknown;
}

/**
 * 같은 Vite dev 서버에 붙은 @agentic-prd/dev-plugin 미들웨어를 저장소로 쓴다.
 * config.storage 미지정 시 기본값. 프로덕션 번들에 실수로 실려도 호스트 앱을
 * 깨지 않도록 실패는 콘솔 경고 1회 + 빈 데이터로 삼킨다.
 */
export function devServerStorage(prefix = "/__agentic-prd"): StorageAdapter {
  let warned = false;
  const warn = (err: unknown) => {
    if (warned) return;
    warned = true;
    console.warn(
      "[agentic-prd] dev-plugin 엔드포인트에 연결할 수 없습니다 — 코멘트/기획문서가 비활성화됩니다. vite.config 에 @agentic-prd/dev-plugin 이 등록됐고 dev 서버인지 확인하세요.",
      err
    );
  };
  async function request<T>(
    path: string,
    init?: RequestInit
  ): Promise<T | null> {
    try {
      const res = await fetch(`${prefix}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      warn(err);
      return null;
    }
  }
  return {
    async fetchThreads(path) {
      const rows = await request<ThreadDTO[]>(
        `/threads?path=${encodeURIComponent(path)}`
      );
      return (rows ?? [])
        .slice()
        .sort((a, b) => a.updatedAt - b.updatedAt)
        .map((row) => ({
          id: row.id,
          path: row.path,
          xPct: row.xPct,
          yPx: row.yPx,
          anchor: row.anchor as CommentThread["anchor"],
          resolved: row.resolved,
          comments: row.comments ?? [],
        }));
    },
    async insertThread(thread) {
      await request(`/threads`, {
        method: "POST",
        body: JSON.stringify({
          id: thread.id,
          path: thread.path,
          xPct: thread.xPct,
          yPx: thread.yPx,
          anchor: thread.anchor ?? null,
          resolved: thread.resolved,
          comments: thread.comments,
        }),
      });
    },
    async patchThread(id, patch) {
      await request(`/threads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    async deleteThread(id) {
      await request(`/threads/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    async fetchSpecs(path) {
      const rows = await request<unknown[]>(
        `/specs?path=${encodeURIComponent(path)}`
      );
      return (rows ?? [])
        .map((row) => normalizeDoc(row))
        .filter((d): d is SpecDoc => d !== null);
    },
    async upsertSpec(doc) {
      await request(`/specs/${encodeURIComponent(doc.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          path: doc.path,
          title: doc.title,
          status: doc.status,
          body: doc.body,
          ...(doc.externalUrl ? { externalUrl: doc.externalUrl } : {}),
          updatedBy: doc.updatedBy,
        }),
      });
    },
    async deleteSpec(id) {
      await request(`/specs/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
```

주의: dev-plugin 의 `SpecDTO` 는 `id/path/title/status/body/externalUrl/updatedBy/updatedAt` 를 갖고, `normalizeDoc` 이 그 키들을 그대로 읽으므로 매핑 코드가 필요 없다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @agentic-prd/widget test`
Expected: PASS. (widget 의 vitest 환경이 jsdom 이 아니어도 Response/fetch 는 Node 22+ 글로벌로 존재.)

- [ ] **Step 5: (커밋 승인 시) 커밋**

```bash
git add packages/widget/src/storage.ts packages/widget/src/storage.test.ts
git commit -m "feat(widget): StorageAdapter boundary + devServerStorage default adapter"
```

---

### Task 6: widget 재배선 — Provider/config/store/specs/index, supabase 삭제

**Files:**
- Modify: `packages/widget/src/WidgetProvider.tsx`
- Modify: `packages/widget/src/config.ts`
- Modify: `packages/widget/src/store.ts`
- Modify: `packages/widget/src/specs/store.ts`
- Modify: `packages/widget/src/CommentWidget.tsx`
- Modify: `packages/widget/src/index.ts`
- Delete: `packages/widget/src/supabase.ts`, `packages/widget/src/database.types.ts`
- Modify: `packages/widget/package.json` (`@supabase/supabase-js` dep 제거)

- [ ] **Step 1: `config.ts` 교체**

```ts
import type { RouteSource } from "./routeSource";
import type { StorageAdapter } from "./storage";

/**
 * `<CommentWidget config={...} />`에 주입하는 설정. 전부 optional —
 * 기본값은 dev 서버의 @agentic-prd/dev-plugin 미들웨어를 저장소로 쓰는
 * zero-config 동작이다.
 */
export interface CommentWidgetConfig {
  /** 코멘트/기획문서 저장소 어댑터. 미지정 시 devServerStorage() */
  storage?: StorageAdapter;
  /** 초기 작성자 이름(미지정 시 위젯이 입력받아 localStorage에 보관) */
  currentUser?: { name?: string };
  /** 위젯 레이어 z-index 베이스(기본 99990) */
  zIndexBase?: number;
  /**
   * `pageKey` prop 없이 위젯이 스스로 라우트를 관찰해야 할 때 쓰는 어댑터.
   * 미지정 시 순수 브라우저 환경에선 `browserRouteSource()`로 폴백한다.
   * (우선순위: pageKey prop > routeSource > browserRouteSource)
   */
  routeSource?: RouteSource;
}
```

- [ ] **Step 2: `WidgetProvider.tsx` 수정**

supabase import/context 를 storage 로 교체. 변경 지점만:

```ts
import type { CommentWidgetConfig } from "./config";
import { devServerStorage, type StorageAdapter } from "./storage";
```

```ts
const StorageContext = createContext<StorageAdapter | null>(null);

/** 현재 StorageAdapter. WidgetProvider 안에서만 호출(없으면 throw). */
export function useStorageAdapter(): StorageAdapter {
  const adapter = useContext(StorageContext);
  if (!adapter) {
    throw new Error("useStorageAdapter must be used within <WidgetProvider>");
  }
  return adapter;
}
```

`WidgetProvider` 본문 (config prop 은 optional 로):

```ts
export function WidgetProvider({
  config,
  children,
}: {
  config?: CommentWidgetConfig;
  children: ReactNode;
}) {
  const queryClient = useMemo(createWidgetQueryClient, []);
  const configStorage = config?.storage;
  const storage = useMemo(
    () => configStorage ?? devServerStorage(),
    [configStorage]
  );
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const portalValue = useMemo(() => ({ container, setContainer }), [container]);
  return (
    <QueryClientProvider client={queryClient}>
      <StorageContext.Provider value={storage}>
        <WidgetPortalContext.Provider value={portalValue}>
          {children}
        </WidgetPortalContext.Provider>
      </StorageContext.Provider>
    </QueryClientProvider>
  );
}
```

파일 상단 JSDoc 의 "SupabaseClient" 언급도 "StorageAdapter" 로 갱신.

- [ ] **Step 3: `store.ts` 수정 (supabase → storage)**

- import 교체: `import type { StorageAdapter } from "./storage";` / `import { useStorageAdapter } from "./WidgetProvider";`
- `useThreads` 내 `const supabase = useSupabaseClient();` → `const storage = useStorageAdapter();`, `queryFn: () => storage.fetchThreads(path)`
- `useThreadMutation` 의 `send: (client: SupabaseClient, ...)` → `send: (client: StorageAdapter, ...)`, `const supabase = useSupabaseClient();` → `const storage = useStorageAdapter();`, `config.send(storage, ...)`
- `useUpdateAnchor` 의 send 만 시그니처 변경:

```ts
    send: (client, { threadId, xPct, yPx, anchor }) =>
      client.patchThread(threadId, { xPct, yPx, anchor }),
```

- 파일 상단 JSDoc 의 Supabase 서술을 "저장소는 StorageAdapter(기본 devServerStorage — dev-plugin 로컬 JSON)" 로 갱신.

- [ ] **Step 4: `specs/store.ts` 수정**

- import 교체: `import type { StorageAdapter } from "../storage";` / `import { useStorageAdapter } from "../WidgetProvider";`
- `specsQueryOptions(supabase: SupabaseClient, ...)` → `specsQueryOptions(storage: StorageAdapter, ...)`, `queryFn: () => storage.fetchSpecs(path)`
- `useSpecDocsForPath`/`useSpecDoc`/`useSpecMutation` 의 `useSupabaseClient()` 호출부 3곳을 `useStorageAdapter()` 로.
- `useSpecMutation` 의 `send: (client: SupabaseClient, ...)` → `(client: StorageAdapter, ...)`
- JSDoc 갱신 (Supabase 폴링 → dev-plugin 폴링).

주의: `specs/store.ts` ↔ `storage.ts` 는 상호 import(타입 전용)가 되는데, `normalizeDoc`/`SpecDoc` 는 값+타입, storage → specs 방향만 값 import 이므로 순환 문제 없음 (기존 supabase.ts 와 동일 구조).

- [ ] **Step 5: `CommentWidget.tsx` — config prop optional 화**

`config` prop 타입을 `config?: CommentWidgetConfig` 로 바꾸고, 사용부를 `config?.routeSource` 로, `<WidgetProvider config={config}>` 는 그대로(Provider 가 optional 수용). 주변 JSDoc 의 "SupabaseClient" 언급 갱신.

- [ ] **Step 6: 삭제 + exports + dep 정리**

```bash
rm packages/widget/src/supabase.ts packages/widget/src/database.types.ts
```

`packages/widget/src/index.ts` 에서 `export type { SupabaseStorageConfig } from "./supabase";` 를 다음으로 교체:

```ts
export { devServerStorage } from "./storage";
export type { StorageAdapter } from "./storage";
```

`packages/widget/package.json` dependencies 에서 `"@supabase/supabase-js"` 라인 제거.

- [ ] **Step 7: 잔여 참조 스캔 + 검증**

Run: `grep -rn "supabase\|Supabase" packages/widget/src` → 결과 0 이어야 함 (있으면 해당 파일의 import/JSDoc 정리).
Run: `pnpm install && pnpm --filter @agentic-prd/widget typecheck && pnpm --filter @agentic-prd/widget test && pnpm --filter @agentic-prd/widget lint && pnpm --filter @agentic-prd/widget build`
Expected: 모두 PASS.

- [ ] **Step 8: (커밋 승인 시) 커밋**

```bash
git add packages/widget
git commit -m "feat(widget)!: remove Supabase; storage flows through StorageAdapter (default devServerStorage)"
```

---

### Task 7: playground/e2e/repo 정리 (Supabase 잔재 제거)

**Files:**
- Modify: `apps/playground/src/App.tsx`
- Delete: `apps/playground/src/supabaseEnv.ts`
- Modify: `apps/playground/vite.config.ts`
- Modify: `apps/playground/playwright.config.ts`
- Modify: `apps/playground/e2e/global-setup.ts` (전체 교체)
- Delete: `apps/playground/e2e/local-supabase.ts`
- Delete: `supabase/` 디렉터리 전체
- Modify: `apps/playground/package.json` (devDeps 의 `@supabase/supabase-js` 제거)
- Modify: `.gitignore`

- [ ] **Step 1: `App.tsx` — config 없는 위젯**

`import { resolveSupabaseStorage } from "./supabaseEnv";` 와 `WIDGET_CONFIG` 상수를 삭제하고:

```tsx
      <CommentWidget pageKey={pathname} pageLabel={PAGE_LABELS[pathname] ?? pathname} />
```

- [ ] **Step 2: `vite.config.ts` 교체**

```ts
import agenticPRDDev from "@agentic-prd/dev-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * 위젯 개발용 플레이그라운드. @agentic-prd/dev-plugin 이 dev 서버에 사이드카로
 * 붙어 코멘트/스펙 저장소(.agentic-prd/ JSON)와 조회/쓰기 endpoint 를 연다.
 * vite-tsconfig-paths 는 위젯 패키지 내부의 @/* alias(=packages/widget/src/*) 를
 * Vite dev 서버가 resolve 하도록 해준다.
 */
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths({
      projects: ["../../packages/widget/tsconfig.json", "./tsconfig.json"],
    }),
    agenticPRDDev({
      specSyncDir: "docs/specs",
    }),
  ],
});
```

- [ ] **Step 3: `e2e/global-setup.ts` 교체 + `local-supabase.ts` 삭제**

```ts
/**
 * Playwright 전역 셋업: dev-plugin 로컬 저장소(.agentic-prd/)를 빈 상태로 초기화하고
 * PRD 3건을 시드한다. 코멘트는 UI 경로 검증이 목적이라 spec 파일에서 위젯으로 남기고,
 * PRD 는 앵커가 없어 파일 직접 쓰기로 충분하다. 저장소 루트는 dev-plugin 의 루트 규칙
 * (pnpm-workspace.yaml 이 있는 workspace 루트)과 동일해야 한다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.agentic-prd"
);

const PRODUCTS_PRD = `## 상품 노출 정책

- 가격은 천단위 콤마를 넣어 \`1,290,000원\` 형식으로 표기한다.
- 품절 상품은 카드 전체를 흐림 처리하고 "품절" 배지를 표시하며, 장바구니 담기를 막는다.
- 상세 다이얼로그의 수량은 1 이상 99 이하만 입력할 수 있다.`;

const CART_PRD = `## 장바구니 규칙

- 장바구니가 비어 있으면 결제하기 버튼을 비활성화하고 "상품을 먼저 담아주세요" 안내를 보여준다.
- 합계는 수량 변경 즉시 재계산한다.`;

const CHECKOUT_PRD = `## 체크아웃 validation 정책

- 이메일은 형식(\`local@domain\`)을 검증하고, 불일치 시 "올바른 이메일 형식이 아닙니다"를 보여준다.
- 배송 방법은 필수 선택이다. 미선택 제출 시 "배송 방법을 선택하세요" 에러를 보여준다.`;

function specRow(id: string, path: string, title: string, body: string) {
  return {
    id,
    path,
    title,
    status: "CONFIRMED",
    sections: { body },
    updated_by: "검증봇",
    updated_at: new Date().toISOString(),
  };
}

async function globalSetup() {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, "comments.json"), "[]\n", "utf8");
  writeFileSync(
    join(DATA_DIR, "specs.json"),
    `${JSON.stringify(
      [
        specRow("spec_seed_products", "/products", "상품 목록 정책", PRODUCTS_PRD),
        specRow("spec_seed_cart", "/cart", "장바구니 정책", CART_PRD),
        specRow("spec_seed_checkout", "/checkout", "체크아웃 정책", CHECKOUT_PRD),
      ],
      null,
      2
    )}\n`,
    "utf8"
  );
}

export default globalSetup;
```

```bash
rm apps/playground/e2e/local-supabase.ts
```

- [ ] **Step 4: `playwright.config.ts` 정리**

local-supabase import 와 `webServer.env` 블록 제거:

```ts
import { defineConfig } from "@playwright/test";

/**
 * 시드 전용 e2e. dev-plugin 로컬 저장소(.agentic-prd/)를 쓰므로 외부 서비스가
 * 필요 없다. turbo test 에 편입하지 않는다 —
 * `pnpm --filter agentic-prd-playground test:e2e` 로만 실행.
 * webServer 는 `--host 127.0.0.1` 로 IPv4 loopback 에 명시 바인딩한다 — 이 환경의
 * Vite 는 host 미지정 시 `[::1]`(IPv6) 에만 바인딩해 `127.0.0.1` baseURL 이
 * connection refused 로 죽는다(webServer 헬스체크 60s 타임아웃으로 관측됨).
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5199",
    headless: true,
  },
  webServer: {
    command: "pnpm play --port 5199 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:5199",
    reuseExistingServer: false,
  },
});
```

- [ ] **Step 5: repo 잔재 삭제**

```bash
rm -rf supabase
```

`apps/playground/package.json` devDependencies 에서 `"@supabase/supabase-js"` 제거.

`.gitignore` 의 Supabase 블록을 데이터 디렉터리 항목으로 교체:

```
# agentic-prd 로컬 저장소 (데모/e2e 데이터 — 공유하려면 이 줄을 지우고 커밋)
.agentic-prd/
```

- [ ] **Step 6: 검증**

Run: `pnpm install && pnpm typecheck && pnpm lint && pnpm build`
Expected: 모두 PASS.
Run: `grep -rn --include="*.ts" --include="*.tsx" --include="*.json" -i supabase packages apps plugins turbo.json package.json` (node_modules 제외)
Expected: 매치 0 (docs/ 의 과거 설계 기록은 남겨도 됨).

- [ ] **Step 7: 런타임 스모크 (백그라운드로 pnpm play)**

Run: `pnpm play` 기동 후:

```bash
cat .agentic-prd.dev.json     # repo 루트에 생성 (pnpm-workspace 루트)
curl -sf "http://localhost:{port}/__agentic-prd/threads"        # → []
curl -sf -X POST "http://localhost:{port}/__agentic-prd/threads" \
  -H "Content-Type: application/json" \
  -d '{"id":"smoke_1","path":"/products","xPct":10,"yPx":200,"comments":[{"id":"c1","author":"smoke","text":"hi","at":1}]}'
curl -sf "http://localhost:{port}/__agentic-prd/threads?path=/products"   # → smoke_1 포함
curl -sf -X POST "http://localhost:{port}/__agentic-prd/threads/smoke_1/comments" \
  -H "Content-Type: application/json" -d '{"author":"agent","text":"수정했습니다"}'
cat .agentic-prd/comments.json   # 파일에 반영 확인
curl -sf -X DELETE "http://localhost:{port}/__agentic-prd/threads/smoke_1"
```

Expected: 각각 201/200, 파일 반영. 확인 후 서버 종료.

- [ ] **Step 8: (커밋 승인 시) 커밋**

```bash
git add -A
git commit -m "refactor(playground)!: drop Supabase stack; e2e seeds via .agentic-prd JSON"
```

---

### Task 8: npm 배포 준비 (메타데이터 + exports 정합 + pack 검증 + 패키지 README)

**Files:**
- Modify: `packages/widget/package.json`
- Modify: `packages/dev-plugin/package.json`
- Create: `packages/widget/README.md`
- Create: `packages/dev-plugin/README.md`

- [ ] **Step 1: 메타데이터 추가 (양쪽 package.json)**

두 패키지 모두 `"version": "0.1.0"` 으로 올리고 다음 필드 추가 (widget 예시 — dev-plugin 은 `directory` 만 다름):

```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/CreeJee/agentic-prd.git",
    "directory": "packages/widget"
  },
  "homepage": "https://github.com/CreeJee/agentic-prd#readme",
  "author": "CreeJee",
  "keywords": ["comment", "annotation", "widget", "react", "vite-plugin", "claude-code", "agentic"],
```

또한 양쪽 `files` 배열에 `"README.md"` 추가.

- [ ] **Step 2: clean build 후 exports 정합 확인**

```bash
rm -rf packages/widget/dist packages/dev-plugin/dist
pnpm build
ls packages/widget/dist packages/dev-plugin/dist
```

산출물 파일명(`index.js` vs `index.mjs`, `.d.ts` vs `.d.mts`)을 확인하고, **top-level `exports` 와 `publishConfig.exports`/`main`/`module`/`types` 가 실제 파일명과 일치하도록** 수정한다. tsdown `exports: true` 가 top-level exports 를 자동 갱신하므로 그 결과를 기준으로 publishConfig 를 맞춘다 (예: dev-plugin 이 `dist/index.mjs` 를 내면 publishConfig 도 `./dist/index.mjs` + `./dist/index.d.mts`). types 조건이 import 조건보다 먼저 오도록 유지.

- [ ] **Step 3: `packages/widget/README.md` 작성**

```markdown
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
```

- [ ] **Step 4: `packages/dev-plugin/README.md` 작성**

```markdown
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
```

- [ ] **Step 5: pack 검증**

```bash
cd packages/widget && pnpm pack && tar -tzf agentic-prd-widget-0.1.0.tgz
cd ../dev-plugin && pnpm pack && tar -tzf agentic-prd-dev-plugin-0.1.0.tgz
```

Expected: 두 타르볼 모두 `dist/`, `src/`, `README.md`, `package.json` 포함, supabase/database.types 부재. 타르볼은 Task 11 에서 사용하므로 지우지 말 것.

- [ ] **Step 6: (커밋 승인 시) 커밋**

```bash
git add packages/widget/package.json packages/widget/README.md packages/dev-plugin/package.json packages/dev-plugin/README.md
git commit -m "chore(release): npm publish metadata + package READMEs (0.1.0)"
```

---

### Task 9: 마켓플레이스 + 플러그인 표준 레이아웃 + skill 갱신

**Files:**
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/agentic-prd-skill/.claude-plugin/plugin.json` (기존 `plugin.json` 이동+수정)
- Delete: `plugins/agentic-prd-skill/plugin.json`
- Create: `plugins/agentic-prd-skill/skills/agentic-prd/SKILL.md` (기존 `skills/agentic-prd.md` 이동+수정)
- Delete: `plugins/agentic-prd-skill/skills/agentic-prd.md`
- Create: `plugins/agentic-prd-skill/skills/setup/SKILL.md`
- Create: `plugins/agentic-prd-skill/commands/work.md`
- Modify: `plugins/agentic-prd-skill/commands/list-threads.md`, `commands/resolve.md`, `commands/unresolve.md`, `commands/thread.md`, `commands/sync-specs.md` (디스커버리 문구)
- Modify: `plugins/agentic-prd-skill/README.md`

- [ ] **Step 1: `.claude-plugin/marketplace.json` (repo 루트)**

```json
{
  "name": "agentic-prd",
  "owner": {
    "name": "CreeJee"
  },
  "plugins": [
    {
      "name": "agentic-prd",
      "source": "./plugins/agentic-prd-skill",
      "description": "Comment-pin driven agentic dev loop: one-shot setup, drain open threads (locate → fix → reply → resolve), sync spec docs."
    }
  ]
}
```

- [ ] **Step 2: 플러그인 매니페스트 이동**

`plugins/agentic-prd-skill/.claude-plugin/plugin.json` 생성:

```json
{
  "name": "agentic-prd",
  "version": "0.2.0",
  "description": "Talk to a running @agentic-prd/dev-plugin from Claude Code. Setup the widget, list/inspect/resolve threads, drain the comment queue, sync specs."
}
```

기존 `plugins/agentic-prd-skill/plugin.json` 삭제.

- [ ] **Step 3: 메인 skill 이동+갱신** — `plugins/agentic-prd-skill/skills/agentic-prd/SKILL.md`

```markdown
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
```

기존 `skills/agentic-prd.md` 삭제.

- [ ] **Step 4: setup skill 작성** — `plugins/agentic-prd-skill/skills/setup/SKILL.md`

```markdown
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
```

- [ ] **Step 5: work 명령 작성** — `plugins/agentic-prd-skill/commands/work.md`

```markdown
---
name: work
description: Drain open comment threads - locate, fix, verify, reply, resolve each one.
---

Drain the open-comment queue end to end. Read `.agentic-prd.dev.json` (walk up
from cwd) for `{port, prefix}`; base URL `http://localhost:{port}{prefix}`.

1. `GET /threads?resolved=false` — collect open threads (oldest first).
2. For each thread:
   a. `GET /threads/{id}/location` — pick the best candidate, skipping any that
      point into `node_modules/` or a package `dist/` (bundle false-positives).
      Empty candidates → grep the anchor's `selector` / `data-testid`, and check
      the screen's spec (`GET /specs?path={thread.path}`).
   b. Read the code, make the fix the comment asks for. If the request is
      ambiguous or the location can't be found, do NOT guess: append a reply
      asking a concrete question and leave the thread unresolved, then continue
      to the next thread.
   c. Verify: run the project's typecheck/test script if present.
   d. Reply with what changed:
      `POST /threads/{id}/comments` body
      `{"author":"Claude","text":"수정했습니다 — <무엇을 어떻게, 1-2문장>"}`
   e. `POST /threads/{id}/resolve`.
3. Finish with a summary table: thread id, path, action (fixed/skipped), note.

Never resolve a thread you didn't actually fix. Batch-verify at the end as well
(full typecheck) if multiple threads touched code.
```

- [ ] **Step 6: 기존 commands 디스커버리 문구 통일**

`commands/list-threads.md`, `commands/resolve.md`, `commands/unresolve.md`, `commands/thread.md`, `commands/sync-specs.md` 각각에서 "Read `.agentic-prd.dev.json` at the workspace root" 류 문구를 "Read `.agentic-prd.dev.json` (walk up from cwd to find it)" 로 교체. 나머지 본문 유지.

- [ ] **Step 7: 플러그인 README 교체** — `plugins/agentic-prd-skill/README.md`

```markdown
# agentic-prd Claude Code plugin

Companion plugin for [`@agentic-prd/dev-plugin`](../../packages/dev-plugin).
Drive the comment-pin loop from Claude Code: one-shot setup, drain open threads,
inspect/resolve/reply, sync spec docs.

## Install (no clone needed)

```
/plugin marketplace add CreeJee/agentic-prd
/plugin install agentic-prd@agentic-prd
```

Then, in an app with the dev server running: `/agentic-prd:list-threads`.
To set up a fresh app end-to-end: `/agentic-prd:setup`.

## Local development (this repo)

```
/plugin marketplace add /path/to/agentic-prd
/plugin install agentic-prd@agentic-prd
```

Validate before pushing: `claude plugin validate .` from the repo root.
```

- [ ] **Step 8: 검증**

```bash
claude plugin validate .
```

Expected: marketplace + plugin 스키마 PASS. 실패 시 메시지 기준으로 수정.

- [ ] **Step 9: (커밋 승인 시) 커밋**

```bash
git add .claude-plugin plugins
git commit -m "feat(skill): marketplace layout, setup skill, work drain-loop command"
```

---

### Task 10: 루트 README + AGENTS.md 갱신

**Files:**
- Create: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 루트 `README.md` 작성**

```markdown
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
```

- [ ] **Step 2: `AGENTS.md` 갱신 (지정 편집)**

아래 편집을 정확히 적용한다:

1. 패키지 소개 불릿의 widget 항목에서 "저장소는 **Supabase 단일 원천**." → "저장소는 **`StorageAdapter` 로 주입(기본: dev-plugin 로컬 JSON)**." 로 교체. dev-plugin 항목 "Supabase 데이터를 로컬 HTTP 로 노출해" → "`.agentic-prd/` 로컬 JSON 저장소를 소유하고 읽기+쓰기 HTTP API 로 노출해" 로 교체.
2. 위젯 소비 스니펫 교체:

```tsx
<CommentWidget
  pageKey={pathname}        // 호스트가 라우트별로 주입 (없으면 browserRouteSource 폴백)
  pageLabel={screenLabel}
  // config 는 전부 optional — storage 미지정 시 devServerStorage(dev-plugin) 기본
  config={{ storage?, currentUser?, zIndexBase?, routeSource? }}
/>
```

3. `## 핵심 아키텍처` 의 첫 불릿을 교체:

```
- **server state = react-query / client state = jotai.** 스레드·기획문서는 StorageAdapter 원천(기본 devServerStorage → dev-plugin 로컬 JSON) → `useQuery` 폴링(코멘트 4s, 스펙 5s, `refetchIntervalInBackground: true`) + 낙관적 `useMutation`("via the cache": onMutate 스냅샷/setQueryData → onError 롤백 → onSettled invalidate). 작성자 이름은 개인값 → jotai `atomWithStorage`.
```

4. "**DI = WidgetProvider.**" 불릿에서 "QueryClient·SupabaseClient 생성" → "QueryClient·StorageAdapter 해석(기본 devServerStorage)", "훅은 `useSupabaseClient()`" → "훅은 `useStorageAdapter()`".
5. "**supabase-only.**" 불릿을 교체:

```
- **storage adapter.** `config.storage`(StorageAdapter) 미지정 시 `devServerStorage()` — 같은 origin 의 dev-plugin 이 comments+specs 담당. Supabase 등 외부 백엔드 직결은 폐기했고, 원격 협업 백엔드는 어댑터로 추가한다.
```

6. 구조도 갱신: `supabaseEnv.ts` 줄 삭제, `e2e/` 설명을 `global-setup.ts(.agentic-prd 초기화+PRD 시드) · seed-comments.spec.ts(실제 위젯 UI 로 코멘트 시드)` 로 교체, widget 트리에서 `database.types.ts`/`supabase.ts` 줄을 `storage.ts             # StorageAdapter + devServerStorage(기본 어댑터)` 로 교체, dev-plugin 트리에서 `supabase.ts` → `storage.ts          # .agentic-prd/ JSON 파일 저장소`, 루트에 `.claude-plugin/          # 플러그인 마켓플레이스 manifest` 추가, `supabase/` 블록 삭제, plugins 트리를 `.claude-plugin/plugin.json`/`skills/agentic-prd/SKILL.md`/`skills/setup/SKILL.md` 반영으로 갱신, 루트에 `README.md` 추가.
7. `DB(Supabase): ...` 문단을 교체:

```
데이터: 루트 `.agentic-prd/comments.json`(id, path, x_pct, y_pct, anchor, resolved, comments, updated_at) · `.agentic-prd/specs.json`(id, path, title, status, sections, updated_by, updated_at). 본문은 `sections.body`(마크다운). dev-plugin 이 소유(원자적 쓰기, 손상 시 .bak 백업)하며 위젯/skill 은 HTTP API 로만 접근한다. 루트는 pnpm-workspace.yaml 이 있으면 workspace 루트, 없으면 Vite config.root.
```

8. Do 리스트에서 "앵커는 insert·patch 양쪽 모두 저장(`insertThread`/`patchThread` 둘 다 `anchor` 컬럼)" 은 유지(여전히 유효). Don't 및 함정 섹션의 Supabase 언급이 있으면 제거.
9. 커맨드 섹션에 배포/skill 항목 추가:

```
skill 설치(no-clone): `/plugin marketplace add CreeJee/agentic-prd` → `/plugin install agentic-prd@agentic-prd`. 로컬 검증은 `claude plugin validate .`.
```

- [ ] **Step 3: 검증**

Run: `grep -n -i supabase AGENTS.md README.md` → 매치 0 (또는 의도적 과거 기록 언급만).

- [ ] **Step 4: (커밋 승인 시) 커밋**

```bash
git add README.md AGENTS.md
git commit -m "docs: root quickstart README; AGENTS.md reflects local-storage architecture"
```

---

### Task 11: 검증 루프 — no-clone fresh 앱 + 마켓플레이스 리허설 + 회귀 (될 때까지 반복)

**Files:**
- Create: `docs/superpowers/specs/2026-07-12-no-clone-verification-report.md` (결과 기록)

이 태스크는 실패 시 원인 태스크로 돌아가 수정하고 **처음부터 재실행**한다. 전 항목 green 이 종료 조건.

- [ ] **Step 1: fresh 앱 스캐폴드 (workspace 밖, npm)**

scratchpad 디렉터리에서:

```bash
npm create vite@latest agentic-prd-smoke -- --template react-ts
cd agentic-prd-smoke && npm install
npm i <repo>/packages/widget/agentic-prd-widget-0.1.0.tgz
npm i -D <repo>/packages/dev-plugin/agentic-prd-dev-plugin-0.1.0.tgz
```

- [ ] **Step 2: 루트 README quickstart 를 문자 그대로 적용**

- `vite.config.ts` 에 `agenticPRDDev()` 추가
- `src/App.tsx` 에 `<CommentWidget pageKey={location.pathname} />` 추가
- Tailwind 는 fresh 템플릿에 없으므로 스타일 확인은 생략(콘솔 에러 없음만 확인) — README 의 Tailwind 단계가 "v4 호스트만" 임을 재확인.

- [ ] **Step 3: 기동 + API/디스커버리/왕복 검증**

```bash
npm run dev   # 백그라운드
cat .agentic-prd.dev.json                    # ← 앱 루트(모노레포 아님)에 생성돼야 함
curl -sf "http://localhost:{port}/__agentic-prd/threads"    # []
# POST → GET → 파일 확인 → 답글 → resolve → DELETE 왕복 (Task 7 Step 7 과 동일 시퀀스)
cat .agentic-prd/comments.json
npm run build                                # 프로덕션 빌드 통과 + dev-plugin 미포함
```

Expected: 전부 성공, 외부 서비스 없음. `npm run build` 산출물에 `__agentic-prd` 문자열이 포함되어도 위젯 폴백(콘솔 경고 1회)이므로 크래시는 없어야 함 — `npx vite preview` 로 열어 콘솔에 uncaught error 없는지 확인.

- [ ] **Step 4: 위젯 실동작 (브라우저)**

dev 서버를 포그라운드 탭에서 열어(백그라운드 탭은 rAF 정지 주의): 툴바 표시 → 이름 설정 → 코멘트 모드 → 요소 클릭 → 텍스트 입력 → 제출 → 핀 표시 → 새로고침 후 핀 유지. `.agentic-prd/comments.json` 에 anchor 가 저장됐는지 확인 (anchor 는 insert·patch 양쪽 저장 규칙).

- [ ] **Step 5: 마켓플레이스 설치 리허설**

```bash
claude plugin validate .        # repo 루트
```

새 Claude Code 세션(또는 사용자 안내)에서: `/plugin marketplace add <repo 로컬경로>` → `/plugin install agentic-prd@agentic-prd` → `/agentic-prd:list-threads` 가 fresh 앱의 스레드를 읽는지 확인. (CLI 비대화형 검증이 안 되면 validate 통과 + 사용자 수동 확인으로 대체하고 리포트에 기록.)

- [ ] **Step 6: playground 회귀**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm play    # 수동: 핀 생성/코멘트/스펙 패널 동작, .agentic-prd/ 반영
pnpm --filter agentic-prd-playground test:e2e   # 시드 e2e (로컬 브라우저 필요)
```

Expected: 전부 green. e2e 는 supabase 없이 돌아야 함.

- [ ] **Step 7: 실패 시 루프**

어느 스텝이든 실패 → 원인 태스크의 코드를 수정 → `pnpm build` + `pnpm pack` 재생성 → fresh 앱에 재설치(`npm i <새 tgz>`) → Step 3 부터 재검증. 전 항목 통과까지 반복.

- [ ] **Step 8: 검증 리포트 작성**

`docs/superpowers/specs/2026-07-12-no-clone-verification-report.md` 에 기록: 검증 매트릭스(항목/결과/증거 커맨드), 재현 절차, 발견·수정한 문제 목록, 남은 백로그(예: cloudStorage, Tailwind 비의존 스타일).

- [ ] **Step 9: (커밋 승인 시) 커밋**

```bash
git add docs/superpowers/specs/2026-07-12-no-clone-verification-report.md
git commit -m "docs: no-clone install verification report"
```

---

## Self-Review 결과

- **Spec coverage:** §0(스토리지) → Task 1–7, §1(npm) → Task 8, §2(디스커버리) → Task 4·9, §3(마켓플레이스) → Task 9, §4(setup/work/reply-back) → Task 3·9, §5(문서) → Task 8·10, §6(검증 루프) → Task 11. 비범위 항목 미포함 확인.
- **Placeholder:** 없음 — 모든 코드/명령 실물 포함.
- **Type consistency:** `DevStorage`/`ThreadRow`/`SpecRow`(dev-plugin storage.ts) ↔ handlers import 일치, `StorageAdapter.patchThread({xPct,yPx})` ↔ store.ts `useUpdateAnchor` 호출 일치, `ThreadDTO.xPct/yPx` ↔ widget devServerStorage 매핑 일치 확인.
