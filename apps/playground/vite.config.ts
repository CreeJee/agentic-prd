import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * 위젯 개발용 플레이그라운드. root 는 이 디렉터리이며 워크스페이스에서
 * @agentic-prd/widget 을 그대로 import 한다(빌드 불필요).
 */
export default defineConfig({
  plugins: [tailwindcss(), react()]
});
