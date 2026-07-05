/**
 * 표 셀 경계 드래그로 열 너비/행 높이를 조절한다.
 * lexical-playground의 TableCellResizer를 포팅(0.20.2) — playground CSS 대신 인라인 스타일 +
 * Tailwind로 대체했고, strictest(noUncheckedIndexedAccess) 가드를 추가했다.
 * document.body로 포털링하며 페이지 좌표로 절대배치한다.
 */

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import {
  $computeTableMapSkipCellCheck,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $isTableCellNode,
  $isTableRowNode,
  getDOMCellFromTarget,
  getTableElement,
  type TableCellNode,
  type TableDOMCell,
  type TableMapType,
  TableNode,
} from "@lexical/table";
import { calculateZoomLevel } from "@lexical/utils";
import { $getNearestNodeFromDOMNode, type LexicalEditor } from "lexical";
import {
  type CSSProperties,
  type JSX,
  type MouseEventHandler,
  type ReactPortal,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface MousePosition {
  x: number;
  y: number;
}

type MouseDraggingDirection = "right" | "bottom";

const MIN_ROW_HEIGHT = 33;
const MIN_COLUMN_WIDTH = 92;

function TableCellResizer({ editor }: { editor: LexicalEditor }): JSX.Element {
  const targetRef = useRef<HTMLElement | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  const tableRectRef = useRef<DOMRect | null>(null);

  const mouseStartPosRef = useRef<MousePosition | null>(null);
  const [mouseCurrentPos, updateMouseCurrentPos] =
    useState<MousePosition | null>(null);

  const [activeCell, updateActiveCell] = useState<TableDOMCell | null>(null);
  const [isMouseDown, updateIsMouseDown] = useState<boolean>(false);
  const [draggingDirection, updateDraggingDirection] =
    useState<MouseDraggingDirection | null>(null);

  const resetState = useCallback(() => {
    updateActiveCell(null);
    targetRef.current = null;
    updateDraggingDirection(null);
    mouseStartPosRef.current = null;
    tableRectRef.current = null;
  }, []);

  const isMouseDownOnEvent = (event: MouseEvent) => (event.buttons & 1) === 1;

  useEffect(() => {
    return editor.registerNodeTransform(TableNode, (tableNode) => {
      if (tableNode.getColWidths()) {
        return tableNode;
      }
      const numColumns = tableNode.getColumnCount();
      tableNode.setColWidths(Array(numColumns).fill(MIN_COLUMN_WIDTH));
      return tableNode;
    });
  }, [editor]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const target = event.target;
      if (draggingDirection) {
        updateMouseCurrentPos({ x: event.clientX, y: event.clientY });
        return;
      }
      updateIsMouseDown(isMouseDownOnEvent(event));
      if (resizerRef.current?.contains(target as Node)) {
        return;
      }

      if (targetRef.current !== target) {
        targetRef.current = target as HTMLElement;
        const cell = getDOMCellFromTarget(target as HTMLElement);

        if (cell && activeCell !== cell) {
          editor.getEditorState().read(
            () => {
              const tableCellNode = $getNearestNodeFromDOMNode(cell.elem);
              if (!tableCellNode) {
                throw new Error("TableCellResizer: Table cell node not found.");
              }
              const tableNode =
                $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
              const tableElement = getTableElement(
                tableNode,
                editor.getElementByKey(tableNode.getKey())
              );
              if (!tableElement) {
                throw new Error("TableCellResizer: Table element not found.");
              }
              targetRef.current = target as HTMLElement;
              tableRectRef.current = tableElement.getBoundingClientRect();
              updateActiveCell(cell);
            },
            { editor }
          );
        } else if (cell == null) {
          resetState();
        }
      }
    };

    const onMouseDown = () => updateIsMouseDown(true);
    const onMouseUp = () => updateIsMouseDown(false);

    const removeRootListener = editor.registerRootListener(
      (rootElement, prevRootElement) => {
        prevRootElement?.removeEventListener("mousemove", onMouseMove);
        prevRootElement?.removeEventListener("mousedown", onMouseDown);
        prevRootElement?.removeEventListener("mouseup", onMouseUp);
        rootElement?.addEventListener("mousemove", onMouseMove);
        rootElement?.addEventListener("mousedown", onMouseDown);
        rootElement?.addEventListener("mouseup", onMouseUp);
      }
    );
    return removeRootListener;
  }, [activeCell, draggingDirection, editor, resetState]);

  const isHeightChanging = (direction: MouseDraggingDirection) =>
    direction === "bottom";

  const getCellNodeHeight = (
    cell: TableCellNode,
    activeEditor: LexicalEditor
  ): number | undefined =>
    activeEditor.getElementByKey(cell.getKey())?.clientHeight;

  const getCellColumnIndex = (
    tableCellNode: TableCellNode,
    tableMap: TableMapType
  ): number | undefined => {
    for (let row = 0; row < tableMap.length; row++) {
      const cols = tableMap[row];
      if (!cols) continue;
      for (let column = 0; column < cols.length; column++) {
        if (cols[column]?.cell === tableCellNode) {
          return column;
        }
      }
    }
    return undefined;
  };

  const updateRowHeight = useCallback(
    (heightChange: number) => {
      if (!activeCell) {
        throw new Error("TableCellResizer: Expected active cell.");
      }
      editor.update(
        () => {
          const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
          if (!$isTableCellNode(tableCellNode)) {
            throw new Error("TableCellResizer: Table cell node not found.");
          }
          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
          const tableRowIndex =
            $getTableRowIndexFromTableCellNode(tableCellNode) +
            tableCellNode.getRowSpan() -
            1;
          const tableRows = tableNode.getChildren();
          if (tableRowIndex >= tableRows.length || tableRowIndex < 0) {
            throw new Error("Expected table cell to be inside of table row.");
          }
          const tableRow = tableRows[tableRowIndex];
          if (!$isTableRowNode(tableRow)) {
            throw new Error("Expected table row");
          }
          let height = tableRow.getHeight();
          if (height === undefined) {
            const rowCells = tableRow.getChildren<TableCellNode>();
            height = Math.min(
              ...rowCells.map(
                (cell) =>
                  getCellNodeHeight(cell, editor) ?? Number.POSITIVE_INFINITY
              )
            );
          }
          const newHeight = Math.max(height + heightChange, MIN_ROW_HEIGHT);
          tableRow.setHeight(newHeight);
        },
        { tag: "skip-scroll-into-view" }
      );
    },
    [activeCell, editor]
  );

  const updateColumnWidth = useCallback(
    (widthChange: number) => {
      if (!activeCell) {
        throw new Error("TableCellResizer: Expected active cell.");
      }
      editor.update(
        () => {
          const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
          if (!$isTableCellNode(tableCellNode)) {
            throw new Error("TableCellResizer: Table cell node not found.");
          }
          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
          const [tableMap] = $computeTableMapSkipCellCheck(
            tableNode,
            null,
            null
          );
          const columnIndex = getCellColumnIndex(tableCellNode, tableMap);
          if (columnIndex === undefined) {
            throw new Error("TableCellResizer: Table column not found.");
          }
          const colWidths = tableNode.getColWidths();
          if (!colWidths) {
            return;
          }
          const width = colWidths[columnIndex];
          if (width === undefined) {
            return;
          }
          const newColWidths = [...colWidths];
          newColWidths[columnIndex] = Math.max(
            width + widthChange,
            MIN_COLUMN_WIDTH
          );
          tableNode.setColWidths(newColWidths);
        },
        { tag: "skip-scroll-into-view" }
      );
    },
    [activeCell, editor]
  );

  const mouseUpHandler = useCallback(
    (direction: MouseDraggingDirection) => {
      const handler = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!activeCell) {
          throw new Error("TableCellResizer: Expected active cell.");
        }
        if (mouseStartPosRef.current) {
          const { x, y } = mouseStartPosRef.current;
          const zoom = calculateZoomLevel(event.target as Element);
          if (isHeightChanging(direction)) {
            updateRowHeight((event.clientY - y) / zoom);
          } else {
            updateColumnWidth((event.clientX - x) / zoom);
          }
          resetState();
          document.removeEventListener("mouseup", handler);
        }
      };
      return handler;
    },
    [activeCell, resetState, updateColumnWidth, updateRowHeight]
  );

  const toggleResize = useCallback(
    (direction: MouseDraggingDirection): MouseEventHandler<HTMLDivElement> =>
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!activeCell) {
          throw new Error("TableCellResizer: Expected active cell.");
        }
        mouseStartPosRef.current = { x: event.clientX, y: event.clientY };
        updateMouseCurrentPos(mouseStartPosRef.current);
        updateDraggingDirection(direction);
        document.addEventListener("mouseup", mouseUpHandler(direction));
      },
    [activeCell, mouseUpHandler]
  );

  const getResizers = useCallback((): {
    bottom: CSSProperties | null;
    right: CSSProperties | null;
  } => {
    if (!activeCell) {
      return { bottom: null, right: null };
    }
    const { height, width, top, left } =
      activeCell.elem.getBoundingClientRect();
    const zoom = calculateZoomLevel(activeCell.elem);
    const zoneWidth = 10;
    const styles: Record<MouseDraggingDirection, CSSProperties> = {
      bottom: {
        cursor: "row-resize",
        height: `${zoneWidth}px`,
        left: `${window.scrollX + left}px`,
        top: `${window.scrollY + top + height - zoneWidth / 2}px`,
        width: `${width}px`,
      },
      right: {
        cursor: "col-resize",
        height: `${height}px`,
        left: `${window.scrollX + left + width - zoneWidth / 2}px`,
        top: `${window.scrollY + top}px`,
        width: `${zoneWidth}px`,
      },
    };

    const tableRect = tableRectRef.current;
    if (draggingDirection && mouseCurrentPos && tableRect) {
      if (isHeightChanging(draggingDirection)) {
        styles[draggingDirection].left = `${window.scrollX + tableRect.left}px`;
        styles[draggingDirection].top = `${
          window.scrollY + mouseCurrentPos.y / zoom
        }px`;
        styles[draggingDirection].height = "3px";
        styles[draggingDirection].width = `${tableRect.width}px`;
      } else {
        styles[draggingDirection].top = `${window.scrollY + tableRect.top}px`;
        styles[draggingDirection].left = `${
          window.scrollX + mouseCurrentPos.x / zoom
        }px`;
        styles[draggingDirection].width = "3px";
        styles[draggingDirection].height = `${tableRect.height}px`;
      }
      styles[draggingDirection].backgroundColor = "#adf";
    }
    return styles;
  }, [activeCell, draggingDirection, mouseCurrentPos]);

  const resizerStyles = getResizers();

  return (
    <div ref={resizerRef}>
      {activeCell != null && !isMouseDown && (
        <>
          <div
            data-table-resizer=""
            className="absolute z-99994"
            style={resizerStyles.right ?? undefined}
            onMouseDown={toggleResize("right")}
          />
          <div
            data-table-resizer=""
            className="absolute z-99994"
            style={resizerStyles.bottom ?? undefined}
            onMouseDown={toggleResize("bottom")}
          />
        </>
      )}
    </div>
  );
}

/** full 툴바 에디터에서만 마운트(editable일 때). */
export function TableCellResizerPlugin(): ReactPortal | null {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  return useMemo(
    () =>
      isEditable
        ? createPortal(<TableCellResizer editor={editor} />, document.body)
        : null,
    [editor, isEditable]
  );
}
