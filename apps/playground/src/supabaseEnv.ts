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
