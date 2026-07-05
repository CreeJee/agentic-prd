import { COMMENT_ROOT, OVERLAY_SEL } from "./constants";

/** overlay 식별 키 — 타이틀 텍스트 우선, 없으면(Select/Dropdown) 여는 trigger 텍스트 */
export function overlayKeyOf(root: Element): string {
  const lid = root.getAttribute("aria-labelledby");
  if (lid) {
    const t = document.getElementById(lid)?.textContent?.trim();
    if (t) return t;
  }
  const al = root.getAttribute("aria-label")?.trim();
  if (al) return al;
  const id = root.id;
  if (id) {
    try {
      const trig = document.querySelector(
        `[aria-controls="${CSS.escape(id)}"]`
      );
      const tt = trig?.textContent?.trim();
      if (tt) return `popper:${tt.slice(0, 40)}`;
    } catch {}
  }
  return "dialog";
}

/** 현재 열려 있는 overlay 중 key가 일치하는 것(닫힌 것 제외) */
export function findOpenOverlay(key: string): Element | null {
  for (const r of document.querySelectorAll(OVERLAY_SEL)) {
    if (r.getAttribute("data-state") === "closed") continue;
    if (r.closest(COMMENT_ROOT)) continue;
    if (overlayKeyOf(r) === key) return r;
  }
  return null;
}

/**
 * overlay를 연 trigger 요소를 찾는다.
 *  1) aria-controls=overlay.id (Radix DropdownMenu/Select/Popover 등 선언형) → 정확
 *  2) 폴백: overlay 열리기 직전 활성화된 버튼(overlay-kit 등 명령형 — aria 연결 없음)
 * trigger는 페이지 트리에 남아 닫혀도 존재해야 하므로 overlay/우리 UI 내부면 무효.
 */
export function triggerForOverlay(
  root: Element,
  lastActivated: Element | null
): Element | null {
  const id = root.id;
  if (id) {
    try {
      const byAria = document.querySelector(
        `[aria-controls="${CSS.escape(id)}"]`
      );
      if (byAria && !byAria.closest(COMMENT_ROOT)) return byAria;
    } catch {}
  }
  const la = lastActivated;
  if (
    la?.isConnected &&
    !la.closest(OVERLAY_SEL) &&
    !la.closest(COMMENT_ROOT)
  ) {
    return la;
  }
  return null;
}
