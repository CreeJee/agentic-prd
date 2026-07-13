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
