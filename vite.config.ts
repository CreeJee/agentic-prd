/// <reference types="vitest/config" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * 위젯 개발용 플레이그라운드 설정.
 * root를 ./playground로 두고, App이 ../src의 위젯 소스를 직접 임포트한다(빌드 불필요).
 */
export default defineConfig({
  root: "./playground",
  plugins: [tailwindcss(), react()],
  resolve: {
    tsconfigPaths: true
  }
});
