import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** className 합성 — clsx로 조건부 결합 후 tailwind-merge로 충돌 정리 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
