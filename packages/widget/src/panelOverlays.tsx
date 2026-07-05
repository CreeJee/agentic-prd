import { CommentPanel } from "./components/CommentPanel";
import { useWidgetPanelRuntime } from "./panelRuntime";
import { SpecPanel } from "./specs/SpecPanel";

export const COMMENT_PANEL_OVERLAY_ID = "comment-widget-comment-panel";
export const SPEC_PANEL_OVERLAY_ID = "comment-widget-spec-panel";

interface OverlayControllerProps {
  isOpen: boolean;
  close: () => void;
  unmount: () => void;
}

export function CommentPanelOverlay({ isOpen, close }: OverlayControllerProps) {
  const { openThreads, resolvedThreads, activeId, selectThread } =
    useWidgetPanelRuntime();

  if (!isOpen) return null;

  return (
    <CommentPanel
      openThreads={openThreads}
      resolvedThreads={resolvedThreads}
      activeId={activeId}
      onSelect={selectThread}
      onClose={close}
    />
  );
}

export function SpecPanelOverlay({ isOpen, close }: OverlayControllerProps) {
  const { path, pageLabel, author } = useWidgetPanelRuntime();

  if (!isOpen) return null;

  return (
    <SpecPanel
      path={path}
      pageLabel={pageLabel}
      open={isOpen}
      onClose={close}
      author={author}
    />
  );
}
