import type { ComponentProps, ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Point } from "../anchor";
import { cn } from "../cn";
import { useWidgetPortalContainer } from "../WidgetProvider";

type PointPopoverProps = {
  point: Point;
  children: ReactNode;
  className?: string;
} & Pick<ComponentProps<typeof PopoverContent>, "align" | "sideOffset">;

/**
 * 뷰포트 좌표를 base-ui Popover anchor 로 변환해 collision/flip 처리를 위임한다.
 * portal 대상은 WidgetProvider 가 제공하는 위젯 stacking context 내부의 host 다
 * (host dialog 와 z-index 가 겹쳐도 위젯 canvas 가 항상 상위 stacking context 라 안정).
 */
export function PointPopover({
  point,
  children,
  className,
  align = "start",
  sideOffset = 18,
}: PointPopoverProps) {
  const side = point.x < window.innerWidth * 0.55 ? "right" : "left";
  const container = useWidgetPortalContainer();
  if (!container) return null;

  return (
    <Popover open>
      <PopoverTrigger
        aria-hidden
        style={{ left: point.x, top: point.y }}
        className="pointer-events-none fixed size-px"
      />
      <PopoverContent
        container={container}
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "pointer-events-auto max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-xl",
          className
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
