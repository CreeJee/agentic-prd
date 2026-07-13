import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  handleDeleteSpec,
  handleGetSpec,
  handleListSpecs,
  handlePutSpec,
  handleSyncAll,
} from "../handlers/specs";
import type { DevStorage, SpecRow } from "../storage";

function makeFake(rows: SpecRow[]): DevStorage {
  const store = new Map(rows.map((r) => [r.id, r]));
  return {
    async listThreads() {
      return [];
    },
    async getThread() {
      return null;
    },
    async insertThread(row) {
      return row;
    },
    async patchThread() {
      return null;
    },
    async appendComment() {
      return null;
    },
    async deleteThread() {
      return false;
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
    async upsertSpec(row) {
      store.set(row.id, row);
      return row;
    },
    async deleteSpec(id) {
      return store.delete(id);
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

  it("returns null for a missing spec", async () => {
    const s = makeFake([row]);
    const res = await handleGetSpec(s, "missing");
    expect(res).toBeNull();
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

  it("creates or replaces a spec via putSpec", async () => {
    const s = makeFake([]);
    const res = await handlePutSpec(s, "new-id", {
      path: "/cart",
      title: "Cart",
      body: "cart body",
      updatedBy: "tester",
    });
    expect(res.id).toBe("new-id");
    expect(res.path).toBe("/cart");
    expect(res.title).toBe("Cart");
    expect(res.body).toBe("cart body");
    expect(res.status).toBe("DRAFT");
    const stored = await s.getSpec("new-id");
    expect(stored?.title).toBe("Cart");
  });

  it("preserves externalUrl through putSpec round-trip", async () => {
    const s = makeFake([]);
    const res = await handlePutSpec(s, "new-id", {
      path: "/cart",
      externalUrl: "https://example.com/doc",
    });
    expect(res.externalUrl).toBe("https://example.com/doc");
  });

  it("deletes a spec", async () => {
    const s = makeFake([row]);
    const res = await handleDeleteSpec(s, "aaaaaaaa1111");
    expect(res).toBe(true);
    expect(await s.getSpec("aaaaaaaa1111")).toBeNull();
  });

  it("returns false when deleting a missing spec", async () => {
    const s = makeFake([row]);
    const res = await handleDeleteSpec(s, "missing");
    expect(res).toBe(false);
  });
});
