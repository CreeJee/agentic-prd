/**
 * 코멘트(핀) 데이터 레이어. Figma처럼 화면에 핀을 찍고 코멘트 스레드를 단다.
 *
 * **single source of truth는 Supabase(원격)** 이므로 server-state 라이브러리인
 * @tanstack/react-query로만 다룬다. 컴포넌트는 훅을 직접 호출한다:
 *  - 읽기: useThreads / useUserName (useQuery, remote는 refetchInterval 폴링)
 *  - 쓰기: useAddThread / useAddComment / useUpdateComment / useToggleResolved /
 *          useDeleteThread / useUpdateAnchor / useSetUserName (useMutation)
 * 모든 쓰기는 react-query 공식 "via the cache" 낙관적 업데이트다(useThreadMutation):
 * onMutate(cancel→스냅샷→낙관적 setQueryData), onError(스냅샷 롤백), onSettled(invalidate
 * Promise return → refetch까지 pending 유지). 호출부마다 try/catch가 필요 없다.
 *
 * 저장소는 config로 주입한다(하드코딩 없음):
 *  - Supabase: 공용 저장소(모두가 같은 코멘트를 봄, POLL_MS 폴링).
 * local/persist 모드는 폐기했고, 훅은 주입된 SupabaseClient만 호출한다.
 *
 * 사용자 이름은 server-state가 아니라 개인 client state(브라우저별, 화면 무관)다 →
 * react-query가 아니라 jotai atomWithStorage(localStorage 백업)로 둔다. 표시 시점에
 * 바로 읽도록 getOnInit으로 첫 렌더부터 저장값을 반영한다.
 *
 * QueryClient/SupabaseClient는 모듈 싱글톤이 아니라 WidgetProvider가 렌더 시점에 만들어
 * Context로 주입한다(useSupabaseClient). 훅은 이를 읽어 queryFn/mutation에 쓴다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { SupabaseClient } from "./supabase";
import { useSupabaseClient } from "./WidgetProvider";

export interface CommentEntry {
  id: string;
  author: string;
  text: string;
  at: number;
}

/**
 * overlay 중첩 한 단계.
 * Radix는 overlay를 body로 portal하므로 DOM 중첩이 사라진다 → 논리적 중첩(부모 overlay)을
 * "열림 시점에 trigger가 어느 overlay 안에 있었나"로 기록한다.
 */
export interface ScopeLevel {
  /** overlay 식별자(주로 dialog 타이틀 텍스트) */
  overlayKey: string;
  /**
   * 이 overlay를 연 trigger의 CSS 경로. **부모 스코프 기준**(부모 overlay 안, 최상위면 document).
   * overlay가 닫혔을 때 핀을 이 trigger 위에 모아 표시한다.
   */
  triggerSelector?: string;
}

/** 코멘트 앵커가 가리키는 가장 유력한 React component 소스 위치 */
export interface ReactSourceLocation {
  /** Fiber type/displayName 또는 owner stack 에서 얻은 component 이름 */
  componentName: string;
  /** list item 식별 보강용 Fiber key */
  key?: string;
  /** `_debugOwner`가 있으면 함께 저장해 owner tree 를 나중에 대조한다. */
  ownerName?: string;
  /** 번들러 origin/query 를 걷어낸 파일명 또는 URL path */
  fileName: string;
  /** 런타임 stack/debugSource 가 제공한 line. 번들러별로 부정확할 수 있다. */
  lineNumber?: number;
  /** 런타임 stack/debugSource 가 제공한 column. 번들러별로 부정확할 수 있다. */
  columnNumber?: number;
}

/**
 * 엘리먼트 기준 핀 앵커.
 * 절대좌표 대신 "어떤 DOM 엘리먼트의 어느 지점"인지로 고정 →
 * 모달/시트, 내부 스크롤, fixed 뷰, 중첩 overlay에서도 콘텐츠를 따라 움직인다.
 */
export interface Anchor {
  /** overlay 중첩 체인(바깥→안). 비어 있으면 page scope */
  scopeChain: ScopeLevel[];
  /** 스코프 루트(최내부 overlay, 체인이 비면 document) 기준 상대 CSS 경로 */
  selector: string;
  /** 엘리먼트 rect 내 가로 비율(0..1) */
  relX: number;
  /** 엘리먼트 rect 내 세로 비율(0..1) */
  relY: number;
  /** 옵셔널: 리액트 로직 위치(안쪽→바깥 named 컴포넌트 경로). 위치고정엔 안 쓰고 참고용 */
  reactPath?: string[];
  /** 옵셔널: dev-server/open-file 연동용 대표 component source */
  reactSource?: ReactSourceLocation;
}

/**
 * 구버전(단일 overlay) 앵커 — 이미 저장된 데이터 읽기 호환용.
 * resolve 시점에 scopeChain으로 정규화한다.
 */
export interface LegacyAnchor {
  scopeKind: "page" | "overlay";
  scopeKey?: string;
  selector: string;
  relX: number;
  relY: number;
  reactPath?: string[];
  reactSource?: ReactSourceLocation;
  triggerSelector?: string;
}

/** 저장소에서 읽을 수 있는 앵커(신/구 혼재) */
export type StoredAnchor = Anchor | LegacyAnchor;

export interface CommentThread {
  id: string;
  /** 핀이 찍힌 화면 키(pageKey) */
  path: string;
  /** 폴백: 레이아웃 가로폭 대비 위치(%) */
  xPct: number;
  /** 폴백: 문서(페이지) 절대 세로 위치(px) */
  yPx: number;
  /** 엘리먼트 앵커(있으면 우선). 못 찾으면 xPct/yPx 폴백. 구버전 데이터면 LegacyAnchor일 수 있음 */
  anchor?: StoredAnchor | null;
  resolved: boolean;
  comments: CommentEntry[];
}

const POLL_MS = 4000;

/** 스레드 쿼리 키 — 화면(path)별로 분리해 캐시/폴링/invalidate를 그 화면으로 한정한다 */
const threadsKey = (path: string) =>
  ["comment-widget", "threads", path] as const;

/**
 * 작성자 이름(개인 client state) — jotai atomWithStorage. localStorage 키는 고정(`comment-widget-name`):
 * 이름은 "나"라서 namespace(데모 인스턴스)와 무관하므로 모드/네임스페이스를 가로질러 공유한다.
 * getOnInit: 첫 렌더부터 저장값을 반영(기본은 default→effect 동기화라 한 프레임 깜빡임).
 */
export const userNameAtom = atomWithStorage<string>(
  "comment-widget-name",
  "",
  undefined,
  { getOnInit: true }
);

function uid() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** 현재 화면(path)의 스레드 — 서버에서 그 path만 가져온다(클라 필터 없음) */
export function useThreads(path: string): CommentThread[] {
  const supabase = useSupabaseClient();
  const { data } = useQuery({
    queryKey: threadsKey(path),
    queryFn: () => supabase.fetchThreads(path),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });
  return data ?? [];
}

/** 작성자 이름(읽기) — jotai atom */
export function useUserName(): string {
  return useAtomValue(userNameAtom);
}

/** 작성자 이름 설정 — jotai 세터(개인 client state, localStorage 자동 영속) */
export function useSetUserName(): (name: string) => void {
  return useSetAtom(userNameAtom);
}

/** 신규 스레드를 만드는 순수 팩토리(컴포넌트가 mutate에 넘긴다) */
export function createThread(input: {
  path: string;
  xPct: number;
  yPx: number;
  anchor: Anchor | null;
  text: string;
  author: string;
}): CommentThread {
  return {
    id: uid(),
    path: input.path,
    xPct: input.xPct,
    yPx: input.yPx,
    anchor: input.anchor,
    resolved: false,
    comments: [
      { id: uid(), author: input.author, text: input.text, at: Date.now() },
    ],
  };
}

/**
 * 스레드 목록을 바꾸는 낙관적 mutation 공통기(react-query 공식 "via the cache" 패턴).
 * 모든 변경은 vars.path의 캐시만 건드린다 → 다른 화면 캐시/폴링과 격리.
 *  - onMutate: cancel → 스냅샷 → 낙관적 next 계산·저장 → { previous, next } 반환
 *  - mutationFn: onMutate가 만든 next(낙관적 결과)를 그대로 받아 서버에 반영(캐시 재조회 없음)
 *  - onError: 스냅샷 롤백, onSettled: 그 path만 invalidate(Promise return → refetch까지 pending)
 */
function useThreadMutation<V extends { path: string }>(config: {
  optimistic: (prev: CommentThread[], vars: V) => CommentThread[];
  send: (
    client: SupabaseClient,
    vars: V,
    next: CommentThread[]
  ) => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const supabase = useSupabaseClient();
  return useMutation({
    onMutate: async (vars: V) => {
      const key = threadsKey(vars.path);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CommentThread[]>(key) ?? [];
      const next = config.optimistic(previous, vars);
      qc.setQueryData<CommentThread[]>(key, next);
      return { key, previous, next };
    },
    mutationFn: (vars: V) =>
      config.send(
        supabase,
        vars,
        qc.getQueryData<CommentThread[]>(threadsKey(vars.path)) ?? []
      ),
    onError: (_err, _vars, context) => {
      if (context) qc.setQueryData(context.key, context.previous);
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: threadsKey(vars.path) }),
  });
}

export const useAddThread = () =>
  useThreadMutation<CommentThread>({
    optimistic: (prev, thread) => [...prev, thread],
    send: (client, thread) => client.insertThread(thread),
  });

export const useAddComment = () =>
  useThreadMutation<{
    path: string;
    threadId: string;
    text: string;
    author: string;
  }>({
    optimistic: (prev, { threadId, text, author }) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              comments: [
                ...t.comments,
                { id: uid(), author, text, at: Date.now() },
              ],
            }
          : t
      ),
    send: (client, { threadId }, next) => {
      const t = next.find((x) => x.id === threadId);
      return t
        ? client.patchThread(threadId, { comments: t.comments })
        : Promise.resolve();
    },
  });

/** 기존 코멘트 본문 편집(재배치) */
export const useUpdateComment = () =>
  useThreadMutation<{
    path: string;
    threadId: string;
    commentId: string;
    text: string;
  }>({
    optimistic: (prev, { threadId, commentId, text }) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              comments: t.comments.map((c) =>
                c.id === commentId ? { ...c, text } : c
              ),
            }
          : t
      ),
    send: (client, { threadId }, next) => {
      const t = next.find((x) => x.id === threadId);
      return t
        ? client.patchThread(threadId, { comments: t.comments })
        : Promise.resolve();
    },
  });

/** 스레드 내 개별 코멘트 삭제. 마지막 코멘트를 지우면 스레드 자체를 제거(빈 스레드 방지) */
export const useDeleteComment = () =>
  useThreadMutation<{ path: string; threadId: string; commentId: string }>({
    optimistic: (prev, { threadId, commentId }) =>
      prev.flatMap((t) => {
        if (t.id !== threadId) return [t];
        const comments = t.comments.filter((c) => c.id !== commentId);
        return comments.length ? [{ ...t, comments }] : [];
      }),
    send: (client, { threadId }, next) => {
      const t = next.find((x) => x.id === threadId);
      return t
        ? client.patchThread(threadId, { comments: t.comments })
        : client.deleteThread(threadId);
    },
  });

export const useToggleResolved = () =>
  useThreadMutation<{ path: string; threadId: string }>({
    optimistic: (prev, { threadId }) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, resolved: !t.resolved } : t
      ),
    send: (client, { threadId }, next) => {
      const t = next.find((x) => x.id === threadId);
      return t
        ? client.patchThread(threadId, { resolved: t.resolved })
        : Promise.resolve();
    },
  });

export const useDeleteThread = () =>
  useThreadMutation<{ path: string; threadId: string }>({
    optimistic: (prev, { threadId }) => prev.filter((t) => t.id !== threadId),
    send: (client, { threadId }) => client.deleteThread(threadId),
  });

/** 핀 재앵커(재배치) — 기존 스레드를 새 위치/엘리먼트로 다시 잡는다 */
export const useUpdateAnchor = () =>
  useThreadMutation<{
    path: string;
    threadId: string;
    xPct: number;
    yPx: number;
    anchor: Anchor | null;
  }>({
    optimistic: (prev, { threadId, xPct, yPx, anchor }) =>
      prev.map((t) => (t.id === threadId ? { ...t, xPct, yPx, anchor } : t)),
    send: (client, { threadId, xPct, yPx, anchor }) =>
      client.patchThread(threadId, { x_pct: xPct, y_pct: yPx, anchor }),
  });
