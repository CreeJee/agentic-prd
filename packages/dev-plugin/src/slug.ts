/**
 * Title → 파일명용 slug 변환 및 collision 판정.
 */

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
 * spec 목록에 대해 slug 를 계산하고, 같은 slug 를 갖는 그룹의 모든 spec 은
 * `<slug>-<idShort>.md` 로, 유일한 것은 `<slug>.md` 로 매핑한다.
 * idShort = UUID 앞 8자.
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
        const idShort = entry.id.slice(0, 8);
        filenameById.set(entry.id, `${slug}-${idShort}.md`);
      }
    }
  }
  return filenameById;
}
