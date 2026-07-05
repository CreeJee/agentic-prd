/**
 * GFM 표(`| a | b |`) 마크다운 ↔ lexical TableNode 변환기.
 * `@lexical/markdown` 기본 TRANSFORMERS엔 표 직렬화가 없어, lexical-playground의
 * TABLE ElementTransformer를 0.20.2 기준으로 포팅했다(셀 내부는 표를 또 품지 않으므로
 * 재귀를 피하려 base TRANSFORMERS로 변환한다).
 * 기획문서(full 툴바) 에디터에서만 `MD_TRANSFORMERS`로 등록한다.
 */
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  type ElementTransformer,
  TRANSFORMERS,
} from "@lexical/markdown";
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { $isParagraphNode, $isTextNode, type LexicalNode } from "lexical";

export const BASE_TRANSFORMERS = [CHECK_LIST, ...TRANSFORMERS];

const TABLE_ROW_REG_EXP = /^(?:\|)(.+)(?:\|)\s?$/;
const TABLE_ROW_DIVIDER_REG_EXP = /^(\| ?:?-*:? ?)+\|\s?$/;

function getTableColumnsSize(table: TableNode): number {
  const row = table.getFirstChild();
  return $isTableRowNode(row) ? row.getChildrenSize() : 0;
}

const $createTableCell = (textContent: string): TableCellNode => {
  const content = textContent.replace(/\\n/g, "\n");
  const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  $convertFromMarkdownString(content, BASE_TRANSFORMERS, cell);
  return cell;
};

const mapToTableCells = (textContent: string): TableCellNode[] | null => {
  const match = textContent.match(TABLE_ROW_REG_EXP);
  const cells = match?.[1];
  if (!cells) return null;
  return cells.split("|").map((text) => $createTableCell(text));
};

const TABLE: ElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  export: (node: LexicalNode) => {
    if (!$isTableNode(node)) return null;

    const output: string[] = [];
    for (const row of node.getChildren()) {
      const rowOutput: string[] = [];
      if (!$isTableRowNode(row)) continue;

      let isHeaderRow = false;
      for (const cell of row.getChildren()) {
        if ($isTableCellNode(cell)) {
          rowOutput.push(
            $convertToMarkdownString(BASE_TRANSFORMERS, cell).replace(
              /\n/g,
              "\\n"
            )
          );
          if (cell.__headerState === TableCellHeaderStates.ROW) {
            isHeaderRow = true;
          }
        }
      }

      output.push(`| ${rowOutput.join(" | ")} |`);
      if (isHeaderRow) {
        output.push(`| ${rowOutput.map(() => "---").join(" | ")} |`);
      }
    }
    return output.join("\n");
  },
  regExp: TABLE_ROW_REG_EXP,
  replace: (parentNode, _children, match) => {
    const line = match[0];
    if (line === undefined) return;
    if (TABLE_ROW_DIVIDER_REG_EXP.test(line)) {
      const table = parentNode.getPreviousSibling();
      if (!table || !$isTableNode(table)) return;

      const rows = table.getChildren();
      const lastRow = rows[rows.length - 1];
      if (!lastRow || !$isTableRowNode(lastRow)) return;

      for (const cell of lastRow.getChildren()) {
        if (!$isTableCellNode(cell)) continue;
        cell.setHeaderStyles(
          TableCellHeaderStates.ROW,
          TableCellHeaderStates.ROW
        );
      }
      parentNode.remove();
      return;
    }

    const matchCells = mapToTableCells(line);
    if (matchCells == null) return;

    const rows = [matchCells];
    let sibling = parentNode.getPreviousSibling();
    let maxCells = matchCells.length;

    while (sibling) {
      if (!$isParagraphNode(sibling)) break;
      if (sibling.getChildrenSize() !== 1) break;

      const firstChild = sibling.getFirstChild();
      if (!$isTextNode(firstChild)) break;

      const cells = mapToTableCells(firstChild.getTextContent());
      if (cells == null) break;

      maxCells = Math.max(maxCells, cells.length);
      rows.unshift(cells);
      const previousSibling = sibling.getPreviousSibling();
      sibling.remove();
      sibling = previousSibling;
    }

    const table = $createTableNode();
    for (const cells of rows) {
      const tableRow = $createTableRowNode();
      table.append(tableRow);
      for (let i = 0; i < maxCells; i++) {
        const cell = cells[i];
        tableRow.append(cell !== undefined ? cell : $createTableCell(""));
      }
    }

    const previousSibling = parentNode.getPreviousSibling();
    if (
      $isTableNode(previousSibling) &&
      getTableColumnsSize(previousSibling) === maxCells
    ) {
      previousSibling.append(...table.getChildren());
      parentNode.remove();
    } else {
      parentNode.replace(table);
    }
    table.selectEnd();
  },
  type: "element",
};

/** 표 + 체크리스트 포함 전체 트랜스포머(표가 먼저 매칭되도록 앞에 둔다). */
export const MD_TRANSFORMERS = [TABLE, ...BASE_TRANSFORMERS];

/** 표 노드(에디터 config에 등록 필요). */
export const TABLE_NODES = [TableNode, TableRowNode, TableCellNode];
