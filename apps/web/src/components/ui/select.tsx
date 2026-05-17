import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Shadcn-style Radix Select. Use for long option lists (lots, carriers,
 * senders) where keyboard navigation + type-ahead matter. Native <select>
 * still fine for ≤5 mutually-exclusive options and for mobile-OS-pickers.
 */
export const Select = RSelect.Root;
export const SelectValue = RSelect.Value;
export const SelectGroup = RSelect.Group;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof RSelect.Trigger>) {
  return (
    <RSelect.Trigger
      className={cn(
        "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm",
        "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[placeholder]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <RSelect.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </RSelect.Icon>
    </RSelect.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: ComponentProps<typeof RSelect.Content>) {
  return (
    <RSelect.Portal>
      <RSelect.Content
        position={position}
        className={cn(
          "relative z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className
        )}
        {...props}
      >
        <RSelect.ScrollUpButton className="flex h-6 items-center justify-center bg-popover">
          <ChevronUp className="h-4 w-4" />
        </RSelect.ScrollUpButton>
        <RSelect.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </RSelect.Viewport>
        <RSelect.ScrollDownButton className="flex h-6 items-center justify-center bg-popover">
          <ChevronDown className="h-4 w-4" />
        </RSelect.ScrollDownButton>
      </RSelect.Content>
    </RSelect.Portal>
  );
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof RSelect.Item>) {
  return (
    <RSelect.Item
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <RSelect.ItemIndicator>
          <Check className="h-4 w-4" />
        </RSelect.ItemIndicator>
      </span>
      <RSelect.ItemText>{children}</RSelect.ItemText>
    </RSelect.Item>
  );
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof RSelect.Label>) {
  return (
    <RSelect.Label
      className={cn("py-1.5 pl-8 pr-2 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
}

export function SelectSeparator({ className, ...props }: ComponentProps<typeof RSelect.Separator>) {
  return <RSelect.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
