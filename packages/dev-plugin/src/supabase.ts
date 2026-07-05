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
    auth: { persistSession: false },
  });

  return {
    async listThreads({ path, resolved, limit = 100 }) {
      let query = client.from(THREAD_TABLE).select("*").limit(limit);
      if (path) query = query.eq("path", path);
      if (typeof resolved === "boolean") query = query.eq("resolved", resolved);
      const { data, error } = await query.order("updated_at", {
        ascending: false,
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
          updated_at: new Date().toISOString(),
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
        ascending: false,
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
    },
  };
}
