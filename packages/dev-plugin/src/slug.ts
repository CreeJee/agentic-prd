/**
 * Title → 파일명용 slug 변환 및 collision 판정.
 */
import { createHash } from "node:crypto";

export function slugify(title: string): string {
  const normalized = title
    .normalize("NFKC")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "untitled";
}

export interface SlugEntry {
  id: string;
  title: string;
}

/**
 * id 로부터 파일명용 안정 short-hash(hex 8자) 를 만든다. sha256 이라 다른 id
 * 형태(UUID, `spec_<epoch>_<random>` 등) 에도 안전하게 unique 하다. 앞자리
 * slice 는 prefix 를 공유하는 id (예: `spec_mqqXXX_YYY`) 에서 collision 을 만든다.
 */
function idShort(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 8);
}

/**
 * spec 목록에 대해 slug 를 계산하고, 같은 slug 를 갖는 그룹의 모든 spec 은
 * `<slug>-<idShort>.md` 로, 유일한 것은 `<slug>.md` 로 매핑한다.
 * idShort 는 sha256(id) 앞 8자(hex).
 */
export function resolveCollisions(entries: SlugEntry[]): Map<string, string> {
  const groups = new Map<string, SlugEntry[]>();
  for (const entry of entries) {
    const slug = slugify(entry.title);
    const bucket = groups.get(slug);
    if (bucket) bucket.push(entry);
    else groups.set(slug, [entry]);
  }
  const filenameById = new Map<string, string>();
  for (const [slug, group] of groups) {
    if (group.length === 1) {
      const only = group[0];
      if (only) filenameById.set(only.id, `${slug}.md`);
    } else {
      for (const entry of group) {
        filenameById.set(entry.id, `${slug}-${idShort(entry.id)}.md`);
      }
    }
  }
  return filenameById;
}
