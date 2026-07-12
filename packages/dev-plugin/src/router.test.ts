import { describe, expect, it } from "vitest";
import { matchRoute } from "./router.js";

describe("matchRoute 쓰기 라우트", () => {
  it("POST /threads → createThread", () => {
    expect(matchRoute("POST", "/threads")).toMatchObject({
      kind: "createThread",
    });
  });
  it("PATCH /threads/:id → patchThread", () => {
    expect(matchRoute("PATCH", "/threads/t1")).toMatchObject({
      kind: "patchThread",
      params: { id: "t1" },
    });
  });
  it("DELETE /threads/:id → deleteThread", () => {
    expect(matchRoute("DELETE", "/threads/t1")).toMatchObject({
      kind: "deleteThread",
    });
  });
  it("POST /threads/:id/comments → appendComment", () => {
    expect(matchRoute("POST", "/threads/t1/comments")).toMatchObject({
      kind: "appendComment",
      params: { id: "t1" },
    });
  });
  it("PUT /specs/:id → putSpec, DELETE /specs/:id → deleteSpec", () => {
    expect(matchRoute("PUT", "/specs/s1")).toMatchObject({ kind: "putSpec" });
    expect(matchRoute("DELETE", "/specs/s1")).toMatchObject({
      kind: "deleteSpec",
    });
  });
  it("기존 라우트 회귀: resolve/sync 는 그대로", () => {
    expect(matchRoute("POST", "/threads/t1/resolve")).toMatchObject({
      kind: "resolveThread",
    });
    expect(matchRoute("POST", "/specs/sync")).toMatchObject({
      kind: "syncSpecs",
    });
    expect(matchRoute("GET", "/threads/t1")).toMatchObject({
      kind: "getThread",
    });
  });
});
