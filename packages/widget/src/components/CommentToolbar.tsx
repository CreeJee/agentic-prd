import {
  FileTextIcon,
  MessageSquarePlusIcon,
  MessagesSquareIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "../cn";
import { authorInitial } from "../format";
import { DraggableToolbar } from "./DraggableToolbar";

export function CommentToolbar({
  userName,
  nameInput,
  nameEditing,
  threadCount,
  addMode,
  specOpen,
  canComment,
  onBeginNameEdit,
  onNameInputChange,
  onCommitName,
  onToggleCommentPanel,
  onToggleSpecPanel,
  onToggleAddMode,
}: {
  userName: string;
  nameInput: string;
  nameEditing: boolean;
  threadCount: number;
  addMode: boolean;
  specOpen: boolean;
  /** 닉네임이 설정돼 코멘트를 달 수 있는 상태인지(없으면 코멘트 버튼 비활성) */
  canComment: boolean;
  onBeginNameEdit: () => void;
  onNameInputChange: (value: string) => void;
  onCommitName: () => void;
  onToggleCommentPanel: () => void;
  onToggleSpecPanel: () => void;
  onToggleAddMode: () => void;
}) {
  return (
    <DraggableToolbar>
      {nameEditing ? (
        <Input
          ref={(ref) => ref?.focus({ focusVisible: true })}
          value={nameInput}
          placeholder="이름 입력"
          onChange={(e) => onNameInputChange(e.target.value)}
          onBlur={onCommitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitName();
          }}
          className="h-7 w-28 rounded-full px-2.5 text-sm focus:border-primary"
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBeginNameEdit}
          className="rounded-full text-slate-600 hover:bg-slate-50"
          title="이름 설정"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-[11px]">
            {authorInitial(userName)}
          </span>
          <span className="max-w-24 truncate">{userName || "이름 설정"}</span>
        </Button>
      )}

      <div className="h-5 w-px bg-slate-200" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleCommentPanel}
        className="rounded-full text-slate-600 hover:bg-slate-50"
        title="코멘트 목록"
      >
        <MessagesSquareIcon className="size-4" />
        목록 {threadCount}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleSpecPanel}
        aria-pressed={specOpen}
        className={cn(
          "rounded-full hover:bg-slate-50",
          specOpen ? "text-primary" : "text-slate-600"
        )}
        title="화면 기획 문서"
      >
        <FileTextIcon className="size-4" />
        문서
      </Button>

      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={onToggleAddMode}
        disabled={!addMode && !canComment}
        title={!addMode && !canComment ? "이름을 먼저 설정하세요" : undefined}
        aria-pressed={addMode}
        className={cn(
          "rounded-full font-medium",
          addMode
            ? "bg-primary text-white hover:bg-primary/90"
            : "bg-slate-900 text-white hover:bg-slate-700"
        )}
      >
        <MessageSquarePlusIcon className="size-4" />
        {addMode ? "취소" : "코멘트"}
      </Button>
    </DraggableToolbar>
  );
}
