/**
 * lexical 기반 마크다운 에디터(코멘트 작성/답글/편집 + 읽기 겸용).
 * 값은 **마크다운 문자열**로 주고받는다(저장 포맷이 마크다운이라 이식성↑).
 *  - editable=true: 작성. 마크다운 단축(**굵게**, - 리스트 등) + 히스토리 + 포맷 툴바(opt). onChange로 마크다운 방출.
 *  - editable=false: 읽기. 같은 렌더 트리로 마크다운을 그대로 보여준다(별도 렌더러 불필요).
 * lexical은 코어가 가볍고 tree-shake되며 콘솔(port-console)도 쓰는 에디터라 일관적이다.
 */
import { CodeExtension } from "@lexical/code";
import {
  AutoFocusExtension,
  TabIndentationExtension,
} from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { LinkExtension } from "@lexical/link";
import {
  $isListItemNode,
  CheckListExtension,
  ListExtension,
} from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  registerMarkdownShortcuts,
  type Transformer,
} from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { RichTextExtension } from "@lexical/rich-text";
import { TableExtension } from "@lexical/table";
import { $findMatchingParent } from "@lexical/utils";
import {
  $addUpdateTag,
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  configExtension,
  defineExtension,
  type EditorThemeClasses,
  HISTORY_MERGE_TAG,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
  PASTE_COMMAND,
  PASTE_TAG,
  type PasteCommandType,
} from "lexical";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../cn";
import { MarkdownToolbar } from "./MarkdownToolbar";
import { BASE_TRANSFORMERS, MD_TRANSFORMERS } from "./markdownTransformers";
import { TableActionMenuPlugin } from "./table/TableActionMenu";
import { TableCellResizerPlugin } from "./table/TableCellResizer";
import { TableHoverActionsPlugin } from "./table/TableHoverActions";

/**
 * 리스트 안에서는 커서 위치와 무관하게 Tab/Shift+Tab이 리스트 항목의 중첩 단계를 조정해야 한다.
 * 일반 Tab indentation은 블록 시작 위치에서만 indent로 처리하므로 리스트 항목을 먼저 가로챈다.
 */
const ListTabIndentationExtension = defineExtension({
  dependencies: [ListExtension],
  name: "Widget/ListTabIndentation",
  register(editor) {
    return editor.registerCommand<KeyboardEvent>(
      KEY_TAB_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const listItems = Array.from(
          new Set(
            selection
              .getNodes()
              .map((node) =>
                $isListItemNode(node)
                  ? node
                  : $findMatchingParent(node, $isListItemNode)
              )
              .filter($isListItemNode)
          )
        );

        if (listItems.length === 0) return false;

        event.preventDefault();
        for (const listItem of listItems) {
          const indent = listItem.getIndent();
          listItem.setIndent(
            event.shiftKey ? Math.max(0, indent - 1) : indent + 1
          );
        }
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  },
});

const MARKDOWN_PASTE_PATTERNS = [
  /^ {0,3}#{1,6}\s+\S/m,
  /^ {0,3}(?:[-*+]|\d+\.)\s+\S/m,
  /^ {0,3}[-*+]\s+\[[ xX]\]\s+\S/m,
  /^ {0,3}>\s+\S/m,
  /^ {0,3}(?:```|~~~)/m,
  /\|[^\n]+\|\n\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?/,
  /\[[^\]\n]+\]\([^)]+\)/,
  /(?:^|[^*])\*\*[^*\n]+?\*\*(?:[^*]|$)/,
  /`[^`\n]+`/,
];

function getClipboardPlainText(event: PasteCommandType): string {
  if ("clipboardData" in event && event.clipboardData !== null) {
    return event.clipboardData.getData("text/plain");
  }
  if ("dataTransfer" in event && event.dataTransfer !== null) {
    return event.dataTransfer.getData("text/plain");
  }
  return "";
}

function shouldImportMarkdown(text: string): boolean {
  const trimmedText = text.trim();
  if (trimmedText.length === 0) return false;
  return MARKDOWN_PASTE_PATTERNS.some((pattern) => pattern.test(trimmedText));
}

function MarkdownRuntimeBridge({
  editable,
  value,
  onChange,
  onSubmit,
  transformers,
}: {
  editable: boolean;
  value?: string;
  onChange?: (markdown: string) => void;
  onSubmit?: () => void;
  transformers: Array<Transformer>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editable) return;
    return registerMarkdownShortcuts(editor, transformers);
  }, [editable, editor, transformers]);

  useEffect(() => {
    if (!editable) return;
    return editor.registerCommand<PasteCommandType>(
      PASTE_COMMAND,
      (event) => {
        const markdown = getClipboardPlainText(event);
        if (!shouldImportMarkdown(markdown)) return false;

        const selection = $getSelection();
        if (selection === null) return false;

        event.preventDefault();
        $addUpdateTag(PASTE_TAG);

        const pasteSelection = selection.clone();
        const container = $createParagraphNode();
        $convertFromMarkdownString(markdown, transformers, container);
        const nodes = container.getChildren();

        $setSelection(pasteSelection);
        $insertNodes(nodes);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editable, editor, transformers]);

  useEffect(() => {
    if (!editable || onChange === undefined) return;
    return editor.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves, editorState, prevEditorState, tags }) => {
        if (
          (dirtyElements.size === 0 && dirtyLeaves.size === 0) ||
          tags.has(HISTORY_MERGE_TAG) ||
          prevEditorState.isEmpty()
        ) {
          return;
        }

        const markdown = editorState.read(() =>
          $convertToMarkdownString(transformers)
        );
        onChange(markdown);
      }
    );
  }, [editable, editor, onChange, transformers]);

  useEffect(() => {
    if (!editable || onSubmit === undefined) return;
    return editor.registerCommand<KeyboardEvent>(
      KEY_ENTER_COMMAND,
      (event) => {
        if ((!event.metaKey && !event.ctrlKey) || event.shiftKey) return false;

        event.preventDefault();
        onSubmit();
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editable, editor, onSubmit]);

  useEffect(() => {
    if (!editable || value === undefined) return;

    const current = editor
      .getEditorState()
      .read(() => $convertToMarkdownString(transformers));
    if (current === value) return;

    editor.update(() => {
      $convertFromMarkdownString(value, transformers);
    });
  }, [editable, editor, transformers, value]);

  return null;
}

const THEME: EditorThemeClasses = {
  paragraph: "mb-1 last:mb-0",
  text: {
    bold: "bold",
    italic: "italic",
    strikethrough: "line-through",
    code: "rounded bg-slate-100 px-1 py-0.5 font-mono",
  },
  list: {
    ul: "pl-5",
    ulDepth: ["list-disc", "list-[circle]", "list-[square]"],
    ol: "pl-5",
    olDepth: ["list-decimal", "list-[upper-alpha]", "list-[lower-alpha]"],
    listitem: "my-0.5",
    nested: {
      listitem: "list-none before:hidden after:hidden",
    },
    listitemUnchecked:
      "relative my-0.5 list-none pl-6 outline-none before:absolute before:top-0.5 before:left-0 before:size-4 before:cursor-pointer before:rounded-sm before:border before:border-slate-300 before:content-['']",
    listitemChecked:
      "relative my-0.5 list-none pl-6 text-slate-400 line-through outline-none before:absolute before:top-0.5 before:left-0 before:size-4 before:cursor-pointer before:rounded-sm before:border before:border-primary before:bg-primary before:content-[''] after:absolute after:top-[3px] after:left-[6px] after:h-2 after:w-1 after:rotate-45 after:border-white after:border-r-2 after:border-b-2 after:content-['']",
  },
  heading: {
    h1: "font-semibold typo-h1-regular",
    h2: "font-semibold typo-h2-regular",
    h3: "font-medium typo-h3-regular",
  },
  quote: "border-slate-200 border-l-2 pl-2 text-slate-500",
  link: "text-primary underline",
  code: "block rounded bg-slate-100 p-2 font-mono",
  tableScrollableWrapper: "my-1.5 overflow-x-auto",
  table: "border-collapse",
  tableRow: "",
  tableCell: "border border-slate-200 px-2 py-1 align-top",
  tableCellHeader: "bg-slate-50 text-left font-semibold",
  tableSelection: "outline outline-2 outline-primary",
  tableCellSelected: "bg-primary/10!",
};

export function MarkdownEditor({
  defaultValue,
  value,
  onChange,
  onSubmit,
  editable = true,
  autoFocus,
  toolbar,
  placeholder,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onChange?: (markdown: string) => void;
  onSubmit?: () => void;
  editable?: boolean;
  autoFocus?: boolean;
  /** 상단 포맷 툴바(헤딩·인용·코드·체크·링크·표). 기획문서 에디터에서만 켠다. */
  toolbar?: "full";
  placeholder?: string;
  className?: string;
}) {
  const tables = toolbar === "full";
  const transformers = tables ? MD_TRANSFORMERS : BASE_TRANSFORMERS;
  const initialMarkdown = useRef(value ?? defaultValue ?? "");
  const extension = useMemo(
    () =>
      defineExtension({
        $initialEditorState: () =>
          $convertFromMarkdownString(initialMarkdown.current, transformers),
        dependencies: [
          RichTextExtension,
          CodeExtension,
          LinkExtension,
          ListExtension,
          CheckListExtension,
          HistoryExtension,
          ListTabIndentationExtension,
          TabIndentationExtension,
          configExtension(AutoFocusExtension, {
            disabled: !(editable && autoFocus),
          }),
          ...(tables
            ? [
                configExtension(TableExtension, {
                  hasCellBackgroundColor: true,
                  hasCellMerge: true,
                  hasHorizontalScroll: true,
                  hasTabHandler: true,
                }),
              ]
            : []),
        ],
        editable,
        name: "Widget/MarkdownEditor",
        namespace: "comment-md",
        theme: THEME,
      }),
    [autoFocus, editable, tables, transformers]
  );
  const [scrollElem, setScrollElem] = useState<HTMLDivElement | null>(null);
  return (
    <LexicalExtensionComposer extension={extension} contentEditable={null}>
      <div className={cn("flex flex-col overflow-hidden", className)}>
        {editable && toolbar && <MarkdownToolbar />}
        <div
          ref={setScrollElem}
          className={cn(
            "relative flex-1",
            editable && "overflow-y-auto px-3 py-1"
          )}
        >
          {placeholder ? (
            <ContentEditable
              aria-placeholder={placeholder}
              className={cn(
                "whitespace-pre-wrap wrap-break-word outline-none",
                editable && "h-full"
              )}
              placeholder={
                <div className="pointer-events-none absolute top-1 left-3 text-slate-400">
                  {placeholder}
                </div>
              }
            />
          ) : (
            <ContentEditable
              placeholder={null}
              className={cn(
                "whitespace-pre-wrap wrap-break-word outline-none",
                editable && "h-full"
              )}
            />
          )}
        </div>
        {editable && tables && <TableCellResizerPlugin />}
        {editable && tables && scrollElem && (
          <>
            <TableHoverActionsPlugin anchorElem={scrollElem} />
            <TableActionMenuPlugin anchorElem={scrollElem} />
          </>
        )}
        <MarkdownRuntimeBridge
          editable={editable}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          transformers={transformers}
        />
      </div>
    </LexicalExtensionComposer>
  );
}
