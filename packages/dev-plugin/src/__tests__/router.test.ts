import { describe, expect, it } from "vitest";
import { matchRoute } from "../router";

describe("matchRoute", () => {
  it("matches GET /threads", () => {
    const r = matchRoute("GET", "/threads");
    expect(r?.kind).toBe("listThreads");
    expect(r?.params).toEqual({});
  });

  it("captures :id in GET /threads/:id", () => {
    const r = matchRoute("GET", "/threads/abc");
    expect(r?.kind).toBe("getThread");
    expect(r?.params).toEqual({ id: "abc" });
  });

  it("distinguishes POST /threads/:id/resolve and /unresolve", () => {
    expect(matchRoute("POST", "/threads/x/resolve")?.kind).toBe(
      "resolveThread"
    );
    expect(matchRoute("POST", "/threads/x/unresolve")?.kind).toBe(
      "unresolveThread"
    );
  });

  it("captures :id in GET /threads/:id/location", () => {
    const r = matchRoute("GET", "/threads/xyz/location");
    expect(r?.kind).toBe("threadLocation");
    expect(r?.params).toEqual({ id: "xyz" });
  });

  it("matches specs routes", () => {
    expect(matchRoute("GET", "/specs")?.kind).toBe("listSpecs");
    expect(matchRoute("GET", "/specs/1")?.kind).toBe("getSpec");
    expect(matchRoute("POST", "/specs/sync")?.kind).toBe("syncSpecs");
    expect(matchRoute("POST", "/specs/1/sync")?.kind).toBe("syncOneSpec");
  });

  it("returns null on unknown route", () => {
    expect(matchRoute("PUT", "/threads")).toBeNull();
    expect(matchRoute("GET", "/nope")).toBeNull();
  });
});
