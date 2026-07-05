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
      </Popover>,
    );

    const popup = screen.getByTestId("popup");
    expect(host.contains(popup)).toBe(true);
    expect(document.body.querySelector("[data-testid='popup']")).toBe(popup);
    /** 확인: popup 이 host 밖 body 직속으로 새어나오지 않았는지 */
    const bodyChildren = Array.from(document.body.children);
    expect(bodyChildren.some((n) => n !== host && n.contains(popup))).toBe(
      false,
    );

    document.body.removeChild(host);
  });
});
