import * as RTooltip from "@radix-ui/react-tooltip";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = RTooltip.Provider;

export function Tooltip({
  children,
  content,
  side = "top",
  delayDuration = 300,
  ...props
}: {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
} & ComponentProps<typeof RTooltip.Root>) {
  return (
    <RTooltip.Root delayDuration={delayDuration} {...props}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 max-w-xs rounded-md bg-foreground/95 px-2.5 py-1.5 text-xs font-medium text-background shadow-soft-md",
            "data-[state=delayed-open]:animate-scale-in"
          )}
        >
          {content}
          <RTooltip.Arrow className="fill-foreground/95" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
