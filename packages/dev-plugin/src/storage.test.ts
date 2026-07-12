import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileStorage, type SpecRow, type ThreadRow } from "./storage.js";

function tmpDataDir(): string {
  return join(mkdtempSync(join(tmpdir(), "agentic-prd-")), ".agentic-prd");
}

function threadRow(
  id: string,
  path = "/products",
  resolved = false
): ThreadRow {
  return {
    id,
    path,
    x_pct: 10,
    y_pct: 20,
    anchor: null,
    resolved,
    comments: [{ id: `${id}_c1`, author: "a", text: "t", at: 1 }],
    updated_at: "2026-07-12T00:00:00.000Z",
  };
}

function specRow(id: string, path = "/products", title = "정책"): SpecRow {
  return {
    id,
    path,
    title,
    status: "DRAFT",
    sections: { body: "## 본문" },
    updated_by: "me",
    updated_at: "2026-07-12T00:00:00.000Z",
  };
}

describe("createFileStorage threads", () => {
  it("insertThread 후 getThread/listThreads 로 왕복된다", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1"));
    expect(await storage.getThread("t1")).toMatchObject({
      id: "t1",
      path: "/products",
    });
    expect(await storage.listThreads({})).toHaveLength(1);
  });

  it("path / resolved / limit 필터가 동작한다", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1", "/products", false));
    await storage.insertThread(threadRow("t2", "/cart", true));
    expect(await storage.listThreads({ path: "/cart" })).toHaveLength(1);
    expect(await storage.listThreads({ resolved: false })).toHaveLength(1);
    expect(await storage.listThreads({ limit: 1 })).toHaveLength(1);
  });

  it("patchThread 는 부분 갱신하고 updated_at 을 갱신하며, 없는 id 는 null", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1"));
    const patched = await storage.patchThread("t1", { resolved: true });
    expect(patched?.resolved).toBe(true);
    expect(patched?.x_pct).toBe(10);
    expect(patched?.updated_at).not.toBe("2026-07-12T00:00:00.000Z");
    expect(await storage.patchThread("nope", { resolved: true })).toBeNull();
  });

  it("appendComment 는 comments 배열 끝에 추가한다", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1"));
    const next = await storage.appendComment("t1", {
      id: "c2",
      author: "agent",
      text: "수정했습니다",
      at: 2,
    });
    expect(next?.comments).toHaveLength(2);
    expect(
      await storage.appendComment("nope", {
        id: "c",
        author: "a",
        text: "t",
        at: 1,
      })
    ).toBeNull();
  });

  it("deleteThread 는 성공 시 true, 없는 id 는 false", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1"));
    expect(await storage.deleteThread("t1")).toBe(true);
    expect(await storage.deleteThread("t1")).toBe(false);
  });

  it("listThreads 는 updated_at 최신순으로 정렬하고 limit 은 최신 것부터 자른다", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t-old"));
    await storage.insertThread({
      ...threadRow("t-new"),
      updated_at: "2026-07-12T01:00:00.000Z",
    });
    const all = await storage.listThreads({});
    expect(all.map((r) => r.id)).toEqual(["t-new", "t-old"]);
    const limited = await storage.listThreads({ limit: 1 });
    expect(limited[0]?.id).toBe("t-new");
  });

  it("insertThread 는 동일 id 를 교체한다 (길이 유지)", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.insertThread(threadRow("t1", "/products"));
    await storage.insertThread(threadRow("t1", "/cart"));
    const rows = await storage.listThreads({});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.path).toBe("/cart");
  });
});

describe("createFileStorage specs", () => {
  it("upsertSpec → getSpec/listSpecs/deleteSpec 왕복", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.upsertSpec({
      id: "s1",
      path: "/products",
      title: "정책",
      status: "DRAFT",
      sections: { body: "## 본문" },
      updated_by: "me",
      updated_at: "2026-07-12T00:00:00.000Z",
    });
    expect(await storage.getSpec("s1")).toMatchObject({ title: "정책" });
    expect(await storage.listSpecs({ path: "/products" })).toHaveLength(1);
    expect(await storage.deleteSpec("s1")).toBe(true);
    expect(await storage.getSpec("s1")).toBeNull();
  });

  it("listSpecs 는 필터 없이 전체를 반환한다", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.upsertSpec(specRow("s1", "/products"));
    await storage.upsertSpec(specRow("s2", "/cart"));
    expect(await storage.listSpecs({})).toHaveLength(2);
  });

  it("upsertSpec 은 동일 id 를 교체한다 (길이 유지)", async () => {
    const storage = createFileStorage(tmpDataDir());
    await storage.upsertSpec(specRow("s1", "/products", "이전"));
    await storage.upsertSpec(specRow("s1", "/products", "갱신"));
    const rows = await storage.listSpecs({});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("갱신");
  });
});

describe("createFileStorage 손상 복구", () => {
  it("깨진 JSON 은 .bak 으로 백업하고 빈 저장소로 시작한다", async () => {
    const dataDir = tmpDataDir();
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "comments.json"), "{ broken", "utf8");
    const storage = createFileStorage(dataDir);
    expect(await storage.listThreads({})).toEqual([]);
    expect(existsSync(join(dataDir, "comments.json.bak"))).toBe(true);
    expect(readFileSync(join(dataDir, "comments.json.bak"), "utf8")).toBe(
      "{ broken"
    );
  });

  it("배열이 아닌 JSON 도 .bak 으로 백업하고 빈 저장소로 시작한다", async () => {
    const dataDir = tmpDataDir();
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "comments.json"), "{}", "utf8");
    const storage = createFileStorage(dataDir);
    expect(await storage.listThreads({})).toEqual([]);
    expect(existsSync(join(dataDir, "comments.json.bak"))).toBe(true);
  });

  it("쓰기는 pretty JSON 파일로 남는다 (git diff 가능)", async () => {
    const dataDir = tmpDataDir();
    const storage = createFileStorage(dataDir);
    await storage.insertThread(threadRow("t1"));
    const raw = readFileSync(join(dataDir, "comments.json"), "utf8");
    expect(raw).toContain("\n  {");
  });

  it("쓰기 후 임시 파일(.tmp)이 남지 않는다", async () => {
    const dataDir = tmpDataDir();
    const storage = createFileStorage(dataDir);
    await storage.insertThread(threadRow("t1"));
    expect(existsSync(join(dataDir, "comments.json.tmp"))).toBe(false);
  });
});
