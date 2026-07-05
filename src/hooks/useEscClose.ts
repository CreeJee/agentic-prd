import { useEffect } from "react";

/** active일 때 ESC를 누르면 onEsc 호출 */
export function useEscClose(active: boolean, onEsc: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEsc();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onEsc]);
}
