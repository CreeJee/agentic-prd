import { defineConfig } from "@playwright/test";
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_URL,
} from "./e2e/local-supabase";

/**
 * 시드 전용 e2e. 로컬 Supabase(supabase start)를 전제로 하며 turbo test 에
 * 편입하지 않는다 — `pnpm --filter agentic-prd-playground test:e2e` 로만 실행.
 * webServer 는 `--host 127.0.0.1` 로 IPv4 loopback 에 명시 바인딩한다 — 이 환경의
 * Vite 는 host 미지정 시 `[::1]`(IPv6) 에만 바인딩해 `127.0.0.1` baseURL 이
 * connection refused 로 죽는다(webServer 헬스체크 60s 타임아웃으로 관측됨).
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
    command: "pnpm play --port 5199 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:5199",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: LOCAL_SUPABASE_URL,
      VITE_SUPABASE_PUBLIC_KEY: LOCAL_SUPABASE_ANON_KEY,
    },
  },
});
