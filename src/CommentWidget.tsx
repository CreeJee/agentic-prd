import type { OverlayControllerComponent } from "overlay-kit";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { buildCapture, clusterIdOf, type Point, resolvePoint } from "./anchor";
import {
  type Canvas,
  type ClusterGroup,
  CommentCanvasLayer,
  type Draft,
  PlacementGuide,
  type SetCanvas,
} from "./canvas";
import { CommentToolbar } from "./components";
import type { CommentWidgetConfig } from "./config";
import {
  useCommentCapture,
  useCrosshair,
  useEscClose,
  useOverlayTracker,
  usePinTracking,
} from "./hooks";
import {
  COMMENT_PANEL_OVERLAY_ID,
  CommentPanelOverlay,
  SPEC_PANEL_OVERLAY_ID,
  SpecPanelOverlay,
} from "./panelOverlays";
import {
  CommentWidgetOverlayProvider,
  commentWidgetOverlay,
  useCommentWidgetOverlayData,
  WidgetPanelRuntimeProvider,
} from "./panelRuntime";
import { useRouteKey } from "./routeSource";
import {
  type CommentThread,
  useAddThread,
  useSetUserName,
  useThreads,
  useUpdateAnchor,
  useUserName,
} from "./store";
import { useSetWidgetPortalContainer, WidgetProvider } from "./WidgetProvider";

interface CommentWidgetProps {
  config: CommentWidgetConfig;
  /**
   * 현재 화면 식별자(코멘트를 화면별로 그룹화). 호스트가 렌더 시점에 전달한다
   * (react-router 등으로 라우트 바뀌면 리렌더돼 자동 반영). 미지정 시 window.location.pathname.
   */
  pageKey?: string;
  /** 화면 라벨(기획 문서 패널 헤더 표기). 미지정 시 pageKey를 그대로 보여준다. */
  pageLabel?: string;
}

/**
 * 공개 진입점. WidgetProvider가 config로 QueryClient/SupabaseClient를 만들어 주입한다.
 * pageKey/pageLabel은 prop > config.routeSource > browserRouteSource 순으로 해석한다.
 */
export function CommentWidget({
  config,
  pageKey,
  pageLabel,
}: CommentWidgetProps) {
  const route = useRouteKey(pageKey, pageLabel, config.routeSource);
  return (
    <WidgetProvider config={config}>
      <CommentWidgetInner pageKey={route.pageKey} pageLabel={route.pageLabel} />
    </WidgetProvider>
  );
}

function CommentWidgetInner({
  pageKey,
  pageLabel,
}: {
  pageKey: string;
  pageLabel: string;
}) {
  const pageThreads = useThreads(pageKey);
  const userName = useUserName();
  const addThread = useAddThread();
  const setUserName = useSetUserName();
  const { mutateAsync: relocate } = useUpdateAnchor();

  const [canvas, setCanvas] = useState<Canvas>({ kind: "idle" });
  const addMode = canvas.kind === "add";
  const placing = canvas.kind === "add" || canvas.kind === "relocate";
  const draft = canvas.kind === "draft" ? canvas.draft : null;
  const openThreadId = canvas.kind === "thread" ? canvas.id : null;
  const expandedCluster = canvas.kind === "cluster" ? canvas.clusterId : null;

  const [nameEditing, setNameEditing] = useState(false);
  const [nameInput, setNameInput] = useState(userName);

  const { overlayInfoRef, lastActivatedRef } = useOverlayTracker();

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    setCanvas({ kind: "idle" });
  }, [pageKey]);

  const openThreads = useMemo(
    () => pageThreads.filter((t) => !t.resolved),
    [pageThreads]
  );
  const resolvedThreads = useMemo(
    () => pageThreads.filter((t) => t.resolved),
    [pageThreads]
  );

  const points = usePinTracking(pageThreads);

  const draftPoint = draft
    ? resolvePoint(draft.anchor, draft.xPct, draft.yPx)
    : null;

  const captureAt = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      const cap = buildCapture(
        clientX,
        clientY,
        target,
        overlayInfoRef.current
      );
      const c = canvas;
      if (c.kind === "relocate") {
        setCanvas({ kind: "thread", id: c.id });
        void relocate({
          path: pageKey,
          threadId: c.id,
          xPct: cap.xPct,
          yPx: cap.yPx,
          anchor: cap.anchor,
        });
      } else {
        setCanvas({ kind: "draft", draft: cap });
      }
    },
    [overlayInfoRef, relocate, pageKey, canvas]
  );

  useCommentCapture({ addMode: placing, lastActivatedRef, onPlace: captureAt });

  useCrosshair(placing);

  useEscClose(canvas.kind !== "idle", () => setCanvas({ kind: "idle" }));

  const clusterGroups: ClusterGroup[] = [];
  {
    const byClusterId = new Map<
      string,
      { threads: CommentThread[]; point: Point }
    >();
    for (const thread of openThreads) {
      const p = points[thread.id];
      if (!p) continue;
      const clusterId = clusterIdOf(p);
      const g = byClusterId.get(clusterId);
      if (g) g.threads.push(thread);
      else byClusterId.set(clusterId, { threads: [thread], point: p });
    }
    for (const [clusterId, g] of byClusterId)
      clusterGroups.push({ clusterId, ...g });
  }
  const expandedGroup =
    clusterGroups.find((g) => g.clusterId === expandedCluster) ?? null;
  const backClusterId =
    canvas.kind === "thread" ? canvas.fromClusterId : undefined;
  const threadBack = backClusterId
    ? () => setCanvas({ kind: "cluster", clusterId: backClusterId })
    : undefined;
  const panelRuntime = useMemo(
    () => ({
      path: pageKey,
      pageLabel,
      author: userName || "익명",
      activeId: openThreadId,
      openThreads,
      resolvedThreads,
      selectThread: (id: string) => setCanvas({ kind: "thread", id }),
    }),
    [pageKey, pageLabel, userName, openThreadId, openThreads, resolvedThreads]
  );

  return createPortal(
    <WidgetPanelRuntimeProvider value={panelRuntime}>
      <CommentWidgetRoot>
        <CommentWidgetOverlayProvider>
          <CommentWidgetSurface
            addMode={addMode}
            addThread={addThread}
            canvas={canvas}
            clusterGroups={clusterGroups}
            draft={draft}
            draftPoint={draftPoint}
            expandedCluster={expandedCluster}
            expandedGroup={expandedGroup}
            nameEditing={nameEditing}
            nameInput={nameInput}
            openThreadId={openThreadId}
            pageKey={pageKey}
            pageThreads={pageThreads}
            placing={placing}
            points={points}
            setCanvas={setCanvas}
            setNameEditing={setNameEditing}
            setNameInput={setNameInput}
            setUserName={setUserName}
            threadBack={threadBack}
            userName={userName}
          />
        </CommentWidgetOverlayProvider>
      </CommentWidgetRoot>
    </WidgetPanelRuntimeProvider>,
    document.body
  );
}

/**
 * 위젯 stacking context 를 정의하고 base-ui overlay 들을 위젯 캔버스 안에 portal 하도록 컨테이너를 공급한다.
 * canvas 레이어(z-99990) 바로 위에 portal host 를 두어 호스트 dialog(보통 z-50) 와의 z 충돌을 근본적으로 회피한다.
 */
function CommentWidgetRoot({ children }: { children: ReactNode }) {
  const setContainer = useSetWidgetPortalContainer();
  return (
    <div data-comment-root style={{ display: "contents" }}>
      {children}
      <div
        ref={setContainer}
        data-comment-portal-host
        className="pointer-events-none fixed inset-0 z-99991"
      />
    </div>
  );
}

function CommentWidgetSurface({
  addMode,
  addThread,
  canvas,
  clusterGroups,
  draft,
  draftPoint,
  expandedCluster,
  expandedGroup,
  nameEditing,
  nameInput,
  openThreadId,
  pageKey,
  pageThreads,
  placing,
  points,
  setCanvas,
  setNameEditing,
  setNameInput,
  setUserName,
  threadBack,
  userName,
}: {
  addMode: boolean;
  addThread: ReturnType<typeof useAddThread>;
  canvas: Canvas;
  clusterGroups: ClusterGroup[];
  draft: Draft | null;
  draftPoint: Point | null;
  expandedCluster: string | null;
  expandedGroup: ClusterGroup | null;
  nameEditing: boolean;
  nameInput: string;
  openThreadId: string | null;
  pageKey: string;
  pageThreads: CommentThread[];
  placing: boolean;
  points: Record<string, Point>;
  setCanvas: SetCanvas;
  setNameEditing: (editing: boolean) => void;
  setNameInput: (input: string) => void;
  setUserName: (name: string) => void;
  threadBack: (() => void) | undefined;
  userName: string;
}) {
  return (
    <>
      <CommentCanvasLayer
        addThread={addThread}
        clusterGroups={clusterGroups}
        draft={draft}
        draftPoint={draftPoint}
        expandedCluster={expandedCluster}
        expandedGroup={expandedGroup}
        openThreadId={openThreadId}
        pageKey={pageKey}
        pageThreads={pageThreads}
        points={points}
        setCanvas={setCanvas}
        threadBack={threadBack}
        userName={userName}
      />
      <PlacementGuide canvas={canvas} placing={placing} />
      <CommentToolbarController
        addMode={addMode}
        nameEditing={nameEditing}
        nameInput={nameInput}
        pageThreads={pageThreads}
        setCanvas={setCanvas}
        setNameEditing={setNameEditing}
        setNameInput={setNameInput}
        setUserName={setUserName}
        userName={userName}
      />
    </>
  );
}

function CommentToolbarController({
  addMode,
  nameEditing,
  nameInput,
  pageThreads,
  setCanvas,
  setNameEditing,
  setNameInput,
  setUserName,
  userName,
}: {
  addMode: boolean;
  nameEditing: boolean;
  nameInput: string;
  pageThreads: CommentThread[];
  setCanvas: SetCanvas;
  setNameEditing: (editing: boolean) => void;
  setNameInput: (input: string) => void;
  setUserName: (name: string) => void;
  userName: string;
}) {
  const overlayData = useCommentWidgetOverlayData();
  const specPanelOpen = overlayData[SPEC_PANEL_OVERLAY_ID]?.isOpen ?? false;
  const togglePanel = (
    overlayId: string,
    controller: OverlayControllerComponent
  ) => {
    if (overlayData[overlayId]?.isOpen) {
      commentWidgetOverlay.close(overlayId);
    } else {
      commentWidgetOverlay.open(controller, { overlayId });
    }
  };

  return (
    <CommentToolbar
      userName={userName}
      nameInput={nameInput}
      nameEditing={nameEditing}
      threadCount={pageThreads.length}
      addMode={addMode}
      specOpen={specPanelOpen}
      canComment={userName.trim().length > 0}
      onBeginNameEdit={() => {
        setNameInput(userName);
        setNameEditing(true);
      }}
      onNameInputChange={setNameInput}
      onCommitName={() => {
        setUserName(nameInput.trim());
        setNameEditing(false);
      }}
      onToggleCommentPanel={() =>
        togglePanel(COMMENT_PANEL_OVERLAY_ID, CommentPanelOverlay)
      }
      onToggleSpecPanel={() =>
        togglePanel(SPEC_PANEL_OVERLAY_ID, SpecPanelOverlay)
      }
      onToggleAddMode={() =>
        setCanvas((canvas) =>
          canvas.kind === "add" ? { kind: "idle" } : { kind: "add" }
        )
      }
    />
  );
}
