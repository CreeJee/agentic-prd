import { describe, expect, it } from "vitest";
import { resolveCollisions, slugify } from "../slug";

describe("slugify", () => {
  it("kebab-cases ASCII input", () => {
    expect(slugify("Checkout Flow")).toBe("checkout-flow");
  });

  it("preserves Korean characters", () => {
    expect(slugify("결제 흐름")).toBe("결제-흐름");
  });

  it("collapses whitespace/dashes and trims", () => {
    expect(slugify("  Multi   Word   Title  ")).toBe("multi-word-title");
    expect(slugify("-a---b-")).toBe("a-b");
  });

  it("returns 'untitled' for empty input", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("   ")).toBe("untitled");
  });
});

describe("resolveCollisions", () => {
  it("returns <slug>.md for unique slug", () => {
    const result = resolveCollisions([
      { id: "aaaaaaaa1111", title: "Checkout" },
    ]);
    expect(result.get("aaaaaaaa1111")).toBe("checkout.md");
  });

  it("returns <slug>-<idShort>.md for every colliding entry", () => {
    const result = resolveCollisions([
      { id: "aaaaaaaa1111", title: "Checkout" },
      { id: "bbbbbbbb2222", title: "checkout" },
    ]);
    const first = result.get("aaaaaaaa1111");
    const second = result.get("bbbbbbbb2222");
    expect(first).toMatch(/^checkout-[0-9a-f]{8}\.md$/);
    expect(second).toMatch(/^checkout-[0-9a-f]{8}\.md$/);
    expect(first).not.toBe(second);
  });

  it("disambiguates non-UUID ids that share a prefix", () => {
    /** 실제 저장소의 id 는 `spec_<epoch>_<random>` 형태라 앞자리 slice 는 collision. */
    const result = resolveCollisions([
      { id: "spec_mqqhbnld_9ntku", title: "새 문서" },
      { id: "spec_mqqoykuz_37wpl", title: "새 문서" },
      { id: "spec_mqqjz994_hnp93", title: "새 문서" },
      { id: "spec_mqqkg41m_15xhb", title: "새 문서" },
    ]);
    const filenames = Array.from(result.values());
    expect(new Set(filenames).size).toBe(4);
    for (const name of filenames) {
      expect(name).toMatch(/^새-문서-[0-9a-f]{8}\.md$/);
    }
  });

  it("does not collide when slugs differ", () => {
    const result = resolveCollisions([
      { id: "id1", title: "A" },
      { id: "id2", title: "B" },
    ]);
    expect(result.get("id1")).toBe("a.md");
    expect(result.get("id2")).toBe("b.md");
  });
});
