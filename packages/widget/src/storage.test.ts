import { afterEach, describe, expect, it, vi } from "vitest";
import { devServerStorage } from "./storage";

function mockFetchOnce(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("devServerStorage", () => {
  it("fetchThreads 는 DTO 를 CommentThread 로 매핑하고 updatedAt 오름차순 정렬한다", async () => {
    mockFetchOnce(200, [
      {
        id: "b",
        path: "/p",
        xPct: 1,
        yPx: 2,
        resolved: false,
        updatedAt: 2,
        comments: [],
        anchor: null,
      },
      {
        id: "a",
        path: "/p",
        xPct: 3,
        yPx: 4,
        resolved: true,
        updatedAt: 1,
        comments: [],
        anchor: null,
      },
    ]);
    const threads = await devServerStorage().fetchThreads("/p");
    expect(threads.map((t) => t.id)).toEqual(["a", "b"]);
    expect(threads[0]).toMatchObject({ xPct: 3, yPx: 4, resolved: true });
  });

  it("insertThread 는 POST /threads 로 보낸다", async () => {
    const fn = mockFetchOnce(201, { id: "t1" });
    await devServerStorage().insertThread({
      id: "t1",
      path: "/p",
      xPct: 1,
      yPx: 2,
      anchor: null,
      resolved: false,
      comments: [],
    });
    expect(fn).toHaveBeenCalledWith(
      "/__agentic-prd/threads",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("엔드포인트 실패 시 throw 하지 않고 빈 결과 + console.warn 1회", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = devServerStorage();
    expect(await storage.fetchThreads("/p")).toEqual([]);
    expect(await storage.fetchSpecs("/p")).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("prefix 커스텀이 URL 에 반영된다", async () => {
    const fn = mockFetchOnce(200, []);
    await devServerStorage("/__custom").fetchThreads("/p");
    expect(fn).toHaveBeenCalledWith(
      "/__custom/threads?path=%2Fp",
      expect.anything()
    );
  });
});
