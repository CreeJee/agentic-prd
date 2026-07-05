import { build, context } from "esbuild";

/**
 * dev-plugin 은 Node ESM 환경(Vite dev 서버)에서 실행된다. tsdown/rolldown-dts 가
 * repo 의 TS 7-rc 와 peer-dep 충돌을 일으켜 esbuild 로 직접 번들한다. types 는
 * package.json 의 exports 가 src/index.ts 를 그대로 노출하므로 별도 emit 없음.
 */
const opts = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/index.js",
  packages: "external",
  target: "node20",
  sourcemap: true,
  logLevel: "info"
};

if (process.argv.includes("--watch")) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log("[dev-plugin] watching src/**");
} else {
  await build(opts);
}
