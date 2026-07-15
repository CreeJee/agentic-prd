#!/usr/bin/env node
/**
 * agentic-prd Claude Code plugin local installer.
 *
 * Links (or copies) `plugins/agentic-prd-skill` into `~/.claude/plugins/` so a
 * cloned repo can install the plugin with one command: `pnpm skill:install`.
 * The repo root is resolved from this script's own location, so it works from
 * any cwd.
 *
 * Flags:
 *   --copy         copy instead of symlink (survives deleting the repo clone)
 *   --force        replace whatever already exists at the destination
 *   --dest <dir>   install into <dir> instead of ~/.claude/plugins
 */
import { cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_NAME = "agentic-prd-skill";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(repoRoot, "plugins", PLUGIN_NAME);

const args = process.argv.slice(2);
const useCopy = args.includes("--copy");
const useForce = args.includes("--force");
const destFlag = args.indexOf("--dest");
const destBase =
  destFlag !== -1 && args[destFlag + 1]
    ? resolve(args[destFlag + 1])
    : join(homedir(), ".claude", "plugins");
const target = join(destBase, PLUGIN_NAME);

/**
 * Describes what currently occupies the target path.
 * @returns {"missing" | "same-link" | "other"}
 */
function targetState() {
  let stat;
  try {
    stat = lstatSync(target);
  } catch {
    return "missing";
  }
  if (stat.isSymbolicLink()) {
    try {
      if (resolve(dirname(target), readlinkSync(target)) === source) return "same-link";
    } catch {
      return "other";
    }
  }
  return "other";
}

if (!existsSync(source)) {
  console.error(`plugin source not found: ${source}`);
  process.exit(1);
}

const state = targetState();
if (state === "same-link" && !useCopy) {
  console.log(`already installed (symlink): ${target} -> ${source}`);
  console.log("nothing to do.");
  process.exit(0);
}
if (state !== "missing") {
  if (!useForce) {
    console.error(`refusing to overwrite existing path: ${target}`);
    console.error("re-run with --force to replace it.");
    process.exit(1);
  }
  rmSync(target, { recursive: true, force: true });
}

mkdirSync(destBase, { recursive: true });
if (useCopy) {
  cpSync(source, target, { recursive: true });
  console.log(`copied ${source} -> ${target}`);
} else {
  symlinkSync(source, target, process.platform === "win32" ? "junction" : "dir");
  console.log(`linked ${target} -> ${source}`);
}

console.log("");
console.log("next steps:");
console.log("  1. restart Claude Code (or run /reload-plugins)");
console.log("  2. start the dev server: pnpm play");
console.log("  3. verify: /agentic-prd:list-threads");
console.log("");
console.log("prefer a managed install? use the plugin marketplace instead:");
console.log("  claude plugin marketplace add CreeJee/agentic-prd");
console.log("  claude plugin install agentic-prd@agentic-prd");
