import { type RefObject, useEffect, useRef } from "react";
import {
  COMMENT_ROOT,
  cssPathWithin,
  OVERLAY_SEL,
  type OverlayInfoMap,
  overlayKeyOf,
  triggerForOverlay,
} from "../anchor";

export interface OverlayTracker {
  /** overlayKey → {부모스코프 기준 trigger 경로, 부모 overlayKey} */
  overlayInfoRef: RefObject<OverlayInfoMap>;
  /** overlay 열기 직전 활성화된 버튼(명령형 overlay의 trigger 추정용) */
  lastActivatedRef: RefObject<Element | null>;
}

/**
 * overlay가 열리는 순간(추가/ data-state=open) 그 overlay를 연 trigger를 박제한다.
 * overlay-kit 같은 명령형 overlay는 aria 연결이 없어 "열림 직전 활성화 버튼"으로 trigger를 추정하고,
 * trigger가 다른 overlay 안에 있으면 그 overlay를 부모로 기록해 중첩 체인을 만든다.
 * trigger를 못 찾아도(비활성 요소가 연 경우) overlayKey는 등록한다 → 체인/부모 메타가 끊기지 않고
 * (열린 동안 핀 표시는 정상), triggerSelector만 비어 닫힘 시 trigger 말풍선 모드만 비활성된다.
 */
export function useOverlayTracker(): OverlayTracker {
  const overlayInfoRef = useRef<OverlayInfoMap>(new Map());
  const lastActivatedRef = useRef<Element | null>(null);

  useEffect(() => {
    const onOverlay = (root: Element) => {
      if (root.getAttribute("data-state") === "closed") return;
      if (root.closest(COMMENT_ROOT)) return;
      const key = overlayKeyOf(root);
      if (overlayInfoRef.current.has(key)) return;
      const trig = triggerForOverlay(root, lastActivatedRef.current);
      const parentOv = trig?.closest(OVERLAY_SEL) ?? null;
      const parent =
        parentOv && !parentOv.closest(COMMENT_ROOT) ? parentOv : null;
      overlayInfoRef.current.set(key, {
        triggerSelector: trig ? cssPathWithin(trig, parent) : undefined,
        parentKey: parent ? overlayKeyOf(parent) : undefined,
      });
    };
    for (const r of document.querySelectorAll(OVERLAY_SEL)) onOverlay(r);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes") {
          const t = m.target;
          if (t instanceof Element && t.matches(OVERLAY_SEL)) onOverlay(t);
          continue;
        }
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (n.matches(OVERLAY_SEL)) onOverlay(n);
          for (const r of n.querySelectorAll(OVERLAY_SEL)) onOverlay(r);
        }
      }
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    return () => mo.disconnect();
  }, []);

  return { overlayInfoRef, lastActivatedRef };
}
