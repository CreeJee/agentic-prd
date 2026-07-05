import {
  FileTextIcon,
  MessageSquarePlusIcon,
  MessagesSquareIcon,
} from "lucide-react";
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
        <input
          ref={(ref) => ref?.focus({ focusVisible: true })}
          value={nameInput}
          placeholder="이름 입력"
          onChange={(e) => onNameInputChange(e.target.value)}
          onBlur={onCommitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitName();
          }}
          className="h-7 w-28 rounded-full border border-slate-200 px-2.5 text-sm outline-none focus:border-primary"
        />
      ) : (
        <button
          type="button"
          onClick={onBeginNameEdit}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-slate-600 text-sm hover:bg-slate-50"
          title="이름 설정"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
            {authorInitial(userName)}
          </span>
          <span className="max-w-24 truncate">{userName || "이름 설정"}</span>
        </button>
      )}

      <div className="h-5 w-px bg-slate-200" />

      <button
        type="button"
        onClick={onToggleCommentPanel}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-sm hover:bg-slate-50"
        title="코멘트 목록"
      >
        <MessagesSquareIcon className="size-4" />
        목록 {threadCount}
      </button>

      <button
        type="button"
        onClick={onToggleSpecPanel}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-sm hover:bg-slate-50",
          specOpen ? "text-primary" : "text-slate-600"
        )}
        title="화면 기획 문서"
      >
        <FileTextIcon className="size-4" />
        문서
      </button>

      <button
        type="button"
        onClick={onToggleAddMode}
        disabled={!addMode && !canComment}
        title={!addMode && !canComment ? "이름을 먼저 설정하세요" : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-sm transition-colors",
          addMode
            ? "bg-primary text-white"
            : "bg-slate-900 text-white hover:bg-slate-700",
          "disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
        )}
      >
        <MessageSquarePlusIcon className="size-4" />
        {addMode ? "취소" : "코멘트"}
      </button>
    </DraggableToolbar>
  );
}
