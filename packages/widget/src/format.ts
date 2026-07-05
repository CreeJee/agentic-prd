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
