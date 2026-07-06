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
      className={`relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
        product.soldOut ? "opacity-50" : ""
      }`}
    >
      {product.soldOut ? (
        <span
          data-testid={`product-soldout-${product.id}`}
          className="absolute top-3 right-3 rounded-full bg-slate-900 px-2 py-0.5 font-medium text-white text-xs"
        >
          품절
        </span>
      ) : null}
      <p className="text-slate-400 text-xs">{product.category}</p>
      <h3 className="mt-1 font-semibold text-sm">{product.name}</h3>
      <p
        data-testid={`product-price-${product.id}`}
        className="mt-2 font-bold text-lg"
      >
        {product.price.toLocaleString()}원
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
              onChange={(e) => {
                const next = Number(e.target.value);
                setQty(Number.isFinite(next) ? Math.max(1, next) : 1);
              }}
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
              disabled={product.soldOut}
              onClick={() => {
                if (product.soldOut) return;
                add(product, qty);
              }}
              className="rounded-lg bg-primary px-3 py-1.5 font-medium text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {product.soldOut ? "품절" : "장바구니 담기"}
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
