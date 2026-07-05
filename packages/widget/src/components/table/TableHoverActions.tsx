/**
 * 표 가장자리에 마우스를 올리면 "행 추가"/"열 추가" 버튼을 띄운다.
 * lexical-playground TableHoverActionsPlugin 포팅(0.20.2) — playground CSS/셀렉터 대신
 * 우리 셀(td/th) + Tailwind 버튼으로 대체하고 useDebounce는 es-toolkit 기반으로 교체했다.
 */

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import {
  $getTableAndElementByKey,
  $getTableColumnIndexFromTableCellNode,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  getTableElement,
  TableNode,
} from "@lexical/table";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import { $getNearestNodeFromDOMNode, type NodeKey } from "lexical";
import { PlusIcon } from "lucide-react";
import {
  type CSSProperties,
  type ReactPortal,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDebounce } from "./useDebounce";

const BUTTON_WIDTH_PX = 20;
const ADD_BTN_CLASS =
  "absolute z-10 flex items-center justify-center rounded bg-slate-100 text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary";

function getMouseInfo(event: MouseEvent): {
  tableDOMNode: HTMLElement | null;
  isOutside: boolean;
} {
  const target = event.target;
  if (target instanceof HTMLElement) {
    const tableDOMNode = target.closest<HTMLElement>("td, th");
    const isOutside = !(
      tableDOMNode ||
      target.closest<HTMLElement>("[data-table-add]") ||
      target.closest<HTMLElement>("[data-table-resizer]")
    );
    return { isOutside, tableDOMNode };
  }
  return { isOutside: true, tableDOMNode: null };
}

function TableHoverActionsContainer({
  anchorElem,
}: {
  anchorElem: HTMLElement;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [isShownRow, setShownRow] = useState(false);
  const [isShownColumn, setShownColumn] = useState(false);
  const [shouldListenMouseMove, setShouldListenMouseMove] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const tableSetRef = useRef<Set<NodeKey>>(new Set());
  const tableCellDOMNodeRef = useRef<HTMLElement | null>(null);

  const debouncedOnMouseMove = useDebounce((event: MouseEvent) => {
    const { isOutside, tableDOMNode } = getMouseInfo(event);
    if (isOutside) {
      setShownRow(false);
      setShownColumn(false);
      return;
    }
    if (!tableDOMNode) {
      return;
    }
    tableCellDOMNodeRef.current = tableDOMNode;

    let hoveredRow = false;
    let hoveredColumn = false;
    let tableDOMElement: HTMLElement | null = null;

    editor.getEditorState().read(
      () => {
        const maybeTableCell = $getNearestNodeFromDOMNode(tableDOMNode);
        if (!$isTableCellNode(maybeTableCell)) return;

        const table = $findMatchingParent(maybeTableCell, (node) =>
          $isTableNode(node)
        );
        if (!$isTableNode(table)) return;

        tableDOMElement = getTableElement(
          table,
          editor.getElementByKey(table.getKey())
        );
        if (!tableDOMElement) return;

        const rowCount = table.getChildrenSize();
        const firstRow = table.getChildAtIndex(0);
        const colCount = $isTableRowNode(firstRow)
          ? firstRow.getChildrenSize()
          : 0;
        const rowIndex = $getTableRowIndexFromTableCellNode(maybeTableCell);
        const colIndex = $getTableColumnIndexFromTableCellNode(maybeTableCell);

        if (rowIndex === rowCount - 1) {
          hoveredRow = true;
        } else if (colIndex === colCount - 1) {
          hoveredColumn = true;
        }
      },
      { editor }
    );

    if (!tableDOMElement) return;
    const {
      width: tableElemWidth,
      y: tableElemY,
      right: tableElemRight,
      left: tableElemLeft,
      bottom: tableElemBottom,
      height: tableElemHeight,
    } = (tableDOMElement as HTMLElement).getBoundingClientRect();
    const { y: editorElemY, left: editorElemLeft } =
      anchorElem.getBoundingClientRect();

    if (hoveredRow) {
      setShownColumn(false);
      setShownRow(true);
      setPosition({
        height: BUTTON_WIDTH_PX,
        left: tableElemLeft - editorElemLeft,
        top: tableElemBottom - editorElemY + 5,
        width: tableElemWidth,
      });
    } else if (hoveredColumn) {
      setShownColumn(true);
      setShownRow(false);
      setPosition({
        height: tableElemHeight,
        left: tableElemRight - editorElemLeft + 5,
        top: tableElemY - editorElemY,
        width: BUTTON_WIDTH_PX,
      });
    }
  }, 50);

  const tableResizeObserver = useMemo(
    () =>
      new ResizeObserver(() => {
        setShownRow(false);
        setShownColumn(false);
      }),
    []
  );

  useEffect(() => {
    if (!shouldListenMouseMove) return;
    document.addEventListener("mousemove", debouncedOnMouseMove);
    return () => {
      setShownRow(false);
      setShownColumn(false);
      debouncedOnMouseMove.cancel();
      document.removeEventListener("mousemove", debouncedOnMouseMove);
    };
  }, [shouldListenMouseMove, debouncedOnMouseMove]);

  useEffect(() => {
    return mergeRegister(
      editor.registerMutationListener(
        TableNode,
        (mutations) => {
          editor.getEditorState().read(
            () => {
              let resetObserver = false;
              for (const [key, type] of mutations) {
                if (type === "created") {
                  tableSetRef.current.add(key);
                  resetObserver = true;
                } else if (type === "destroyed") {
                  tableSetRef.current.delete(key);
                  resetObserver = true;
                }
              }
              if (resetObserver) {
                tableResizeObserver.disconnect();
                for (const tableKey of tableSetRef.current) {
                  const { tableElement } = $getTableAndElementByKey(tableKey);
                  tableResizeObserver.observe(tableElement);
                }
                setShouldListenMouseMove(tableSetRef.current.size > 0);
              }
            },
            { editor }
          );
        },
        { skipInitialization: false }
      )
    );
  }, [editor, tableResizeObserver]);

  const insertAction = (insertRow: boolean) => {
    editor.update(() => {
      if (tableCellDOMNodeRef.current) {
        const maybeTableNode = $getNearestNodeFromDOMNode(
          tableCellDOMNodeRef.current
        );
        maybeTableNode?.selectEnd();
        if (insertRow) {
          $insertTableRowAtSelection();
          setShownRow(false);
        } else {
          $insertTableColumnAtSelection();
          setShownColumn(false);
        }
      }
    });
  };

  if (!isEditable) return null;

  return (
    <>
      {isShownRow && (
        <button
          type="button"
          aria-label="행 추가"
          data-table-add=""
          className={ADD_BTN_CLASS}
          style={position}
          onClick={() => insertAction(true)}
        >
          <PlusIcon className="size-3.5" />
        </button>
      )}
      {isShownColumn && (
        <button
          type="button"
          aria-label="열 추가"
          data-table-add=""
          className={ADD_BTN_CLASS}
          style={position}
          onClick={() => insertAction(false)}
        >
          <PlusIcon className="size-3.5" />
        </button>
      )}
    </>
  );
}

/** full 툴바 에디터에서만 마운트. anchorElem(에디터 스크롤 컨테이너)에 포털. */
export function TableHoverActionsPlugin({
  anchorElem,
}: {
  anchorElem: HTMLElement;
}): ReactPortal | null {
  const isEditable = useLexicalEditable();
  return isEditable
    ? createPortal(
        <TableHoverActionsContainer anchorElem={anchorElem} />,
        anchorElem
      )
    : null;
}
