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
    ...(row.sections?.externalUrl
      ? { externalUrl: row.sections.externalUrl }
      : {}),
    updatedBy: row.updated_by,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function fileHeader(spec: SpecDTO): string {
  const iso = new Date(spec.updatedAt).toISOString();
  return `<!-- agentic-prd:spec id=${spec.id} updatedAt=${iso} status=${spec.status} -->\n\n# ${spec.title}\n\n`;
}

export async function handleListSpecs(
  storage: DevStorage,
  filter: { path?: string }
): Promise<SpecDTO[]> {
  const rows = await storage.listSpecs(filter);
  return rows.map(toDTO);
}

export async function handleGetSpec(
  storage: DevStorage,
  id: string
): Promise<SpecDTO | null> {
  const row = await storage.getSpec(id);
  return row ? toDTO(row) : null;
}

export async function handleSyncAll(
  storage: DevStorage,
  specSyncDir: string,
  filter: { path?: string }
): Promise<{ synced: SyncedSpec[]; removed: string[] }> {
  const rows = await storage.listSpecs(filter);
  const specs = rows.map(toDTO);

  await mkdir(specSyncDir, { recursive: true });
  const manifest = await loadManifest(specSyncDir);
  /**
   * 이번 sync 대상 manifest 스냅샷. 아래 write 루프가 `manifest.byId` 를 갱신한 뒤에도
   * "이전에 무슨 파일이었는지" 를 알아 stale 판정에 쓰기 위함. 이 스냅샷이 없으면
   * rename 감지가 실패해 이전 이름의 파일이 orphan 으로 남는다.
   */
  const previousById: Record<string, { file: string; syncedAt: number }> = {
    ...manifest.byId,
  };
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
      collided: nameWithoutExt !== baseSlug,
    });
    manifest.byId[spec.id] = { file: filename, syncedAt: Date.now() };
    writtenFiles.add(filename);
  }

  const removed: string[] = [];
  /**
   * path 필터 sync 는 다른 path 의 manifest 항목까지 orphan 취급해 삭제하면 안 된다
   * (fetch 범위 밖이라 filenameById 에도 없음). global sync 일 때만 stale 을 청소한다.
   */
  if (filter.path === undefined) {
    for (const [id, entry] of Object.entries(previousById)) {
      const newFilename = filenameById.get(id);
      if (newFilename && newFilename === entry.file) continue;
      const stale = join(specSyncDir, entry.file);
      await unlink(stale).catch(() => undefined);
      removed.push(entry.file);
      if (!newFilename) delete manifest.byId[id];
    }
  }

  await saveManifest(specSyncDir, manifest);
  return { synced, removed };
}

export async function handleSyncOne(
  storage: DevStorage,
  specSyncDir: string,
  id: string
): Promise<SyncedSpec | null> {
  const target = await storage.getSpec(id);
  if (!target) return null;
  /**
   * collision 은 <specSyncDir> 안에서 파일 이름이 겹치는지 여부라, 같은 flat 디렉터리
   * 를 공유하는 모든 spec 을 대상으로 판정해야 syncOne 과 syncAll 이 같은 파일명을
   * 낸다. 이전에는 target.path 의 sibling 만 봐 다른 path 의 동명 spec 을 놓쳤다.
   */
  const allSpecs = await storage.listSpecs({});
  const filenameById = resolveCollisions(
    allSpecs.map((r) => ({ id: r.id, title: r.title }))
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
  input: SpecPutInput
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
  id: string
): Promise<boolean> {
  return storage.deleteSpec(id);
}
