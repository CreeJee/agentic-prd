import { CheckIcon, XIcon } from "lucide-react";
import type { Point } from "../anchor";
import { cn } from "../cn";
import { authorInitial, snippet, threadAuthor } from "../format";
import type { CommentThread } from "../store";
import { PointPopover } from "./PointPopover";

/** 클러스터 펼침 목록 — 겹친 코멘트들을 골라 열 수 있는 컴팩트 리스트 */
export function ClusterPopover({
  point,
  threads,
  onSelect,
  onClose,
}: {
  point: Point;
  threads: CommentThread[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <PointPopover point={point} className="flex w-72 flex-col">
      <div className="flex shrink-0 items-center justify-between border-slate-100 border-b px-3 py-2">
        <span className="font-medium text-slate-500 text-xs">
          겹친 코멘트 {threads.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
        {threads.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-bold text-[11px] text-white",
                t.resolved ? "bg-green-500" : "bg-primary"
              )}
            >
              {t.resolved ? (
                <CheckIcon className="size-3" />
              ) : (
                authorInitial(threadAuthor(t))
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-slate-900 text-sm">
                {t.comments[0]?.author ?? "익명"}
              </span>
              <span className="truncate text-slate-600 text-sm">
                {snippet(t)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </PointPopover>
  );
}
