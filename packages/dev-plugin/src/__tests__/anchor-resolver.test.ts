import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAnchorLocation } from "../anchor-resolver";

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "anchor-test-"));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, contents, "utf8");
  }
  return root;
}

describe("resolveAnchorLocation", () => {
  it("returns reactSource directly when populated", async () => {
    const root = makeProject({});
    const result = await resolveAnchorLocation(root, {
      selector: "*",
      relX: 0,
      relY: 0,
      reactSource: {
        componentName: "App",
        fileName: "apps/playground/src/App.tsx",
        lineNumber: 42,
        columnNumber: 3
      }
    });
    expect(result[0]).toMatchObject({
      file: "apps/playground/src/App.tsx",
      line: 42,
      kind: "reactSource",
      confidence: 1
    });
  });

  it("grep-locates data-testid attribute value", async () => {
    const root = makeProject({
      "apps/playground/src/App.tsx": [
        "export function App() {",
        "  return <li data-testid=\"row-11\">항목 12</li>;",
        "}"
      ].join("\n")
    });
    const result = await resolveAnchorLocation(root, {
      selector: "[data-testid=\"row-11\"]",
      relX: 0,
      relY: 0
    });
    expect(result[0]).toMatchObject({
      file: "apps/playground/src/App.tsx",
      line: 2,
      kind: "testid",
      confidence: 0.8
    });
  });

  it("grep-locates named function component via reactPath", async () => {
    const root = makeProject({
      "packages/widget/src/CommentWidget.tsx": [
        "export function CommentWidget() {",
        "  return null;",
        "}"
      ].join("\n")
    });
    const result = await resolveAnchorLocation(root, {
      selector: "div",
      relX: 0,
      relY: 0,
      reactPath: ["CommentWidget", "App"]
    });
    expect(result[0]).toMatchObject({
      file: "packages/widget/src/CommentWidget.tsx",
      line: 1,
      kind: "reactPath",
      confidence: 0.5
    });
  });

  it("returns empty when nothing matches", async () => {
    const root = makeProject({});
    const result = await resolveAnchorLocation(root, {
      selector: "*",
      relX: 0,
      relY: 0
    });
    expect(result).toEqual([]);
  });
});
