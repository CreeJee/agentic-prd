import { CheckIcon } from "lucide-react";
import type { Point } from "../anchor";
import { cn } from "../cn";
import { authorInitial } from "../format";

/** 단일 코멘트 핀 — 작성자 이니셜 teardrop. 해결됨은 체크, overlay 닫힘이면 링으로 표시. */
export function Pin({
  point,
  resolved,
  author,
  active,
  onClick,
}: {
  point: Point;
  resolved: boolean;
  author: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ left: point.x, top: point.y }}
      className={cn(
        "-translate-x-1 -translate-y-7 pointer-events-auto absolute flex size-7 items-center justify-center rounded-full rounded-bl-none border-2 border-white font-bold text-white text-xs shadow-md transition-[left,top,transform] duration-300 ease-out hover:scale-110",
        resolved ? "bg-green-500" : "bg-primary",
        active && !resolved && "ring-2 ring-primary/30",
        point.onTrigger && "ring-2 ring-primary/40 ring-offset-1"
      )}
    >
      {resolved ? <CheckIcon className="size-3.5" /> : authorInitial(author)}
    </button>
  );
}
