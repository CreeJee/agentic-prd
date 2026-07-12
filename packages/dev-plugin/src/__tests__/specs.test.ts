import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  handleGetSpec,
  handleListSpecs,
  handleSyncAll,
} from "../handlers/specs";
import type { DevSupabase, SpecRow } from "../supabase";

function makeFake(rows: SpecRow[]): DevSupabase {
  const store = new Map(rows.map((r) => [r.id, r]));
  return {
    async listThreads() {
      return [];
    },
    async getThread() {
      return null;
    },
    async setThreadResolved() {
      throw new Error("unused");
    },
    async listSpecs({ path }) {
      return Array.from(store.values()).filter((r) => !path || r.path === path);
    },
    async getSpec(id) {
      return store.get(id) ?? null;
    },
  };
}

const row: SpecRow = {
  id: "aaaaaaaa1111",
  path: "/",
  title: "Checkout",
  status: "DRAFT",
  sections: { body: "# hello" },
  updated_by: "tester",
  updated_at: new Date(0).toISOString(),
};

describe("specs handlers", () => {
  it("lists specs", async () => {
    const s = makeFake([row]);
    const res = await handleListSpecs(s, {});
    expect(res).toHaveLength(1);
    expect(res[0]?.title).toBe("Checkout");
  });

  it("returns single spec with body", async () => {
    const s = makeFake([row]);
    const res = await handleGetSpec(s, "aaaaaaaa1111");
    expect(res?.body).toBe("# hello");
  });

  it("syncs unique-slug spec to <slug>.md", async () => {
    const s = makeFake([row]);
    const dir = mkdtempSync(join(tmpdir(), "sync-"));
    const res = await handleSyncAll(s, dir, {});
    expect(res.synced[0]?.localPath.endsWith("checkout.md")).toBe(true);
    expect(res.synced[0]?.collided).toBe(false);
    const file = readFileSync(res.synced[0]!.localPath, "utf8");
    expect(file).toContain("agentic-prd:spec id=aaaaaaaa1111");
    expect(file).toContain("# Checkout");
    expect(file).toContain("# hello");
  });

  it("syncs colliding specs with idShort suffix", async () => {
    const s = makeFake([
      row,
      { ...row, id: "bbbbbbbb2222", title: "checkout" },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "sync2-"));
    const res = await handleSyncAll(s, dir, {});
    const names = res.synced.map((r) => r.localPath.split(/[\\/]/).pop());
    expect(names).toHaveLength(2);
    for (const name of names) {
      expect(name).toMatch(/^checkout-[0-9a-f]{8}\.md$/);
    }
    expect(new Set(names).size).toBe(2);
    expect(res.synced.every((r) => r.collided)).toBe(true);
  });
});
