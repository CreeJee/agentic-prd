/**
 * 현재 열린 스레드(thread 모드)의 팝오버를 그 핀 위치에 띄운다.
 */
import type { Point } from "../anchor";
import { ThreadPopover } from "../components";
import type { CommentThread } from "../store";
import type { SetCanvas } from "./types";

export function OpenThreadPopover({
  threads,
  openThreadId,
  points,
  userName,
  onBack,
  setCanvas,
}: {
  threads: CommentThread[];
  openThreadId: string | null;
  points: Record<string, Point>;
  userName: string;
  onBack: (() => void) | undefined;
  setCanvas: SetCanvas;
}) {
  if (!openThreadId) return null;

  const thread = threads.find((candidate) => candidate.id === openThreadId);
  const point = openThreadId ? points[openThreadId] : undefined;
  if (!thread || !point) return null;

  return (
    <ThreadPopover
      thread={thread}
      point={point}
      author={userName || "익명"}
      onClose={() => setCanvas({ kind: "idle" })}
      onBack={onBack}
      onRelocate={() => setCanvas({ kind: "relocate", id: thread.id })}
    />
  );
}
