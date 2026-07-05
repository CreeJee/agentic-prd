/**
 * 뷰포트 좌표 레이어 — 핀/스레드/클러스터/작성 팝오버를 한데 모아 그린다.
 * 핀 위치는 usePinTracking이 rAF로 추종(모달/내부스크롤/fixed 대응).
 */
import type { Point } from "../anchor";
import type { CommentThread, useAddThread } from "../store";
import { DraftThreadComposer } from "./DraftThreadComposer";
import { ExpandedClusterPopover } from "./ExpandedClusterPopover";
import { OpenThreadPopover } from "./OpenThreadPopover";
import { PinClusters } from "./PinClusters";
import type { ClusterGroup, Draft, SetCanvas } from "./types";

export function CommentCanvasLayer({
  addThread,
  clusterGroups,
  draft,
  draftPoint,
  expandedCluster,
  expandedGroup,
  openThreadId,
  pageKey,
  pageThreads,
  points,
  setCanvas,
  threadBack,
  userName,
}: {
  addThread: ReturnType<typeof useAddThread>;
  clusterGroups: ClusterGroup[];
  draft: Draft | null;
  draftPoint: Point | null;
  expandedCluster: string | null;
  expandedGroup: ClusterGroup | null;
  openThreadId: string | null;
  pageKey: string;
  pageThreads: CommentThread[];
  points: Record<string, Point>;
  setCanvas: SetCanvas;
  threadBack: (() => void) | undefined;
  userName: string;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-99990">
      <PinClusters
        groups={clusterGroups}
        activeCluster={expandedCluster}
        activeThreadId={openThreadId}
        setCanvas={setCanvas}
      />
      <OpenThreadPopover
        threads={pageThreads}
        openThreadId={openThreadId}
        points={points}
        userName={userName}
        onBack={threadBack}
        setCanvas={setCanvas}
      />
      <ExpandedClusterPopover group={expandedGroup} setCanvas={setCanvas} />
      <DraftThreadComposer
        addThread={addThread}
        draft={draft}
        point={draftPoint}
        pageKey={pageKey}
        userName={userName}
        setCanvas={setCanvas}
      />
    </div>
  );
}
