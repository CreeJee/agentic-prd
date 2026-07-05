import { defineConfig } from "tsdown";
import packageJSON from "./package.json" with { type: "json" };

/**
 * peerDependencies(vite)는 호스트 프로젝트가 제공하고, runtime dep 인
 * `@supabase/supabase-js` 는 여기서 함께 두어 번들에 안 담기게 external 처리.
 * dts.tsgo=true 로 tsc 대신 typescript-native-preview 로 declaration 생성 →
 * rolldown-plugin-dts × typescript 7.0.1-rc peer 충돌 우회.
 */
const neverBundle = [
  ...Object.keys(packageJSON.peerDependencies ?? {}),
  ...Object.keys(packageJSON.dependencies ?? {}),
];

export default defineConfig({
  dts: {
    tsgo: true,
  },
  exports: true,
  clean: false,
  platform: "node",
  fromVite: false,
  deps: {
    neverBundle,
  },
  entry: {
    index: "src/index.ts",
  },
});
