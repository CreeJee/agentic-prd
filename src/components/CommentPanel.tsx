import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../cn";
import { authorInitial, threadAuthor, timeAgo } from "../format";
import type { CommentThread } from "../store";
import { MarkdownEditor } from "./MarkdownEditor";

/** 코멘트 목록 패널(우하단) — 미해결/해결됨 그룹. 행 클릭 시 해당 스레드 열기. */
export function CommentPanel({
  openThreads,
  resolvedThreads,
  activeId,
  onSelect,
  onClose,
}: {
  openThreads: CommentThread[];
  resolvedThreads: CommentThread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const Row = ({
    thread,
    resolved,
  }: {
    thread: CommentThread;
    resolved?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => onSelect(thread.id)}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50",
        activeId === thread.id && "bg-primary/5"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-bold text-[11px] text-white",
          resolved ? "bg-green-500" : "bg-primary"
        )}
      >
        {resolved ? (
          <CheckIcon className="size-3" />
        ) : (
          authorInitial(threadAuthor(thread))
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate font-medium text-slate-900 text-sm">
            {thread.comments[0]?.author ?? "익명"}
          </span>
          <span className="shrink-0 text-slate-400 text-xs">
            {timeAgo(thread.comments[0]?.at ?? Date.now())}
          </span>
        </span>
        <MarkdownEditor
          key={`${thread.id}:${thread.comments[0]?.at ?? 0}`}
          defaultValue={thread.comments[0]?.text ?? ""}
          editable={false}
          className={cn(
            "max-h-5 text-sm [&>div]:contents [&_p]:mb-0 [&_p]:truncate",
            resolved ? "text-slate-400" : "text-slate-600"
          )}
        />
        {thread.comments.length > 1 && (
          <span className="text-slate-400 text-xs">
            답글 {thread.comments.length - 1}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <div className="pointer-events-auto fixed right-5 bottom-20 z-[99992] flex max-h-[70vh] w-80 flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-slate-100 border-b px-4 py-2.5">
        <span className="font-medium text-slate-900 text-sm">코멘트</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="닫기"
          className="text-slate-400 hover:bg-slate-100"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto p-2">
        <div className="px-2.5 py-1 font-medium text-slate-500 text-xs">
          미해결 {openThreads.length}
        </div>
        {openThreads.length === 0 ? (
          <p className="px-2.5 pb-2 text-slate-400 text-sm">
            미해결 코멘트가 없어요.
          </p>
        ) : (
          openThreads.map((t) => <Row key={t.id} thread={t} />)
        )}

        {resolvedThreads.length > 0 && (
          <>
            <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1 font-medium text-slate-500 text-xs">
              <CheckIcon className="size-3.5 text-green-500" />
              해결됨 {resolvedThreads.length}
            </div>
            {resolvedThreads.map((t) => (
              <Row key={t.id} thread={t} resolved />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
