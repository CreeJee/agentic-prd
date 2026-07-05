import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";
import { normalizeDoc, type SpecDoc } from "./specs/store";
import type { CommentEntry, CommentThread, StoredAnchor } from "./store";

export interface SupabaseStorageConfig {
  url: string;
  publicKey: string;
}

export interface SupabaseClient {
  /** 해당 화면(path)의 스레드만 서버에서 가져온다(payload 최소화) */
  fetchThreads(path: string): Promise<CommentThread[]>;
  insertThread(thread: CommentThread): Promise<void>;
  patchThread(
    id: string,
    patch: {
      resolved?: boolean;
      comments?: CommentEntry[];
      /** 재앵커(재배치)용: 엘리먼트 앵커 + 폴백 좌표 */
      anchor?: StoredAnchor | null;
      x_pct?: number;
      y_pct?: number;
    }
  ): Promise<void>;
  deleteThread(id: string): Promise<void>;
  /** 해당 화면(path)의 기획 문서만 서버에서 가져온다 */
  fetchSpecs(path: string): Promise<SpecDoc[]>;
  upsertSpec(doc: SpecDoc): Promise<void>;
  deleteSpec(id: string): Promise<void>;
}
/** 코멘트용 PostgREST 클라이언트(table: demo_comments 기본) */
export function createSupabaseClient(
  config: SupabaseStorageConfig
): SupabaseClient {
  const client = createClient<Database>(config.url, config.publicKey);

  return {
    async fetchThreads(path) {
      const rows = await client
        .from("demo_comments")
        .select("*")
        .eq("path", path)
        .order("updated_at", {
          ascending: true,
        });

      return (rows.data ?? []).map((row) => {
        return {
          id: row.id,
          path: row.path,
          xPct: row.x_pct,
          yPx: row.y_pct,
          anchor: row.anchor as unknown as CommentThread["anchor"],
          resolved: row.resolved,
          comments: (row.comments ??
            []) as unknown as CommentThread["comments"],
        } as CommentThread;
      });
    },

    async insertThread(thread) {
      await client.from("demo_comments").insert({
        id: thread.id,
        path: thread.path,
        x_pct: thread.xPct,
        y_pct: thread.yPx,
        anchor: thread.anchor as Json,
        resolved: thread.resolved,
        comments: thread.comments as unknown as Json[],
      });
    },

    async patchThread(id, patch) {
      await client
        .from("demo_comments")
        .update({
          anchor: patch.anchor as Json,
          comments: patch.comments as unknown as Json[],
          resolved: patch.resolved,
          x_pct: patch.x_pct,
          y_pct: patch.y_pct,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    },

    async deleteThread(id) {
      await client.from("demo_comments").delete().eq("id", id);
    },

    async fetchSpecs(path) {
      const { data } = await client
        .from("demo_specs")
        .select("*")
        .eq("path", path);
      return (data ?? [])
        .map((row) => {
          const sections = (row.sections ?? {}) as Record<string, string>;
          return normalizeDoc({
            id: row.id,
            path: row.path,
            title: row.title ?? "",
            status: row.status,
            body:
              typeof sections["body"] === "string"
                ? sections["body"]
                : undefined,
            externalUrl:
              typeof sections["externalUrl"] === "string"
                ? sections["externalUrl"]
                : undefined,
            sections,
            updatedBy: row.updated_by ?? "",
            updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
          });
        })
        .filter((d): d is SpecDoc => d !== null);
    },

    async upsertSpec(doc) {
      await client.from("demo_specs").upsert({
        id: doc.id,
        path: doc.path,
        title: doc.title,
        status: doc.status,
        sections: {
          body: doc.body,
          ...(doc.externalUrl ? { externalUrl: doc.externalUrl } : {}),
        } as unknown as Json,
        updated_by: doc.updatedBy,
        updated_at: new Date(doc.updatedAt).toISOString(),
      });
    },

    async deleteSpec(id) {
      await client.from("demo_specs").delete().eq("id", id);
    },
  };
}
