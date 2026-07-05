import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * 위젯 개발용 플레이그라운드. root 는 이 디렉터리이며 워크스페이스에서
 * @agentic-prd/widget 을 그대로 import 한다(빌드 불필요).
 * vite-tsconfig-paths 는 위젯 패키지 내부의 @/* alias(=packages/widget/src/*) 를
 * Vite dev 서버가 resolve 하도록 해준다.
 */
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths({
      projects: ["../../packages/widget/tsconfig.json", "./tsconfig.json"],
    }),
  ],
});
