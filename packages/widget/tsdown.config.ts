import { defineConfig } from "tsdown";
import packageJSON from "./package.json" with { type: "json" };

/**
 * peerDependencies(react/react-dom)는 호스트가 제공하므로 번들에 포함하지 않는다.
 */
const neverBundle = Object.keys(packageJSON.peerDependencies);

export default defineConfig({
  dts: {
    tsgo: true,
  },
  exports: true,
  clean: false,
  platform: "neutral",
  fromVite: true,
  deps: {
    neverBundle,
  },
  entry: {
    index: "src/index.ts",
  },
});
