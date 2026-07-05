import type { Anchor, ScopeLevel, StoredAnchor } from "../store";
import { findOpenOverlay } from "./overlays";
import { isOccluded, safeQuery } from "./selectors";

/** 핀의 뷰포트 좌표(px) + 표시 메타 */
export interface Point {
  x: number;
  y: number;
  /** overlay 닫힘 상태라 trigger 위에 모여 있는 핀(말풍선 모드) */
  onTrigger?: boolean;
  /** 같은 trigger/지점에 모이는 핀을 묶기 위한 그룹 키 */
  clusterKey?: string;
}

/** 구버전(단일 overlay) 앵커를 scopeChain 형태로 정규화 */
export function normalizeAnchor(
  anchor: StoredAnchor | null | undefined
): Anchor | null {
  if (!anchor) return null;
  if (Array.isArray((anchor as Anchor).scopeChain)) return anchor as Anchor;
  const legacy = anchor as {
    scopeKind?: "page" | "overlay";
    scopeKey?: string;
    selector: string;
    relX: number;
    relY: number;
    reactPath?: string[];
    triggerSelector?: string;
  };
  const scopeChain: ScopeLevel[] =
    legacy.scopeKind === "overlay" && legacy.scopeKey
      ? [
          {
            overlayKey: legacy.scopeKey,
            triggerSelector: legacy.triggerSelector,
          },
        ]
      : [];
  return {
    scopeChain,
    selector: legacy.selector,
    relX: legacy.relX,
    relY: legacy.relY,
    reactPath: legacy.reactPath,
  };
}

/**
 * 핀이 속한 클러스터(겹침 그룹) 키.
 * 말풍선 모드는 같은 trigger(clusterKey)끼리, 일반 핀은 14px 버킷의 같은 지점끼리 묶는다.
 */
export function clusterIdOf(p: Point): string {
  if (p.onTrigger && p.clusterKey) return p.clusterKey;
  return `pt:${Math.round(p.x / 14)}:${Math.round(p.y / 14)}`;
}

/**
 * 핀 위치를 현재 뷰포트 좌표(px)로 해석한다.
 * - page scope(체인 비음): 문서에서 엘리먼트를 찾아 표시. 못 찾으면 xPct/yPx 폴백.
 * - overlay 체인: 열린 가장 깊은 레벨을 찾아
 *     · 최내부가 열림 → 그 안에서 엘리먼트를 찾아 핀
 *     · 자식이 닫힘 → 자식 trigger 위에 말풍선(부모 overlay 안 / 모두 닫혔으면 페이지에서 해석)
 * 가려졌거나(occlusion) 못 찾으면 null(숨김).
 */
export function resolvePoint(
  anchor: StoredAnchor | null | undefined,
  xPct: number,
  yPx: number
): Point | null {
  const norm = normalizeAnchor(anchor);

  if (!norm || norm.scopeChain.length === 0) {
    if (norm) {
      const el = safeQuery(document, norm.selector);
      if (el) {
        if (isOccluded(el)) return null;
        const r = el.getBoundingClientRect();
        return {
          x: r.left + norm.relX * r.width,
          y: r.top + norm.relY * r.height,
        };
      }
    }
    return {
      x: (xPct / 100) * document.documentElement.clientWidth,
      y: yPx - window.scrollY,
    };
  }

  const chain = norm.scopeChain;
  let openIdx = -1;
  let openOverlay: Element | null = null;
  for (let i = chain.length - 1; i >= 0; i--) {
    const lvl = chain[i];
    const ov = lvl ? findOpenOverlay(lvl.overlayKey) : null;
    if (ov) {
      openIdx = i;
      openOverlay = ov;
      break;
    }
  }

  if (openIdx === chain.length - 1 && openOverlay) {
    const el = safeQuery(openOverlay, norm.selector);
    if (el) {
      if (isOccluded(el)) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left + norm.relX * r.width,
        y: r.top + norm.relY * r.height,
      };
    }
    return null;
  }

  const childLevel = chain[openIdx + 1];
  const trigSel = childLevel?.triggerSelector;
  if (!trigSel) return null;
  const root: ParentNode = openOverlay ?? document;
  const el = safeQuery(root, trigSel);
  if (!el) return null;
  if (isOccluded(el)) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.right - 4,
    y: r.top + 4,
    onTrigger: true,
    clusterKey: `${openIdx + 1}|${trigSel}`,
  };
}
