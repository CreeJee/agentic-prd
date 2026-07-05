import type { Point } from "../anchor";
import { cn } from "../cn";
import { authorInitial, distinctAuthors } from "../format";
import type { CommentThread } from "../store";

/**
 * 클러스터(겹침) 배지 — 같은 지점에 여러 코멘트가 겹칠 때 하나로 묶는다.
 * 단일 핀(작성자 1명 teardrop)과 구분되도록 작성자 아바타를 겹쳐 쌓아 "누가 달았는지" 보여준다.
 * 작성자가 3명 초과면 +N으로 축약.
 */
export function ClusterBadge({
  point,
  threads,
  active,
  onClick,
}: {
  point: Point;
  threads: CommentThread[];
  active: boolean;
  onClick: () => void;
}) {
  const authors = distinctAuthors(threads);
  const shown = authors.slice(0, 3);
  const extra = authors.length - shown.length;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ left: point.x, top: point.y }}
      title={`작성자 ${authors.join(", ")}`}
      className={cn(
        "-translate-x-1 -translate-y-7 pointer-events-auto absolute flex items-center transition-[left,top] duration-300 ease-out hover:scale-110",
        active && "drop-shadow-[0_0_0_2px_rgba(252,107,45,0.4)]"
      )}
    >
      {shown.map((a, i) => (
        <span
          key={a}
          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: shown.length - i }}
          className="relative flex size-7 items-center justify-center rounded-full border-2 border-white bg-primary font-bold text-white text-xs shadow-md"
        >
          {authorInitial(a)}
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{ marginLeft: -10 }}
          className="relative flex size-7 items-center justify-center rounded-full border-2 border-white bg-slate-600 font-bold text-white text-xs shadow-md"
        >
          +{extra}
        </span>
      )}
    </button>
  );
}
