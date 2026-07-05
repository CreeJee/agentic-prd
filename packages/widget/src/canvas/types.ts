/**
 * 캔버스(핀 영역) 공유 타입. CommentWidget 오케스트레이터와 canvas/ 렌더 블록이 함께 쓴다.
 */
import type { Dispatch, SetStateAction } from "react";
import type { Point } from "../anchor";
import type { Anchor, CommentThread } from "../store";

export interface Draft {
  xPct: number;
  yPx: number;
  anchor: Anchor | null;
}

/**
 * 캔버스 상호배타 모드. 한 번에 하나만 가능 →
 * 불가능한 조합(작성 중인데 스레드도 열림 등)을 타입으로 차단한다.
 *  - idle: 평상
 *  - add: 코멘트 위치 지정 모드(다음 클릭이 핀이 됨)
 *  - draft: 신규 코멘트 작성 중
 *  - thread: 특정 스레드 팝오버 열림(fromClusterId: 겹친 목록에서 들어왔으면 뒤로가기용)
 *  - cluster: 겹침 그룹 목록 펼침
 *  - relocate: 기존 스레드 재앵커 모드(다음 클릭이 그 스레드의 새 anchor가 됨)
 */
export type Canvas =
  | { kind: "idle" }
  | { kind: "add" }
  | { kind: "draft"; draft: Draft }
  | { kind: "thread"; id: string; fromClusterId?: string }
  | { kind: "cluster"; clusterId: string }
  | { kind: "relocate"; id: string };

export type SetCanvas = Dispatch<SetStateAction<Canvas>>;

export interface ClusterGroup {
  clusterId: string;
  threads: CommentThread[];
  point: Point;
}
