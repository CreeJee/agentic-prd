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
  filter: { path?: string; resolved?: boolean; limit?: number }
): Promise<ThreadDTO[]> {
  const rows = await storage.listThreads(filter);
  return rows.map(toDTO);
}

export async function handleGetThread(
  storage: DevStorage,
  id: string
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
  input: CreateThreadInput
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
  patch: ThreadPatchInput
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
  input: AppendCommentInput
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
  id: string
): Promise<boolean> {
  return storage.deleteThread(id);
}

export async function handleSetResolved(
  storage: DevStorage,
  id: string,
  resolved: boolean
): Promise<ThreadDTO | null> {
  const row = await storage.setThreadResolved(id, resolved);
  return row ? toDTO(row) : null;
}

export async function handleThreadLocation(
  storage: DevStorage,
  projectRoot: string,
  id: string
): Promise<{ candidates: LocationCandidate[] }> {
  const row = await storage.getThread(id);
  if (!row?.anchor) return { candidates: [] };
  const candidates = await resolveAnchorLocation(
    projectRoot,
    row.anchor as WidgetAnchor
  );
  return { candidates };
}
