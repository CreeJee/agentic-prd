import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import type { Point } from "../anchor";
import { cn } from "../cn";

type PointPopoverProps = {
  point: Point;
  children: ReactNode;
  className?: string;
} & Pick<ComponentProps<typeof PopoverContent>, "align" | "sideOffset">;

/** 뷰포트 좌표를 PDS Popover anchor로 변환해 collision/flip 처리를 Radix에 위임한다. */
export function PointPopover({
  point,
  children,
  className,
  align = "start",
  sideOffset = 18,
}: PointPopoverProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const side = point.x < window.innerWidth * 0.55 ? "right" : "left";

  return (
    <div ref={setContainer} className="contents">
      <Popover open>
        <PopoverTrigger
          aria-hidden
          style={{ left: point.x, top: point.y }}
          className="pointer-events-none fixed size-px"
        >
        </PopoverTrigger>
        {container ? (
          <PopoverContent
            side={side}
            align={align}
            sideOffset={sideOffset}
            // collisionPadding={12}
            // onOpenAutoFocus={(event) => event.preventDefault()}
            className={cn(
              "pointer-events-auto max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-xl",
              className
            )}
          >
            {children}
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  );
}
