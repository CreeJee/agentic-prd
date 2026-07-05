import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadManifest, MANIFEST_NAME, saveManifest } from "../manifest";

let dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "manifest-test-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  dirs = [];
});

describe("manifest", () => {
  it("returns empty manifest when file missing", async () => {
    const dir = tmp();
    const manifest = await loadManifest(dir);
    expect(manifest.byId).toEqual({});
  });

  it("round-trips manifest to disk", async () => {
    const dir = tmp();
    await saveManifest(dir, {
      byId: {
        abc: { file: "checkout.md", syncedAt: 100 },
      },
    });
    const raw = readFileSync(join(dir, MANIFEST_NAME), "utf8");
    expect(JSON.parse(raw)).toEqual({
      byId: {
        abc: { file: "checkout.md", syncedAt: 100 },
      },
    });
    const roundTripped = await loadManifest(dir);
    expect(roundTripped.byId["abc"]?.file).toBe("checkout.md");
  });

  it("survives malformed manifest by returning empty", async () => {
    const dir = tmp();
    writeFileSync(join(dir, MANIFEST_NAME), "{ not json");
    const manifest = await loadManifest(dir);
    expect(manifest.byId).toEqual({});
  });
});
