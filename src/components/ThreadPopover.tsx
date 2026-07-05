import { valibotResolver } from "@hookform/resolvers/valibot";
import {
  CheckIcon,
  ChevronLeftIcon,
  Loader2Icon,
  MoveIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as v from "valibot";
import type { Point } from "../anchor";
import { cn } from "../cn";
import { timeAgo } from "../format";
import {
  type CommentThread,
  useAddComment,
  useDeleteComment,
  useDeleteThread,
  useToggleResolved,
  useUpdateComment,
} from "../store";
import { MarkdownEditor } from "./MarkdownEditor";
import { PointPopover } from "./PointPopover";

const commentTextFormSchema = (message: string) =>
  v.object({
    text: v.pipe(v.string(), v.trim(), v.nonEmpty(message)),
  });

/** 스레드 팝오버 — 코멘트 목록(마크다운) + 답글 + 본문편집/재배치/해결/삭제. */
export function ThreadPopover({
  thread,
  point,
  author,
  onClose,
  onBack,
  onRelocate,
}: {
  thread: CommentThread;
  point: Point;
  author: string;
  onClose: () => void;
  /** 겹친 코멘트 목록에서 들어왔을 때 그 목록으로 돌아가기 */
  onBack?: () => void;
  /** 재배치(핀 위치 다시 잡기) 시작 — 다음 클릭이 새 anchor가 된다 */
  onRelocate?: () => void;
}) {
  const { mutateAsync: addComment, isPending: loadingAddComment } =
    useAddComment();
  const { mutateAsync: updateComment, isPending: loadingUpdateComment } =
    useUpdateComment();
  const { mutateAsync: toggleResolved, isPending: loadingToggleResolved } =
    useToggleResolved();
  const { mutateAsync: deleteThread, isPending: loadingDeleteThread } =
    useDeleteThread();
  const { mutateAsync: deleteComment, isPending: loadingDeleteComment } =
    useDeleteComment();

  const replyForm = useForm<{ text: string }>({
    mode: "onChange",
    resolver: valibotResolver(commentTextFormSchema("답글 내용을 입력하세요.")),
    defaultValues: { text: "" },
  });
  const editForm = useForm<{ text: string }>({
    mode: "onChange",
    resolver: valibotResolver(commentTextFormSchema("본문을 입력하세요.")),
    defaultValues: { text: "" },
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const count = thread.comments.length;
  const prevCount = useRef(count);
  useEffect(() => {
    if (count > prevCount.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevCount.current = count;
  }, [count]);

  const startEdit = (id: string, text: string) => {
    editForm.reset({ text });
    setEditingId(id);
  };

  const submitReply = replyForm.handleSubmit(async ({ text }) => {
    await addComment({
      path: thread.path,
      threadId: thread.id,
      text,
      author,
    });
    replyForm.reset({ text: "" });
  });
  const submitEdit = editForm.handleSubmit(async ({ text }) => {
    if (!editingId) return;
    await updateComment({
      path: thread.path,
      threadId: thread.id,
      commentId: editingId,
      text,
    });
    setEditingId(null);
  });

  return (
    <PointPopover point={point} className="flex w-80 flex-col">
      <div className="flex shrink-0 items-center justify-between border-slate-100 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          {onBack && (
            <button
              type="button"
              title="겹친 코멘트로 돌아가기"
              onClick={onBack}
              className="-ml-1 flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
          )}
          <span className="font-medium text-slate-500 text-xs">
            코멘트 {thread.comments.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onRelocate && (
            <button
              type="button"
              title="재배치 (핀 위치 다시 잡기)"
              onClick={onRelocate}
              className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-primary"
            >
              <MoveIcon className="size-4" />
            </button>
          )}
          <button
            type="button"
            title={thread.resolved ? "다시 열기" : "해결됨으로 표시"}
            onClick={() => {
              toggleResolved({ path: thread.path, threadId: thread.id }).then(
                onClose
              );
            }}
            disabled={loadingToggleResolved}
            className={cn(
              "flex size-6 items-center justify-center rounded hover:bg-slate-100",
              thread.resolved ? "text-green-600" : "text-slate-400"
            )}
          >
            {loadingToggleResolved ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
          </button>
          <button
            type="button"
            title="삭제"
            onClick={() =>
              deleteThread({ path: thread.path, threadId: thread.id })
            }
            disabled={loadingDeleteThread}
            className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-red-500 disabled:opacity-50"
          >
            {loadingDeleteThread ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <Trash2Icon className="size-4" />
            )}
          </button>
          <button
            type="button"
            title="닫기"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        {thread.comments.map((c) => (
          <div key={c.id} className="group flex gap-2">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-medium text-slate-600 text-xs">
              {(c.author || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="font-medium text-slate-900 text-sm">
                  {c.author}
                </span>
                <span className="text-slate-400 text-xs">{timeAgo(c.at)}</span>
                {editingId !== c.id && (
                  <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="본문 편집"
                      onClick={() => startEdit(c.id, c.text)}
                      className="flex size-5 items-center justify-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                    >
                      <PencilIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      title="코멘트 삭제"
                      disabled={loadingDeleteComment}
                      onClick={() =>
                        deleteComment({
                          path: thread.path,
                          threadId: thread.id,
                          commentId: c.id,
                        })
                      }
                      className="flex size-5 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      {loadingDeleteComment ? (
                        <Loader2Icon className="size-3 animate-spin" />
                      ) : (
                        <Trash2Icon className="size-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              {editingId === c.id ? (
                <form
                  onSubmit={submitEdit}
                  className="mt-1 flex flex-col gap-1.5"
                >
                  <Controller
                    control={editForm.control}
                    name="text"
                    render={({ field }) => (
                      <div className="flex flex-col gap-1">
                        <MarkdownEditor
                          value={field.value}
                          onChange={field.onChange}
                          onSubmit={submitEdit}
                          autoFocus
                          placeholder="본문 (마크다운)"
                          className="max-h-40 min-h-12 rounded-lg border border-slate-200 text-slate-700 focus-within:border-primary"
                        />
                        {editForm.formState.errors.text?.message && (
                          <p className="px-1 text-red-500 text-xs">
                            {editForm.formState.errors.text.message}
                          </p>
                        )}
                      </div>
                    )}
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded px-2 py-1 text-slate-500 text-xs hover:bg-slate-50"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={
                        !editForm.formState.isValid || loadingUpdateComment
                      }
                      className="rounded bg-primary px-2 py-1 font-medium text-white text-xs disabled:opacity-40"
                    >
                      {loadingUpdateComment ? "저장 중…" : "저장"}
                    </button>
                  </div>
                </form>
              ) : (
                <MarkdownEditor
                  key={`${c.id}:${c.at}`}
                  defaultValue={c.text}
                  editable={false}
                  className="text-slate-700"
                />
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submitReply}
        className="flex shrink-0 items-start gap-2 border-slate-100 border-t p-2"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Controller
            control={replyForm.control}
            name="text"
            render={({ field }) => (
              <MarkdownEditor
                value={field.value}
                onChange={field.onChange}
                onSubmit={submitReply}
                placeholder="답글 달기… (Cmd/Ctrl+Enter)"
                className="max-h-28 min-h-8 rounded-lg border border-slate-200 focus-within:border-primary"
              />
            )}
          />
          {replyForm.formState.errors.text?.message && (
            <p className="px-1 text-red-500 text-xs">
              {replyForm.formState.errors.text.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={!replyForm.formState.isValid || loadingAddComment}
          className="rounded-lg bg-primary px-2.5 py-1.5 font-medium text-white text-xs disabled:opacity-40"
        >
          {loadingAddComment ? "등록 중…" : "등록"}
        </button>
      </form>
    </PointPopover>
  );
}
