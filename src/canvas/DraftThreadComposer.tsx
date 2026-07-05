/**
 * 신규 코멘트 작성(draft 모드) 팝오버. 작성자는 이미 설정된 닉네임(userName)을 쓴다.
 */
import type { Point } from "../anchor";
import { DraftComposer } from "../components";
import { createThread, type useAddThread } from "../store";
import type { Draft, SetCanvas } from "./types";

export function DraftThreadComposer({
  addThread,
  draft,
  point,
  pageKey,
  userName,
  setCanvas,
}: {
  addThread: ReturnType<typeof useAddThread>;
  draft: Draft | null;
  point: Point | null;
  pageKey: string;
  userName: string;
  setCanvas: SetCanvas;
}) {
  if (!draft || !point) return null;

  return (
    <DraftComposer
      point={point}
      onCancel={() => setCanvas({ kind: "idle" })}
      onSubmit={(text) => {
        void addThread.mutateAsync(
          createThread({
            path: pageKey,
            xPct: draft.xPct,
            yPx: draft.yPx,
            anchor: draft.anchor,
            text,
            author: userName || "익명",
          })
        );
        setCanvas({ kind: "idle" });
      }}
    />
  );
}
