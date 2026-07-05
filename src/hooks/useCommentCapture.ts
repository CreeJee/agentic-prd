import { type RefObject, useEffect } from "react";
import { isFocusable } from "tabbable";
import { COMMENT_ROOT } from "../anchor";

/**
 * 클릭 지점에서 가장 가까운 focusable 조상을 찾는다(tabbable로 a11y 규칙대로 판정 —
 * disabled/숨김/inert/contenteditable 등 엣지 포함). focusable 조상이 없으면(예: role/tabindex
 * 없는 onClickRow 행) 이벤트 raw target을 그대로 trigger 후보로 신뢰한다.
 */
function closestFocusable(el: Element): Element {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (isFocusable(n)) return n;
  }
  return el;
}

export interface CommentCaptureOptions {
  /** 현재 코멘트 위치 지정(add) 모드인지 */
  addMode: boolean;
  /**
   * overlay 열기 직전 활성화된 버튼을 기록할 ref(useOverlayTracker 소유).
   * pointerdown 핸들러(여기) → MutationObserver(트래커) 사이의 mutable 채널이라 ref가 맞다.
   */
  lastActivatedRef: RefObject<Element | null>;
  /** add 모드에서 대상 클릭 시 호출(앵커 캡처). 안정 참조여야 함(useCallback). bippy source lookup 이 async 라 Promise 반환. */
  onPlace: (
    clientX: number,
    clientY: number,
    target: EventTarget | null
  ) => Promise<void>;
}

/**
 * window capture 단계에서 pointerdown/click/focus를 가로채 호스트 모달과 공존시킨다:
 *  (1) 우리 UI 상호작용이 document로 전파돼 Radix DismissableLayer가 모달을 닫는 것을 막고
 *  (2) Radix FocusScope(focus-trap)가 우리 입력의 포커스를 모달 안으로 뺏는 것을 막고
 *  (3) add 모드 중 대상 클릭을 Radix보다 먼저 가로채 모달을 닫지 않고 앵커를 잡고
 *  (4) 평상시엔 클릭 지점을 기록해 곧 열릴 overlay의 trigger 추정에 쓴다. 가장 가까운 focusable
 *      조상(tabbable), 없으면 raw target. onClickRow 류 비-focusable 오프너도 타깃으로 잡는다.
 * addMode 토글 시에만 재구독한다.
 */
export function useCommentCapture({
  addMode,
  lastActivatedRef,
  onPlace,
}: CommentCaptureOptions): void {
  useEffect(() => {
    const inUI = (t: EventTarget | null) =>
      (t as Element | null)?.closest?.(COMMENT_ROOT);
    const onDown = (e: PointerEvent) => {
      if (inUI(e.target)) {
        if (
          (e.target as Element | null)?.closest?.("[data-comment-no-capture]")
        ) {
          return;
        }
        e.stopPropagation();
        return;
      }
      if (addMode) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const tgt = e.target instanceof Element ? e.target : null;
      if (tgt) lastActivatedRef.current = closestFocusable(tgt);
    };
    const onClick = (e: MouseEvent) => {
      if (!addMode) return;
      if (inUI(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void onPlace(e.clientX, e.clientY, e.target);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (inUI(e.target)) e.stopImmediatePropagation();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (inUI(e.relatedTarget)) e.stopImmediatePropagation();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("focusout", onFocusOut, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("focusout", onFocusOut, true);
    };
  }, [addMode, lastActivatedRef, onPlace]);
}
