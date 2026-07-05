# AGENTS.md / CLAUDE.md 실체 반영 설계

- 날짜: 2026-07-05
- 대상: `AGENTS.md`, `CLAUDE.md`

## 목표

`AGENTS.md`가 다음 조건을 만족하도록 재작성:
1. 실제 소스코드/스크립트/의존성과 일치.
2. 이 저장소를 **독립 프로젝트**로 처음 접하는 에이전트/기여자가 필요한 배경 없이 바로 협업할 수 있음. 외부 조직·모노레포·타 프로덕트 이름은 언급하지 않는다.
3. Do/Don't·아키텍처 결정·함정 서술은 실체와 맞는 한 유지.

`CLAUDE.md`는 얇은 포인터로 유지하되 헤더의 프로젝트명만 실체(`agentic-prd`)에 맞춘다.

## 반영할 실체

### 정체성 & 소비 방식
- 패키지명 `agentic-prd`. Drop-in 코멘트 핀 + 기획문서 오버레이 위젯.
- 소비자는 임의의 React 앱. `<CommentWidget config={...} pageKey={...} pageLabel={...} />` 진입점.
- 저장소는 Supabase 단일 원천. 크레덴셜은 `config.storage`로 호스트 주입.

### 스크립트 (`package.json`)
- `typecheck`: `tsgo -p ./tsconfig.json --noEmit` (typescript-native-preview).
- `dev`: `tsdown --watch`.
- `build`: `tsdown`.
- `play`: `vite` (루트 `./playground`, 위젯 소스를 직접 임포트).
- `test`: `vitest run --passWithNoTests`.
- `lint`: `pnpm biome check . --diagnostic-level=error --max-diagnostics=200`.
- 단일 파일 정리: `pnpm exec biome check --fix <path>`.

### 의존 스택
- React 19 (peer), react-hook-form + valibot + `@hookform/resolvers/valibot`.
- 상태: `@tanstack/react-query` (서버) / `jotai` + `atomWithStorage` (로컬 개인값).
- Supabase: `@supabase/supabase-js` v2.
- 에디터: `lexical` + 다수 `@lexical/*` **모두 0.46.x 단일 버전**.
- UI 프리미티브: `@base-ui/react` 기반 로컬 shadcn (`src/components/ui/*`, `components.json`의 `base-sera` 스타일). 아이콘 `lucide-react`.
- 오버레이: `overlay-kit` (`experimental_createOverlayContext`).
- DnD: `@dnd-kit/core|modifiers|utilities`.
- Tailwind v4 (`@tailwindcss/vite`).
- 유틸: `clsx`, `tailwind-merge`, `es-toolkit`, `tabbable`.

### 구조 (실제 파일)
- 루트: `AGENTS.md`, `CLAUDE.md`, `package.json`, `tsconfig.json`, `tsdown.config.ts`, `vite.config.ts`, `vitest.config.ts`, `components.json`, `supabase/`(마이그레이션·config).
- `src/`:
  - `CommentWidget.tsx`, `WidgetProvider.tsx`, `config.ts`, `panelRuntime.tsx`, `panelOverlays.tsx`, `routeSource.ts`, `store.ts`, `supabase.ts`, `cn.ts`, `format.ts`, `database.types.ts`(자동생성), `index.ts`.
  - `lib/utils.ts` (shadcn `cn`).
  - `anchor/` — 앵커 캡처·해석.
  - `canvas/` — 캔버스 렌더 블록 + `types.ts` + `index.ts` barrel.
  - `components/` — 상위 컴포넌트, `table/`, `ui/`(base-ui/shadcn 프리미티브).
  - `hooks/` — `useCommentCapture`, `useOverlayTracker`, `usePinTracking`, `useCrosshair`, `useEscClose`.
  - `specs/` — `SpecPanel.tsx` + `store.ts` (SpecEditor는 SpecPanel 내부에 통합됨).

### 저장 스키마 (Supabase)
- `demo_comments (id, path, x_pct, y_pct, anchor, resolved, comments, updated_at)`
- `demo_specs (id, path, title, status, sections, updated_by, updated_at)` — 본문은 `sections.body`(마크다운).

### 데이터 흐름
- 코멘트: `useThreads`가 `["comment-widget", "threads", path]` 키로 폴링(4s, `refetchIntervalInBackground: true`), 모든 쓰기는 "via the cache" 낙관적 업데이트.
- 기획문서: 동일 패턴, 폴링 5s.
- 작성자 이름: `jotai` + `atomWithStorage`(개인값).
- DI: `WidgetProvider`가 렌더 시점 useMemo로 QueryClient·SupabaseClient 생성 → Context 주입.

### 앵커
- 절대좌표 대신 스코프 체인 + 상대 CSS 셀렉터 + 엘리먼트 rect 내 비율.
- `OVERLAY_SEL = '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]'`.
- 캡처와 patch 양쪽 모두 앵커 저장 필수.

### 마크다운/표/체크리스트
- 트랜스포머: `BASE_TRANSFORMERS = [CHECK_LIST, ...TRANSFORMERS]`, `MD_TRANSFORMERS = [TABLE, ...BASE_TRANSFORMERS]`.
- 표: `@lexical/table` + `<TablePlugin hasCellMerge hasCellBackgroundColor hasHorizontalScroll />` + 자체 포팅한 `TableCellResizer`, `TableHoverActions`, `TableActionMenu`(로컬 `components/ui/dropdown-menu`).
- 테마 키: `tableScrollableWrapper`, `tableSelection`, `tableCellSelected`, `listitemChecked`, `listitemUnchecked`.

### 함정
- `useCommentCapture`가 window pointerdown/click/focus 캡처 → 위젯 UI는 `[data-comment-root]`로 표시. dnd-kit 드래그 핸들·overlay 트리거는 `[data-comment-no-capture]` 필수.
- DnD 위치 커밋은 `active.rect.current.translated`(clamped) 사용.
- Tailwind v4는 위젯 CSS를 자체 배포하지 않고 호스트 Tailwind entry에 `@source` 위젯 src 등록 필요. 플레이그라운드는 `playground/src/style.css`의 `@source "../../src"`.
- 백그라운드 탭은 rAF 정지 → 실행/검증은 포그라운드에서.

## 변경 방침

### AGENTS.md
- 위 실체를 반영하여 완전 재작성. 외부 조직·모노레포·타 프로덕트 언급 없음.
- 어조는 기존 파일과 같은 간결한 실무 가이드 스타일 유지.
- 참고 문서 섹션은 이 저장소 안(`docs/superpowers/specs/`)만 링크.

### CLAUDE.md
- 헤더 프로젝트명을 `agentic-prd`로. 나머지(`See @AGENTS.md`) 유지.

## 유지되는 원칙 (요약)

- server state = react-query / client state = jotai / DI = Context (모듈 싱글톤 금지).
- Supabase 단일 원천, path별 쿼리키.
- 앵커: 엘리먼트 + 스코프 체인 우선, 좌표 폴백.
- 폼: react-hook-form + valibot + Controller, 마크다운 제어형 value.
- 커밋/푸시는 사용자 명시 요청 시에만.

## 저장 & 절차

1. 본 설계 문서: `docs/superpowers/specs/2026-07-05-agents-md-drift-sync-design.md`.
2. AGENTS.md · CLAUDE.md 업데이트.
3. 커밋은 사용자 요청 시 별도 진행.

## 위험 / 오픈 이슈

- **빈 `src/ui/` 폴더**: 문서에서 언급하지 않고 그대로 두거나, 사용자에게 정리 여부 확인 필요.
- **MarkdownEditor 내부 확장 문자열 식별자에 남아있는 옛 네임스페이스**: 런타임 문자열이라 리팩터가 필요하면 별도 작업. 문서에는 언급하지 않는다.
