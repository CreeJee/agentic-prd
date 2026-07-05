/**
 * lexical-playground의 useDebounce 대체(es-toolkit `debounce` 기반).
 * 최신 콜백을 ref로 잡아 디바운스 함수 재생성 없이 항상 최신 동작을 부르고,
 * `.cancel()`로 보류 호출을 취소한다(언마운트/리스너 해제 시).
 */
import { debounce } from "es-toolkit";
import { useMemo, useRef } from "react";

export function useDebounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number
): { (...args: Args): void; cancel: () => void } {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useMemo(
    () => debounce((...args: Args) => fnRef.current(...args), ms),
    [ms]
  );
}
