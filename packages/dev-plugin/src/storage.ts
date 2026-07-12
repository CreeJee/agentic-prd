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
  /** 동일 id 가 이미 있으면 행을 교체한다(클라이언트 생성 id 의 멱등 재시도 허용). */
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

/** 손상 파일을 `.bak` 으로 백업하고 경고를 남긴다 — 다음 쓰기가 원본을 덮어쓰지 않게 한다. */
function backupCorruptFile(file: string): void {
  renameSync(file, `${file}.bak`);
  console.warn(
    `[agentic-prd] ${file} JSON 파싱 실패 — ${file}.bak 으로 백업하고 빈 저장소로 시작합니다.`
  );
}

/** ISO 문자열을 epoch ms 로 파싱하되, 못 읽는 값은 0 으로 취급해 정렬이 NaN 에 오염되지 않게 한다. */
function ts(v: string): number {
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 파싱 실패나 배열이 아닌 JSON 은 원본을 `.bak` 으로 백업하고 빈 저장소로
 * 시작한다 — 손상된 파일 때문에 dev 서버 전체가 죽으면 안 된다.
 */
function readTable<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  const raw = readFileSync(file, "utf8");
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as T[];
    backupCorruptFile(file);
    return [];
  } catch {
    backupCorruptFile(file);
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
    patch: ThreadPatch
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
        .sort((a, b) => ts(b.updated_at) - ts(a.updated_at))
        .slice(0, Math.max(0, limit));
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
      return rows.sort((a, b) => ts(b.updated_at) - ts(a.updated_at));
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
