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
    /* 파일 없음 or JSON 파싱 실패 → 빈 manifest */
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
