import { experimental_createOverlayContext } from "overlay-kit";
import { createContext, type ReactNode, useContext } from "react";
import type { CommentThread } from "./store";

const {
  overlay: commentWidgetOverlay,
  OverlayProvider: CommentWidgetOverlayProvider,
  useOverlayData: useCommentWidgetOverlayData,
} = experimental_createOverlayContext();

export {
  commentWidgetOverlay,
  CommentWidgetOverlayProvider,
  useCommentWidgetOverlayData,
};

export interface WidgetPanelRuntime {
  path: string;
  pageLabel: string;
  author: string;
  activeId: string | null;
  openThreads: CommentThread[];
  resolvedThreads: CommentThread[];
  selectThread: (id: string) => void;
}

const WidgetPanelRuntimeContext = createContext<WidgetPanelRuntime | null>(
  null
);

export function WidgetPanelRuntimeProvider({
  value,
  children,
}: {
  value: WidgetPanelRuntime;
  children: ReactNode;
}) {
  return (
    <WidgetPanelRuntimeContext.Provider value={value}>
      {children}
    </WidgetPanelRuntimeContext.Provider>
  );
}

export function useWidgetPanelRuntime(): WidgetPanelRuntime {
  const runtime = useContext(WidgetPanelRuntimeContext);
  if (!runtime) {
    throw new Error(
      "useWidgetPanelRuntime must be used within <WidgetPanelRuntimeProvider>"
    );
  }
  return runtime;
}
