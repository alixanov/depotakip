import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-soft",
        "ring-offset-background placeholder:text-muted-foreground/70",
        "transition-[box-shadow,border-color] duration-150 resize-y",
        "hover:border-foreground/20",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
