import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  platform: "node",
  format: ["esm"],
  external: ["vite", "@supabase/supabase-js"],
  dts: true,
  clean: true
});
