/**
 * 드래그로 옮길 수 있는 하단 우측 툴바 셸(dnd-kit). 드래그/위치 로직만 담당하고
 * 툴바 내용은 children으로 받는다(호출부 책임 분리).
 *  - 기본 위치는 CSS(right-5 bottom-5). 그 지점에서 translate 오프셋(in-memory)으로 이동.
 *  - restrictToWindowEdges modifier가 드래그 중 화면 밖으로 나가지 않게 가둔다.
 *  - 그립 핸들에만 드래그 리스너를 달아 버튼/입력 상호작용과 충돌하지 않는다.
 */
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { GripVerticalIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

interface Offset {
  x: number;
  y: number;
}

const DRAG_ID = "comment-widget-toolbar";

export function DraggableToolbar({ children }: { children: ReactNode }) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const onDragEnd = ({ active }: DragEndEvent) => {
    const { initial, translated } = active.rect.current;
    if (!initial || !translated) return;
    setOffset((prev) => ({
      x: prev.x + (translated.left - initial.left),
      y: prev.y + (translated.top - initial.top),
    }));
  };

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
      onDragEnd={onDragEnd}
    >
      <ToolbarShell offset={offset}>{children}</ToolbarShell>
    </DndContext>
  );
}

function ToolbarShell({
  offset,
  children,
}: {
  offset: Offset;
  children: ReactNode;
}) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({
    id: DRAG_ID,
  });
  const x = offset.x + (transform?.x ?? 0);
  const y = offset.y + (transform?.y ?? 0);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      className="pointer-events-auto fixed right-5 bottom-5 z-99992 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-lg"
    >
      <button
        type="button"
        aria-label="툴바 이동"
        data-comment-no-capture=""
        {...listeners}
        {...attributes}
        className="flex size-6 cursor-grab touch-none items-center justify-center rounded text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      {children}
    </div>
  );
}
