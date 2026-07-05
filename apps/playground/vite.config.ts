import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import agenticPRDDev from "@agentic-prd/dev-plugin";

/**
 * 위젯 개발용 플레이그라운드. @agentic-prd/dev-plugin 이 dev 서버에 사이드카로
 * 붙어 코멘트/스펙 조회 endpoint 를 열어준다.
 * vite-tsconfig-paths 는 위젯 패키지 내부의 @/* alias(=packages/widget/src/*) 를
 * Vite dev 서버가 resolve 하도록 해준다.
 */
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths({ projects: ["../../packages/widget/tsconfig.json", "./tsconfig.json"] }),
    agenticPRDDev({
      storage: {
        url: "https://rcspbbhdwffpnimefyeu.supabase.co",
        publicKey: "sb_publishable_1xY8wrIcq36-nf4DULOWGg_o2NTWzdJ"
      },
      specSyncDir: "docs/specs"
    })
  ]
});
