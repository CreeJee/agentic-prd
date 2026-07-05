import { uniq } from "es-toolkit";
import type { CommentThread } from "./store";

/** 상대 시간 표기(방금/N분 전/N시간 전/N일 전) */
export function timeAgo(at: number): string {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/**
 * 마크다운 문법 문자를 걷어내 한 줄 미리보기용 순수 텍스트로 만든다.
 * 리스트/헤딩/블록쿼트/링크/이미지/코드/굵게·이탤릭·취소선/체크박스를 모두 벗긴다.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`\n]+?)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/__([^_\n]+?)__/g, "$1")
    .replace(/(?<![*\w])\*([^*\n]+?)\*(?!\w)/g, "$1")
    .replace(/(?<![_\w])_([^_\n]+?)_(?!\w)/g, "$1")
    .replace(/~~([^~\n]+?)~~/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 스레드 첫 코멘트의 미리보기(마크다운 문법 제거 후 48자 컷) */
export function snippet(thread: CommentThread): string {
  const first = thread.comments[0]?.text ?? "";
  const plain = stripMarkdown(first);
  return plain.length > 48 ? `${plain.slice(0, 48)}…` : plain;
}

/** 스레드의 첫 코멘트 작성자 */
export function threadAuthor(t: CommentThread): string {
  return t.comments[0]?.author ?? "익명";
}

/** 작성자 닉네임의 머리글자(아바타용) */
export function authorInitial(name: string): string {
  return (name || "?").slice(0, 1).toUpperCase();
}

/** 그룹 내 중복 제거된 작성자 목록(첫 등장 순) */
export function distinctAuthors(threads: CommentThread[]): string[] {
  return uniq(threads.map(threadAuthor));
}
