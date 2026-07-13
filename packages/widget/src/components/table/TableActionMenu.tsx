import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import {
  $computeTableMapSkipCellCheck,
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableCellNodeFromLexicalNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableSelection,
  $mergeCells,
  $unmergeCell,
  TableCellHeaderStates,
  type TableCellNode,
} from "@lexical/table";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  type NodeKey,
} from "lexical";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import {
  type ReactPortal,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRESET_COLORS: { label: string; value: string | null }[] = [
  { label: "지우기", value: null },
  { label: "빨강", value: "#fee2e2" },
  { label: "노랑", value: "#fef9c3" },
  { label: "초록", value: "#dcfce7" },
  { label: "파랑", value: "#dbeafe" },
  { label: "보라", value: "#f3e8ff" },
];

function TableActionMenuContainer({ anchorElem }: { anchorElem: HTMLElement }) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [cellKey, setCellKey] = useState<NodeKey | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [canMerge, setCanMerge] = useState(false);
  const [canUnmerge, setCanUnmerge] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);

  const recompute = useCallback(() => {
    let foundKey: NodeKey | null = null;
    let merge = false;
    let unmerge = false;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      const node =
        $isRangeSelection(selection) || $isTableSelection(selection)
          ? selection.anchor.getNode()
          : null;
      const cell = node ? $getTableCellNodeFromLexicalNode(node) : null;
      if (!$isTableCellNode(cell)) return;
      foundKey = cell.getKey();
      unmerge = cell.getColSpan() > 1 || cell.getRowSpan() > 1;
      if ($isTableSelection(selection)) {
        const shape = selection.getShape();
        merge = shape.toX - shape.fromX > 0 || shape.toY - shape.fromY > 0;
      }
    });
    setCellKey(foundKey);
    setCanMerge(merge);
    setCanUnmerge(unmerge);

    const dom = foundKey ? editor.getElementByKey(foundKey) : null;
    if (!dom) {
      setPos(null);
      return;
    }
    const r = dom.getBoundingClientRect();
    const a = anchorElem.getBoundingClientRect();
    const next = {
      top: r.top - a.top + anchorElem.scrollTop + 2,
      left: r.right - a.left + anchorElem.scrollLeft - 18,
    };
    setPos((prev) =>
      prev && prev.top === next.top && prev.left === next.left ? prev : next
    );
  }, [editor, anchorElem]);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      if (menuOpenRef.current) return;
      recompute();
    });
  }, [editor, recompute]);

  const onOpenChange = (open: boolean) => {
    menuOpenRef.current = open;
    setMenuOpen(open);
    if (!open) recompute();
  };

  const withCell = (fn: (cell: TableCellNode) => void) =>
    editor.update(() => {
      const cell = cellKey ? $getNodeByKey(cellKey) : null;
      if ($isTableCellNode(cell)) {
        cell.selectEnd();
        fn(cell);
      }
    });

  const insertRow = (after: boolean) =>
    withCell(() => $insertTableRowAtSelection(after));
  const insertColumn = (after: boolean) =>
    withCell(() => $insertTableColumnAtSelection(after));
  const deleteRow = () => withCell(() => $deleteTableRowAtSelection());
  const deleteColumn = () => withCell(() => $deleteTableColumnAtSelection());
  const deleteTable = () => {
    withCell((cell) => $getTableNodeFromLexicalNodeOrThrow(cell).remove());
    setPos(null);
  };

  const toggleRowHeader = () =>
    withCell((cell) => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(cell);
      const rowIndex = $getTableRowIndexFromTableCellNode(cell);
      const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
      const rowMap = gridMap[rowIndex];
      if (!rowMap) return;
      const newStyle = cell.getHeaderStyles() ^ TableCellHeaderStates.ROW;
      const seen = new Set<TableCellNode>();
      for (const mapCell of rowMap) {
        if (!mapCell?.cell || seen.has(mapCell.cell)) continue;
        seen.add(mapCell.cell);
        mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.ROW);
      }
    });
  const toggleColumnHeader = () =>
    withCell((cell) => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(cell);
      const colIndex = $getTableColumnIndexFromTableCellNode(cell);
      const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
      const newStyle = cell.getHeaderStyles() ^ TableCellHeaderStates.COLUMN;
      const seen = new Set<TableCellNode>();
      for (const row of gridMap) {
        const mapCell = row[colIndex];
        if (!mapCell?.cell || seen.has(mapCell.cell)) continue;
        seen.add(mapCell.cell);
        mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.COLUMN);
      }
    });

  const mergeCells = () =>
    editor.update(() => {
      const selection = $getSelection();
      if (!$isTableSelection(selection)) return;
      const cells = selection.getNodes().filter($isTableCellNode);
      const target = $mergeCells(cells);
      target?.selectEnd();
    });
  const unmergeCells = () => withCell(() => $unmergeCell());

  const setBackground = (value: string | null) =>
    editor.update(() => {
      const selection = $getSelection();
      if ($isTableSelection(selection)) {
        for (const node of selection.getNodes()) {
          if ($isTableCellNode(node)) node.setBackgroundColor(value);
        }
        return;
      }
      const cell = cellKey ? $getNodeByKey(cellKey) : null;
      if ($isTableCellNode(cell)) cell.setBackgroundColor(value);
    });

  if (!isEditable || !cellKey || !pos) return null;

  return (
    <DropdownMenu open={menuOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        data-comment-no-capture=""
        aria-label="표 셀 메뉴"
        className="absolute z-99994 flex size-4 items-center justify-center rounded bg-white/90 text-slate-400 shadow-sm ring-1 ring-slate-200 hover:text-primary"
        style={{ top: pos.top, left: pos.left }}
      >
        <ChevronDownIcon className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="z-99999 min-w-44"
        data-comment-no-capture=""
      >
        <DropdownMenuLabel>행</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => insertRow(false)}>
          위에 행 삽입
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => insertRow(true)}>
          아래에 행 삽입
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={deleteRow}>행 삭제</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>열</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => insertColumn(false)}>
          왼쪽에 열 삽입
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => insertColumn(true)}>
          오른쪽에 열 삽입
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={deleteColumn}>열 삭제</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={toggleRowHeader}>
          헤더 행 전환
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleColumnHeader}>
          헤더 열 전환
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canMerge} onSelect={mergeCells}>
          셀 병합
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canUnmerge} onSelect={unmergeCells}>
          병합 해제
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>셀 배경색</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="z-99999">
              {PRESET_COLORS.map((c) => (
                <DropdownMenuItem
                  key={c.label}
                  onSelect={() => setBackground(c.value)}
                >
                  <span
                    className="mr-2 inline-block size-3.5 rounded-sm border border-slate-200"
                    style={{ backgroundColor: c.value ?? "transparent" }}
                  />
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-500 focus:text-red-500"
          onSelect={deleteTable}
        >
          <Trash2Icon className="mr-2 size-3.5" />표 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** full 툴바 에디터에서만 마운트. anchorElem(에디터 스크롤 컨테이너)에 트리거를 포털. */
export function TableActionMenuPlugin({
  anchorElem,
}: {
  anchorElem: HTMLElement;
}): ReactPortal | null {
  const isEditable = useLexicalEditable();
  return isEditable
    ? createPortal(
        <TableActionMenuContainer anchorElem={anchorElem} />,
        anchorElem
      )
    : null;
}
