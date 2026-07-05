import type { RouteSource } from "./routeSource";
import type { SupabaseStorageConfig } from "./supabase";

/**
 * `<CommentWidget config={...} />`에 주입하는 설정.
 * 위젯을 특정 앱(Supabase 크레덴셜, 디자인 토큰 등)에서 떼어내기 위한 경계.
 * 저장소는 Supabase 단일 원천이며, 크레덴셜은 호스트가 주입한다(하드코딩 없음).
 */
export interface CommentWidgetConfig {
  /** 코멘트/기획문서 저장소 — Supabase 크레덴셜 */
  storage: SupabaseStorageConfig;
  /** 초기 작성자 이름(미지정 시 위젯이 입력받아 localStorage에 보관) */
  currentUser?: { name?: string };
  /** 위젯 레이어 z-index 베이스(기본 99990) */
  zIndexBase?: number;
  /**
   * `pageKey` prop 없이 위젯이 스스로 라우트를 관찰해야 할 때 쓰는 어댑터.
   * 미지정 시 순수 브라우저 환경에선 `browserRouteSource()`로 폴백한다.
   * (우선순위: pageKey prop > routeSource > browserRouteSource)
   */
  routeSource?: RouteSource;
}
