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
                <tr
                  key={item.product.id}
                  data-testid={`cart-row-${item.product.id}`}
                >
                  <td className="px-4 py-3">{item.product.name}</td>
                  <td className="px-4 py-3">
                    {item.product.price.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setQty(
                          item.product.id,
                          Number.isFinite(next) ? Math.max(1, next) : 1
                        );
                      }}
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
          <span
            data-testid="cart-total"
            className="font-bold text-lg text-slate-900"
          >
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
