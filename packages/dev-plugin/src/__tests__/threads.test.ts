import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  handleGetThread,
  handleListThreads,
  handleSetResolved,
  handleThreadLocation,
} from "../handlers/threads";
import type { DevSupabase, ThreadRow } from "../supabase";

function makeFake(rows: ThreadRow[]): DevSupabase {
  const store = new Map(rows.map((r) => [r.id, { ...r }]));
  return {
    async listThreads({ path, resolved }) {
      return Array.from(store.values()).filter(
        (r) =>
          (!path || r.path === path) &&
          (typeof resolved !== "boolean" || r.resolved === resolved),
      );
    },
    async getThread(id) {
      return store.get(id) ?? null;
    },
    async setThreadResolved(id, resolved) {
      const row = store.get(id);
      if (!row) throw new Error("not found");
      row.resolved = resolved;
      return row;
    },
    async listSpecs() {
      return [];
    },
    async getSpec() {
      return null;
    },
  };
}

const row: ThreadRow = {
  id: "t1",
  path: "/",
  x_pct: 0,
  y_pct: 0,
  anchor: {
    selector: '[data-testid="row-1"]',
    relX: 0,
    relY: 0,
    reactPath: ["App"],
  },
  resolved: false,
  comments: [{ id: "c1", author: "A", text: "hi", at: 1 }],
  updated_at: new Date(0).toISOString(),
};

describe("threads handlers", () => {
  it("lists unresolved threads only when filter set", async () => {
    const s = makeFake([row, { ...row, id: "t2", resolved: true }]);
    const res = await handleListThreads(s, { resolved: false });
    expect(res.map((t) => t.id)).toEqual(["t1"]);
  });

  it("returns a single thread with normalized comments", async () => {
    const s = makeFake([row]);
    const res = await handleGetThread(s, "t1");
    expect(res?.id).toBe("t1");
    expect(res?.comments[0]?.text).toBe("hi");
  });

  it("toggles resolved via setResolved handler", async () => {
    const s = makeFake([row]);
    const res = await handleSetResolved(s, "t1", true);
    expect(res.resolved).toBe(true);
  });

  it("returns location candidates for anchor testid", async () => {
    const s = makeFake([row]);
    const tmpRoot = mkdtempSync(join(tmpdir(), "threads-loc-"));
    const res = await handleThreadLocation(s, tmpRoot, "t1");
    expect(res).toEqual({ candidates: [] });
  });
});
