/**
 * 위젯 루트 Provider — config로부터 QueryClient와 SupabaseClient를 렌더 시점에 만들어 주입한다.
 * 모듈 싱글톤/imperative init을 두지 않고 React Context로 의존성을 내려준다.
 *  - QueryClient: 코멘트+기획문서가 공유. 호스트의 react-query와 격리.
 *  - SupabaseClient: 단일 원천(server). 훅이 queryFn/mutation에서 useSupabaseClient로 읽는다.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { CommentWidgetConfig } from "./config";
import { createSupabaseClient, type SupabaseClient } from "./supabase";

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

const SupabaseContext = createContext<SupabaseClient | null>(null);

/** 현재 SupabaseClient. WidgetProvider 안에서만 호출(없으면 throw). */
export function useSupabaseClient(): SupabaseClient {
  const client = useContext(SupabaseContext);
  if (!client) {
    throw new Error("useSupabaseClient must be used within <WidgetProvider>");
  }
  return client;
}

export function WidgetProvider({
  config,
  children,
}: {
  config: CommentWidgetConfig;
  children: ReactNode;
}) {
  const queryClient = useMemo(createWidgetQueryClient, []);
  const supabase = useMemo(
    () => createSupabaseClient(config.storage),
    [config.storage]
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseContext.Provider value={supabase}>
        {children}
      </SupabaseContext.Provider>
    </QueryClientProvider>
  );
}
