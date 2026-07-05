import { clamp } from "es-toolkit";
import type { Anchor, ScopeLevel } from "../store";
import { COMMENT_ROOT, OVERLAY_SEL } from "./constants";
import { reactContextOf } from "./fiber";
import { overlayKeyOf } from "./overlays";
import { cssPathWithin } from "./selectors";

/** overlay 열림 시점에 잡은 정보(overlayKey → {부모스코프 기준 trigger 경로, 부모 overlayKey}) */
export type OverlayInfoMap = Map<
  string,
  { triggerSelector?: string; parentKey?: string }
>;

export interface Capture {
  /** 폴백용: 레이아웃 가로폭 대비 위치(%) */
  xPct: number;
  /** 폴백용: 문서 절대 세로 위치(px) */
  yPx: number;
  /** 엘리먼트 앵커(우리 UI 밖 클릭이면 생성, 아니면 null) */
  anchor: Anchor | null;
}

/**
 * 클릭 지점의 엘리먼트로 앵커를 만든다.
 * overlay 내부면 부모 링크(overlayInfo.parentKey)를 따라 바깥→안 중첩 체인을 구성한다.
 * bippy 로 fiber traverse + source-map 조회를 하므로 비동기다.
 */
export async function buildCapture(
  clientX: number,
  clientY: number,
  target: EventTarget | null,
  overlayInfo: OverlayInfoMap
): Promise<Capture> {
  const el =
    target instanceof Element
      ? target
      : document.elementFromPoint(clientX, clientY);
  let anchor: Anchor | null = null;
  if (el && !el.closest(COMMENT_ROOT)) {
    const overlay = el.closest(OVERLAY_SEL);
    const root = overlay && !overlay.closest(COMMENT_ROOT) ? overlay : null;
    const r = el.getBoundingClientRect();
    const scopeChain: ScopeLevel[] = [];
    if (root) {
      let key: string | undefined = overlayKeyOf(root);
      let guard = 0;
      while (key && guard++ < 8) {
        const info = overlayInfo.get(key);
        scopeChain.unshift({
          overlayKey: key,
          triggerSelector: info?.triggerSelector,
        });
        key = info?.parentKey;
      }
    }
    const reactContext = await reactContextOf(el);
    anchor = {
      scopeChain,
      selector: cssPathWithin(el, root),
      relX: r.width ? clamp((clientX - r.left) / r.width, 0, 1) : 0.5,
      relY: r.height ? clamp((clientY - r.top) / r.height, 0, 1) : 0.5,
      reactPath: reactContext.path,
      reactSource: reactContext.source,
    };
  }
  const xPct = (clientX / document.documentElement.clientWidth) * 100;
  const yPx = clientY + window.scrollY;
  return { xPct, yPx, anchor };
}
