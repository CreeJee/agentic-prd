import agenticPRDDev from "@agentic-prd/dev-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolveSupabaseStorage } from "./src/supabaseEnv";

/**
 * 위젯 개발용 플레이그라운드. @agentic-prd/dev-plugin 이 dev 서버에 사이드카로
 * 붙어 코멘트/스펙 조회 endpoint 를 열어준다.
 * vite-tsconfig-paths 는 위젯 패키지 내부의 @/* alias(=packages/widget/src/*) 를
 * Vite dev 서버가 resolve 하도록 해준다.
 * storage 는 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLIC_KEY env 로 오버라이드 가능
 * (Playwright 시드가 로컬 Supabase 를 가리킬 때 사용). 미설정 시 호스티드 폴백.
 */
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths({
      projects: ["../../packages/widget/tsconfig.json", "./tsconfig.json"],
    }),
    agenticPRDDev({
      storage: resolveSupabaseStorage(process.env),
      specSyncDir: "docs/specs",
    }),
  ],
});
