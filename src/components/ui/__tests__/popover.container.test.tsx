import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

describe("PopoverContent container", () => {
  it("renders popup inside the provided container element, not document.body", () => {
    const host = document.createElement("div");
    host.id = "widget-portal";
    document.body.appendChild(host);

    render(
      <Popover open>
        <PopoverTrigger>trigger</PopoverTrigger>
        <PopoverContent container={host} data-testid="popup">
          content
        </PopoverContent>
      </Popover>
    );

    const popup = screen.getByTestId("popup");
    expect(host.contains(popup)).toBe(true);
    expect(document.body.querySelector("[data-testid='popup']")).toBe(popup);
    /** 확인: popup 이 host 밖 body 직속으로 새어나오지 않았는지 */
    const bodyChildren = Array.from(document.body.children);
    expect(bodyChildren.some((n) => n !== host && n.contains(popup))).toBe(
      false
    );

    document.body.removeChild(host);
  });

  it("falls back to document.body when no container prop is provided", () => {
    const host = document.createElement("div");
    host.id = "unused-widget-portal";
    document.body.appendChild(host);

    render(
      <Popover open>
        <PopoverTrigger>trigger</PopoverTrigger>
        <PopoverContent data-testid="popup">content</PopoverContent>
      </Popover>
    );

    const popup = screen.getByTestId("popup");
    /** container 미지정 시 base-ui 기본 동작: portal 이 document.body 로 감. */
    expect(host.contains(popup)).toBe(false);
    /** popup 의 최상위 조상이 body 안에 있어야 하고, 그 조상이 host 가 아니어야 한다. */
    let node: Node | null = popup;
    while (node?.parentNode && node.parentNode !== document.body) {
      node = node.parentNode;
    }
    expect(node?.parentNode).toBe(document.body);
    expect(node).not.toBe(host);

    document.body.removeChild(host);
  });
});
