/**
 * 위젯 루트 Provider — config로부터 QueryClient와 StorageAdapter를 렌더 시점에 만들어 주입한다.
 * 모듈 싱글톤/imperative init을 두지 않고 React Context로 의존성을 내려준다.
 *  - QueryClient: 코멘트+기획문서가 공유. 호스트의 react-query와 격리.
 *  - StorageAdapter: 단일 원천(server). 훅이 queryFn/mutation에서 useStorageAdapter로 읽는다.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from "react";
import type { CommentWidgetConfig } from "./config";
import { devServerStorage, type StorageAdapter } from "./storage";

function createWidgetQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

const StorageContext = createContext<StorageAdapter | null>(null);

/** 현재 StorageAdapter. WidgetProvider 안에서만 호출(없으면 throw). */
export function useStorageAdapter(): StorageAdapter {
  const adapter = useContext(StorageContext);
  if (!adapter) {
    throw new Error("useStorageAdapter must be used within <WidgetProvider>");
  }
  return adapter;
}

interface WidgetPortalState {
  container: HTMLElement | null;
  setContainer: Dispatch<SetStateAction<HTMLElement | null>>;
}

const WidgetPortalContext = createContext<WidgetPortalState | null>(null);

/** overlay 들이 위젯 canvas 안으로 portal 하도록 하는 컨테이너 ref. WidgetProvider 안에서만 유효. */
export function useWidgetPortalContainer(): HTMLElement | null {
  return useContext(WidgetPortalContext)?.container ?? null;
}

/** 위젯 루트에서 사용. portal 대상 DOM 노드를 등록한다. */
export function useSetWidgetPortalContainer(): Dispatch<
  SetStateAction<HTMLElement | null>
> {
  const ctx = useContext(WidgetPortalContext);
  if (!ctx) {
    throw new Error(
      "useSetWidgetPortalContainer must be used within <WidgetProvider>"
    );
  }
  return ctx.setContainer;
}

export function WidgetProvider({
  config,
  children,
}: {
  config?: CommentWidgetConfig;
  children: ReactNode;
}) {
  const queryClient = useMemo(createWidgetQueryClient, []);
  const configStorage = config?.storage;
  const storage = useMemo(
    () => configStorage ?? devServerStorage(),
    [configStorage]
  );
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const portalValue = useMemo(() => ({ container, setContainer }), [container]);
  return (
    <QueryClientProvider client={queryClient}>
      <StorageContext.Provider value={storage}>
        <WidgetPortalContext.Provider value={portalValue}>
          {children}
        </WidgetPortalContext.Provider>
      </StorageContext.Provider>
    </QueryClientProvider>
  );
}
