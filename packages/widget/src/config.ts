import type { RouteSource } from "./routeSource";
import type { StorageAdapter } from "./storage";

/**
 * `<CommentWidget config={...} />`에 주입하는 설정. 전부 optional —
 * 기본값은 dev 서버의 @agentic-prd/dev-plugin 미들웨어를 저장소로 쓰는
 * zero-config 동작이다.
 */
export interface CommentWidgetConfig {
  /** 코멘트/기획문서 저장소 어댑터. 미지정 시 devServerStorage() */
  storage?: StorageAdapter;
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
