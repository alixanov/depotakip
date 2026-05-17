import * as RTabs from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Shadcn-style Tabs over Radix. Replaces the four hand-rolled TabButton
 * variants spread across depo/finans/raporlar/notifications. Adds free
 * keyboard navigation (← → home/end), role="tablist", aria-selected.
 */
export const Tabs = RTabs.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof RTabs.List>) {
  return (
    <RTabs.List
      className={cn("inline-flex h-11 items-center justify-start gap-1 border-b", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 text-sm font-semibold text-muted-foreground transition-colors -mb-px",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:border-primary data-[state=active]:text-primary",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RTabs.Content>) {
  return (
    <RTabs.Content
      className={cn(
        "mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  );
}
