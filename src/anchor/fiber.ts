/**
 * 옵셔널: 리액트 로직 위치(안쪽→바깥 named 컴포넌트 경로) 수집.
 * 위치고정엔 안 쓰고 참고용. 호스트(div/span) Fiber는 건너뛰고 named 컴포넌트만.
 */
function fiberName(t: unknown): string | undefined {
  if (!t) return undefined;
  if (typeof t === "function") {
    const fn = t as { displayName?: string; name?: string };
    return fn.displayName || fn.name || undefined;
  }
  if (typeof t === "object") {
    const o = t as { displayName?: string; render?: unknown; type?: unknown };
    if (o.displayName) return o.displayName;
    if (o.render) return fiberName(o.render);
    if (o.type) return fiberName(o.type);
  }
  return undefined;
}

/** 엘리먼트에서 안쪽→바깥 named 컴포넌트 경로를 최대 16단계 수집 */
export function reactPathOf(el: Element): string[] | undefined {
  try {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    // biome-ignore lint/suspicious/noExplicitAny: React 내부 Fiber 접근
    let f = key ? (el as any)[key] : null;
    const names: string[] = [];
    let hops = 0;
    while (f && hops < 240 && names.length < 16) {
      const name = fiberName(f.type);
      if (
        name &&
        name !== "anonymous" &&
        name !== "Unknown" &&
        names[names.length - 1] !== name
      ) {
        names.push(name);
      }
      f = f.return;
      hops++;
    }
    return names.length ? names : undefined;
  } catch {
    return undefined;
  }
}
