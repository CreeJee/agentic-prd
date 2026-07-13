import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  handleAppendComment,
  handleCreateThread,
  handleDeleteThread,
  handleGetThread,
  handleListThreads,
  handlePatchThread,
  handleSetResolved,
  handleThreadLocation,
} from "../handlers/threads";
import type {
  CommentEntry,
  DevStorage,
  ThreadPatch,
  ThreadRow,
} from "../storage";

function makeFake(rows: ThreadRow[]): DevStorage {
  const store = new Map(rows.map((r) => [r.id, { ...r }]));
  return {
    async listThreads({ path, resolved }) {
      return Array.from(store.values()).filter(
        (r) =>
          (!path || r.path === path) &&
          (typeof resolved !== "boolean" || r.resolved === resolved)
      );
    },
    async getThread(id) {
      return store.get(id) ?? null;
    },
    async insertThread(row) {
      store.set(row.id, { ...row });
      return row;
    },
    async patchThread(id: string, patch: ThreadPatch) {
      const current = store.get(id);
      if (!current) return null;
      const next: ThreadRow = {
        ...current,
        ...(patch.x_pct !== undefined ? { x_pct: patch.x_pct } : {}),
        ...(patch.y_pct !== undefined ? { y_pct: patch.y_pct } : {}),
        ...(patch.anchor !== undefined ? { anchor: patch.anchor } : {}),
        ...(patch.resolved !== undefined ? { resolved: patch.resolved } : {}),
        ...(patch.comments !== undefined ? { comments: patch.comments } : {}),
        updated_at: new Date().toISOString(),
      };
      store.set(id, next);
      return next;
    },
    async appendComment(id: string, comment: CommentEntry) {
      const current = store.get(id);
      if (!current) return null;
      const comments = Array.isArray(current.comments)
        ? [...(current.comments as CommentEntry[]), comment]
        : [comment];
      const next: ThreadRow = {
        ...current,
        comments,
        updated_at: new Date().toISOString(),
      };
      store.set(id, next);
      return next;
    },
    async deleteThread(id: string) {
      return store.delete(id);
    },
    async setThreadResolved(id: string, resolved: boolean) {
      const current = store.get(id);
      if (!current) return null;
      const next: ThreadRow = {
        ...current,
        resolved,
        updated_at: new Date().toISOString(),
      };
      store.set(id, next);
      return next;
    },
    async listSpecs() {
      return [];
    },
    async getSpec() {
      return null;
    },
    async upsertSpec(row) {
      return row;
    },
    async deleteSpec() {
      return false;
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
    expect(res?.xPct).toBe(0);
    expect(res?.yPx).toBe(0);
    expect(res?.comments[0]?.text).toBe("hi");
  });

  it("toggles resolved via setResolved handler", async () => {
    const s = makeFake([row]);
    const res = await handleSetResolved(s, "t1", true);
    expect(res?.resolved).toBe(true);
  });

  it("returns null from setResolved when thread is missing", async () => {
    const s = makeFake([row]);
    const res = await handleSetResolved(s, "missing", true);
    expect(res).toBeNull();
  });

  it("returns location candidates for anchor testid", async () => {
    const s = makeFake([row]);
    const tmpRoot = mkdtempSync(join(tmpdir(), "threads-loc-"));
    const res = await handleThreadLocation(s, tmpRoot, "t1");
    expect(res).toEqual({ candidates: [] });
  });

  it("creates a thread from input", async () => {
    const s = makeFake([]);
    const res = await handleCreateThread(s, {
      id: "t3",
      path: "/cart",
      xPct: 12,
      yPx: 34,
    });
    expect(res.id).toBe("t3");
    expect(res.path).toBe("/cart");
    expect(res.xPct).toBe(12);
    expect(res.yPx).toBe(34);
    expect(res.resolved).toBe(false);
    expect(res.comments).toEqual([]);
    const stored = await s.getThread("t3");
    expect(stored?.id).toBe("t3");
  });

  it("patches an existing thread", async () => {
    const s = makeFake([row]);
    const res = await handlePatchThread(s, "t1", { xPct: 50, resolved: true });
    expect(res?.xPct).toBe(50);
    expect(res?.resolved).toBe(true);
  });

  it("returns null when patching a missing thread", async () => {
    const s = makeFake([row]);
    const res = await handlePatchThread(s, "missing", { xPct: 50 });
    expect(res).toBeNull();
  });

  it("appends a comment to a thread", async () => {
    const s = makeFake([row]);
    const res = await handleAppendComment(s, "t1", {
      author: "B",
      text: "second",
    });
    expect(res?.comments).toHaveLength(2);
    expect(res?.comments[1]?.text).toBe("second");
    expect(res?.comments[1]?.author).toBe("B");
  });

  it("returns null when appending a comment to a missing thread", async () => {
    const s = makeFake([row]);
    const res = await handleAppendComment(s, "missing", {
      author: "B",
      text: "second",
    });
    expect(res).toBeNull();
  });

  it("deletes a thread", async () => {
    const s = makeFake([row]);
    const res = await handleDeleteThread(s, "t1");
    expect(res).toBe(true);
    expect(await s.getThread("t1")).toBeNull();
  });

  it("returns false when deleting a missing thread", async () => {
    const s = makeFake([row]);
    const res = await handleDeleteThread(s, "missing");
    expect(res).toBe(false);
  });
});
