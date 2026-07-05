# UI 일관성 정리 + Portal Container 복원 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** shadcn 프리미티브(`Button`, 신규 `Input`)로 위젯 내부의 임시(bespoke) 버튼·입력을 통일하고, base-ui `.Portal container` 를 복구해 팝오버가 위젯 canvas 레이어 안에서 자체 stacking context 를 갖도록 만들어 dialog↔popover z-index 충돌을 근본적으로 없앤다.

**Architecture:**
- **Container 복구**: base-ui의 `Dialog.Portal`, `Popover.Portal`, `Menu.Portal`, `Select.Portal` 은 모두 `container?: HTMLElement | RefObject<HTMLElement>` prop 을 받는다(내부적으로 `FloatingPortal.container`). 현재 `src/components/ui/*.tsx` 래퍼가 이 prop 을 노출하지 않아 PointPopover 가 base-ui 이관 후 이 능력을 잃었다. 래퍼에 `container` prop 을 추가 → `WidgetProvider` 가 `WidgetPortalContext` 로 컨테이너 DOM ref 를 공급 → `PointPopover` 가 그것을 소비해 canvas 레이어(z-99990) 내부에 portal 한다. Playground 의 임시 z-index 밴드에이드(`z-[56]`, `z-[60]`)는 이 원인을 우회하려던 흔적이므로 함께 제거.
- **컴포넌트 일관성**: 위젯 내부 파일들이 각자 `<button className="flex size-6 …">` 스타일로 반복 구현하고 있어 아이콘 사이즈·height·hover 색이 파일마다 살짝 다르다. `Button` 프리미티브(`variant="ghost"`, `size="icon-sm|sm"`) 로 통일하고, `<input>` 역시 신규 `Input` 프리미티브로 통일. bespoke `<select>` (SpecPanel 상태 픽커)는 기존 `Select` 프리미티브로 이행.

**Tech Stack:** React 19 · TypeScript(strictest) · `@base-ui/react@1.6` · shadcn(base-sera style, local generation) · Tailwind v4 · Vitest(+ @testing-library/react) · Biome.

---

## 파일 구조 개요

**수정 대상**
- `src/components/ui/popover.tsx` — `PopoverContent`에 `container` prop 추가
- `src/components/ui/dialog.tsx` — `DialogPortal`/`DialogContent`에 `container` prop 추가
- `src/components/ui/dropdown-menu.tsx` — `DropdownMenuContent`에 `container` prop 추가
- `src/components/ui/select.tsx` — `SelectContent`에 `container` prop 추가
- `src/WidgetProvider.tsx` — `WidgetPortalContext` 신설 + `useWidgetPortalContainer()` 훅 노출
- `src/CommentWidget.tsx` — portal container 용 DOM ref 를 canvas 레이어와 같은 stacking context 에 붙여 provider 로 공급
- `src/components/PointPopover.tsx` — context 에서 container 을 읽어 `PopoverContent` 에 전달
- `src/components/CommentPanel.tsx` — 헤더 close 버튼을 `<Button>` 로 이관
- `src/components/CommentToolbar.tsx` — name 편집 input/버튼들을 `<Input>`, `<Button>` 로 이관
- `src/components/DraftComposer.tsx` — 취소/코멘트 액션을 `<Button>` 로 이관
- `src/components/ThreadPopover.tsx` — 헤더 아이콘 버튼들, 인라인 편집 버튼들, 답글 등록 버튼을 `<Button>` 로 이관
- `src/components/ClusterPopover.tsx` — 헤더 close 버튼을 `<Button>` 로 이관
- `src/components/MarkdownToolbar.tsx` — 로컬 `TBtn`을 `<Button variant="ghost" size="icon-sm">` 로 대체
- `src/specs/SpecPanel.tsx` — 두 view(list header / editor header, editor footer)의 버튼, 두 input(link title/url + editor title), status `<select>`를 shadcn 프리미티브로 이관
- `playground/src/App.tsx` — 임시 z-index override 제거(`z-[56]`, `z-[60]`, redundant `z-50`)

**생성 대상**
- `src/components/ui/input.tsx` — `pnpm dlx shadcn add input`로 base-sera 스타일 로컬 생성
- `src/components/ui/__tests__/popover.container.test.tsx` — 컨테이너 회귀 방지 vitest

**언터치**
- `src/anchor/**`, `src/canvas/**`, `src/hooks/**`, `src/store.ts`, `src/routeSource.ts`, `src/panelRuntime.tsx`, `src/panelOverlays.tsx`, `src/supabase.ts` — 로직에 손대지 않는다.

---

## Phase 1 — Portal container 복구

### Task 1: Popover 래퍼에 container prop 추가 + 회귀 테스트

**Files:**
- Modify: `src/components/ui/popover.tsx`
- Create: `src/components/ui/__tests__/popover.container.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/ui/__tests__/popover.container.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

describe("PopoverContent container", () => {
  it("renders popup inside the provided container element, not document.body", () => {
    const host = document.createElement("div");
    host.id = "widget-portal";
    document.body.appendChild(host);

    render(
      <Popover open>
        <PopoverTrigger>trigger</PopoverTrigger>
        <PopoverContent container={host} data-testid="popup">
          content
        </PopoverContent>
      </Popover>,
    );

    const popup = screen.getByTestId("popup");
    expect(host.contains(popup)).toBe(true);
    expect(document.body.querySelector("[data-testid='popup']")).toBe(popup);
    // 확인: popup 이 host 밖 body 직속으로 새어나오지 않았는지
    const bodyChildren = Array.from(document.body.children);
    expect(bodyChildren.some((n) => n !== host && n.contains(popup))).toBe(
      false,
    );

    document.body.removeChild(host);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test popover.container`
Expected: FAIL — `container` prop is not accepted on `PopoverContent`, so the popup falls back to `document.body` and `host.contains(popup)` is `false`.

- [ ] **Step 3: Add container passthrough to PopoverContent**

Replace `src/components/ui/popover.tsx` `PopoverContent` with:

```tsx
function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  container,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > &
  Pick<PopoverPrimitive.Portal.Props, "container">) {
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 flex w-72 origin-(--transform-origin) flex-col gap-4 rounded-lg bg-popover p-2.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test popover.container`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/popover.tsx src/components/ui/__tests__/popover.container.test.tsx
git commit -m "feat(ui): forward container prop through PopoverContent portal"
```

---

### Task 2: DialogContent 에 container prop 추가

**Files:**
- Modify: `src/components/ui/dialog.tsx`

- [ ] **Step 1: Update `DialogContent` (and internal `DialogPortal` propagation)**

Replace `DialogContent` in `src/components/ui/dialog.tsx` with:

```tsx
function DialogContent({
  className,
  children,
  showCloseButton = true,
  container,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
} & Pick<DialogPrimitive.Portal.Props, "container">) {
  return (
    <DialogPortal container={container}>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-xs/relaxed text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "feat(ui): forward container prop through DialogContent portal"
```

---

### Task 3: DropdownMenuContent 에 container prop 추가

**Files:**
- Modify: `src/components/ui/dropdown-menu.tsx`

- [ ] **Step 1: Update `DropdownMenuContent`**

Replace `DropdownMenuContent` with:

```tsx
function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  container,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > &
  Pick<MenuPrimitive.Portal.Props, "container">) {
  return (
    <MenuPrimitive.Portal container={container}>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx
git commit -m "feat(ui): forward container prop through DropdownMenuContent portal"
```

---

### Task 4: SelectContent 에 container prop 추가

**Files:**
- Modify: `src/components/ui/select.tsx`

- [ ] **Step 1: Update `SelectContent`**

Replace `SelectContent` with:

```tsx
function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  container,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  > &
  Pick<SelectPrimitive.Portal.Props, "container">) {
  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/select.tsx
git commit -m "feat(ui): forward container prop through SelectContent portal"
```

---

### Task 5: WidgetPortalContext 신설

**Files:**
- Modify: `src/WidgetProvider.tsx`

- [ ] **Step 1: Add PortalContainerContext and hook**

At the end of `src/WidgetProvider.tsx`, and update the imports to include `useContext, useState` (already present) plus `Dispatch, SetStateAction` from react. Add:

```tsx
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

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
      "useSetWidgetPortalContainer must be used within <WidgetProvider>",
    );
  }
  return ctx.setContainer;
}
```

Wrap the existing `WidgetProvider` return value with the new provider:

```tsx
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
    [config.storage],
  );
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const portalValue = useMemo(
    () => ({ container, setContainer }),
    [container],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseContext.Provider value={supabase}>
        <WidgetPortalContext.Provider value={portalValue}>
          {children}
        </WidgetPortalContext.Provider>
      </SupabaseContext.Provider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/WidgetProvider.tsx
git commit -m "feat(widget): add portal container context for base-ui overlays"
```

---

### Task 6: CommentWidget 에 portal container DOM 설치

**Files:**
- Modify: `src/CommentWidget.tsx`

- [ ] **Step 1: Attach a portal-host div at the same stacking layer as the canvas**

Update the imports:

```tsx
import { useSetWidgetPortalContainer, WidgetProvider } from "./WidgetProvider";
```

Change the `CommentWidgetInner` return so the `<div data-comment-root>` also references a nested portal host div at `z-99991` (just above the canvas base but below panel guides). Replace the `return createPortal(...)` block with:

```tsx
  return createPortal(
    <WidgetPanelRuntimeProvider value={panelRuntime}>
      <CommentWidgetRoot>
        <CommentWidgetOverlayProvider>
          <CommentWidgetSurface
            addMode={addMode}
            addThread={addThread}
            canvas={canvas}
            clusterGroups={clusterGroups}
            draft={draft}
            draftPoint={draftPoint}
            expandedCluster={expandedCluster}
            expandedGroup={expandedGroup}
            nameEditing={nameEditing}
            nameInput={nameInput}
            openThreadId={openThreadId}
            pageKey={pageKey}
            pageThreads={pageThreads}
            placing={placing}
            points={points}
            setCanvas={setCanvas}
            setNameEditing={setNameEditing}
            setNameInput={setNameInput}
            setUserName={setUserName}
            threadBack={threadBack}
            userName={userName}
          />
        </CommentWidgetOverlayProvider>
      </CommentWidgetRoot>
    </WidgetPanelRuntimeProvider>,
    document.body,
  );
}

function CommentWidgetRoot({ children }: { children: React.ReactNode }) {
  const setContainer = useSetWidgetPortalContainer();
  return (
    <div data-comment-root style={{ display: "contents" }}>
      {children}
      {/*
        base-ui overlay(포인트 팝오버·문서 다이얼로그 등)를 위젯 stacking context 안으로 portal 하기 위한 host.
        canvas 레이어(z-99990) 바로 위에 앉혀 host dialog(보통 z-50) 와 z 충돌을 근본적으로 회피한다.
      */}
      <div
        ref={setContainer}
        data-comment-portal-host
        className="pointer-events-none fixed inset-0 z-99991"
      />
    </div>
  );
}
```

Add `import type { ReactNode } from "react"` if needed (already imports React types—verify).

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/CommentWidget.tsx
git commit -m "feat(widget): mount portal host div inside widget stacking context"
```

---

### Task 7: PointPopover 가 컨테이너를 소비하게 변경

**Files:**
- Modify: `src/components/PointPopover.tsx`

- [ ] **Step 1: Consume widget portal container**

Replace the whole file with:

```tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ComponentProps, ReactNode } from "react";
import type { Point } from "../anchor";
import { cn } from "../cn";
import { useWidgetPortalContainer } from "../WidgetProvider";

type PointPopoverProps = {
  point: Point;
  children: ReactNode;
  className?: string;
} & Pick<ComponentProps<typeof PopoverContent>, "align" | "sideOffset">;

/**
 * 뷰포트 좌표를 base-ui Popover anchor 로 변환해 collision/flip 처리를 위임한다.
 * portal 대상은 WidgetProvider 가 제공하는 위젯 stacking context 내부의 host 다
 * (host dialog 와 z-index 가 겹쳐도 위젯 canvas 가 항상 상위 stacking context 라 안정).
 */
export function PointPopover({
  point,
  children,
  className,
  align = "start",
  sideOffset = 18,
}: PointPopoverProps) {
  const side = point.x < window.innerWidth * 0.55 ? "right" : "left";
  const container = useWidgetPortalContainer();
  if (!container) return null;

  return (
    <Popover open>
      <PopoverTrigger
        aria-hidden
        style={{ left: point.x, top: point.y }}
        className="pointer-events-none fixed size-px"
      />
      <PopoverContent
        container={container}
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "pointer-events-auto max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-xl",
          className,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test (foreground tab)**

Run: `pnpm play`
Steps:
1. Playground 열림 후 우하단 툴바에서 닉네임 설정 → "코멘트" 클릭 → 페이지 아무 곳 클릭.
2. Popover 가 뜨면 elements 탭에서 `[data-testid="popup"]` 대신 `[data-slot="popover-content"]` 을 찾고 그 조상에 `[data-comment-portal-host]` 가 있는지 확인.
3. Playground 의 "Dialog 열기" 를 눌러 dialog 를 띄운 뒤 그 안의 입력에 코멘트를 달아 popover 가 dialog 위에 뜨는지 확인(이전에는 뒤에 깔림).

- [ ] **Step 4: Commit**

```bash
git add src/components/PointPopover.tsx
git commit -m "fix(widget): render pin popovers into widget portal host so they stack above host dialogs"
```

---

### Task 8: Playground 의 z-index 임시 override 제거

**Files:**
- Modify: `playground/src/App.tsx`

- [ ] **Step 1: Remove ad-hoc z-index bandaids**

`playground/src/App.tsx` 에서 아래 세 곳을 정리:

Line 46:
```tsx
// before
<DialogContent className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-96 rounded-xl bg-white p-5 shadow-xl">
// after
<DialogContent className="w-96 rounded-xl bg-white p-5 shadow-xl">
```

Line 72:
```tsx
// before
<SelectContent className="z-[60] rounded-lg border border-slate-200 bg-white shadow-lg">
// after
<SelectContent className="rounded-lg border border-slate-200 bg-white shadow-lg">
```

Line 92:
```tsx
// before
<DialogContent className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-[56] w-80 rounded-xl bg-white p-5 shadow-xl">
// after
<DialogContent className="w-80 rounded-xl bg-white p-5 shadow-xl">
```

`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` 는 이미 shadcn `DialogContent` 내부에서 부여하므로 중복 제거해도 시각 동일.

- [ ] **Step 2: Run playground smoke test**

Run: `pnpm play`
Steps:
1. Dialog 열고 안쪽 Dialog 도 열어 stacking 순서(안쪽 Dialog 가 바깥 Dialog 를 덮는지) 확인.
2. Dialog 안 Select 를 열어 옵션 리스트가 Dialog 위에 뜨는지 확인.
3. 두 Dialog 열린 상태에서 위젯 툴바에서 코멘트 모드 진입 → 안쪽 Dialog 의 라벨 위에 코멘트 → PointPopover 가 두 Dialog 위에 뜨는지 확인.

- [ ] **Step 3: Commit**

```bash
git add playground/src/App.tsx
git commit -m "chore(playground): drop z-index overrides now that portal container fixes stacking"
```

---

## Phase 2 — Input 프리미티브 추가

### Task 9: shadcn 로 Input 추가

**Files:**
- Create: `src/components/ui/input.tsx`

- [ ] **Step 1: Add Input via shadcn CLI**

Run:
```bash
pnpm dlx shadcn@latest add input
```

Expected: `src/components/ui/input.tsx` 생성. `components.json` 의 base-sera 스타일 규약대로 base-ui `Input`(또는 native `<input>` + shared classes) 이 들어온다.

- [ ] **Step 2: Verify export**

Run: `pnpm typecheck`
Expected: 0 errors.

Read the generated file and confirm the export signature:

```tsx
// C:\Users\CreeJee\Desktop\open-source\agentic-prd\src\components\ui\input.tsx
export { Input }
```

만약 CLI 가 `alias @/lib/utils` 이외의 파일을 요구하면(예: shadcn 이 새 utils 를 넣으려 시도), `components.json` 이 이미 alias 를 설정해 두었으므로 그대로 수용.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat(ui): add shadcn Input primitive (base-sera)"
```

---

## Phase 3 — bespoke 컴포넌트 일관성 정리

각 태스크는 typecheck 를 통과시켜야 하며 시각 확인은 마지막 Task 20에서 일괄 진행.

### Task 10: MarkdownToolbar 내부 TBtn → Button

**Files:**
- Modify: `src/components/MarkdownToolbar.tsx`

- [ ] **Step 1: Replace local TBtn with shadcn Button**

`src/components/MarkdownToolbar.tsx` 상단 import 에 추가:

```tsx
import { Button } from "@/components/ui/button";
```

`TBtn` 함수를 아래로 교체:

```tsx
function TBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "text-slate-500 hover:bg-slate-100",
        active && "bg-primary/10 text-primary hover:bg-primary/15",
      )}
    >
      {children}
    </Button>
  );
}
```

- [ ] **Step 2: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MarkdownToolbar.tsx
git commit -m "refactor(markdown-toolbar): use Button primitive for TBtn"
```

---

### Task 11: CommentPanel 헤더 close 버튼 통일

**Files:**
- Modify: `src/components/CommentPanel.tsx`

- [ ] **Step 1: Import Button and replace bespoke close button**

`src/components/CommentPanel.tsx` 상단 import 에 추가:

```tsx
import { Button } from "@/components/ui/button";
```

`return (...)` 안의 헤더(현재 line 75~84)를 아래로 교체:

```tsx
      <div className="flex items-center justify-between border-slate-100 border-b px-4 py-2.5">
        <span className="font-medium text-slate-900 text-sm">코멘트</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="닫기"
          className="text-slate-400 hover:bg-slate-100"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CommentPanel.tsx
git commit -m "refactor(comment-panel): use Button primitive for header close"
```

---

### Task 12: ClusterPopover 헤더 close 버튼 통일

**Files:**
- Modify: `src/components/ClusterPopover.tsx`

- [ ] **Step 1: Replace bespoke close button**

`src/components/ClusterPopover.tsx` 상단 import 에 추가:

```tsx
import { Button } from "@/components/ui/button";
```

헤더 close 를 교체:

```tsx
      <div className="flex shrink-0 items-center justify-between border-slate-100 border-b px-3 py-2">
        <span className="font-medium text-slate-500 text-xs">
          겹친 코멘트 {threads.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="닫기"
          className="text-slate-400 hover:bg-slate-100"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ClusterPopover.tsx
git commit -m "refactor(cluster-popover): use Button primitive for header close"
```

---

### Task 13: ThreadPopover — 헤더/인라인 편집/답글 등록 버튼 통일

**Files:**
- Modify: `src/components/ThreadPopover.tsx`

- [ ] **Step 1: Import Button**

파일 상단 import 에 추가:

```tsx
import { Button } from "@/components/ui/button";
```

- [ ] **Step 2: Replace header 4개 아이콘 버튼**

Line 113~181 의 헤더 우측 4개 (`onBack`, `onRelocate`, `toggleResolved`, `deleteThread`, `onClose`) 를 아래로 교체:

```tsx
      <div className="flex shrink-0 items-center justify-between border-slate-100 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="겹친 코멘트로 돌아가기"
              onClick={onBack}
              className="-ml-1 text-slate-400 hover:bg-slate-100"
              aria-label="목록으로"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
          )}
          <span className="font-medium text-slate-500 text-xs">
            코멘트 {thread.comments.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onRelocate && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="재배치 (핀 위치 다시 잡기)"
              onClick={onRelocate}
              className="text-slate-400 hover:bg-slate-100 hover:text-primary"
              aria-label="재배치"
            >
              <MoveIcon className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={thread.resolved ? "다시 열기" : "해결됨으로 표시"}
            onClick={() => {
              toggleResolved({ path: thread.path, threadId: thread.id }).then(
                onClose,
              );
            }}
            disabled={loadingToggleResolved}
            className={cn(
              "hover:bg-slate-100",
              thread.resolved ? "text-green-600" : "text-slate-400",
            )}
            aria-label="해결 토글"
          >
            {loadingToggleResolved ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="삭제"
            onClick={() =>
              deleteThread({ path: thread.path, threadId: thread.id })
            }
            disabled={loadingDeleteThread}
            className="text-slate-400 hover:bg-slate-100 hover:text-red-500"
            aria-label="스레드 삭제"
          >
            {loadingDeleteThread ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <Trash2Icon className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="닫기"
            onClick={onClose}
            className="text-slate-400 hover:bg-slate-100"
            aria-label="닫기"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
```

- [ ] **Step 3: Replace inline edit/delete 및 폼 제출/취소 버튼**

동일 파일 line 197~226(인라인 편집/삭제 icon 5x5)과 line 254~272(편집 폼 취소/저장), line 311~317(답글 등록) 3부분을 교체.

인라인 그룹:
```tsx
                {editingId !== c.id && (
                  <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      title="본문 편집"
                      onClick={() => startEdit(c.id, c.text)}
                      className="text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                      aria-label="편집"
                    >
                      <PencilIcon className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      title="코멘트 삭제"
                      disabled={loadingDeleteComment}
                      onClick={() =>
                        deleteComment({
                          path: thread.path,
                          threadId: thread.id,
                          commentId: c.id,
                        })
                      }
                      className="text-slate-300 hover:bg-red-50 hover:text-red-500"
                      aria-label="코멘트 삭제"
                    >
                      {loadingDeleteComment ? (
                        <Loader2Icon className="size-3 animate-spin" />
                      ) : (
                        <Trash2Icon className="size-3" />
                      )}
                    </Button>
                  </div>
                )}
```

편집 폼 액션:
```tsx
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setEditingId(null)}
                      className="text-slate-500 hover:bg-slate-50"
                    >
                      취소
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                      size="xs"
                      disabled={
                        !editForm.formState.isValid || loadingUpdateComment
                      }
                    >
                      {loadingUpdateComment ? "저장 중…" : "저장"}
                    </Button>
                  </div>
```

답글 등록:
```tsx
        <Button
          type="submit"
          variant="default"
          size="sm"
          disabled={!replyForm.formState.isValid || loadingAddComment}
        >
          {loadingAddComment ? "등록 중…" : "등록"}
        </Button>
```

- [ ] **Step 4: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThreadPopover.tsx
git commit -m "refactor(thread-popover): unify buttons via Button primitive"
```

---

### Task 14: DraftComposer 액션 버튼 통일

**Files:**
- Modify: `src/components/DraftComposer.tsx`

- [ ] **Step 1: Replace action buttons**

파일 상단 import 에 추가:

```tsx
import { Button } from "@/components/ui/button";
```

`<div className="flex items-center justify-end gap-2">` 블록(line 62~78)을 교체:

```tsx
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-500 hover:bg-slate-50"
          >
            취소
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!isValid}
            onClick={submit}
          >
            코멘트
          </Button>
        </div>
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DraftComposer.tsx
git commit -m "refactor(draft-composer): use Button primitives for actions"
```

---

### Task 15: CommentToolbar 버튼 + name Input 통일

**Files:**
- Modify: `src/components/CommentToolbar.tsx`

- [ ] **Step 1: Swap bespoke `<button>`/`<input>` for shadcn primitives**

파일 상단 import 에 추가:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

`return (…)` 를 아래로 교체:

```tsx
  return (
    <DraggableToolbar>
      {nameEditing ? (
        <Input
          ref={(ref) => ref?.focus({ focusVisible: true })}
          value={nameInput}
          placeholder="이름 입력"
          onChange={(e) => onNameInputChange(e.target.value)}
          onBlur={onCommitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitName();
          }}
          className="h-7 w-28 rounded-full px-2.5 text-sm focus:border-primary"
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBeginNameEdit}
          className="rounded-full text-slate-600 hover:bg-slate-50"
          title="이름 설정"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-[11px]">
            {authorInitial(userName)}
          </span>
          <span className="max-w-24 truncate">{userName || "이름 설정"}</span>
        </Button>
      )}

      <div className="h-5 w-px bg-slate-200" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleCommentPanel}
        className="rounded-full text-slate-600 hover:bg-slate-50"
        title="코멘트 목록"
      >
        <MessagesSquareIcon className="size-4" />
        목록 {threadCount}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleSpecPanel}
        aria-pressed={specOpen}
        className={cn(
          "rounded-full hover:bg-slate-50",
          specOpen ? "text-primary" : "text-slate-600",
        )}
        title="화면 기획 문서"
      >
        <FileTextIcon className="size-4" />
        문서
      </Button>

      <Button
        type="button"
        variant={addMode ? "default" : "default"}
        size="sm"
        onClick={onToggleAddMode}
        disabled={!addMode && !canComment}
        title={!addMode && !canComment ? "이름을 먼저 설정하세요" : undefined}
        aria-pressed={addMode}
        className={cn(
          "rounded-full font-medium",
          addMode
            ? "bg-primary text-white hover:bg-primary/90"
            : "bg-slate-900 text-white hover:bg-slate-700",
        )}
      >
        <MessageSquarePlusIcon className="size-4" />
        {addMode ? "취소" : "코멘트"}
      </Button>
    </DraggableToolbar>
  );
```

주의: `Input` 이 base-ui 기반이면 `ref` 콜백이 그대로 통과되지만, native `<input>` fallback 이면 `focus({ focusVisible: true })` 옵션이 무시될 수 있다. Task 9 결과물이 base-ui `Input` 이 아니라면 `ref` 를 `useRef` + `useEffect` 로 옮겨:

```tsx
const inputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  if (nameEditing) inputRef.current?.focus();
}, [nameEditing]);
```

이후 `<Input ref={inputRef} … />` 로 대체.

- [ ] **Step 2: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CommentToolbar.tsx
git commit -m "refactor(comment-toolbar): unify controls via Button/Input primitives"
```

---

### Task 16: SpecPanel list header 버튼 + link Inputs 통일

**Files:**
- Modify: `src/specs/SpecPanel.tsx`

- [ ] **Step 1: Import primitives**

파일 상단 import 에 추가:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

- [ ] **Step 2: Replace list header block (line 280~326 in current file)**

`return (…)` 헤더~링크 토글 파트를 교체:

```tsx
  return (
    <>
      <div
        data-drag-handle
        data-comment-no-capture=""
        className="flex cursor-move items-center justify-between border-slate-100 border-b px-4 py-3"
      >
        <div className="flex min-w-0 flex-col">
          <span className="typo-regular-medium text-slate-900">기획 문서</span>
          <span className="truncate text-xs text-slate-400">{pageLabel}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="닫기"
          className="text-slate-400 hover:bg-slate-100"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto p-3">
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCreate}
            disabled={creating}
            className="flex-1 border-primary border-dashed font-medium text-primary hover:bg-orange-50"
          >
            {creating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            {creating ? "생성 중…" : "새 문서"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setLinkMode(!linkMode)}
            aria-pressed={linkMode}
            className={cn(
              "border-dashed font-medium",
              linkMode
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-slate-300 text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600",
            )}
            title="Google Docs 연결"
          >
            <LinkIcon className="size-4" />
          </Button>
        </div>
```

`cn` 이 아직 이 파일에 import 되어 있지 않다면 상단에 추가:

```tsx
import { cn } from "../cn";
```

- [ ] **Step 3: Replace link mode form (line 329~364)**

`{linkMode && (…)}` 블록을 교체:

```tsx
        {linkMode && (
          <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <Input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="문서 제목"
              className="focus:border-blue-400"
            />
            <Input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Google Docs URL 붙여넣기"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLinkSubmit();
              }}
              className="focus:border-blue-400"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {linkUrl && !parseGoogleDocsId(linkUrl)
                  ? "올바른 Google Docs URL을 입력해 주세요"
                  : "링크 공유가 설정된 문서만 표시돼요"}
              </span>
              <Button
                type="button"
                variant="default"
                size="xs"
                disabled={!parseGoogleDocsId(linkUrl)}
                onClick={handleLinkSubmit}
                className="bg-blue-500 text-white hover:bg-blue-600"
              >
                연결
              </Button>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/specs/SpecPanel.tsx
git commit -m "refactor(spec-panel): unify list header controls via primitives"
```

---

### Task 17: SpecPanel editor header — title Input + status Select

**Files:**
- Modify: `src/specs/SpecPanel.tsx`

- [ ] **Step 1: Import Select primitives**

파일 상단 import 에 추가(중복이면 그대로 두기):

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

- [ ] **Step 2: Replace editor header block (line 485~546)**

edit view 의 상단 (뒤로/제목/상태/닫기) 를 교체:

```tsx
      <div
        data-drag-handle
        data-comment-no-capture=""
        className="flex cursor-move items-center justify-between gap-2 border-slate-100 border-b px-3 py-2.5"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            flushSave();
            onBack();
          }}
          className="shrink-0 text-slate-500 hover:bg-slate-100"
          title="목록"
          aria-label="목록"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <Input
          {...register("title", {
            onChange: (e) => scheduleSave({ title: e.target.value }),
          })}
          placeholder="문서 제목"
          onBlur={flushSave}
          className="min-w-0 flex-1 border-transparent bg-transparent px-1.5 py-1 font-medium text-sm text-slate-900 hover:bg-slate-50 focus:bg-slate-50"
        />
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(next: SpecStatus) => {
                field.onChange(next);
                saveSpec.mutate({
                  path,
                  id: docId,
                  patch: { ...getValues(), status: next },
                  author,
                });
              }}
            >
              <SelectTrigger
                size="sm"
                className={cn(
                  "h-7 shrink-0 rounded-full border-0 px-2 text-xs font-medium",
                  STATUS_BADGE[field.value],
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["DRAFT", "REVIEW", "CONFIRMED"] as SpecStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SPEC_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            flushSave();
            onClose();
          }}
          className="shrink-0 text-slate-400 hover:bg-slate-100"
          aria-label="닫기"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
```

주의: base-ui `Select` 는 `onValueChange` 를 지원한다(shadcn wrapper 는 native `onChange` 대신 이를 노출). Task 4 로 이미 base-ui 기반 SelectContent 를 쓰고 있으니 그대로 매칭. `status` prop 은 `field.value` 로 대체(별도 `status` 변수 정의가 있었지만 이제 필요 없음).

- [ ] **Step 3: If `status` local var becomes unused, remove it**

파일 앞부분 SpecEditor 내부에서 `const status = watch("status")` 같은 변수가 이 헤더에서만 쓰였다면 삭제. `noUnusedLocals` 에 걸림.

- [ ] **Step 4: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/specs/SpecPanel.tsx
git commit -m "refactor(spec-panel): editor header uses Input and Select primitives"
```

---

### Task 18: SpecPanel editor footer 삭제 버튼 통일

**Files:**
- Modify: `src/specs/SpecPanel.tsx`

- [ ] **Step 1: Replace footer delete button (line 592~613)**

푸터 삭제 블록 교체:

```tsx
      <div className="flex items-center justify-between border-slate-100 border-t px-4 py-2 text-xs text-slate-400">
        <span>
          {doc?.updatedBy
            ? `최종 수정 · ${doc.updatedBy} · ${timeAgo(doc.updatedAt)}`
            : "작성 중"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={loadingDelete}
          onClick={async () => {
            await deleteSpec({ path, id: docId });
            onDeleted();
          }}
          className="text-slate-400 hover:bg-red-50 hover:text-red-500"
        >
          {loadingDelete ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <Trash2Icon className="size-3.5" />
          )}
          {loadingDelete ? "삭제 중…" : "삭제"}
        </Button>
      </div>
```

- [ ] **Step 2: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/specs/SpecPanel.tsx
git commit -m "refactor(spec-panel): editor footer delete uses Button primitive"
```

---

## Phase 4 — 최종 검증

### Task 19: 통합 검증 (typecheck · lint · test · build · playground)

**Files:**
- Run only

- [ ] **Step 1: Full lint + typecheck + test**

Run:
```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: 각 명령 0 errors / all tests pass (Popover container 회귀 테스트 포함).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: `dist/` 산출 성공.

- [ ] **Step 3: Playground 시각 스모크**

Run: `pnpm play`

수동 확인 체크리스트 (전부 foreground 탭에서):
- 우하단 툴바: 이름 미설정 → "코멘트" 비활성, 이름 설정 후 활성.
- 툴바 각 버튼 hover/active 색이 이전과 동일한 톤 유지.
- 이름 편집 input focus 시 primary border 뜸.
- "Dialog 열기" → 안쪽 Select 열림, 옵션이 dialog 를 덮음.
- 안쪽 Dialog 도 열어 2단 dialog 상태에서 그 안 라벨 위에 코멘트 → PointPopover 가 2단 dialog 를 덮음(이전에는 뒤로 깔림).
- SpecPanel 열어 문서 생성, 제목 편집, 상태 Select 변경, Google Docs 링크 추가, 삭제 모두 동작.
- ThreadPopover 열어 답글 등록 · 인라인 편집 · 삭제 · 해결 토글 모두 동작.

- [ ] **Step 4: 사용자 확인 요청**

이 시점에서 사용자에게 시각 결과 확인 요청(플랜 완료 후 리뷰 단계). 필요한 경우 스크린샷 첨부하여 asymmetric 잔재(색·padding) 지적 받으면 개별 후속 커밋.

- [ ] **Step 5: (선택) tag / no-commit — 검증만**

이 태스크는 최종 gate 이므로 별도 커밋 없음.

---

## Self-Review 결과

**스펙 커버리지**
- "사이즈가 안맞거나 일관성이 적용되지 않은 컴포넌트 정리" → Task 10–18 (MarkdownToolbar, CommentPanel, ClusterPopover, ThreadPopover, DraftComposer, CommentToolbar, SpecPanel × 3).
- "shadcn CLI 로 추가" → Task 9 (`Input`). `Button`, `Popover`, `Dialog`, `DropdownMenu`, `Select` 는 이미 존재.
- "dialog 간 z-index 계층 이상" → Task 1–7 (portal container 복구가 root cause fix). Task 8 (playground 밴드에이드 제거) 이 결과 검증.
- "PointPopover container 제거가 원인" → Task 7 이 명시적으로 base-ui `container` 를 다시 소비.
- "playground 잘못 배치" → Task 8 이 임시 z override 제거로 확인.

**Placeholder scan**
- 모든 코드 스텝에 완결된 스니펫 포함. TBD/TODO 없음. Task 19 의 "시각 스모크" 는 커밋을 만들지 않는 검증 단계로 명시.

**Type consistency**
- `useWidgetPortalContainer` 반환 `HTMLElement | null` — Task 5 정의, Task 7 소비.
- `useSetWidgetPortalContainer` 반환 `Dispatch<SetStateAction<HTMLElement | null>>` — Task 5 정의, Task 6 소비.
- 모든 shadcn wrapper 는 `Pick<X.Portal.Props, "container">` 로 타입 확장 — Task 1–4 통일 패턴.
- `PopoverContent`/`DialogContent`/`DropdownMenuContent`/`SelectContent` 시그니처 변경은 모두 기존 소비처와 호환(container 는 옵셔널).
