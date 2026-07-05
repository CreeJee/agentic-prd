import { resolveAnchorLocation } from "../anchor-resolver.js";
import type { DevSupabase, ThreadRow } from "../supabase.js";
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
    anchor: (row.anchor as WidgetAnchor) ?? undefined,
  };
}

export async function handleListThreads(
  supabase: DevSupabase,
  filter: { path?: string; resolved?: boolean; limit?: number },
): Promise<ThreadDTO[]> {
  const rows = await supabase.listThreads(filter);
  return rows.map(toDTO);
}

export async function handleGetThread(
  supabase: DevSupabase,
  id: string,
): Promise<ThreadDTO | null> {
  const row = await supabase.getThread(id);
  return row ? toDTO(row) : null;
}

export async function handleSetResolved(
  supabase: DevSupabase,
  id: string,
  resolved: boolean,
): Promise<ThreadDTO> {
  const row = await supabase.setThreadResolved(id, resolved);
  return toDTO(row);
}

export async function handleThreadLocation(
  supabase: DevSupabase,
  projectRoot: string,
  id: string,
): Promise<{ candidates: LocationCandidate[] }> {
  const row = await supabase.getThread(id);
  if (!row?.anchor) return { candidates: [] };
  const candidates = await resolveAnchorLocation(
    projectRoot,
    row.anchor as WidgetAnchor,
  );
  return { candidates };
}
