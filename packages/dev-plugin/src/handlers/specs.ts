import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadManifest, saveManifest } from "../manifest.js";
import { resolveCollisions } from "../slug.js";
import type { DevSupabase, SpecRow } from "../supabase.js";

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
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function fileHeader(spec: SpecDTO): string {
  const iso = new Date(spec.updatedAt).toISOString();
  return `<!-- agentic-prd:spec id=${spec.id} updatedAt=${iso} status=${spec.status} -->\n\n# ${spec.title}\n\n`;
}

export async function handleListSpecs(
  supabase: DevSupabase,
  filter: { path?: string },
): Promise<SpecDTO[]> {
  const rows = await supabase.listSpecs(filter);
  return rows.map(toDTO);
}

export async function handleGetSpec(
  supabase: DevSupabase,
  id: string,
): Promise<SpecDTO | null> {
  const row = await supabase.getSpec(id);
  return row ? toDTO(row) : null;
}

export async function handleSyncAll(
  supabase: DevSupabase,
  specSyncDir: string,
  filter: { path?: string },
): Promise<{ synced: SyncedSpec[]; removed: string[] }> {
  const rows = await supabase.listSpecs(filter);
  const specs = rows.map(toDTO);

  await mkdir(specSyncDir, { recursive: true });
  const manifest = await loadManifest(specSyncDir);
  const filenameById = resolveCollisions(
    specs.map(({ id, title }) => ({ id, title })),
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
      collided: nameWithoutExt !== baseSlug,
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
  id: string,
): Promise<SyncedSpec | null> {
  const target = await supabase.getSpec(id);
  if (!target) return null;
  const siblings = await supabase.listSpecs({ path: target.path });
  const filenameById = resolveCollisions(
    siblings.map((r) => ({ id: r.id, title: r.title })),
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
