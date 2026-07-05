import { COMMENT_ROOT } from "./constants";

/** 엘리먼트 자체로 유일 식별 가능한 안정 selector(data-testid 우선) */
export function stableSelfSelector(el: Element): string | null {
  const testid = el.getAttribute("data-testid");
  if (testid) return `[data-testid="${testid.replace(/"/g, '\\"')}"]`;
  return null;
}

/**
 * el에서 root(미포함)까지의 상대 CSS 경로.
 * 가장 가까운 안정 조상(data-testid)에 경로를 고정하고, 그 아래는 nth-of-type로 좁힌다.
 * 동적 id는 절대 쓰지 않는다.
 */
export function cssPathWithin(el: Element, root: Element | null): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 8) {
    if (node === root || node === document.body) break;
    const stable = stableSelfSelector(node);
    if (stable) {
      parts.unshift(stable);
      break;
    }
    let sel = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (c) => c.tagName === node?.tagName
      );
      if (sameTag.length > 1) {
        sel += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }
    parts.unshift(sel);
    node = parent;
  }
  return parts.join(" > ") || ":scope";
}

/** selector로 안전 조회(잘못된 selector면 null) */
export function safeQuery(root: ParentNode, selector: string): Element | null {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * 앵커 엘리먼트가 다른 무언가(열린 dialog/sheet/drawer 등)에 가려졌는지.
 * 단일 z-index로는 "page 핀은 모달 아래 + overlay 핀은 모달 위"를 동시에 못 하므로,
 * 엘리먼트 중심점의 최상단 요소가 자기 자신(또는 그 안/밖 관계)이 아니면 가림으로 보고 핀을 숨긴다.
 * 우리 코멘트 UI(COMMENT_ROOT)는 가림으로 치지 않는다.
 */
export function isOccluded(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const top = document.elementFromPoint(
    r.left + r.width / 2,
    r.top + r.height / 2
  );
  if (!top || top.closest(COMMENT_ROOT)) return false;
  return !(top === el || el.contains(top) || top.contains(el));
}
