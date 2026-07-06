# agentic-prd — Agent Guide (monorepo)

pnpm + turborepo 모노레포. 두 개의 배포 패키지와 하나의 데모 앱, 하나의 Claude Code skill 로 구성된다.

- `@agentic-prd/widget` (`packages/widget`) — Drop-in **코멘트 핀 + 기획문서** 오버레이 위젯. 스레드 코멘트를 임의 DOM 엘리먼트에 앵커(모달·중첩 오버레이 내부 포함)하고, 화면(path)별 기획문서를 단다. 저장소는 **Supabase 단일 원천**. 호스트 앱(어떤 React 앱이든)이 라우팅/인증을 제공하고 위젯을 임베드한다.
- `@agentic-prd/dev-plugin` (`packages/dev-plugin`) — dev 전용 사이드카 Vite 플러그인. Vite dev 서버 안 미들웨어로 Supabase 데이터를 로컬 HTTP 로 노출해 Claude Code skill 이 소비. 별도 프로세스 없음.
- `agentic-prd-playground` (`apps/playground`, private) — 위젯 + dev-plugin 을 붙여 돌리는 개발용 데모 앱.
- `plugins/agentic-prd-skill/` — 위 dev-plugin 을 자연어로 두드리는 Claude Code skill (npm 패키지 아님).

위젯 소비:

```tsx
<CommentWidget
  config={{ storage: { url, publicKey }, currentUser?, zIndexBase?, routeSource? }}
  pageKey={pathname}        // 호스트가 라우트별로 주입
  pageLabel={screenLabel}
/>
```

## Commands

pnpm 워크스페이스 루트에서 실행:

```bash
pnpm typecheck                              # turbo run typecheck (모든 패키지)
pnpm lint                                   # turbo run lint
pnpm test                                   # turbo run test
pnpm build                                  # turbo run build
pnpm play                                   # turbo run play --filter agentic-prd-playground
```

특정 패키지만:

```bash
pnpm --filter @agentic-prd/widget typecheck
pnpm --filter @agentic-prd/dev-plugin test
pnpm --filter agentic-prd-playground play
```

biome 은 워크스페이스 루트 `biome.json` 을 공유하며 각 패키지가 자기 scope 로 호출한다.

검증 기준: **typecheck 0 + biome(error) 클린**. 번들 확인은 build, 런타임은 play(실키보드/마우스). typecheck 는 `tsgo`(typescript-native-preview) 기반이라 표준 `tsc` 보다 훨씬 빠르지만 동일 옵션(`tsconfig.base.json` 확장) 을 사용한다.

## Do

- **JSDoc 만 작성, `//` 인라인 주석 금지**. `database.types.ts`(자동생성) 는 예외.
- `@tsconfig/strictest` (noUncheckedIndexedAccess ON) — 배열/객체 인덱스 접근은 가드.
- **모든 `@lexical/*` + `lexical` 을 단일 버전(현재 0.46.0)으로 유지** — 버전 스큐는 표 함수가 다른 selection store 를 읽어 조용히 깨진다(예: 삽입이 항상 첫 셀).
- UI 프리미티브는 **`@base-ui/react` 기반 로컬 shadcn**(`packages/widget/src/components/ui/*`, `components.json` 의 `base-sera` 스타일) 재사용. 신규 프리미티브가 필요하면 `pnpm dlx shadcn add ...` 로 로컬에 추가. 아이콘은 `lucide-react`.
- 앵커는 **insert·patch 양쪽 모두 저장**(`insertThread`/`patchThread` 둘 다 `anchor` 컬럼) — 빠지면 절대좌표로 고정돼 콘텐츠 추종 안 함.
- 새 dep 추가 후 play 가 vite deps 재최적화로 한 번 죽을 수 있음 → 재부팅.
- **`@agentic-prd/dev-plugin` 은 dev 전용 사이드카**. Vite `configureServer` 훅으로 dev 서버 안에서만 동작하고 `build` 아웃풋에 안 실린다. Claude Code skill 이 로컬 HTTP 로 소비하는 게 유일한 목적.

## Don't

- 모듈 싱글톤 금지 — 의존성은 `WidgetProvider` 가 Context 로 주입.
- 절대좌표만으로 핀 고정 금지 — 엘리먼트 앵커(scope chain) 우선, 좌표는 폴백.
- `resolvePoint`(rAF 매 프레임 경로) 에 레이아웃 읽기(`getComputedStyle`/`isFocusable` 등) 넣지 말 것.
- secrets/`.env` 커밋 금지. **커밋·푸시는 사용자가 명시 요청할 때만.**

## 핵심 아키텍처

아래는 모두 `packages/widget` 내부 얘기. (경로가 `src/…` 로 표기되면 `packages/widget/src/…` 로 읽는다.)

- **server state = react-query / client state = jotai.** 스레드·기획문서는 Supabase 원천 → `useQuery` 폴링(코멘트 4s, 스펙 5s, `refetchIntervalInBackground: true`) + 낙관적 `useMutation`("via the cache": onMutate 스냅샷/setQueryData → onError 롤백 → onSettled invalidate). 작성자 이름은 개인값 → jotai `atomWithStorage`.
- **DI = WidgetProvider.** 렌더 시점 useMemo 로 QueryClient·SupabaseClient 생성, Context 주입. 훅은 `useSupabaseClient()`.
- **supabase-only.** `@supabase/supabase-js` 단일 클라가 comments + specs 담당. local/persist 모드 없음.
- **path 별 쿼리키** `["comment-widget", "threads"|"specs", path]` — payload·폴링·invalidate 를 활성 화면으로 한정.
- **pageKey/pageLabel 해석:** prop > `config.routeSource` > `browserRouteSource()`. props 가 1순위라 어떤 라우터(browser/hash/memory) 든 호스트 리렌더로 커버. 라우터 없는 임베드는 `browserRouteSource`(history+popstate) 폴백.
- **에디터 = lexical(0.46).** `MarkdownEditor` 가 작성/답글/편집/읽기 겸용, **제어형 `value`**(마크다운 in/out, 에코 가드). 폼은 **react-hook-form + valibot + Controller**. 코멘트/스레드는 툴바 없음(마크다운 단축만), 기획문서(`SpecPanel` 내부 편집 트리) 만 `toolbar="full"`.
- **닉네임 필수.** 작성자 이름 미설정이면 툴바 "코멘트" 버튼 비활성. 작성 폼엔 이름 입력 없음(툴바에서만 설정).
- **드래그 툴바 = dnd-kit**, **패널 lifecycle = widget-local overlay-kit context**(`experimental_createOverlayContext`).

## 구조

```
agentic-prd/
├─ package.json              # workspace root, "private": true
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json        # 공용 컴파일러 옵션
├─ biome.json                # 공용 lint/format
├─ apps/
│  └─ playground/            # agentic-prd-playground (private) — 커머스 데모 + 앵커 시험장
│     ├─ package.json        # deps: @agentic-prd/widget, @agentic-prd/dev-plugin, react-router
│     ├─ vite.config.ts      # agenticPRDDev({...}) 사이드카. storage 는 VITE_SUPABASE_* env 로 오버라이드(실 process env 만 — .env 파일은 config 평가 시점에 미로드)
│     ├─ playwright.config.ts # 시드 전용 e2e — turbo test 미편입, `pnpm --filter agentic-prd-playground test:e2e` (로컬 supabase 필요)
│     ├─ e2e/                # local-supabase.ts(로컬 키 상수) · global-setup.ts(truncate+PRD 시드) · seed-comments.spec.ts(실제 위젯 UI 로 코멘트 시드)
│     └─ src/
│        ├─ App.tsx          # 네비 레이아웃 + Routes + CommentWidget(pageKey=pathname 주입)
│        ├─ supabaseEnv.ts   # env → storage 해석 (앱 import.meta.env / vite.config process.env 공유)
│        ├─ data.ts cart.tsx # 데모 상품 데이터 · 장바구니 Context
│        └─ routes/          # Products / Cart / Checkout / KitchenSink(/_kitchen-sink 앵커 회귀 시험)
├─ packages/
│  ├─ widget/                # @agentic-prd/widget (npm public)
│  │  ├─ package.json
│  │  ├─ tsconfig.json       # extends tsconfig.base.json
│  │  ├─ tsdown.config.ts
│  │  └─ src/                # ← 아래 위젯 트리
│  │     ├─ CommentWidget.tsx    # 오케스트레이터(캔버스 상태/캡처/클러스터링) + Surface + ToolbarController
│  │     ├─ WidgetProvider.tsx   # QueryClient+SupabaseClient 주입
│  │     ├─ config.ts            # CommentWidgetConfig
│  │     ├─ cn.ts / format.ts    # 위젯 로컬 헬퍼(cn = tailwind-merge/clsx)
│  │     ├─ lib/utils.ts         # shadcn 규약의 cn 헬퍼(로컬 shadcn 프리미티브가 사용)
│  │     ├─ database.types.ts    # supabase gen types (자동생성)
│  │     ├─ store.ts             # 코멘트 react-query 훅 + jotai userName
│  │     ├─ supabase.ts          # @supabase/supabase-js 단일 클라(comments+specs)
│  │     ├─ routeSource.ts       # RouteSource 어댑터 + browserRouteSource + useRouteKey
│  │     ├─ panelRuntime.tsx     # overlay-kit context + WidgetPanelRuntimeProvider(path/thread/author 공급)
│  │     ├─ panelOverlays.tsx    # CommentPanel/SpecPanel overlay controllers
│  │     ├─ anchor/              # 앵커 캡처/해석(scope chain·occlusion·cluster)
│  │     │  capture.ts constants.ts fiber.ts index.ts overlays.ts resolve.ts selectors.ts
│  │     ├─ canvas/              # 캔버스 렌더 블록 (barrel: index.ts)
│  │     │  CommentCanvasLayer.tsx DraftThreadComposer.tsx ExpandedClusterPopover.tsx
│  │     │  OpenThreadPopover.tsx PinClusters.tsx PlacementGuide.tsx types.ts
│  │     ├─ components/          # 상위 컴포넌트 (barrel: index.ts)
│  │     │  CommentToolbar.tsx CommentPanel.tsx DraftComposer.tsx DraggableToolbar.tsx
│  │     │  MarkdownEditor.tsx MarkdownToolbar.tsx markdownTransformers.ts
│  │     │  Pin.tsx PointPopover.tsx ThreadPopover.tsx
│  │     │  ClusterBadge.tsx ClusterPopover.tsx
│  │     │  table/               # TableCellResizer / TableHoverActions / TableActionMenu(로컬 dropdown-menu) / useDebounce
│  │     │  ui/                  # base-ui/shadcn 프리미티브 (button/dialog/dropdown-menu/popover/select)
│  │     ├─ hooks/               # (barrel: index.ts) useCommentCapture / useOverlayTracker / usePinTracking(rAF) / useCrosshair / useEscClose
│  │     └─ specs/               # 기획문서 store + SpecPanel(RHF+valibot, debounce 자동저장, 편집 트리 내부 통합)
│  └─ dev-plugin/            # @agentic-prd/dev-plugin (npm public, dev 전용 사이드카)
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ tsdown.config.ts    # platform: "node"
│     └─ src/
│        ├─ index.ts         # export default agenticPRDDev(options)
│        ├─ plugin.ts        # Vite Plugin object (configureServer)
│        ├─ router.ts        # method/path → handler
│        ├─ handlers/        # threads.ts / specs.ts
│        ├─ supabase.ts      # server-side @supabase/supabase-js
│        ├─ anchor-resolver.ts
│        ├─ slug.ts
│        ├─ manifest.ts
│        └─ types.ts
├─ plugins/
│  └─ agentic-prd-skill/     # Claude Code skill (npm 아님, 심링크/복사로 배포)
│     ├─ plugin.json
│     ├─ skills/agentic-prd.md
│     └─ commands/…
├─ supabase/
│  ├─ config.toml
│  └─ migrations/            # 로컬 스택용 스키마 재현 (20260707000000_demo_tables.sql — 테이블+RLS+GRANT)
└─ docs/
   └─ superpowers/specs/     # 설계/드리프트 기록
```

DB(Supabase): `demo_comments`(id, path, x_pct, y_pct, anchor, resolved, comments, updated_at) · `demo_specs`(id, path, title, status, sections, updated_by, updated_at). 본문은 `sections.body`(마크다운). 로컬 스택은 `supabase start`(docker) 로 기동하며 `supabase/migrations/` 가 자동 적용된다 — RLS 정책만으로는 부족하고 **테이블 GRANT(anon/authenticated/service_role)까지 있어야** 위젯/시드가 동작한다.

## 마크다운 / 표 / 체크리스트

- 트랜스포머: `BASE_TRANSFORMERS = [CHECK_LIST, ...TRANSFORMERS]` (체크리스트는 기본 `TRANSFORMERS` 에 없어 명시 추가). full 툴바는 `MD_TRANSFORMERS = [TABLE, ...BASE_TRANSFORMERS]`.
- 표(full 만): `@lexical/table` + `<TablePlugin hasCellMerge hasCellBackgroundColor hasHorizontalScroll />` + 포팅한 `TableCellResizer`(열폭/행높이) · `TableHoverActions`(행/열 추가) · `TableActionMenu`(셀 메뉴, 로컬 `components/ui/dropdown-menu`). GFM 표 마크다운은 커스텀 `TABLE` ElementTransformer 로 왕복. 셀 드래그선택은 `<TablePlugin>` 이 `registerTableSelectionObserver` 를 내부 등록(별도 플러그인 없음).
- 필요한 테마 키: `tableScrollableWrapper`(hasHorizontalScroll 래퍼), `tableSelection`/`tableCellSelected`(드래그선택 하이라이트), `listitemChecked`/`listitemUnchecked`(체크박스는 lexical 이 안 그림 → `::before`/`::after` 로 그림).

## 함정

- **window-capture 공존:** `useCommentCapture` 가 window pointerdown/click/focus 를 캡처해 호스트 Radix/base-ui DismissableLayer/FocusScope 와 공존. 우리 UI 는 `[data-comment-root]`. **dnd-kit 드래그 핸들·overlay 트리거(합성 pointerdown 에 동작) 는 `[data-comment-no-capture]` 표시 필수** — 안 하면 stopPropagation 이 막아 동작 안 함.
- **overlay 셀렉터 실체:** `packages/widget/src/anchor/constants.ts` 의 `OVERLAY_SEL` 은 `[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]`. 스코프 체인·가림 판정은 이 셋을 기준으로 한다.
- **dnd 위치 커밋:** raw `delta`(클램프 전) 대신 `active.rect.current.translated`(modifier 클램프됨) 사용 — 안 그러면 멀리 드래그 시 화면 밖으로.
- **trigger 탐지:** `useCommentCapture` 가 클릭 지점의 가장 가까운 focusable 조상(`tabbable.isFocusable`), 없으면 raw target 을 `lastActivated` 로 기록. 유효성은 `triggerForOverlay` 가 isConnected·overlay 밖·UI 밖으로 게이팅.
- **Tailwind v4:** `z-99990` 류 bare numeric 은 v4 dynamic value 로 생성됨. 위젯은 자체 CSS 를 싣지 않고 호스트 Tailwind 가 스캔 → 호스트 앱의 Tailwind entry 에 `@source` 위젯 src 필요. 플레이그라운드는 `apps/playground/src/style.css` 에서 `@source "../../../packages/widget/src"` 로 처리됨.
- 백그라운드 탭은 rAF 정지 → 핀 "안 그려짐" 처럼 보임(포그라운드로 검증). dnd 는 자동화로 트리거 안 됨 → 실마우스. 텍스트(한글 포함)는 CDP/Playwright 의 insertText 경로로 입력 가능(IME 불필요 — 2026-07-07 검증 리포트에서 확인). 단 base-ui Select 등 일부 오버레이는 합성 클릭에 안 열릴 수 있음.

## 참고 문서

이 저장소의 설계 결정/드리프트 기록은 `docs/superpowers/specs/` 에 남긴다.

- `docs/superpowers/specs/2026-07-05-agents-md-drift-sync-design.md` — 이 문서와 CLAUDE.md 의 실체 반영 설계.
- `docs/superpowers/specs/2026-07-05-dev-plugin-design.md` — 모노레포 레이아웃 + `@agentic-prd/dev-plugin` + Claude Code skill 설계(현행).
- `docs/superpowers/specs/2026-07-07-playground-demo-agentic-verification-design.md` — 커머스 데모 + 에이전틱 루프 검증 설계.
- `docs/superpowers/specs/2026-07-07-agentic-loop-verification-report.md` — 루프 검증 결과(6/6)와 resolver/위젯 개선 백로그.
