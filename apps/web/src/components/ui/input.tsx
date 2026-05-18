import type { ComponentProps, FocusEvent } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, onFocus, ...props }: ComponentProps<"input">) {
  // For `number` fields, auto-select existing value on focus so typing replaces
  // it instead of appending — without this, a field showing "0" + typing "55"
  // visually looks like "055" until React re-renders the parsed state.
  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (type === "number") e.currentTarget.select();
    onFocus?.(e);
  };

  return (
    <input
      type={type}
      onFocus={handleFocus}
      className={cn(
        "flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-soft",
        "ring-offset-background placeholder:text-muted-foreground/70",
        "transition-[box-shadow,border-color] duration-150",
        "hover:border-foreground/20",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15",
        // a11y: visual hook when consumer sets aria-invalid="true" (drives RHF
        // server errors, type-mismatch, etc.). Destructive border + soft ring
        // matches the focus treatment to give a continuous error→focus story.
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  );
}
