import { describe, expect, it } from "vitest";
import { slugify, resolveCollisions } from "../slug";

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
      { id: "aaaaaaaa1111", title: "Checkout" }
    ]);
    expect(result.get("aaaaaaaa1111")).toBe("checkout.md");
  });

  it("returns <slug>-<idShort>.md for every colliding entry", () => {
    const result = resolveCollisions([
      { id: "aaaaaaaa1111", title: "Checkout" },
      { id: "bbbbbbbb2222", title: "checkout" }
    ]);
    expect(result.get("aaaaaaaa1111")).toBe("checkout-aaaaaaaa.md");
    expect(result.get("bbbbbbbb2222")).toBe("checkout-bbbbbbbb.md");
  });

  it("does not collide when slugs differ", () => {
    const result = resolveCollisions([
      { id: "id1", title: "A" },
      { id: "id2", title: "B" }
    ]);
    expect(result.get("id1")).toBe("a.md");
    expect(result.get("id2")).toBe("b.md");
  });
});
