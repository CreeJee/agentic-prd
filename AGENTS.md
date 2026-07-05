# agentic-prd — Agent Guide

Drop-in **코멘트 핀 + 기획문서** 오버레이 위젯. 스레드 코멘트를 임의 DOM 엘리먼트에 앵커(모달·중첩 오버레이 내부 포함)하고, 화면(path)별 기획문서를 단다. 저장소는 **Supabase 단일 원천**. 호스트 앱(어떤 React 앱이든)이 라우팅/인증을 제공하고 위젯을 임베드한다.

소비:

```tsx
<CommentWidget
  config={{ storage: { url, publicKey }, currentUser?, zIndexBase?, routeSource? }}
  pageKey={pathname}        // 호스트가 라우트별로 주입
  pageLabel={screenLabel}
/>
```

## Commands

저장소 루트에서 실행:

```bash
pnpm typecheck                              # tsgo -p ./tsconfig.json --noEmit (필수 게이트)
pnpm exec biome check --fix <path>          # 단일 파일 정리
pnpm lint                                   # biome check . --diagnostic-level=error --max-diagnostics=200
pnpm play                                   # vite 플레이그라운드(데모 supabase)
pnpm dev                                    # tsdown --watch
pnpm build                                  # tsdown 번들
pnpm test                                   # vitest
```

검증 기준: **typecheck 0 + biome(error) 클린**. 번들 확인은 build, 런타임은 play(실키보드/마우스). typecheck는 `tsgo`(typescript-native-preview) 기반이라 표준 `tsc`보다 훨씬 빠르지만 동일 옵션(`tsconfig.json`)을 사용한다.

## Do

- **JSDoc만 작성, `//` 인라인 주석 금지**. `database.types.ts`(자동생성)는 예외.
- `@tsconfig/strictest` (noUncheckedIndexedAccess ON) — 배열/객체 인덱스 접근은 가드.
- **모든 `@lexical/*` + `lexical`을 단일 버전(현재 0.46.0)으로 유지** — 버전 스큐는 표 함수가 다른 selection store를 읽어 조용히 깨진다(예: 삽입이 항상 첫 셀).
- UI 프리미티브는 **`@base-ui/react` 기반 로컬 shadcn**(`src/components/ui/*`, `components.json`의 `base-sera` 스타일) 재사용. 신규 프리미티브가 필요하면 `pnpm dlx shadcn add ...` 로 로컬에 추가. 아이콘은 `lucide-react`.
- 앵커는 **insert·patch 양쪽 모두 저장**(`insertThread`/`patchThread` 둘 다 `anchor` 컬럼) — 빠지면 절대좌표로 고정돼 콘텐츠 추종 안 함.
- 새 dep 추가 후 play가 vite deps 재최적화로 한 번 죽을 수 있음 → 재부팅.

## Don't

- 모듈 싱글톤 금지 — 의존성은 `WidgetProvider`가 Context로 주입.
- 절대좌표만으로 핀 고정 금지 — 엘리먼트 앵커(scope chain) 우선, 좌표는 폴백.
- `resolvePoint`(rAF 매 프레임 경로)에 레이아웃 읽기(`getComputedStyle`/`isFocusable` 등) 넣지 말 것.
- secrets/`.env` 커밋 금지. **커밋·푸시는 사용자가 명시 요청할 때만.**

## 핵심 아키텍처

- **server state = react-query / client state = jotai.** 스레드·기획문서는 Supabase 원천 → `useQuery` 폴링(코멘트 4s, 스펙 5s, `refetchIntervalInBackground: true`) + 낙관적 `useMutation`("via the cache": onMutate 스냅샷/setQueryData → onError 롤백 → onSettled invalidate). 작성자 이름은 개인값 → jotai `atomWithStorage`.
- **DI = WidgetProvider.** 렌더 시점 useMemo로 QueryClient·SupabaseClient 생성, Context 주입. 훅은 `useSupabaseClient()`.
- **supabase-only.** `@supabase/supabase-js` 단일 클라가 comments + specs 담당. local/persist 모드 없음.
- **path별 쿼리키** `["comment-widget", "threads"|"specs", path]` — payload·폴링·invalidate를 활성 화면으로 한정.
- **pageKey/pageLabel 해석:** prop > `config.routeSource` > `browserRouteSource()`. props가 1순위라 어떤 라우터(browser/hash/memory)든 호스트 리렌더로 커버. 라우터 없는 임베드는 `browserRouteSource`(history+popstate) 폴백.
- **에디터 = lexical(0.46).** `MarkdownEditor`가 작성/답글/편집/읽기 겸용, **제어형 `value`**(마크다운 in/out, 에코 가드). 폼은 **react-hook-form + valibot + Controller**. 코멘트/스레드는 툴바 없음(마크다운 단축만), 기획문서(`SpecPanel` 내부 편집 트리)만 `toolbar="full"`.
- **닉네임 필수.** 작성자 이름 미설정이면 툴바 "코멘트" 버튼 비활성. 작성 폼엔 이름 입력 없음(툴바에서만 설정).
- **드래그 툴바 = dnd-kit**, **패널 lifecycle = widget-local overlay-kit context**(`experimental_createOverlayContext`).

## 구조

```
src/
  CommentWidget.tsx       # 오케스트레이터(캔버스 상태/캡처/클러스터링) + Surface + ToolbarController
  WidgetProvider.tsx      # QueryClient+SupabaseClient 주입
  config.ts               # CommentWidgetConfig
  cn.ts / format.ts       # 위젯 로컬 헬퍼(cn = tailwind-merge/clsx)
  lib/utils.ts            # shadcn 규약의 cn 헬퍼(로컬 shadcn 프리미티브가 사용)
  database.types.ts       # supabase gen types (자동생성)
  store.ts                # 코멘트 react-query 훅 + jotai userName
  supabase.ts             # @supabase/supabase-js 단일 클라(comments+specs)
  routeSource.ts          # RouteSource 어댑터 + browserRouteSource + useRouteKey
  panelRuntime.tsx        # overlay-kit context + WidgetPanelRuntimeProvider(path/thread/author 공급)
  panelOverlays.tsx       # CommentPanel/SpecPanel overlay controllers
  anchor/                 # 앵커 캡처/해석(scope chain·occlusion·cluster)
    capture.ts constants.ts fiber.ts index.ts overlays.ts resolve.ts selectors.ts
  canvas/                 # 캔버스 렌더 블록 (barrel: index.ts)
    CommentCanvasLayer.tsx DraftThreadComposer.tsx ExpandedClusterPopover.tsx
    OpenThreadPopover.tsx PinClusters.tsx PlacementGuide.tsx types.ts
  components/             # 상위 컴포넌트 (barrel: index.ts)
    CommentToolbar.tsx CommentPanel.tsx DraftComposer.tsx DraggableToolbar.tsx
    MarkdownEditor.tsx MarkdownToolbar.tsx markdownTransformers.ts
    Pin.tsx PointPopover.tsx ThreadPopover.tsx
    ClusterBadge.tsx ClusterPopover.tsx
    table/                # TableCellResizer / TableHoverActions / TableActionMenu(로컬 dropdown-menu) / useDebounce
    ui/                   # base-ui/shadcn 프리미티브 (button/dialog/dropdown-menu/popover/select)
  hooks/                  # (barrel: index.ts) useCommentCapture / useOverlayTracker / usePinTracking(rAF) / useCrosshair / useEscClose
  specs/                  # 기획문서 store + SpecPanel(RHF+valibot, debounce 자동저장, 편집 트리 내부 통합)
```

DB(Supabase, `supabase/` 마이그레이션): `demo_comments`(id, path, x_pct, y_pct, anchor, resolved, comments, updated_at) · `demo_specs`(id, path, title, status, sections, updated_by, updated_at). 본문은 `sections.body`(마크다운).

## 마크다운 / 표 / 체크리스트

- 트랜스포머: `BASE_TRANSFORMERS = [CHECK_LIST, ...TRANSFORMERS]` (체크리스트는 기본 `TRANSFORMERS`에 없어 명시 추가). full 툴바는 `MD_TRANSFORMERS = [TABLE, ...BASE_TRANSFORMERS]`.
- 표(full만): `@lexical/table` + `<TablePlugin hasCellMerge hasCellBackgroundColor hasHorizontalScroll />` + 포팅한 `TableCellResizer`(열폭/행높이) · `TableHoverActions`(행/열 추가) · `TableActionMenu`(셀 메뉴, 로컬 `components/ui/dropdown-menu`). GFM 표 마크다운은 커스텀 `TABLE` ElementTransformer로 왕복. 셀 드래그선택은 `<TablePlugin>`이 `registerTableSelectionObserver`를 내부 등록(별도 플러그인 없음).
- 필요한 테마 키: `tableScrollableWrapper`(hasHorizontalScroll 래퍼), `tableSelection`/`tableCellSelected`(드래그선택 하이라이트), `listitemChecked`/`listitemUnchecked`(체크박스는 lexical이 안 그림 → `::before`/`::after`로 그림).

## 함정

- **window-capture 공존:** `useCommentCapture`가 window pointerdown/click/focus를 캡처해 호스트 Radix/base-ui DismissableLayer/FocusScope와 공존. 우리 UI는 `[data-comment-root]`. **dnd-kit 드래그 핸들·overlay 트리거(합성 pointerdown에 동작)는 `[data-comment-no-capture]` 표시 필수** — 안 하면 stopPropagation이 막아 동작 안 함.
- **overlay 셀렉터 실체:** `src/anchor/constants.ts`의 `OVERLAY_SEL`은 `[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]`. 스코프 체인·가림 판정은 이 셋을 기준으로 한다.
- **dnd 위치 커밋:** raw `delta`(클램프 전) 대신 `active.rect.current.translated`(modifier 클램프됨) 사용 — 안 그러면 멀리 드래그 시 화면 밖으로.
- **trigger 탐지:** `useCommentCapture`가 클릭 지점의 가장 가까운 focusable 조상(`tabbable.isFocusable`), 없으면 raw target을 `lastActivated`로 기록. 유효성은 `triggerForOverlay`가 isConnected·overlay 밖·UI 밖으로 게이팅.
- **Tailwind v4:** `z-99990` 류 bare numeric은 v4 dynamic value로 생성됨. 위젯은 자체 CSS를 싣지 않고 호스트 Tailwind가 스캔 → 호스트 앱의 Tailwind entry에 `@source` 위젯 src 필요. 플레이그라운드는 `playground/src/style.css`에서 `@source "../../src"` 로 처리됨.
- 백그라운드 탭은 rAF 정지 → 핀 "안 그려짐"처럼 보임(포그라운드로 검증). dnd/IME는 자동화로 트리거 안 됨 → 실키보드/마우스.

## 참고 문서

이 저장소의 설계 결정/드리프트 기록은 `docs/superpowers/specs/`에 남긴다.

- `docs/superpowers/specs/2026-07-05-agents-md-drift-sync-design.md` — 이 문서와 CLAUDE.md의 실체 반영 설계(현행).
