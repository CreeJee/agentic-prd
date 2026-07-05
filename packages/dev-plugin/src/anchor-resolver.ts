import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { LocationCandidate, WidgetAnchor } from "./types";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".git",
  "docs",
  ".next",
  ".vite",
  "plugins"
]);
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);
const MAX_CANDIDATES = 5;

async function walkSources(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        const dotIdx = entry.name.lastIndexOf(".");
        const ext = dotIdx >= 0 ? entry.name.slice(dotIdx) : "";
        if (SOURCE_EXT.has(ext)) files.push(full);
      }
    }
  }
  const rootStat = await stat(root).catch(() => null);
  if (rootStat?.isDirectory()) await walk(root);
  return files;
}

interface Match {
  file: string;
  line: number;
  evidence: string;
}

async function grepAll(
  files: string[],
  regex: RegExp,
  evidenceFrom: (match: RegExpMatchArray, lineText: string) => string
): Promise<Match[]> {
  const results: Match[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8").catch(() => "");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i] ?? "";
      const match = lineText.match(regex);
      if (match) {
        results.push({
          file,
          line: i + 1,
          evidence: evidenceFrom(match, lineText)
        });
        if (results.length >= MAX_CANDIDATES) return results;
      }
    }
  }
  return results;
}

function extractSelectorAttribute(
  selector: string,
  attr: string
): string | undefined {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[${escaped}=(?:"|')([^"'\\]]+)(?:"|')\\]`);
  const match = selector.match(re);
  return match?.[1];
}

/**
 * anchor 정보로부터 소스 파일:라인 후보를 해석한다.
 * reactSource 우선, 그다음 selector 의 data-testid / id 속성,
 * 마지막으로 reactPath 컴포넌트 이름을 grep 한다.
 */
export async function resolveAnchorLocation(
  projectRoot: string,
  anchor: WidgetAnchor
): Promise<LocationCandidate[]> {
  const out: LocationCandidate[] = [];

  if (anchor.reactSource?.fileName) {
    out.push({
      file: anchor.reactSource.fileName,
      line: anchor.reactSource.lineNumber ?? 1,
      evidence: `reactSource ${anchor.reactSource.componentName}`,
      kind: "reactSource",
      confidence: 1
    });
    if (out.length >= MAX_CANDIDATES) return out;
  }

  const files = await walkSources(projectRoot);

  const testid = extractSelectorAttribute(anchor.selector, "data-testid");
  if (testid) {
    const re = new RegExp(`data-testid=(?:"|')${testid}(?:"|')`);
    for (const match of await grepAll(
      files,
      re,
      () => `data-testid="${testid}"`
    )) {
      out.push({
        file: relative(projectRoot, match.file).replace(/\\/g, "/"),
        line: match.line,
        evidence: match.evidence,
        kind: "testid",
        confidence: 0.8
      });
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }

  const idAttr = extractSelectorAttribute(anchor.selector, "id");
  if (idAttr) {
    const re = new RegExp(`id=(?:"|')${idAttr}(?:"|')`);
    for (const match of await grepAll(files, re, () => `id="${idAttr}"`)) {
      out.push({
        file: relative(projectRoot, match.file).replace(/\\/g, "/"),
        line: match.line,
        evidence: match.evidence,
        kind: "id-attr",
        confidence: 0.8
      });
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }

  if (anchor.reactPath && anchor.reactPath.length > 0) {
    for (const name of anchor.reactPath) {
      const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `(?:export\\s+(?:default\\s+)?function\\s+${safe}\\s*\\(|function\\s+${safe}\\s*\\(|const\\s+${safe}\\s*=\\s*(?:memo\\(|forwardRef\\(|\\())`
      );
      for (const match of await grepAll(
        files,
        re,
        (m) => `matched component ${name}: ${m[0].slice(0, 50)}`
      )) {
        out.push({
          file: relative(projectRoot, match.file).replace(/\\/g, "/"),
          line: match.line,
          evidence: match.evidence,
          kind: "reactPath",
          confidence: 0.5
        });
        if (out.length >= MAX_CANDIDATES) return out;
      }
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }

  return out;
}
