# Playground 커머스 데모 + 에이전틱 루프 검증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이그라운드를 shadcn 스타일 커머스 미니앱(상품/장바구니/체크아웃)으로 개편하고, 의도적 결함 6건 + 화면별 PRD 3건을 심은 뒤, 위젯 → dev-plugin → Claude Code skill 경로로 "코멘트만 보고 코드 수정"이 가능한지 E2E 검증한다.

**Architecture:** react-router 기반 4라우트(`/products`, `/cart`, `/checkout`, `/_kitchen-sink`) 데모 앱. Supabase 접속정보는 `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLIC_KEY` env 로 전환(기본값=현행 호스티드). 재현 가능 시드는 Playwright + 로컬 Supabase(`supabase start`, 신규 마이그레이션)로, 1차 검증은 claude-in-chrome 으로 실제 위젯 경로를 태운다.

**Tech Stack:** react-router v7, @playwright/test, @supabase/supabase-js(시드용 devDep), supabase CLI(로컬 스택), 기존 위젯 export(Dialog/Select) + Tailwind v4.

**스펙:** `docs/superpowers/specs/2026-07-07-playground-demo-agentic-verification-design.md`

**프로젝트 규칙 (AGENTS.md):**
- 주석은 JSDoc 만. `//` 인라인 주석 금지.
- `@tsconfig/strictest` + `noUncheckedIndexedAccess` — 인덱스 접근은 가드(`?? fallback`).
- 검증 기준: `pnpm typecheck` 0 + biome(error) 클린. biome 은 `pnpm dlx @biomejs/biome@2.1.1 check <paths>`.
- 커밋은 각 태스크 끝에서 수행(사용자가 이 플랜 실행에 대해 커밋을 승인함). 푸시 금지.

---

## File Structure (전체 조감)

```
apps/playground/
├─ package.json               # M: react-router, @playwright/test, @supabase/supabase-js 추가 + test:e2e 스크립트
├─ vite.config.ts             # M: storage 를 resolveSupabaseStorage(process.env) 로
├─ playwright.config.ts       # C: e2e 설정 (webServer + 로컬 supabase env)
├─ e2e/
│  ├─ local-supabase.ts       # C: 로컬 Supabase URL/키 상수 (env override 가능)
│  ├─ global-setup.ts         # C: demo_comments/demo_specs truncate + PRD 3건 insert
│  └─ seed-comments.spec.ts   # C: 실제 위젯 UI 로 코멘트 6건 시드
└─ src/
   ├─ index.tsx               # M: BrowserRouter 래핑
   ├─ App.tsx                 # M: 레이아웃(네비) + Routes + CommentWidget(pageKey 주입)
   ├─ supabaseEnv.ts          # C: env → storage 해석 (vite.config 과 앱이 공유)
   ├─ data.ts                 # C: 데모 상품 정적 데이터
   ├─ cart.tsx                # C: CartProvider (Context + useState)
   └─ routes/
      ├─ Products.tsx         # C: 상품 그리드 + 상세 Dialog (결함 1,2,3)
      ├─ Cart.tsx             # C: 장바구니 테이블 (결함 4)
      ├─ Checkout.tsx         # C: 체크아웃 폼 + Select (결함 5,6)
      └─ KitchenSink.tsx      # C: 기존 App.tsx 콘텐츠 이동
supabase/
└─ migrations/
   └─ 20260707000000_demo_tables.sql   # C: demo_comments/demo_specs 스키마 (로컬용)
docs/superpowers/specs/
└─ 2026-07-07-agentic-loop-verification-report.md   # C: Task 11 산출물
```

**Planted issues (결함 ↔ 코드 지점 정답표 — Task 11 채점 기준):**

| # | 코멘트 대상 | 정답 파일 | 결함 |
|---|---|---|---|
| 1 | 가격 텍스트 (`data-testid="product-price-p1"`) | `routes/Products.tsx` | `{product.price}원` — 천단위 콤마 없음 |
| 2 | 품절 카드 (`data-testid="product-card-p3"`) | `routes/Products.tsx` | soldOut 시각 구분 없음 |
| 3 | 상세 Dialog 수량 입력 (`data-testid="product-qty-input"`) | `routes/Products.tsx` | `max` 제한 없음 |
| 4 | 결제 버튼 (`data-testid="cart-pay-button"`) | `routes/Cart.tsx` | 빈 장바구니에도 활성 |
| 5 | 이메일 입력 (`data-testid="checkout-email-input"`) | `routes/Checkout.tsx` | 형식 검증 없음 (nonEmpty 만) |
| 6 | 배송방법 Select (`data-testid="shipping-select-trigger"`) | `routes/Checkout.tsx` | 미선택 시 에러 안내 없음 |

---

### Task 1: react-router 도입 + 키친싱크 라우트 이동 + 레이아웃

**Files:**
- Modify: `apps/playground/package.json`
- Create: `apps/playground/src/routes/KitchenSink.tsx`
- Modify: `apps/playground/src/index.tsx`
- Modify: `apps/playground/src/App.tsx`

- [ ] **Step 1: react-router 의존성 추가**

```powershell
pnpm --filter agentic-prd-playground add react-router@^7
```

- [ ] **Step 2: `src/routes/KitchenSink.tsx` 생성 — 기존 App.tsx 콘텐츠 이동**

현행 `App.tsx` 의 JSX 전체(고정 패널 + main)를 그대로 옮기되:
- `CommentWidget` 마운트와 그 import 는 제외 (App 레이아웃에서 전역 마운트).
- 최상위 `<div className="min-h-screen bg-slate-50 text-slate-900">` 는 제외 (레이아웃이 담당) — 최상위를 fragment(`<>`) 로.
- 고정 패널 `aside` 의 `top-4` → `top-20` (신규 네비 헤더와 겹침 방지).
- 함수명/JSDoc: `export function KitchenSink()`, JSDoc 은 기존 "위젯 앵커 동작을 시험하기 위한 키친싱크 페이지..." 유지.
- import 는 `@agentic-prd/widget` 에서 `Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue` (CommentWidget 제외).

- [ ] **Step 3: `src/index.tsx` — BrowserRouter 래핑**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import "./style.css";

// biome-ignore lint/style/noNonNullAssertion: 플레이그라운드 마운트 지점은 항상 존재
createRoot(document.querySelector("#app")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 4: `src/App.tsx` — 레이아웃 + Routes 재작성**

이 시점에는 Products/Cart/Checkout 이 아직 없으므로 KitchenSink 라우트와 임시 placeholder 라우트만 둔다. (Task 3~5 에서 교체)

```tsx
import { CommentWidget } from "@agentic-prd/widget";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { KitchenSink } from "./routes/KitchenSink";
import { resolveSupabaseStorage } from "./supabaseEnv";

const WIDGET_CONFIG = {
  storage: resolveSupabaseStorage(import.meta.env),
};

const PAGE_LABELS: Record<string, string> = {
  "/products": "상품 목록",
  "/cart": "장바구니",
  "/checkout": "체크아웃",
  "/_kitchen-sink": "키친싱크",
};

/**
 * 데모 커머스 미니앱 레이아웃. 네비 헤더 + 라우트 + CommentWidget 전역 마운트.
 * pageKey 는 호스트가 라우터 pathname 으로 주입한다 (AGENTS.md 권장 소비 패턴).
 */
export function App() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-slate-200 border-b bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-4xl items-center gap-5 px-6 py-3 text-sm">
          <span className="font-bold">데모 스토어</span>
          <Link to="/products" className="text-slate-600 hover:text-slate-900">
            상품
          </Link>
          <Link to="/cart" className="text-slate-600 hover:text-slate-900">
            장바구니
          </Link>
          <Link to="/checkout" className="text-slate-600 hover:text-slate-900">
            체크아웃
          </Link>
          <Link
            to="/_kitchen-sink"
            className="ml-auto text-slate-400 text-xs hover:text-slate-600"
          >
            kitchen sink
          </Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route path="/_kitchen-sink" element={<KitchenSink />} />
      </Routes>

      <CommentWidget
        config={WIDGET_CONFIG}
        pageKey={pathname}
        pageLabel={PAGE_LABELS[pathname] ?? pathname}
      />
    </div>
  );
}
```

주의: `WIDGET_CONFIG` 는 **모듈 상수** — App 이 라우트 변경마다 리렌더되므로 config 객체를 렌더 내부에서 만들면 WidgetProvider 의 QueryClient/SupabaseClient 가 재생성될 수 있다.

이 시점에서는 `supabaseEnv.ts` 가 없어 typecheck 이 실패한다 — Step 5 에서 함께 생성 후 검증한다.

- [ ] **Step 5: `src/supabaseEnv.ts` 생성 (Task 6 에서 vite.config 도 이 모듈을 쓰게 됨)**

```ts
/**
 * Supabase 접속정보 해석. 앱(import.meta.env)과 vite.config(process.env)이 공유한다.
 * env 미설정 시 호스티드 데모 프로젝트로 폴백 — publishable(anon) 키라 secret 아님.
 */
export interface SupabaseStorage {
  url: string;
  publicKey: string;
}

const DEFAULT_URL = "https://rcspbbhdwffpnimefyeu.supabase.co";
const DEFAULT_PUBLIC_KEY = "sb_publishable_1xY8wrIcq36-nf4DULOWGg_o2NTWzdJ";

export function resolveSupabaseStorage(
  env: Record<string, string | undefined>
): SupabaseStorage {
  return {
    url: env["VITE_SUPABASE_URL"] ?? DEFAULT_URL,
    publicKey: env["VITE_SUPABASE_PUBLIC_KEY"] ?? DEFAULT_PUBLIC_KEY,
  };
}
```

- [ ] **Step 6: typecheck + biome**

```powershell
pnpm --filter agentic-prd-playground typecheck
pnpm dlx @biomejs/biome@2.1.1 check apps/playground/src
```

Expected: 둘 다 에러 0. (react-router v7 는 `react-router` 단일 패키지에서 `BrowserRouter`/`Link`/`Routes` 를 export 한다 — `react-router-dom` 불필요.)

- [ ] **Step 7: 수동 스모크 — play 기동**

```powershell
pnpm play
```

브라우저에서 `http://localhost:5173/_kitchen-sink` 접속: 기존 키친싱크가 헤더 아래 그대로 렌더되고, 위젯 툴바가 뜨는지 확인. `/` 는 `/products` 로 redirect 되어 빈 화면(라우트 미등록)이어도 OK — Task 3 에서 채워짐. 확인 후 서버 종료.

- [ ] **Step 8: Commit**

```powershell
git add apps/playground
git commit -m @'
feat(playground): react-router layout + kitchen sink route + supabase env module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 2: 데모 데이터 + 장바구니 컨텍스트

**Files:**
- Create: `apps/playground/src/data.ts`
- Create: `apps/playground/src/cart.tsx`
- Modify: `apps/playground/src/index.tsx` (CartProvider 래핑)

- [ ] **Step 1: `src/data.ts` 생성**

```ts
/** 데모 상품 정적 데이터. 품절 2건 포함 — planted issue #2(품절 시각 구분)의 대상. */
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  soldOut: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "미니 기계식 키보드",
    category: "키보드",
    price: 129000,
    description: "68키 저소음 적축, 무선/유선 겸용.",
    soldOut: false,
  },
  {
    id: "p2",
    name: "무선 버티컬 마우스",
    category: "마우스",
    price: 59000,
    description: "손목 부담을 줄이는 57도 버티컬 그립.",
    soldOut: false,
  },
  {
    id: "p3",
    name: "4K 웹캠",
    category: "영상",
    price: 189000,
    description: "오토포커스 + 듀얼 마이크 내장.",
    soldOut: true,
  },
  {
    id: "p4",
    name: "USB-C 도킹 스테이션",
    category: "허브",
    price: 239000,
    description: "듀얼 4K 출력, 100W PD 패스스루.",
    soldOut: false,
  },
  {
    id: "p5",
    name: "노이즈캔슬링 헤드폰",
    category: "오디오",
    price: 359000,
    description: "하이브리드 ANC, 40시간 재생.",
    soldOut: true,
  },
  {
    id: "p6",
    name: "듀얼 모니터 암",
    category: "거치대",
    price: 99000,
    description: "32인치 2대 지원 가스 스프링 암.",
    soldOut: false,
  },
];
```

- [ ] **Step 2: `src/cart.tsx` 생성**

```tsx
/**
 * 장바구니 client state. 데모용이라 라이브러리 없이 Context + useState.
 * (위젯의 "모듈 싱글톤 금지" 규약과 동일하게 Provider 주입형으로 둔다.)
 */
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Product } from "./data";

export interface CartItem {
  product: Product;
  qty: number;
}

interface CartValue {
  items: CartItem[];
  add: (product: Product, qty: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const value = useMemo<CartValue>(
    () => ({
      items,
      add: (product, qty) =>
        setItems((prev) => {
          const existing = prev.find((i) => i.product.id === product.id);
          if (existing) {
            return prev.map((i) =>
              i.product.id === product.id ? { ...i, qty: i.qty + qty } : i
            );
          }
          return [...prev, { product, qty }];
        }),
      setQty: (productId, qty) =>
        setItems((prev) =>
          prev.map((i) => (i.product.id === productId ? { ...i, qty } : i))
        ),
      remove: (productId) =>
        setItems((prev) => prev.filter((i) => i.product.id !== productId)),
      clear: () => setItems([]),
    }),
    [items]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart 는 CartProvider 안에서만 사용");
  return ctx;
}
```

- [ ] **Step 3: `src/index.tsx` 에 CartProvider 래핑**

`<BrowserRouter><App /></BrowserRouter>` → `<BrowserRouter><CartProvider><App /></CartProvider></BrowserRouter>`, `import { CartProvider } from "./cart";` 추가.

- [ ] **Step 4: typecheck + biome**

```powershell
pnpm --filter agentic-prd-playground typecheck
pnpm dlx @biomejs/biome@2.1.1 check apps/playground/src
```

Expected: 에러 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/playground/src
git commit -m @'
feat(playground): demo product data + cart context

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 3: /products 화면 (planted issues 1, 2, 3)

**Files:**
- Create: `apps/playground/src/routes/Products.tsx`
- Modify: `apps/playground/src/App.tsx` (라우트 등록)

- [ ] **Step 1: `src/routes/Products.tsx` 생성**

의도적 결함 — **절대 "고치지" 말 것** (검증 대상):
- 결함 1: 가격이 `{product.price}원` — `toLocaleString()` 없음.
- 결함 2: `soldOut` 상품 카드가 일반 카드와 동일하게 렌더 (흐림/배지 없음, 담기 버튼도 활성).
- 결함 3: 수량 입력에 `min={1}` 만 있고 `max` 없음.

```tsx
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@agentic-prd/widget";
import { useState } from "react";
import { useCart } from "../cart";
import { PRODUCTS, type Product } from "../data";

/** 상품 카드 + 상세 Dialog. 상세에서 수량을 정해 장바구니에 담는다. */
function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  return (
    <div
      data-testid={`product-card-${product.id}`}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <p className="text-slate-400 text-xs">{product.category}</p>
      <h3 className="mt-1 font-semibold text-sm">{product.name}</h3>
      <p
        data-testid={`product-price-${product.id}`}
        className="mt-2 font-bold text-lg"
      >
        {product.price}원
      </p>
      <Dialog>
        <DialogTrigger
          data-testid={`product-open-${product.id}`}
          className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-sm text-white hover:bg-slate-700"
        >
          상세 보기
        </DialogTrigger>
        <DialogContent className="w-96 rounded-xl bg-white p-5 shadow-xl">
          <DialogTitle className="font-semibold text-lg">
            {product.name}
          </DialogTitle>
          <DialogDescription className="mt-1 text-slate-500 text-sm">
            {product.description}
          </DialogDescription>
          <label className="mt-4 block font-medium text-sm">
            수량
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              data-testid="product-qty-input"
              className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <DialogClose className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">
              닫기
            </DialogClose>
            <DialogClose
              data-testid={`product-add-${product.id}`}
              onClick={() => add(product, qty)}
              className="rounded-lg bg-primary px-3 py-1.5 font-medium text-sm text-white"
            >
              장바구니 담기
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 상품 목록 화면. */
export function Products() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-bold text-2xl">상품 목록</h1>
      <p className="mt-2 text-slate-600 text-sm">
        데모 스토어의 전체 상품입니다.
      </p>
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: App.tsx 라우트 등록**

`import { Products } from "./routes/Products";` 추가, Routes 에 `<Route path="/products" element={<Products />} />` 추가.

- [ ] **Step 3: typecheck + biome**

```powershell
pnpm --filter agentic-prd-playground typecheck
pnpm dlx @biomejs/biome@2.1.1 check apps/playground/src
```

Expected: 에러 0. 주의: base-ui `DialogClose` 가 `onClick` prop 을 받는지 — 위젯 shadcn 래퍼는 native props 를 전달하므로 동작해야 하나, 타입 에러 시 `render` prop 대신 `DialogClose` 를 버튼으로 두고 `onClick` 병행이 되는지 `packages/widget/src/components/ui/dialog.tsx` 를 확인해 맞출 것.

- [ ] **Step 4: 수동 스모크**

`pnpm play` → `/products`: 카드 6개, 상세 Dialog 열림/수량 변경/담기 동작 확인. 가격이 `129000원`(콤마 없음)으로 보이는 것이 **정상(의도된 결함)**. 확인 후 종료.

- [ ] **Step 5: Commit**

```powershell
git add apps/playground/src
git commit -m @'
feat(playground): products route with detail dialog (planted issues 1-3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 4: /cart 화면 (planted issue 4)

**Files:**
- Create: `apps/playground/src/routes/Cart.tsx`
- Modify: `apps/playground/src/App.tsx` (라우트 등록)

- [ ] **Step 1: `src/routes/Cart.tsx` 생성**

의도적 결함 4: 장바구니가 비어도 결제 버튼이 활성(비활성화/안내 없음) — **고치지 말 것**.

```tsx
import { useNavigate } from "react-router";
import { useCart } from "../cart";

/** 장바구니 화면. 수량 조절/삭제/합계 + 결제 진행. */
export function Cart() {
  const { items, setQty, remove } = useCart();
  const navigate = useNavigate();
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.qty,
    0
  );
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-bold text-2xl">장바구니</h1>
      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">상품</th>
              <th className="px-4 py-3 font-medium">단가</th>
              <th className="px-4 py-3 font-medium">수량</th>
              <th className="px-4 py-3 font-medium">금액</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  장바구니가 비어 있습니다.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.product.id} data-testid={`cart-row-${item.product.id}`}>
                  <td className="px-4 py-3">{item.product.name}</td>
                  <td className="px-4 py-3">
                    {item.product.price.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) =>
                        setQty(item.product.id, Number(e.target.value))
                      }
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {(item.product.price * item.qty).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(item.product.id)}
                      className="text-slate-400 text-xs hover:text-red-500"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex items-center justify-end gap-6">
        <p className="text-sm text-slate-600">
          합계{" "}
          <span data-testid="cart-total" className="font-bold text-lg text-slate-900">
            {total.toLocaleString()}원
          </span>
        </p>
        <button
          type="button"
          data-testid="cart-pay-button"
          onClick={() => navigate("/checkout")}
          className="rounded-lg bg-primary px-5 py-2.5 font-medium text-sm text-white hover:opacity-90"
        >
          결제하기
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: App.tsx 라우트 등록** (`<Route path="/cart" element={<Cart />} />`)

- [ ] **Step 3: typecheck + biome** (Task 3 Step 3 과 동일 명령, 에러 0)

- [ ] **Step 4: Commit**

```powershell
git add apps/playground/src
git commit -m @'
feat(playground): cart route (planted issue 4)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 5: /checkout 화면 (planted issues 5, 6)

**Files:**
- Create: `apps/playground/src/routes/Checkout.tsx`
- Modify: `apps/playground/src/App.tsx` (라우트 등록)

- [ ] **Step 1: `src/routes/Checkout.tsx` 생성**

의도적 결함 — **고치지 말 것**:
- 결함 5: 이메일이 비어있는지만 검사(형식 검증 없음, input type 도 `text`).
- 결함 6: 배송방법 미선택이어도 검증/에러 문구 없이 통과.

주의: 데모에 `alert()` 금지(브라우저 자동화를 막음) — 완료 상태는 인라인 메시지로.

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentic-prd/widget";
import { useState } from "react";
import { useCart } from "../cart";

const SHIPPING_METHODS = ["일반 배송 (무료)", "당일 배송 (+5,000원)"];

/** 체크아웃 화면. 배송 정보 폼 + 배송방법 선택 + 주문 접수. */
export function Checkout() {
  const { items, clear } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [shipping, setShipping] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.qty,
    0
  );

  const submit = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next["name"] = "이름을 입력하세요.";
    if (!email.trim()) next["email"] = "이메일을 입력하세요.";
    if (!address.trim()) next["address"] = "주소를 입력하세요.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setDone(true);
    clear();
  };

  if (done) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-bold text-2xl">주문이 접수되었습니다</h1>
        <p className="mt-2 text-slate-600 text-sm" data-testid="checkout-done">
          데모 주문이라 실제 결제는 일어나지 않습니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="font-bold text-2xl">체크아웃</h1>
      <p className="mt-2 text-slate-600 text-sm">
        주문 금액 {total.toLocaleString()}원
      </p>

      <div className="mt-8 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="block font-medium text-sm">
          이름
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="checkout-name-input"
            className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            placeholder="주문자 이름"
          />
          {errors["name"] && (
            <p className="mt-1 font-normal text-red-500 text-xs">
              {errors["name"]}
            </p>
          )}
        </label>

        <label className="block font-medium text-sm">
          이메일
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="checkout-email-input"
            className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            placeholder="you@example.com"
          />
          {errors["email"] && (
            <p className="mt-1 font-normal text-red-500 text-xs">
              {errors["email"]}
            </p>
          )}
        </label>

        <label className="block font-medium text-sm">
          배송지 주소
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            data-testid="checkout-address-input"
            className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            placeholder="도로명 주소"
          />
          {errors["address"] && (
            <p className="mt-1 font-normal text-red-500 text-xs">
              {errors["address"]}
            </p>
          )}
        </label>

        <div>
          <p className="font-medium text-sm">배송 방법</p>
          <Select value={shipping} onValueChange={setShipping}>
            <SelectTrigger
              data-testid="shipping-select-trigger"
              className="mt-1 inline-flex w-full items-center justify-between rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            >
              <SelectValue placeholder="배송 방법 선택" />
            </SelectTrigger>
            <SelectContent className="rounded-lg border border-slate-200 bg-white shadow-lg">
              {SHIPPING_METHODS.map((method) => (
                <SelectItem
                  key={method}
                  value={method}
                  className="cursor-pointer rounded px-3 py-1.5 text-sm data-highlighted:bg-slate-100"
                >
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          data-testid="checkout-submit"
          onClick={submit}
          className="mt-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-sm text-white hover:opacity-90"
        >
          주문하기
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: App.tsx 라우트 등록** (`<Route path="/checkout" element={<Checkout />} />`)

- [ ] **Step 3: typecheck + biome** (에러 0)

주의: 위젯 `Select` 래퍼의 value/onValueChange prop 시그니처는 `packages/widget/src/components/ui/select.tsx` 를 확인해 맞출 것 (base-ui 는 `value`/`onValueChange`).

- [ ] **Step 4: 수동 스모크**

`pnpm play` → `/products` 에서 담기 → `/cart` 수량/합계 → `/checkout` 폼 제출(빈 값 에러, 채우면 완료 화면). 이메일에 `abc` 만 넣어도 통과하는 것이 **정상(의도된 결함)**. 각 화면에서 위젯 툴바로 코멘트 모드 진입이 되는지도 확인. 종료.

- [ ] **Step 5: Commit**

```powershell
git add apps/playground/src
git commit -m @'
feat(playground): checkout route (planted issues 5-6)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 6: vite.config 의 storage 를 env 기반으로 전환

**Files:**
- Modify: `apps/playground/vite.config.ts`

- [ ] **Step 1: vite.config.ts 수정**

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import agenticPRDDev from "@agentic-prd/dev-plugin";
import { resolveSupabaseStorage } from "./src/supabaseEnv";

/**
 * 위젯 개발용 플레이그라운드. @agentic-prd/dev-plugin 이 dev 서버에 사이드카로
 * 붙어 코멘트/스펙 조회 endpoint 를 열어준다.
 * storage 는 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLIC_KEY env 로 오버라이드 가능
 * (Playwright 시드가 로컬 Supabase 를 가리킬 때 사용). 미설정 시 호스티드 폴백.
 */
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths({
      projects: ["../../packages/widget/tsconfig.json", "./tsconfig.json"],
    }),
    agenticPRDDev({
      storage: resolveSupabaseStorage(process.env),
      specSyncDir: "docs/specs",
    }),
  ],
});
```

- [ ] **Step 2: typecheck + 스모크**

```powershell
pnpm --filter agentic-prd-playground typecheck
pnpm play
```

Expected: dev 서버 기동, `.agentic-prd.dev.json` 생성. `Invoke-RestMethod "http://127.0.0.1:<port>/__agentic-prd/threads"` 가 JSON 응답(호스티드 데이터)을 주는지 확인 후 종료. (`<port>` 는 `.agentic-prd.dev.json` 의 실제 값)

- [ ] **Step 3: Commit**

```powershell
git add apps/playground/vite.config.ts
git commit -m @'
feat(playground): env-driven supabase storage for app and dev-plugin

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 7: 로컬 Supabase 마이그레이션

**Files:**
- Create: `supabase/migrations/20260707000000_demo_tables.sql`

배경: 리포의 `supabase/` 엔 config.toml 만 있고 마이그레이션이 없다(스키마는 호스티드에만 존재). 로컬 `supabase start` 가 빈 DB 로 뜨므로 스키마를 마이그레이션으로 재현해야 한다. 스키마 원천: `packages/widget/src/database.types.ts`.

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- demo_comments / demo_specs: 위젯(anon publishable key)이 CRUD 하는 데모 테이블.
-- 호스티드 프로젝트와 동일 스키마 (packages/widget/src/database.types.ts 기준).
create table if not exists public.demo_comments (
  id text primary key,
  path text not null,
  x_pct double precision not null,
  y_pct double precision not null,
  anchor jsonb,
  resolved boolean not null default false,
  comments jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_specs (
  id text primary key,
  path text not null,
  title text not null default '',
  status text not null default 'DRAFT',
  sections jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.demo_comments enable row level security;
alter table public.demo_specs enable row level security;

-- 데모 전용: anon 포함 전체 허용 (호스티드의 publishable-key CRUD 동작과 동일하게)
create policy "demo_comments_all" on public.demo_comments
  for all using (true) with check (true);
create policy "demo_specs_all" on public.demo_specs
  for all using (true) with check (true);
```

(SQL 파일은 biome JSDoc 규칙 대상 아님 — `--` 주석 허용.)

- [ ] **Step 2: 로컬 스택 기동 검증 (docker 필요)**

```powershell
supabase start
```

Expected: 컨테이너 기동 후 API URL `http://127.0.0.1:54321` 출력. 마이그레이션이 자동 적용된다. 이미 떠있었다면 `supabase db reset` 으로 재적용.

```powershell
supabase status
```

Expected: `API URL`, `anon key`, `service_role key` 출력 — 값들을 Task 8 의 기본 상수와 대조.

docker 미설치 등으로 실패 시: 이 태스크는 SQL 커밋까지만 하고, Task 8~9 의 로컬 실행 검증은 블로킹 이슈로 보고할 것 (설계의 리스크 항목 — Playwright 경로 스킵 허용).

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations
git commit -m @'
feat(supabase): demo tables migration for local stack

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 8: Playwright 세팅 + global-setup (truncate + PRD 시드)

**Files:**
- Modify: `apps/playground/package.json`
- Create: `apps/playground/playwright.config.ts`
- Create: `apps/playground/e2e/local-supabase.ts`
- Create: `apps/playground/e2e/global-setup.ts`

- [ ] **Step 1: 의존성 + 스크립트**

```powershell
pnpm --filter agentic-prd-playground add -D "@playwright/test" "@supabase/supabase-js"
pnpm --filter agentic-prd-playground exec playwright install chromium
```

`apps/playground/package.json` scripts 에 추가 (**`test` 라는 이름 금지** — turbo `pnpm test` 가 docker 의존 e2e 를 끌어가면 안 됨):

```json
"test:e2e": "playwright test"
```

- [ ] **Step 2: `e2e/local-supabase.ts` 생성**

```ts
/**
 * 로컬 Supabase 접속 상수. 아래 두 JWT 는 supabase CLI 가 모든 로컬 프로젝트에
 * 공통으로 쓰는 공개 데모 키(secret 아님, supabase docs 에 그대로 실려 있음).
 * CLI 버전에 따라 값이 다르면 `supabase status` 출력으로 env 오버라이드할 것.
 */
export const LOCAL_SUPABASE_URL =
  process.env["LOCAL_SUPABASE_URL"] ?? "http://127.0.0.1:54321";

export const LOCAL_SUPABASE_ANON_KEY =
  process.env["LOCAL_SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const LOCAL_SUPABASE_SERVICE_KEY =
  process.env["LOCAL_SUPABASE_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
```

**실행 전 반드시 `supabase status` 의 실제 anon/service_role 키와 대조**하고, 다르면 위 기본값을 실제 값으로 교체할 것 (공개 데모 키이므로 커밋 가능).

- [ ] **Step 3: `e2e/global-setup.ts` 생성 — truncate + PRD 3건 insert**

```ts
/**
 * Playwright 전역 셋업: 로컬 Supabase 를 빈 상태로 초기화하고 PRD 3건을 시드한다.
 * 코멘트는 UI 경로 검증이 목적이라 spec 파일에서 위젯으로 남기지만, PRD 는 앵커가
 * 없어 직접 insert 로 충분하다 (설계 문서 §3).
 */
import { createClient } from "@supabase/supabase-js";
import {
  LOCAL_SUPABASE_SERVICE_KEY,
  LOCAL_SUPABASE_URL,
} from "./local-supabase";

const PRODUCTS_PRD = `## 상품 노출 정책

- 가격은 천단위 콤마를 넣어 \`1,290,000원\` 형식으로 표기한다.
- 품절 상품은 카드 전체를 흐림 처리하고 "품절" 배지를 표시하며, 장바구니 담기를 막는다.
- 상세 다이얼로그의 수량은 1 이상 99 이하만 입력할 수 있다.`;

const CART_PRD = `## 장바구니 규칙

- 장바구니가 비어 있으면 결제하기 버튼을 비활성화하고 "상품을 먼저 담아주세요" 안내를 보여준다.
- 합계는 수량 변경 즉시 재계산한다.`;

const CHECKOUT_PRD = `## 체크아웃 validation 정책

- 이메일은 형식(\`local@domain\`)을 검증하고, 불일치 시 "올바른 이메일 형식이 아닙니다"를 보여준다.
- 배송 방법은 필수 선택이다. 미선택 제출 시 "배송 방법을 선택하세요" 에러를 보여준다.`;

async function globalSetup() {
  const sb = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_KEY);
  const wipeComments = await sb.from("demo_comments").delete().neq("id", "");
  if (wipeComments.error) throw new Error(wipeComments.error.message);
  const wipeSpecs = await sb.from("demo_specs").delete().neq("id", "");
  if (wipeSpecs.error) throw new Error(wipeSpecs.error.message);

  const seeded = await sb.from("demo_specs").insert([
    {
      id: "spec_seed_products",
      path: "/products",
      title: "상품 목록 정책",
      status: "APPROVED",
      sections: { body: PRODUCTS_PRD },
      updated_by: "검증봇",
    },
    {
      id: "spec_seed_cart",
      path: "/cart",
      title: "장바구니 정책",
      status: "APPROVED",
      sections: { body: CART_PRD },
      updated_by: "검증봇",
    },
    {
      id: "spec_seed_checkout",
      path: "/checkout",
      title: "체크아웃 정책",
      status: "APPROVED",
      sections: { body: CHECKOUT_PRD },
      updated_by: "검증봇",
    },
  ]);
  if (seeded.error) throw new Error(seeded.error.message);
}

export default globalSetup;
```

- [ ] **Step 4: `playwright.config.ts` 생성**

```ts
import { defineConfig } from "@playwright/test";
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_URL,
} from "./e2e/local-supabase";

/**
 * 시드 전용 e2e. 로컬 Supabase(supabase start)를 전제로 하며 turbo test 에
 * 편입하지 않는다 — `pnpm --filter agentic-prd-playground test:e2e` 로만 실행.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5199",
    headless: true,
  },
  webServer: {
    command: "pnpm play --port 5199 --strictPort",
    url: "http://127.0.0.1:5199",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: LOCAL_SUPABASE_URL,
      VITE_SUPABASE_PUBLIC_KEY: LOCAL_SUPABASE_ANON_KEY,
    },
  },
});
```

- [ ] **Step 5: typecheck + biome**

```powershell
pnpm --filter agentic-prd-playground typecheck
pnpm dlx @biomejs/biome@2.1.1 check apps/playground
```

Expected: 에러 0. (playground tsconfig 의 include 가 `e2e/`, `playwright.config.ts` 를 포함하는지 확인 — 안 되면 include 에 추가.)

- [ ] **Step 6: Commit**

```powershell
git add apps/playground
git commit -m @'
feat(playground): playwright harness + local supabase seed setup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 9: seed-comments.spec.ts — 위젯 UI 로 코멘트 6건 시드

**Files:**
- Create: `apps/playground/e2e/seed-comments.spec.ts`

위젯 상호작용에 필요한 사실(코드 확인 완료):
- 닉네임: `localStorage["comment-widget-name"]`, jotai atomWithStorage 라 값은 **JSON 문자열** (`JSON.stringify("검증봇")`).
- 툴바: 코멘트 모드 진입 버튼 텍스트 `코멘트` (addMode 중엔 `취소`), 스레드 수 버튼 `목록 N`.
- 컴포저: `PointPopover` 안 `contenteditable` 에디터 + 제출 버튼 텍스트 `코멘트`(addMode 중이라 툴바 쪽은 `취소`로 바뀌어 이름 충돌 없음). 제출 버튼은 본문이 비면 disabled.
- 위젯 UI 루트는 `[data-comment-root]`.

- [ ] **Step 1: spec 작성**

```ts
/**
 * 실제 위젯 UI 경로(코멘트 모드 → 대상 클릭 → 에디터 입력 → 제출)로 planted
 * issue 6건에 코멘트를 시드한다. 앵커 캡처(fiber/selector/scope chain)가 진짜
 * 사용자 경로로 만들어지는 것이 목적이므로 Supabase 직접 insert 를 쓰지 않는다.
 */
import { expect, type Page, test } from "@playwright/test";

const AUTHOR = "검증봇";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([value]) => {
      window.localStorage.setItem("comment-widget-name", value ?? '""');
    },
    [JSON.stringify(AUTHOR)]
  );
});

async function leaveComment(
  page: Page,
  targetTestId: string,
  text: string,
  expectedCount: number
) {
  await page.getByRole("button", { name: "코멘트", exact: true }).click();
  await page.getByTestId(targetTestId).click();
  const editor = page.locator('[data-comment-root] [contenteditable="true"]');
  await editor.click();
  await page.keyboard.insertText(text);
  await page.getByRole("button", { name: "코멘트", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `목록 ${expectedCount}` })
  ).toBeVisible({ timeout: 10_000 });
}

test("seed /products comments (issues 1-3)", async ({ page }) => {
  await page.goto("/products");
  await leaveComment(
    page,
    "product-price-p1",
    "가격에 천단위 콤마가 빠졌어요. 상품 노출 정책의 표기 형식대로 고쳐주세요.",
    1
  );
  await leaveComment(
    page,
    "product-card-p3",
    "품절 상품이 일반 상품과 똑같이 보여요. 정책대로 흐림 처리하고 품절 배지를 달아주세요.",
    2
  );
  await page.getByTestId("product-open-p1").click();
  await leaveComment(
    page,
    "product-qty-input",
    "수량을 999까지 입력할 수 있어요. 최대 99로 제한해주세요.",
    3
  );
});

test("seed /cart comment (issue 4)", async ({ page }) => {
  await page.goto("/cart");
  await leaveComment(
    page,
    "cart-pay-button",
    "장바구니가 비어 있는데 결제하기 버튼이 눌려요. 규칙대로 비활성화하고 안내 문구를 보여주세요.",
    1
  );
});

test("seed /checkout comments (issues 5-6)", async ({ page }) => {
  await page.goto("/checkout");
  await leaveComment(
    page,
    "checkout-email-input",
    "이메일에 아무 문자나 넣어도 통과돼요. validation 정책대로 형식 검증을 추가해주세요.",
    1
  );
  await leaveComment(
    page,
    "shipping-select-trigger",
    "배송 방법을 안 골랐는데 에러 안내 없이 주문이 돼요. 필수 선택으로 만들어주세요.",
    2
  );
});
```

- [ ] **Step 2: typecheck + biome** (`pnpm --filter agentic-prd-playground typecheck` + biome check `apps/playground` — 에러 0)

- [ ] **Step 3: 실행 (로컬 Supabase 기동 상태에서)**

```powershell
supabase start
pnpm --filter agentic-prd-playground test:e2e
```

Expected: 3 passed. 실패 시 흔한 원인:
- `목록 N` 텍스트 미스매치 → 툴바 버튼 텍스트가 아이콘+텍스트라 `name` 은 accessible name 기준 부분일치로 `page.getByRole("button", { name: /목록/ })` + 텍스트 검증으로 완화.
- 에디터 포커스 문제 → `editor.click()` 뒤 `page.keyboard.insertText` 가 Lexical 의 beforeinput 을 타는지 확인, 안 되면 `page.keyboard.type(text)` 로 폴백.
- Dialog 내부 클릭이 코멘트 캡처로 안 잡힘 → `useCommentCapture` 는 window 캡처라 동작해야 하나, 실패 시 systematic-debugging 으로 원인 파악(스펙을 우회하지 말 것).

- [ ] **Step 4: 시드 결과 dev-plugin 으로 확인**

Playwright webServer 는 종료되므로, 확인은 별도 기동으로:

```powershell
$env:VITE_SUPABASE_URL = "http://127.0.0.1:54321"; $env:VITE_SUPABASE_PUBLIC_KEY = "<local anon key>"; pnpm play
```

`.agentic-prd.dev.json` 의 포트로 `http://127.0.0.1:<port>/__agentic-prd/threads` 조회 → 6건, 각 스레드에 `anchor` 가 null 이 아닌지 확인. 종료 후 env 정리(`Remove-Item Env:VITE_SUPABASE_URL` 등).

- [ ] **Step 5: Commit**

```powershell
git add apps/playground/e2e
git commit -m @'
feat(playground): widget-path comment seeding e2e spec

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 10: 1차 검증 런 — claude-in-chrome (호스티드)

**Files:** 없음 (런타임 활동). 이 태스크는 서브에이전트 위임 불가 — 메인 세션에서 브라우저 도구로 직접 수행.

- [ ] **Step 1: dev 서버 기동 (env 없이 = 호스티드 Supabase)**

```powershell
pnpm play
```

(백그라운드 실행, `.agentic-prd.dev.json` 에서 포트 확인)

- [ ] **Step 2: claude-in-chrome 으로 실제 위젯 조작**

1. 새 탭에서 `http://localhost:<port>/products` 접속.
2. 툴바 "이름 설정" 클릭 → 이름 입력(한글 IME 실패 시 `verifier` 영문 폴백) → Enter.
3. planted issue 6건에 대해 Task 9 와 동일한 시나리오로 코멘트 작성 (코멘트 → 대상 클릭 → 본문 입력 → 제출). 한글 입력이 안 되면 영문 본문으로 폴백하되, **어떤 단계가 왜 실패했는지 기록** (검증 리포트의 "Chrome 자동화 한계" 섹션 재료).
4. 각 화면에서 툴바 "문서" 로 SpecPanel 열어 PRD 3건 작성 (제목+본문, Task 8 의 PRD 마크다운 내용 사용). SpecPanel 편집이 자동화로 어려우면 이 단계만 dev-plugin 이 아닌 Supabase 호스티드에 직접 insert 로 폴백하고 기록.
5. 실패가 2~3회 반복되는 단계는 중단하고 사용자에게 보고 (브라우저 자동화 rabbit hole 금지 규칙).

- [ ] **Step 3: 시드 확인**

`http://127.0.0.1:<port>/__agentic-prd/threads` 로 6건 + anchor 채워짐 확인.

- [ ] **Step 4: 결과 기록**

성공/폴백/실패 내역을 scratchpad 에 메모해 두고 Task 11 리포트에 반영. 커밋 없음.

---

### Task 11: 에이전틱 루프 실행 + 채점 + 검증 리포트

**Files:**
- Create: `docs/superpowers/specs/2026-07-07-agentic-loop-verification-report.md`
- Modify: `AGENTS.md` (구조 트리에 playground routes/e2e + supabase/migrations 반영)
- Modify: 데모 코드 (코멘트에 따른 실제 수정 — 결함별 커밋)

이 태스크는 메인 세션에서 수행하되, **"소스 힌트 없이"** 조건을 지키기 위해 각 결함의 수정 작업은 스레드 정보(코멘트 본문 + anchor + location candidates + PRD)만 프롬프트에 담아 서브에이전트에 위임한다 (서브에이전트는 이 플랜 문서와 정답표를 읽지 않는다).

- [ ] **Step 1: PRD 동기화**

dev 서버 기동 상태에서 `/agentic-prd:sync-specs` (또는 `http://127.0.0.1:<port>/__agentic-prd/specs/sync` POST) → `docs/specs/` 에 PRD 3건 생성 확인.

- [ ] **Step 2: 스레드 목록 + 상세 수집**

`/agentic-prd:list-threads` → 6건. 각 id 에 대해 `/agentic-prd:thread <id>` 응답 저장(scratchpad). 각 응답의 location candidates 를 정답표(플랜 상단)와 대조해 기록:
- **top-5 안에 정답 파일 포함 여부** (핵심 지표)
- 후보 순위, confidence, 사용된 전략(testid/reactPath/...)

- [ ] **Step 3: 결함별 수정 위임 (6회)**

각 스레드마다 서브에이전트에 다음만 제공: 코멘트 본문, anchor JSON, location candidates, 해당 path 의 PRD 마크다운, "apps/playground 코드베이스에서 이 코멘트를 해소하는 최소 수정을 하라". 완료 후:
- 수정이 정답표의 의도된 해법과 일치하는지 메인 세션이 채점.
- `pnpm --filter agentic-prd-playground typecheck` + biome 통과 확인.
- 결함별 커밋: `fix(playground): resolve comment <n> — <요약>`.
- `/agentic-prd:resolve <id>` 로 스레드 resolve.

- [ ] **Step 4: 리포트 작성**

`docs/superpowers/specs/2026-07-07-agentic-loop-verification-report.md`:
- 요약: N/6 위치 특정 성공, M/6 수정 성공, 성공 기준(5/6) 충족 여부.
- 결함별 표: 코멘트, anchor 요약, 후보 top-5, 정답 포함 여부/순위, 수정 결과.
- Chrome 자동화 한계 기록 (Task 10 메모).
- 실패 건 → anchor 캡처/anchor-resolver 개선 백로그 목록.

- [ ] **Step 5: AGENTS.md 구조 갱신**

구조 트리의 playground 항목에 `routes/`, `e2e/`, `supabaseEnv.ts` 반영, `supabase/` 항목에 `migrations/` 반영. CLAUDE.md 는 AGENTS.md 참조라 수정 불요.

- [ ] **Step 6: 최종 검증 + Commit**

```powershell
pnpm typecheck
pnpm dlx @biomejs/biome@2.1.1 check apps/playground
git add docs AGENTS.md
git commit -m @'
docs: agentic loop verification report + structure sync

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

## Self-Review 결과

- **스펙 커버리지:** 데모 앱(§1)=Task 1~5, planted issues(§2)=Task 3~5, PRD 시드(§3)=Task 8/10, 데이터 생성 2단계(§4)=Task 9(Playwright)+10(Chrome), env 전환+로컬 Supabase(§4)=Task 6~7, 검증 프로토콜/성공기준/리포트(§5)=Task 11. 누락 없음.
- **플레이스홀더:** 코드 스텝 전부 완성 코드 포함. 로컬 Supabase 키는 "supabase status 로 대조" 라는 검증 절차와 함께 제공 — CLI 버전에 따른 가변값이라 절차가 정답.
- **타입 일관성:** `resolveSupabaseStorage` 시그니처(Task 1 Step 5 ↔ Task 6), `useCart` 인터페이스(Task 2 ↔ 3/4/5), data-testid(Task 3~5 ↔ Task 9 ↔ 정답표) 상호 일치 확인.
