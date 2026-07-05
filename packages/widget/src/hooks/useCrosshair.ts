import { useEffect } from "react";

/** active일 때 body 커서를 crosshair로(코멘트 위치 지정 모드 표시) */
export function useCrosshair(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "crosshair";
    return () => {
      document.body.style.cursor = prev;
    };
  }, [active]);
}
