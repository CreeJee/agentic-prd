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
