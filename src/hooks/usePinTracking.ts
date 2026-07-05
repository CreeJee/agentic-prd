import { useEffect, useState } from "react";
import { type Point, resolvePoint } from "../anchor";
import type { CommentThread } from "../store";

/**
 * 핀 위치를 requestAnimationFrame으로 매 프레임 재측정해 threadId별 뷰포트 좌표(px)로 돌려준다.
 * 엘리먼트 rect 기반이라 스크롤/모달 이동/fixed/레이아웃 변화를 자동 추종하며,
 * 위치 변동이 있을 때만 setState 한다. (배경 탭은 브라우저가 rAF를 멈추므로 자연히 일시정지)
 *
 * threads는 안정된 참조여야 한다(useMemo 등). 같은 프레임 루프가 계속 돌고,
 * threads가 바뀔 때만 루프를 재생성한다.
 */
export function usePinTracking(
  threads: CommentThread[]
): Record<string, Point> {
  const [points, setPoints] = useState<Record<string, Point>>({});

  useEffect(() => {
    let raf = 0;
    let prevKey = "";
    const loop = () => {
      const next: Record<string, Point> = {};
      for (const t of threads) {
        const p = resolvePoint(t.anchor, t.xPct, t.yPx);
        if (p) next[t.id] = p;
      }
      const key = JSON.stringify(next);
      if (key !== prevKey) {
        prevKey = key;
        setPoints(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [threads]);

  return points;
}
