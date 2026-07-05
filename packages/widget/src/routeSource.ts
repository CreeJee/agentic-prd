/**
 * 화면 키/라벨 해석 — 라우터 비의존.
 *
 * 우선순위: `pageKey` prop > `config.routeSource` > `browserRouteSource()`.
 *  - prop: 호스트가 리렌더로 라우트 변경을 반영(어떤 라우터든 — browser/hash/memory 무관).
 *  - routeSource: prop 없이 위젯이 스스로 라우트를 관찰해야 할 때 호스트가 주입하는 어댑터.
 *  - browserRouteSource: 라우터가 없는 순수 브라우저 임베드용 기본값(history + popstate).
 *
 * 기존 usePageKey의 전역 history 몽키패치를 "기본 동작"에서 떼어내 옵트인 어댑터로 옮긴 형태다.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

/** 호스트(라우터)와 연동하는 라우트 관찰 어댑터. */
export interface RouteSource {
  /** 현재 화면 키(코멘트 그룹화 단위, 보통 pathname). */
  getPageKey: () => string;
  /** 현재 화면 라벨(없으면 키를 그대로 표기). */
  getPageLabel?: () => string;
  /** 라우트 변경 구독(반환값은 해지 함수). 없으면 1회성으로만 읽는다. */
  subscribe?: (onChange: () => void) => () => void;
}

const NOOP = () => {};

/**
 * 라우터 없는 브라우저 호스트용 기본 어댑터.
 * history(pushState/replaceState) + popstate를 가로채 SPA 내비게이션을 감지한다.
 * memory/hash 라우터처럼 history API를 못 쓰는 환경은 `pageKey` prop이나 별도 어댑터로 연동한다.
 */
export function browserRouteSource(): RouteSource {
  return {
    getPageKey: () =>
      typeof window !== "undefined" ? window.location.pathname : "",
    subscribe: (onChange) => {
      if (typeof window === "undefined") return NOOP;
      const origPush = history.pushState;
      const origReplace = history.replaceState;
      history.pushState = function pushState(this: History, ...args) {
        origPush.apply(this, args);
        onChange();
      } as typeof history.pushState;
      history.replaceState = function replaceState(this: History, ...args) {
        origReplace.apply(this, args);
        onChange();
      } as typeof history.replaceState;
      window.addEventListener("popstate", onChange);
      return () => {
        history.pushState = origPush;
        history.replaceState = origReplace;
        window.removeEventListener("popstate", onChange);
      };
    },
  };
}

/**
 * pageKey/pageLabel을 해석한다. prop이 주어지면 그 값을 쓰고(호스트 리렌더가 반영),
 * 없으면 routeSource(없으면 browserRouteSource)를 구독해 화면 변경을 추종한다.
 */
export function useRouteKey(
  pageKeyProp: string | undefined,
  pageLabelProp: string | undefined,
  routeSource: RouteSource | undefined
): { pageKey: string; pageLabel: string } {
  const source = useMemo(
    () => routeSource ?? browserRouteSource(),
    [routeSource]
  );
  const usingSource = pageKeyProp === undefined;

  const subscribe = useCallback(
    (onChange: () => void) =>
      usingSource && source.subscribe ? source.subscribe(onChange) : NOOP,
    [usingSource, source]
  );
  const getSnapshot = useCallback(
    () => (usingSource ? source.getPageKey() : ""),
    [usingSource, source]
  );
  const sourceKey = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const pageKey = pageKeyProp ?? sourceKey;
  const pageLabel =
    pageLabelProp ??
    (usingSource ? source.getPageLabel?.() : undefined) ??
    pageKey;
  return { pageKey, pageLabel };
}
