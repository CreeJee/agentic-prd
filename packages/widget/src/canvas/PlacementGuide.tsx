/**
 * 위치 지정(add/relocate) 중 상단 안내 배너.
 */
import type { Canvas } from "./types";

export function PlacementGuide({
  canvas,
  placing,
}: {
  canvas: Canvas;
  placing: boolean;
}) {
  if (!placing) return null;

  return (
    <div className="-translate-x-1/2 pointer-events-none fixed top-4 left-1/2 z-99993 rounded-full bg-slate-900 px-3 py-1.5 text-white text-xs shadow-lg">
      {canvas.kind === "relocate"
        ? "코멘트를 다시 붙일 위치를 클릭하세요 (모달 안도 가능) · ESC로 취소"
        : "코멘트를 남길 위치를 클릭하세요 (모달 안도 가능) · ESC로 취소"}
    </div>
  );
}
