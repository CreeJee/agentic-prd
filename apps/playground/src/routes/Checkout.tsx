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

/** 체크아웃 validation 정책의 이메일 형식(local@domain) 검사 정규식. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

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
    else if (!EMAIL_PATTERN.test(email.trim()))
      next["email"] = "올바른 이메일 형식이 아닙니다";
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
