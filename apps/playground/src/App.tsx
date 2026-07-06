import { CommentWidget } from "@agentic-prd/widget";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { KitchenSink } from "./routes/KitchenSink";
import { Products } from "./routes/Products";
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
        <Route path="/products" element={<Products />} />
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
