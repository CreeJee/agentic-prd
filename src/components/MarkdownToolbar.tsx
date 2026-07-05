/**
 * lexical 포맷 툴바(MarkdownEditor 상단). 선택 영역에 블록/인라인 서식을 적용한다.
 * 헤딩·인용·코드·체크리스트·링크까지 전부 노출하며, 기획문서 에디터(full)에서만 쓴다.
 * 버튼은 onMouseDown에서 preventDefault → 클릭해도 에디터 선택이 풀리지 않는다.
 */
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createHeadingNode,
  $createQuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import {
  $getSelection,
  $isRangeSelection,
  type CommandPayloadType,
  type ElementNode,
  FORMAT_TEXT_COMMAND,
  type LexicalCommand,
  type TextFormatType,
} from "lexical";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  QuoteIcon,
  StrikethroughIcon,
  TableIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "../cn";

function TBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "text-slate-500 hover:bg-slate-100",
        active && "bg-primary/10 text-primary hover:bg-primary/15"
      )}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" />;
}

const INLINE: { format: TextFormatType; title: string; Icon: LucideIcon }[] = [
  { format: "bold", title: "굵게", Icon: BoldIcon },
  { format: "italic", title: "기울임", Icon: ItalicIcon },
  { format: "strikethrough", title: "취소선", Icon: StrikethroughIcon },
  { format: "code", title: "인라인 코드", Icon: CodeIcon },
];

const HEADINGS: { tag: HeadingTagType; title: string; Icon: LucideIcon }[] = [
  { tag: "h1", title: "제목 1", Icon: Heading1Icon },
  { tag: "h2", title: "제목 2", Icon: Heading2Icon },
  { tag: "h3", title: "제목 3", Icon: Heading3Icon },
];

export function MarkdownToolbar() {
  const [editor] = useLexicalComposerContext();
  const [active, setActive] = useState<Record<TextFormatType, boolean>>(
    {} as Record<TextFormatType, boolean>
  );

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel)) return;
          setActive({
            bold: sel.hasFormat("bold"),
            italic: sel.hasFormat("italic"),
            strikethrough: sel.hasFormat("strikethrough"),
            code: sel.hasFormat("code"),
          } as Record<TextFormatType, boolean>);
        });
      }),
    [editor]
  );

  const fmt = (f: TextFormatType) =>
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, f);
  const toBlock = (creator: () => ElementNode) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, creator);
    });
  const cmd = <T extends LexicalCommand<unknown>>(
    command: T,
    payload: CommandPayloadType<T>
  ) => editor.dispatchCommand(command, payload);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-slate-100 border-b px-1.5 py-1">
      {HEADINGS.map(({ tag, title, Icon }) => (
        <TBtn
          key={tag}
          title={title}
          onClick={() => toBlock(() => $createHeadingNode(tag))}
        >
          <Icon className="size-4" />
        </TBtn>
      ))}
      <Divider />

      {INLINE.map(({ format, title, Icon }) => (
        <TBtn
          key={format}
          title={title}
          active={active[format]}
          onClick={() => fmt(format)}
        >
          <Icon className="size-4" />
        </TBtn>
      ))}
      <Divider />

      <TBtn
        title="불릿 목록"
        onClick={() => cmd(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      >
        <ListIcon className="size-4" />
      </TBtn>
      <TBtn
        title="번호 목록"
        onClick={() => cmd(INSERT_ORDERED_LIST_COMMAND, undefined)}
      >
        <ListOrderedIcon className="size-4" />
      </TBtn>
      <TBtn
        title="체크리스트"
        onClick={() => cmd(INSERT_CHECK_LIST_COMMAND, undefined)}
      >
        <ListChecksIcon className="size-4" />
      </TBtn>

      <Divider />
      <TBtn title="인용" onClick={() => toBlock(() => $createQuoteNode())}>
        <QuoteIcon className="size-4" />
      </TBtn>
      <TBtn title="링크" onClick={() => cmd(TOGGLE_LINK_COMMAND, "https://")}>
        <LinkIcon className="size-4" />
      </TBtn>
      <TBtn
        title="표 삽입 (3×3)"
        onClick={() =>
          cmd(INSERT_TABLE_COMMAND, {
            columns: "3",
            rows: "3",
            includeHeaders: true,
          })
        }
      >
        <TableIcon className="size-4" />
      </TBtn>
    </div>
  );
}
