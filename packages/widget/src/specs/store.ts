/**
 * 화면별 기획 문서 데이터 레이어 (PO/PD/BE/FE/QA 정렬용).
 * 한 화면(path)에 여러 문서(id)를 둘 수 있고, 본문은 자유 마크다운.
 *
 * QueryClient/SupabaseClient는 WidgetProvider가 Context로 주입(useSupabaseClient). 코멘트와
 * 같은 QueryClient를 공유한다. 읽기는 Supabase 폴링 useQuery + 파생 훅의 select, 쓰기는
 * react-query 공식 "via the cache" 낙관적 useMutation.
 * local/persist 모드는 폐기했고, 훅은 주입된 SupabaseClient만 호출한다.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import type { SupabaseClient } from "../supabase";
import { useSupabaseClient } from "../WidgetProvider";

export type SpecStatus = "DRAFT" | "REVIEW" | "CONFIRMED";

export const SPEC_STATUS_LABEL: Record<SpecStatus, string> = {
  DRAFT: "초안",
  REVIEW: "검토중",
  CONFIRMED: "확정",
};

/** 새 문서 기본 템플릿 (마크다운) — PO/PD/BE/FE/QA 정렬용 출발점, 자유 편집 가능 */
export const SPEC_TEMPLATE = `## 배경 / 목적
왜 이 문서가 필요한가

## 정책 · 규칙
- 비즈니스 규칙, 예외 케이스

## 화면 동작
- 상태/전이, 인터랙션, 빈 상태

## BE / API
- 엔드포인트, 데이터, 검증

## FE
- 컴포넌트, 상태관리, 엣지케이스

## QA 시나리오
- [ ] 체크리스트로 작성
`;

export interface SpecDoc {
  id: string;
  path: string;
  title: string;
  status: SpecStatus;
  /** 자유 마크다운 본문 */
  body: string;
  /** Google Docs 등 외부 문서 URL (있으면 iframe으로 표시) */
  externalUrl?: string;
  updatedBy: string;
  updatedAt: number;
}

const POLL_MS = 5000;

const specsKey = (path: string) => ["comment-widget", "specs", path] as const;

const LEGACY_SECTION_LABELS: Record<string, string> = {
  background: "배경 / 목적",
  policy: "정책 · 규칙",
  behavior: "화면 동작",
  backend: "BE / API",
  frontend: "FE",
  qa: "QA 시나리오",
};

/** 구버전(섹션 6분할) 문서를 마크다운 본문으로 변환 */
function sectionsToMarkdown(sections: Record<string, string>): string {
  const order = [
    "background",
    "policy",
    "behavior",
    "backend",
    "frontend",
    "qa",
  ];
  const rest = Object.keys(sections).filter((k) => !order.includes(k));
  return [...order.filter((k) => k in sections), ...rest]
    .map((k) => {
      const label = LEGACY_SECTION_LABELS[k] ?? k;
      const content = (sections[k] ?? "").trim();
      return content ? `## ${label}\n${content}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/** 어떤 형태로 저장돼 있든 정규화 (신규 body / 레거시 sections 모두 지원) */
export function normalizeDoc(raw: unknown): SpecDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d["id"] !== "string" || typeof d["path"] !== "string") return null;

  let body = "";
  if (typeof d["body"] === "string") {
    body = d["body"];
  } else if (d["sections"] && typeof d["sections"] === "object") {
    body = sectionsToMarkdown(d["sections"] as Record<string, string>);
  }

  return {
    id: d["id"] as string,
    path: d["path"] as string,
    title: typeof d["title"] === "string" ? (d["title"] as string) : "",
    status: (d["status"] as SpecStatus) ?? "DRAFT",
    body,
    externalUrl:
      typeof d["externalUrl"] === "string"
        ? (d["externalUrl"] as string)
        : undefined,
    updatedBy:
      typeof d["updatedBy"] === "string" ? (d["updatedBy"] as string) : "",
    updatedAt:
      typeof d["updatedAt"] === "number"
        ? (d["updatedAt"] as number)
        : Date.now(),
  };
}

function uid() {
  return `spec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * specs 쿼리 공유 옵션. 화면(path)별로 서버에서 그 문서만 가져온다.
 * 파생 훅은 이 옵션에 select만 얹어 필요한 슬라이스에만 구독한다.
 */
function specsQueryOptions(supabase: SupabaseClient, path: string) {
  return queryOptions({
    queryKey: specsKey(path),
    queryFn: () => supabase.fetchSpecs(path),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });
}

/**
 * 특정 화면의 문서 목록 쿼리 (최근 수정 순). path 필터는 서버가 했으므로 select는 정렬만.
 * useQuery 결과 전체를 반환 → 소비처에서 data/isLoading 사용.
 */
export function useSpecDocsForPath(path: string) {
  const supabase = useSupabaseClient();
  const select = useCallback(
    (docs: SpecDoc[]) => [...docs].sort((a, b) => b.updatedAt - a.updatedAt),
    []
  );
  return useQuery({ ...specsQueryOptions(supabase, path), select });
}

/** 단일 문서 쿼리(반응형) — 그 문서가 바뀔 때만 리렌더. useQuery 결과 전체 반환 */
export function useSpecDoc(path: string, id: string) {
  const supabase = useSupabaseClient();
  const select = useCallback(
    (docs: SpecDoc[]) => docs.find((d) => d.id === id),
    [id]
  );
  return useQuery({ ...specsQueryOptions(supabase, path), select });
}

/** 새 문서 팩토리(컴포넌트가 mutate 변수로 넘긴다) */
export function createSpecDoc(
  path: string,
  title: string,
  author: string
): SpecDoc {
  return {
    id: uid(),
    path,
    title: title.trim() || "새 문서",
    status: "DRAFT",
    body: SPEC_TEMPLATE,
    updatedBy: author || "",
    updatedAt: Date.now(),
  };
}

/** 외부 문서(Google Docs 등) 연결용 팩토리 */
export function createLinkedSpecDoc(
  path: string,
  title: string,
  externalUrl: string,
  author: string
): SpecDoc {
  return {
    id: uid(),
    path,
    title: title.trim() || "연결된 문서",
    status: "DRAFT",
    body: "",
    externalUrl,
    updatedBy: author || "",
    updatedAt: Date.now(),
  };
}

/**
 * 문서 목록을 바꾸는 낙관적 mutation 공통기. 모든 변경은 vars.path의 캐시만 건드린다.
 *  - onMutate: cancel → 스냅샷 → 낙관적 next 계산·저장 → { key, previous } 반환
 *  - mutationFn: onMutate가 만든 next를 캐시에서 읽어 서버에 반영
 *  - onError: 스냅샷 롤백, onSettled: 그 path만 invalidate(refetch까지 pending)
 */
function useSpecMutation<V extends { path: string }>(config: {
  optimistic: (prev: SpecDoc[], vars: V) => SpecDoc[];
  send: (client: SupabaseClient, vars: V, next: SpecDoc[]) => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const supabase = useSupabaseClient();
  return useMutation({
    onMutate: async (vars: V) => {
      const key = specsKey(vars.path);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<SpecDoc[]>(key) ?? [];
      qc.setQueryData<SpecDoc[]>(key, config.optimistic(previous, vars));
      return { key, previous };
    },
    mutationFn: (vars: V) =>
      config.send(
        supabase,
        vars,
        qc.getQueryData<SpecDoc[]>(specsKey(vars.path)) ?? []
      ),
    onError: (_err, _vars, context) => {
      if (context) qc.setQueryData(context.key, context.previous);
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: specsKey(vars.path) }),
  });
}

export const useCreateSpec = () =>
  useSpecMutation<SpecDoc>({
    optimistic: (prev, doc) => [...prev, doc],
    send: (client, doc) => client.upsertSpec(doc),
  });

export const useSaveSpec = () =>
  useSpecMutation<{
    path: string;
    id: string;
    patch: {
      title?: string;
      body?: string;
      status?: SpecStatus;
      externalUrl?: string;
    };
    author: string;
  }>({
    optimistic: (prev, { id, patch, author }) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              title: patch.title ?? d.title,
              status: patch.status ?? d.status,
              body: patch.body ?? d.body,
              externalUrl: patch.externalUrl ?? d.externalUrl,
              updatedBy: author || d.updatedBy,
              updatedAt: Date.now(),
            }
          : d
      ),
    send: (client, { id }, next) => {
      const d = next.find((x) => x.id === id);
      return d ? client.upsertSpec(d) : Promise.resolve();
    },
  });

export const useDeleteSpec = () =>
  useSpecMutation<{ path: string; id: string }>({
    optimistic: (prev, { id }) => prev.filter((d) => d.id !== id),
    send: (client, { id }) => client.deleteSpec(id),
  });
