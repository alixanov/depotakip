import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Shimmering placeholder block (sweep gradient instead of opacity pulse).
 * Use for loading states instead of plain "Yükleniyor…" text — preserves
 * layout and feels more premium than a pulse.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-shimmer rounded-md", className)}
      aria-busy="true"
      aria-live="polite"
      {...props}
    />
  );
}
