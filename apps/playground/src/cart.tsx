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
